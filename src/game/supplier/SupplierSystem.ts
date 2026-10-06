import type { StoreStorage } from '../inventory/StoreStorage.ts';
import type { StoreEconomy } from '../economy/StoreEconomy.ts';
import type { PlayerId } from '../types/game.ts';
import { SUPPLIER } from './SupplierConfig.ts';
import { createOrder } from './SupplierOrder.ts';
import type { SupplierOrder, OrderRequestLine } from './SupplierOrder.ts';

export type OrderResult = { readonly status: 'accepted'; readonly order: SupplierOrder } | { readonly status: 'busy' | 'insufficient-funds' | 'invalid' | 'duplicate' | 'stopped' | 'closed' };

export class SupplierSystem {
  private readonly records = new Map<string, SupplierOrder>();
  private readonly confirmedRequests = new Set<string>();
  private readonly listeners = new Set<(order: SupplierOrder) => void>();
  private activeId: string | null = null;
  private elapsedMs = 0;
  private nextId = 1;
  private stopped = false;
  readonly storage: StoreStorage;
  readonly economy: StoreEconomy;
  private readonly settings: Readonly<typeof SUPPLIER>;
  private readonly orderingAllowed: () => boolean;
  constructor(storage: StoreStorage, economy: StoreEconomy, settings: Readonly<typeof SUPPLIER> = SUPPLIER, orderingAllowed: () => boolean = () => true) {
    if (!Number.isFinite(settings.deliveryMs) || settings.deliveryMs <= 0 || !Number.isSafeInteger(settings.maxQuantity) || settings.maxQuantity <= 0 || !Number.isSafeInteger(settings.quantityStep) || settings.quantityStep <= 0) throw new RangeError('Invalid supplier settings');
    this.storage = storage; this.economy = economy; this.settings = settings; this.orderingAllowed = orderingAllowed;
  }
  get activeOrder(): SupplierOrder | null { return this.activeId ? this.records.get(this.activeId) ?? null : null; }
  get orders(): readonly SupplierOrder[] { return Object.freeze([...this.records.values()]); }
  get remainingMs(): number { return this.activeOrder ? Math.max(0, this.settings.deliveryMs - this.elapsedMs) : 0; }
  get canOrder(): boolean { return !this.stopped && this.orderingAllowed(); }
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
    this.notify(delivering);
    return { status: 'accepted', order: delivering };
  }
  update(deltaMs: number): void {
    if (this.stopped || !this.activeId) return;
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Delivery elapsed time must be nonnegative');
    this.elapsedMs += deltaMs;
    if (this.elapsedMs >= this.settings.deliveryMs) this.deliver(this.activeId);
  }
  deliver(orderId: string): boolean {
    const order = this.records.get(orderId);
    if (this.stopped || order?.status !== 'DELIVERING' || this.activeId !== orderId || this.elapsedMs < this.settings.deliveryMs) return false;
    // Claim before stock notifications: repeated or reentrant delivery cannot add twice.
    this.storage.validateAddition(order.items);
    const delivered = Object.freeze({ ...order, status: 'DELIVERED' as const });
    this.records.set(orderId, delivered); this.activeId = null;
    this.storage.addBatch(order.items);
    this.notify(delivered);
    return true;
  }
  onChange(listener: (order: SupplierOrder) => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private notify(order: SupplierOrder): void { for (const listener of this.listeners) listener(order); }
  shutdown(): void { this.stopped = true; this.activeId = null; this.listeners.clear(); this.records.clear(); this.confirmedRequests.clear(); }
}
