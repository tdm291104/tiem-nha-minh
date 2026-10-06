import type { PlayerId, Position } from '../types/game.ts';
import { StoreEconomy } from '../economy/StoreEconomy.ts';
import { CHECKOUT } from './CheckoutConfig.ts';
import { CashierStation } from './CashierStation.ts';
import type { CashierDefinition } from './CashierStation.ts';
import { orderedCashiers } from './QueueSelection.ts';
import { createSale, freezePurchase } from './SaleTransaction.ts';
import type { CustomerPurchase, SaleTransaction } from './SaleTransaction.ts';

export type PurchaseStatus = 'unassigned' | 'queued' | 'ready' | 'processing' | 'paid';
interface PurchaseRecord { items: readonly CustomerPurchase[]; status: PurchaseStatus; cashierId: string | null }
export interface QueueAssignment { kind: 'queue' | 'overflow'; position: Position; cashierId: string | null; index: number }

export class CheckoutSystem {
  readonly stations: readonly CashierStation[];
  readonly economy: StoreEconomy;
  private readonly purchases = new Map<number, PurchaseRecord>();
  private readonly overflow = new Map<number, number>();
  private readonly waitingPositions: readonly Position[];
  private readonly settings: Readonly<typeof CHECKOUT>;
  private readonly listeners = new Set<(sale: SaleTransaction) => void>();
  private nextSaleId = 1;
  private stopped = false;

  constructor(definitions: readonly CashierDefinition[], waitingPositions: readonly Position[], economy = new StoreEconomy(), settings: Readonly<typeof CHECKOUT> = CHECKOUT) {
    if (new Set(definitions.map(definition => definition.id)).size !== definitions.length) throw new RangeError('Cashier IDs must be unique');
    const positions = [...definitions.flatMap(definition => definition.queuePositions.slice(0, settings.maxQueueLength)), ...waitingPositions];
    if (positions.some(position => !Number.isFinite(position.x) || !Number.isFinite(position.y)) || new Set(positions.map(position => `${position.x},${position.y}`)).size !== positions.length) throw new RangeError('Queue and waiting positions must be finite and distinct');
    if (!Number.isFinite(settings.processingMs) || settings.processingMs <= 0) throw new RangeError('Checkout duration must be positive');
    this.stations = definitions.map(definition => new CashierStation(definition, settings.maxQueueLength));
    this.waitingPositions = waitingPositions.map(position => Object.freeze({ ...position }));
    this.economy = economy;
    this.settings = settings;
  }
  registerPurchase(customerId: number, items: readonly CustomerPurchase[]): boolean {
    if (this.stopped || this.purchases.has(customerId) || this.economy.hasServed(customerId) || items.length === 0) return false;
    if (!Number.isSafeInteger(customerId) || customerId <= 0) throw new RangeError('Customer IDs must be positive safe integers');
    this.purchases.set(customerId, { items: freezePurchase(items), status: 'unassigned', cashierId: null });
    return true;
  }
  status(customerId: number): PurchaseStatus | null { return this.purchases.get(customerId)?.status ?? null; }
  hasActiveProcessing(): boolean { return this.stations.some(station => station.state === 'PROCESSING'); }
  prepareNextDay(): boolean {
    if (this.stopped || this.hasActiveProcessing()) return false;
    for (const station of this.stations) station.clear();
    this.purchases.clear(); this.overflow.clear(); return true;
  }
  assignment(customerId: number): QueueAssignment | null {
    const cashierId = this.purchases.get(customerId)?.cashierId;
    const station = this.stations.find(candidate => candidate.id === cashierId);
    const position = station?.queue.positionFor(customerId);
    if (station && position) return { kind: 'queue', cashierId: station.id, position, index: station.queue.indexOf(customerId) };
    const index = this.overflow.get(customerId);
    const waiting = index === undefined ? undefined : this.waitingPositions[index];
    return waiting && index !== undefined ? { kind: 'overflow', cashierId: null, position: { ...waiting }, index } : null;
  }
  assign(customerId: number, position: Position, canReach: (destination: Position) => boolean): QueueAssignment | null {
    const record = this.purchases.get(customerId);
    if (this.stopped || !record || record.status === 'paid') return null;
    if (record.cashierId) return this.assignment(customerId);
    for (const station of orderedCashiers(this.stations, position)) {
      const slot = station.queue.positions[station.queue.length];
      if (!slot || !canReach(slot) || !station.queue.join(customerId)) continue;
      record.cashierId = station.id;
      record.status = 'queued';
      this.overflow.delete(customerId);
      return this.assignment(customerId);
    }
    if (this.overflow.has(customerId)) return this.assignment(customerId);
    const used = new Set(this.overflow.values());
    const index = this.waitingPositions.findIndex((candidate, slot) => !used.has(slot) && canReach(candidate));
    if (index !== -1) this.overflow.set(customerId, index);
    return this.assignment(customerId);
  }
  markReady(customerId: number): boolean {
    const record = this.purchases.get(customerId);
    const station = this.stations.find(candidate => candidate.id === record?.cashierId);
    if (!record || record.status !== 'queued' || !station?.markReady(customerId)) return false;
    record.status = 'ready';
    return true;
  }
  start(cashierId: string, playerId: PlayerId, gameTimeMs: number): 'started' | 'busy' | 'not-ready' {
    if (this.stopped) return 'not-ready';
    const station = this.stations.find(candidate => candidate.id === cashierId);
    if (station?.state === 'PROCESSING') return 'busy';
    const customerId = station?.currentCustomerId;
    const record = customerId === null || customerId === undefined ? undefined : this.purchases.get(customerId);
    if (!station || !record || record.status !== 'ready' || customerId === null || customerId === undefined) return 'not-ready';
    const sale = createSale({ id: `sale-${this.nextSaleId}`, customerId, cashierId, playerId, gameTimeMs }, record.items);
    if (!station.start(sale, this.settings.processingMs)) return 'not-ready';
    // Claim synchronously before the next player's interaction can run.
    record.status = 'processing';
    this.nextSaleId++;
    return 'started';
  }
  update(deltaMs: number, gameTimeMs: number): void {
    if (this.stopped) return;
    for (const station of this.stations) {
      const pending = station.update(deltaMs);
      if (!pending) continue;
      const record = this.purchases.get(pending.customerId);
      if (!record || record.status !== 'processing') continue;
      const sale = Object.freeze({ ...pending, gameTimeMs });
      const committed = this.economy.commit(sale);
      record.status = 'paid';
      station.remove(pending.customerId);
      if (committed) for (const listener of this.listeners) listener(sale);
    }
  }
  onSale(listener: (sale: SaleTransaction) => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  forgetCustomer(customerId: number): void {
    for (const station of this.stations) station.remove(customerId);
    this.overflow.delete(customerId);
    this.purchases.delete(customerId);
  }
  shutdown(): void {
    this.stopped = true;
    for (const station of this.stations) station.clear();
    this.purchases.clear(); this.overflow.clear(); this.listeners.clear();
  }
}
