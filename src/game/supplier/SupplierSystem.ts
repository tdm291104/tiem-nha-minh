import type { StoreStorage } from '../inventory/StoreStorage.ts';
import type { StoreEconomy } from '../economy/StoreEconomy.ts';
import type { PlayerId } from '../types/game.ts';
import { SUPPLIER } from './SupplierConfig.ts';
import { createOrder, type SupplierOrder, type OrderRequestLine } from './SupplierOrder.ts';

export type OrderResult = { readonly status: 'accepted'; readonly order: SupplierOrder } | { readonly status: 'busy' | 'insufficient-funds' | 'invalid' | 'duplicate' | 'stopped' | 'closed' };
export interface SupplierCheckpoint { orders: readonly SupplierOrder[]; elapsedMs: number; nextId: number; deliveryDurationMs: number }

export class SupplierSystem {
  private readonly records = new Map<string, SupplierOrder>();
  private readonly confirmedRequests = new Set<string>();
  private readonly listeners = new Set<(order: SupplierOrder) => void>();
  private activeId: string | null = null;
  private elapsedMs = 0;
  private nextId = 1;
  private deliveryDurationMs: number;
  private nextDeliveryDurationMs: number;
  private stopped = false;
  readonly storage: StoreStorage;
  readonly economy: StoreEconomy;
  private readonly settings: Readonly<typeof SUPPLIER>;
  private readonly orderingAllowed: () => boolean;
  private readonly deliverySink?: (order: SupplierOrder) => void;
  constructor(storage: StoreStorage, economy: StoreEconomy, settings: Readonly<typeof SUPPLIER> = SUPPLIER, orderingAllowed: () => boolean = () => true, deliverySink?: (order: SupplierOrder) => void) {
    if (!Number.isFinite(settings.deliveryMs) || settings.deliveryMs <= 0 || !Number.isSafeInteger(settings.maxQuantity) || settings.maxQuantity <= 0 || !Number.isSafeInteger(settings.quantityStep) || settings.quantityStep <= 0) throw new RangeError('Invalid supplier settings');
    this.storage = storage; this.economy = economy; this.settings = settings; this.orderingAllowed = orderingAllowed;
    this.deliverySink = deliverySink;
    this.deliveryDurationMs = settings.deliveryMs; this.nextDeliveryDurationMs = settings.deliveryMs;
  }
  get activeOrder(): SupplierOrder | null { return this.activeId ? this.records.get(this.activeId) ?? null : null; }
  get orders(): readonly SupplierOrder[] { return Object.freeze([...this.records.values()]); }
  get remainingMs(): number { return this.activeOrder ? Math.max(0, this.deliveryDurationMs - this.elapsedMs) : 0; }
  get deliveryTimeMs(): number { return this.nextDeliveryDurationMs; }
  setDeliveryDuration(durationMs: number): void {
    if (!Number.isSafeInteger(durationMs) || durationMs <= 0) throw new RangeError('Invalid delivery duration');
    this.nextDeliveryDurationMs = durationMs;
  }
  get canOrder(): boolean { return !this.stopped && this.orderingAllowed(); }
  get checkpoint(): SupplierCheckpoint { return { orders: this.orders, elapsedMs: this.elapsedMs, nextId: this.nextId, deliveryDurationMs: this.deliveryDurationMs }; }
  get draftPrefix(): string { return `order-${this.nextId}`; }
  restore(checkpoint: SupplierCheckpoint): void {
    if (!Number.isSafeInteger(checkpoint.nextId) || checkpoint.nextId < 1 || !Number.isSafeInteger(checkpoint.deliveryDurationMs) || checkpoint.deliveryDurationMs <= 0 || !Number.isFinite(checkpoint.elapsedMs) || checkpoint.elapsedMs < 0 || checkpoint.elapsedMs > checkpoint.deliveryDurationMs) throw new RangeError('Invalid saved delivery');
    const active = checkpoint.orders.filter(order => order.status === 'DELIVERING');
    if (active.length > 1 || new Set(checkpoint.orders.map(order => order.id)).size !== checkpoint.orders.length) throw new RangeError('Invalid saved order identities');
    for (const order of checkpoint.orders) {
      if (!/^order-[1-9]\d*$/.test(order.id) || Number(order.id.slice(6)) >= checkpoint.nextId || !['DELIVERING', 'DELIVERED'].includes(order.status) || !Number.isFinite(order.createdAt) || order.createdAt < 0 || (order.playerId !== 1 && order.playerId !== 2) || order.items.length === 0) throw new RangeError('Invalid saved order');
      let total = 0;
      if (new Set(order.items.map(line => line.productId)).size !== order.items.length) throw new RangeError('Duplicate saved order products');
      for (const line of order.items) {
        if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0 || line.quantity > this.settings.maxQuantity || !Number.isSafeInteger(line.unitBuyPrice) || line.unitBuyPrice <= 0 || line.lineTotal !== line.quantity * line.unitBuyPrice) throw new RangeError('Invalid saved order line');
        this.storage.getQuantity(line.productId); total += line.lineTotal;
      }
      if (!Number.isSafeInteger(total) || total !== order.totalCost || !this.economy.moneyLedger.some(entry => entry.kind === 'SUPPLIER_PURCHASE' && entry.referenceId === order.id && entry.amount === -total)) throw new RangeError('Saved order has no matching payment');
    }
    if (active[0]) this.storage.validateAddition(active[0].items);
    this.records.clear();
    for (const order of checkpoint.orders) this.records.set(order.id, Object.freeze({ ...order, items: Object.freeze(order.items.map(line => Object.freeze({ ...line }))) }));
    this.activeId = active[0]?.id ?? null; this.elapsedMs = checkpoint.elapsedMs; this.nextId = checkpoint.nextId; this.deliveryDurationMs = checkpoint.deliveryDurationMs;
  }
  confirm(requestId: string, playerId: PlayerId, items: readonly OrderRequestLine[], gameTimeMs: number): OrderResult {
    if (this.stopped) return { status: 'stopped' };
    if (!this.canOrder) return { status: 'closed' };
    if (this.confirmedRequests.has(requestId)) return { status: 'duplicate' };
    if (this.activeId) return { status: 'busy' };
    let order: SupplierOrder;
    try {
      if (!requestId) return { status: 'invalid' };
      order = createOrder(`order-${this.nextId}`, playerId, items, gameTimeMs, this.settings.maxQuantity);
      this.storage.validateAddition(order.items);
    } catch (error) { if (error instanceof RangeError) return { status: 'invalid' }; throw error; }
    if (!this.economy.trySpend(order.totalCost, order.id, gameTimeMs)) return { status: 'insufficient-funds' };
    const delivering = Object.freeze({ ...order, status: 'DELIVERING' as const });
    this.confirmedRequests.add(requestId); this.records.set(order.id, delivering);
    this.activeId = order.id; this.elapsedMs = 0; this.nextId++;
    this.deliveryDurationMs = this.nextDeliveryDurationMs;
    this.notify(delivering);
    return { status: 'accepted', order: delivering };
  }
  update(deltaMs: number): void {
    if (this.stopped || !this.activeId) return;
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Delivery elapsed time must be nonnegative');
    this.elapsedMs += deltaMs;
    if (this.elapsedMs >= this.deliveryDurationMs) { this.elapsedMs = this.deliveryDurationMs; this.deliver(this.activeId); }
  }
  deliver(orderId: string): boolean {
    const order = this.records.get(orderId);
    if (this.stopped || order?.status !== 'DELIVERING' || this.activeId !== orderId || this.elapsedMs < this.deliveryDurationMs) return false;
    // Claim before stock notifications: repeated or reentrant delivery cannot add twice.
    this.storage.validateAddition(order.items);
    const delivered = Object.freeze({ ...order, status: 'DELIVERED' as const });
    this.records.set(orderId, delivered); this.activeId = null;
    if (this.deliverySink) this.deliverySink(delivered); else this.storage.addBatch(order.items);
    this.notify(delivered);
    return true;
  }
  onChange(listener: (order: SupplierOrder) => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private notify(order: SupplierOrder): void { for (const listener of this.listeners) listener(order); }
  shutdown(): void { this.stopped = true; this.activeId = null; this.listeners.clear(); this.records.clear(); this.confirmedRequests.clear(); }
}
