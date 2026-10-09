import { PRODUCTS, createStack, getProduct } from '../products/ProductCatalog.ts';
import type { ProductId, ProductStack } from '../products/Product.ts';
import { StockBatches, expiryFor, type StockBatch } from '../operations/StockBatches.ts';
export interface StorageAddition extends StockBatch { readonly productId: ProductId }
export type StorageBatches = Readonly<Record<ProductId, readonly StockBatch[]>>;
export class StoreStorage {
  private bins: Record<ProductId, StockBatches>;
  private day: number | undefined;
  private readonly listeners = new Set<(productId: ProductId, quantity: number) => void>();
  constructor(initial: Readonly<Partial<Record<ProductId, number>>> = {}, batches?: StorageBatches, currentDay?: number) {
    this.day = currentDay;
    this.bins = Object.fromEntries(Object.keys(PRODUCTS).map(id => [id, new StockBatches()])) as Record<ProductId, StockBatches>;
    this.addBatch(Object.entries(initial).map(([productId, quantity]) => ({ productId: productId as ProductId, quantity })));
    if (batches) {
      const restored = Object.fromEntries(Object.keys(PRODUCTS).map(id => [id, new StockBatches(batches[id as ProductId])])) as Record<ProductId, StockBatches>;
      for (const id of Object.keys(PRODUCTS) as ProductId[]) if (restored[id].quantity !== this.getQuantity(id)) throw new RangeError('Storage batch total differs from stock');
      this.bins = restored;
    }
  }
  setDay(day: number): void { if (!Number.isSafeInteger(day) || day < 1) throw new RangeError('Invalid storage day'); this.day = day; }
  getQuantity(productId: ProductId): number { this.validateProduct(productId); return this.bins[productId].quantity; }
  get snapshot(): Readonly<Record<ProductId, number>> { return Object.freeze(Object.fromEntries(Object.keys(PRODUCTS).map(id => [id, this.getQuantity(id as ProductId)])) as Record<ProductId, number>); }
  get batchSnapshot(): StorageBatches { return Object.fromEntries(Object.keys(PRODUCTS).map(id => [id, this.bins[id as ProductId].snapshot])) as StorageBatches; }
  onChange(listener: (productId: ProductId, quantity: number) => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private validateProduct(productId: ProductId): void { if (!Object.hasOwn(PRODUCTS, productId) || !getProduct(productId)) throw new RangeError('Unknown storage product'); }
  validateAddition(items: readonly StorageAddition[]): void { this.addedBins(items); }
  private addedBins(items: readonly StorageAddition[]): Record<ProductId, StockBatches> {
    const next = Object.fromEntries(Object.keys(PRODUCTS).map(id => [id, new StockBatches(this.bins[id as ProductId].snapshot)])) as Record<ProductId, StockBatches>;
    for (const item of items) {
      this.validateProduct(item.productId);
      const expiresOnDay = item.expiresOnDay ?? (this.day ? expiryFor(item.productId, this.day) : undefined);
      next[item.productId].add({ quantity: item.quantity, ...(expiresOnDay !== undefined ? { expiresOnDay } : {}) });
    }
    return next;
  }
  add(productId: ProductId, quantity: number): void { this.addBatch([{ productId, quantity }]); }
  addBatch(items: readonly StorageAddition[]): void {
    const next = this.addedBins(items), previous = this.snapshot; this.bins = next;
    for (const id of Object.keys(PRODUCTS) as ProductId[]) if (next[id].quantity !== previous[id]) this.notify(id);
  }
  take(productId: ProductId, quantity: number): number {
    this.validateProduct(productId); const taken = this.bins[productId].take(quantity).reduce((sum, batch) => sum + batch.quantity, 0);
    if (taken > 0) this.notify(productId); return taken;
  }
  takeStack(productId: ProductId, quantity = getProduct(productId).maxStack): ProductStack | null {
    this.validateProduct(productId);
    if (quantity > getProduct(productId).maxStack) throw new RangeError('Pickup exceeds stack capacity');
    const batch = this.bins[productId].take(quantity, true)[0];
    if (!batch) return null; this.notify(productId); return createStack(productId, batch.quantity, batch);
  }
  expire(day: number, coldStorage: boolean): number {
    let removed = 0;
    for (const id of Object.keys(PRODUCTS) as ProductId[]) { const amount = this.bins[id].expire(day + (id === 'milk' && !coldStorage ? 1 : 0)); removed += amount; if (amount > 0) this.notify(id); }
    this.setDay(day); return removed;
  }
  private notify(productId: ProductId): void { for (const listener of this.listeners) listener(productId, this.getQuantity(productId)); }
  shutdown(): void { this.listeners.clear(); }
}
