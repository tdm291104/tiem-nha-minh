import type { ProductId } from '../products/Product.ts';
import { getProduct } from '../products/ProductCatalog.ts';
import { assertQuantity } from '../products/StockTransfer.ts';
import { addVnd, assertVnd } from '../economy/Money.ts';
import type { PlayerId } from '../types/game.ts';

export interface CustomerPurchase { readonly productId: ProductId; readonly quantity: number }
export interface SaleLine extends CustomerPurchase { readonly unitPrice: number; readonly lineTotal: number }
export interface SaleTransaction {
  readonly id: string;
  readonly customerId: number;
  readonly cashierId: string;
  readonly playerId: PlayerId;
  readonly items: readonly SaleLine[];
  readonly total: number;
  readonly gameTimeMs: number;
}
export type SaleIdentity = Omit<SaleTransaction, 'items' | 'total'>;

export function freezePurchase(items: readonly CustomerPurchase[]): readonly CustomerPurchase[] {
  if (items.length === 0) throw new RangeError('A purchase needs at least one item');
  return Object.freeze(items.map(item => {
    assertQuantity(item.quantity);
    if (item.quantity === 0 || !getProduct(item.productId)) throw new RangeError('Purchase lines require valid products and positive quantities');
    return Object.freeze({ productId: item.productId, quantity: item.quantity });
  }));
}

export function createSale(identity: SaleIdentity, purchase: readonly CustomerPurchase[]): SaleTransaction {
  const items = freezePurchase(purchase).map(item => {
    const unitPrice = getProduct(item.productId).sellPrice;
    assertVnd(unitPrice);
    const lineTotal = unitPrice * item.quantity;
    assertVnd(lineTotal);
    return Object.freeze({ ...item, unitPrice, lineTotal });
  });
  return freezeSale({ ...identity, items, total: items.reduce((total, item) => addVnd(total, item.lineTotal), 0) });
}

export function freezeSale(sale: SaleTransaction): SaleTransaction {
  if (!sale.id || !sale.cashierId || !Number.isSafeInteger(sale.customerId) || sale.customerId <= 0 || (sale.playerId !== 1 && sale.playerId !== 2) || !Number.isFinite(sale.gameTimeMs) || sale.gameTimeMs < 0) throw new RangeError('Invalid sale identity');
  freezePurchase(sale.items);
  const items = sale.items.map(item => {
    assertVnd(item.unitPrice); assertVnd(item.lineTotal);
    if (item.lineTotal !== item.quantity * item.unitPrice) throw new RangeError('Sale line total is inconsistent');
    return Object.freeze({ ...item });
  });
  const total = items.reduce((sum, item) => addVnd(sum, item.lineTotal), 0);
  assertVnd(sale.total);
  if (sale.total !== total) throw new RangeError('Sale total is inconsistent');
  return Object.freeze({ ...sale, items: Object.freeze(items), total });
}
