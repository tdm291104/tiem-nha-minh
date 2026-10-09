import { PRODUCTS, getProduct } from '../products/ProductCatalog.ts';
import type { ProductId } from '../products/Product.ts';
import type { CustomerPurchase } from '../checkout/SaleTransaction.ts';
export function chooseShoppingList(maxProducts: number, random: () => number): readonly ProductId[] {
  const available = Object.keys(PRODUCTS) as ProductId[];
  if (!Number.isSafeInteger(maxProducts) || maxProducts < 1 || maxProducts > available.length) throw new RangeError('Invalid shopping list size');
  const sample = (): number => { const value = random(); if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('Random sample must be in [0, 1)'); return value; };
  const count = maxProducts === 1 ? 1 : 1 + Math.floor(sample() * maxProducts);
  const selected: ProductId[] = [];
  for (let index = 0; index < count; index++) selected.push(available.splice(Math.floor(sample() * available.length), 1)[0]!);
  return Object.freeze(selected);
}
export function describePurchase(items: readonly CustomerPurchase[]): string {
  return items.map(line => `${getProduct(line.productId).name}${line.quantity > 1 ? ` x${line.quantity}` : ''}`).join(' · ');
}
