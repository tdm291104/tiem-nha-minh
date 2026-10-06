import { getProduct, PRODUCTS } from '../products/ProductCatalog.ts';
import type { ProductId } from '../products/Product.ts';
import { assertQuantity } from '../products/StockTransfer.ts';
import { addVnd, assertVnd } from '../economy/Money.ts';
import type { PlayerId } from '../types/game.ts';
import { SUPPLIER } from './SupplierConfig.ts';

export interface OrderRequestLine { readonly productId: ProductId; readonly quantity: number }
export interface SupplierOrderLine extends OrderRequestLine { readonly unitBuyPrice: number; readonly lineTotal: number }
export interface SupplierOrder {
  readonly id: string;
  readonly playerId: PlayerId;
  readonly items: readonly SupplierOrderLine[];
  readonly totalCost: number;
  readonly createdAt: number;
  readonly status: 'PENDING' | 'DELIVERING' | 'DELIVERED';
}

export function priceOrder(items: readonly OrderRequestLine[], maxQuantity = SUPPLIER.maxQuantity): { readonly items: readonly SupplierOrderLine[]; readonly totalCost: number } {
  assertQuantity(maxQuantity);
  const seen = new Set<ProductId>();
  const lines = items.flatMap(item => {
    assertQuantity(item.quantity);
    if (!Object.hasOwn(PRODUCTS, item.productId) || seen.has(item.productId) || item.quantity > maxQuantity) throw new RangeError('Invalid order product or quantity');
    seen.add(item.productId);
    if (item.quantity === 0) return [];
    const unitBuyPrice = getProduct(item.productId).buyPrice, lineTotal = unitBuyPrice * item.quantity;
    assertVnd(unitBuyPrice); assertVnd(lineTotal);
    return [Object.freeze({ productId: item.productId, quantity: item.quantity, unitBuyPrice, lineTotal })];
  });
  return Object.freeze({ items: Object.freeze(lines), totalCost: lines.reduce((sum, line) => addVnd(sum, line.lineTotal), 0) });
}

export function createOrder(id: string, playerId: PlayerId, items: readonly OrderRequestLine[], createdAt: number, maxQuantity = SUPPLIER.maxQuantity): SupplierOrder {
  if (!id || (playerId !== 1 && playerId !== 2) || !Number.isFinite(createdAt) || createdAt < 0) throw new RangeError('Invalid order identity');
  const priced = priceOrder(items, maxQuantity);
  if (priced.items.length === 0 || priced.totalCost === 0) throw new RangeError('Order must have a positive cost');
  return Object.freeze({ id, playerId, ...priced, createdAt, status: 'PENDING' });
}
