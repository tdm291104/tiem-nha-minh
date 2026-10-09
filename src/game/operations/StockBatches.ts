import type { ProductId } from '../products/Product.ts';
export interface StockBatch { readonly quantity: number; readonly expiresOnDay?: number }
export const SHELF_LIFE: Readonly<Record<ProductId, number>> = Object.freeze({ instant_noodles: 7, soft_drink: 5, milk: 2, cookies: 5, fish_sauce: 10 });
export function expiryFor(productId: ProductId, day: number, refrigerated = true): number {
  if (!Number.isSafeInteger(day) || day < 1) throw new RangeError('Invalid stock day');
  return day + (productId === 'milk' && !refrigerated ? 1 : SHELF_LIFE[productId]);
}
function validate(batch: StockBatch): void {
  if (!Number.isSafeInteger(batch.quantity) || batch.quantity < 0 || batch.expiresOnDay !== undefined && (!Number.isSafeInteger(batch.expiresOnDay) || batch.expiresOnDay < 1)) throw new RangeError('Invalid stock batch');
}
export class StockBatches {
  private batches: StockBatch[] = [];
  constructor(initial: readonly StockBatch[] = []) { for (const batch of initial) this.add(batch); }
  get quantity(): number { return this.batches.reduce((sum, batch) => sum + batch.quantity, 0); }
  get snapshot(): readonly StockBatch[] { return this.batches.map(batch => Object.freeze({ ...batch })); }
  get firstExpiry(): number | undefined { return this.batches[0]?.expiresOnDay; }
  add(batch: StockBatch): void {
    validate(batch); if (!Number.isSafeInteger(this.quantity + batch.quantity)) throw new RangeError('Stock overflow');
    if (batch.quantity === 0) return;
    const matching = this.batches.findIndex(existing => existing.expiresOnDay === batch.expiresOnDay);
    if (matching >= 0) this.batches[matching] = { ...batch, quantity: this.batches[matching]!.quantity + batch.quantity };
    else this.batches.push(Object.freeze({ ...batch }));
    this.batches.sort((a, b) => (a.expiresOnDay ?? Infinity) - (b.expiresOnDay ?? Infinity));
  }
  take(quantity: number, singleBatch = false): readonly StockBatch[] {
    validate({ quantity }); let remaining = quantity; const taken: StockBatch[] = [];
    while (remaining > 0 && this.batches[0]) {
      const batch = this.batches[0], amount = Math.min(remaining, batch.quantity);
      taken.push({ ...batch, quantity: amount }); remaining -= amount;
      if (amount === batch.quantity) this.batches.shift(); else this.batches[0] = { ...batch, quantity: batch.quantity - amount };
      if (singleBatch) break;
    }
    return taken;
  }
  expire(day: number): number {
    if (!Number.isSafeInteger(day) || day < 1) throw new RangeError('Invalid expiry day');
    let removed = 0; this.batches = this.batches.filter(batch => { if (batch.expiresOnDay !== undefined && batch.expiresOnDay <= day) { removed += batch.quantity; return false; } return true; }); return removed;
  }
}
