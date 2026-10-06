import { PRODUCTS, getProduct } from '../products/ProductCatalog.ts';
import type { ProductId } from '../products/Product.ts';
import { assertQuantity } from '../products/StockTransfer.ts';

export interface StorageAddition { readonly productId: ProductId; readonly quantity: number }

export class StoreStorage {
  private quantities: Record<ProductId, number>;
  private readonly listeners = new Set<(productId: ProductId, quantity: number) => void>();
  constructor(initial: Readonly<Partial<Record<ProductId, number>>> = {}) {
    this.quantities = Object.fromEntries(Object.keys(PRODUCTS).map(id => [id, 0])) as Record<ProductId, number>;
    this.addBatch(Object.entries(initial).map(([productId, quantity]) => ({ productId: productId as ProductId, quantity })));
  }
  getQuantity(productId: ProductId): number { this.validateProduct(productId); return this.quantities[productId]; }
  get snapshot(): Readonly<Record<ProductId, number>> { return Object.freeze({ ...this.quantities }); }
  onChange(listener: (productId: ProductId, quantity: number) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private validateProduct(productId: ProductId): void {
    if (!Object.hasOwn(PRODUCTS, productId) || !getProduct(productId)) throw new RangeError('Unknown storage product');
  }
  validateAddition(items: readonly StorageAddition[]): void { this.addedQuantities(items); }
  private addedQuantities(items: readonly StorageAddition[]): Record<ProductId, number> {
    const next = { ...this.quantities };
    for (const item of items) {
      this.validateProduct(item.productId); assertQuantity(item.quantity);
      const total = next[item.productId] + item.quantity;
      assertQuantity(total);
      next[item.productId] = total;
    }
    return next;
  }
  add(productId: ProductId, quantity: number): void { this.addBatch([{ productId, quantity }]); }
  addBatch(items: readonly StorageAddition[]): void {
    const next = this.addedQuantities(items), previous = this.quantities;
    // Validate the entire delivery before changing any product; notify after all changes.
    this.quantities = next;
    for (const productId of Object.keys(PRODUCTS) as ProductId[]) if (next[productId] !== previous[productId]) this.notify(productId);
  }
  take(productId: ProductId, quantity: number): number {
    assertQuantity(quantity);
    const taken = Math.min(this.getQuantity(productId), quantity);
    if (taken > 0) { this.quantities[productId] -= taken; this.notify(productId); }
    return taken;
  }
  private notify(productId: ProductId): void { for (const listener of this.listeners) listener(productId, this.getQuantity(productId)); }
  shutdown(): void { this.listeners.clear(); }
}
