import { PRODUCTS } from '../products/ProductCatalog.ts';
import type { ProductId } from '../products/Product.ts';
import { priceOrder } from './SupplierOrder.ts';
import { SUPPLIER } from './SupplierConfig.ts';

export class OrderDraft {
  private readonly quantities = new Map<ProductId, number>();
  readonly step: number;
  readonly maximum: number;
  constructor(step = SUPPLIER.quantityStep, maximum = SUPPLIER.maxQuantity) {
    if (!Number.isSafeInteger(step) || step <= 0 || !Number.isSafeInteger(maximum) || maximum < 1) throw new RangeError('Invalid order limits');
    this.step = step; this.maximum = maximum;
    for (const product of Object.values(PRODUCTS)) this.quantities.set(product.id, 0);
  }
  getQuantity(productId: ProductId): number {
    const quantity = this.quantities.get(productId);
    if (quantity === undefined) throw new RangeError('Unknown draft product');
    return quantity;
  }
  adjust(productId: ProductId, direction: -1 | 1): void {
    if (direction !== -1 && direction !== 1) throw new RangeError('Invalid order adjustment');
    this.quantities.set(productId, Math.max(0, Math.min(this.maximum, this.getQuantity(productId) + direction * this.step)));
  }
  get items(): readonly { readonly productId: ProductId; readonly quantity: number }[] {
    return Object.freeze([...this.quantities].map(([productId, quantity]) => Object.freeze({ productId, quantity })));
  }
  get totalCost(): number { return priceOrder(this.items, this.maximum).totalCost; }
}
