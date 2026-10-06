import type { ProductId } from '../products/Product.ts';
import { assertQuantity } from '../products/StockTransfer.ts';
import type { ShelfInventory } from '../products/StockTransfer.ts';
import type { Position } from '../types/game.ts';

export interface ShoppingShelf {
  readonly id: string;
  readonly acceptedProductId: ProductId;
  readonly interactionPosition: Position;
  readonly stock: ShelfInventory;
}

export function findShelvesForProduct(productId: ProductId, position: Position, shelves: readonly ShoppingShelf[]): ShoppingShelf[] {
  const distance = (shelf: ShoppingShelf): number => Math.hypot(shelf.interactionPosition.x - position.x, shelf.interactionPosition.y - position.y);
  return shelves.filter(shelf => shelf.acceptedProductId === productId).sort((a, b) => Number(b.stock.currentStock > 0) - Number(a.stock.currentStock > 0) || distance(a) - distance(b));
}

export function takeRequestedProduct(shelf: ShoppingShelf, productId: ProductId, desiredQuantity: number): { carriedQuantity: number; purchaseIntentFulfilled: boolean } {
  assertQuantity(desiredQuantity);
  if (desiredQuantity === 0) throw new RangeError('Shopping quantity must be positive');
  const carriedQuantity = shelf.acceptedProductId === productId ? shelf.stock.take(desiredQuantity) : 0;
  return { carriedQuantity, purchaseIntentFulfilled: carriedQuantity === desiredQuantity };
}
