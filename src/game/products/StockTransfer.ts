import { createStack } from './ProductCatalog.ts';
import type { ProductId, ProductStack } from './Product.ts';

export interface ShelfState {
  readonly acceptedProductId: ProductId;
  readonly currentStock: number;
  readonly maxStock: number;
}

export interface StockTransfer {
  readonly status: 'stocked' | 'empty-handed' | 'wrong-product' | 'full';
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
  if (heldItem.productId !== shelf.acceptedProductId) return unchanged('wrong-product');
  const transferred = Math.min(heldItem.quantity, shelf.maxStock - shelf.currentStock);
  if (transferred === 0) return unchanged('full');
  const remainder = heldItem.quantity - transferred;
  return {
    status: 'stocked',
    currentStock: shelf.currentStock + transferred,
    heldItem: remainder > 0 ? createStack(heldItem.productId, remainder) : null,
    transferred,
  };
}

// Owns stock mutation so future customers can consume goods through the same invariants.
export class ShelfInventory implements ShelfState {
  private stock: number;
  private readonly listeners = new Set<(quantity: number) => void>();
  readonly acceptedProductId: ProductId;
  readonly maxStock: number;
  constructor(acceptedProductId: ProductId, maxStock: number, initialStock = 0) {
    transferToShelf({ acceptedProductId, currentStock: initialStock, maxStock }, null);
    this.acceptedProductId = acceptedProductId;
    this.maxStock = maxStock;
    this.stock = initialStock;
  }
  get currentStock(): number { return this.stock; }
  onChange(listener: (quantity: number) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private setStock(quantity: number): void {
    if (quantity === this.stock) return;
    this.stock = quantity;
    for (const listener of this.listeners) listener(quantity);
  }
  stockFrom(heldItem: ProductStack | null): StockTransfer {
    const result = transferToShelf(this, heldItem);
    this.setStock(result.currentStock);
    return result;
  }
  take(quantity: number): number {
    assertQuantity(quantity);
    const taken = Math.min(quantity, this.stock);
    this.setStock(this.stock - taken);
    return taken;
  }
}
