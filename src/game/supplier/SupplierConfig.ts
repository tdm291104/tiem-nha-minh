import type { ProductId } from '../products/Product.ts';

export interface SupplierSettings { readonly deliveryMs: number; readonly quantityStep: number; readonly maxQuantity: number }
export const SUPPLIER: SupplierSettings = Object.freeze({ deliveryMs: 5000, quantityStep: 5, maxQuantity: 50 });
export const INITIAL_STORAGE: Readonly<Record<ProductId, number>> = Object.freeze({
  instant_noodles: 10, soft_drink: 10, milk: 10, cookies: 10, fish_sauce: 10,
});
