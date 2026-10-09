import { createStack } from './ProductCatalog.ts';
import { StockBatches, expiryFor, type StockBatch } from '../operations/StockBatches.ts';
import type { ProductId, ProductStack } from './Product.ts';

export interface ShelfState {
  readonly acceptedProductId: ProductId;
  readonly currentStock: number;
  readonly maxStock: number;
}

export interface StockTransfer {
  readonly status: 'stocked' | 'empty-handed' | 'wrong-product' | 'full' | 'packed';
  readonly currentStock: number;
  readonly heldItem: ProductStack | null;
  readonly transferred: number;
}

export function assertQuantity(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Quantity must be a nonnegative safe integer');
}

export function transferToShelf(shelf: ShelfState, heldItem: ProductStack | null): StockTransfer {
  assertQuantity(shelf.currentStock);
  assertQuantity(shelf.maxStock);
  if (shelf.currentStock > shelf.maxStock) throw new RangeError('Shelf stock exceeds capacity');
  if (heldItem) createStack(heldItem.productId, heldItem.quantity);

  const unchanged = (status: StockTransfer['status']): StockTransfer => ({ status, currentStock: shelf.currentStock, heldItem, transferred: 0 });
  if (!heldItem) return unchanged('empty-handed');
  if (heldItem.packed) return unchanged('packed');
  if (heldItem.productId !== shelf.acceptedProductId) return unchanged('wrong-product');
  const transferred = Math.min(heldItem.quantity, shelf.maxStock - shelf.currentStock);
  if (transferred === 0) return unchanged('full');
  const remainder = heldItem.quantity - transferred;
  return {
    status: 'stocked',
    currentStock: shelf.currentStock + transferred,
    heldItem: remainder > 0 ? createStack(heldItem.productId, remainder, heldItem) : null,
    transferred,
  };
}

export class ShelfInventory implements ShelfState {
  private batches: StockBatches;
  private day: number | undefined;
  private readonly listeners = new Set<(quantity: number) => void>();
  readonly acceptedProductId: ProductId;
  private capacity: number;
  constructor(acceptedProductId: ProductId, maxStock: number, initialStock = 0, batches?: readonly StockBatch[], day?: number) {
    transferToShelf({ acceptedProductId, currentStock: initialStock, maxStock }, null);
    this.acceptedProductId = acceptedProductId; this.capacity = maxStock; this.day = day;
    this.batches = new StockBatches(batches ?? [{ quantity: initialStock, ...(day ? { expiresOnDay: expiryFor(acceptedProductId, day) } : {}) }]);
    if (this.batches.quantity !== initialStock) throw new RangeError('Shelf batch total differs from stock');
  }
  get currentStock(): number { return this.batches.quantity; }
  get batchSnapshot(): readonly StockBatch[] { return this.batches.snapshot; }
  get maxStock(): number { return this.capacity; }
  setCapacity(capacity: number): void { assertQuantity(capacity); if (capacity < this.currentStock || capacity === 0) throw new RangeError('Capacity cannot discard stock'); this.capacity = capacity; this.notify(); }
  onChange(listener: (quantity: number) => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private notify(): void { for (const listener of this.listeners) listener(this.currentStock); }
  stockFrom(heldItem: ProductStack | null): StockTransfer {
    const result = transferToShelf(this, heldItem);
    if (result.transferred > 0 && heldItem) {
      const expiresOnDay = heldItem.expiresOnDay ?? (this.day ? expiryFor(this.acceptedProductId, this.day) : undefined);
      this.batches.add({ quantity: result.transferred, ...(expiresOnDay !== undefined ? { expiresOnDay } : {}) }); this.notify();
    }
    return result;
  }
  take(quantity: number): number {
    const taken = this.batches.take(quantity).reduce((sum, batch) => sum + batch.quantity, 0);
    if (taken > 0) this.notify(); return taken;
  }
  expire(day: number): number { this.day = day; const removed = this.batches.expire(day); if (removed > 0) this.notify(); return removed; }
}
