import type { Product, ProductId, ProductStack } from './Product.ts';

export const PRODUCTS: Readonly<Record<ProductId, Product>> = {
  instant_noodles: { id: 'instant_noodles', name: 'Mì gói', category: 'food', placeholderColor: 0xe8ae45, placeholderShape: 'packet', maxStack: 5, buyPrice: 3000, sellPrice: 5000 },
  soft_drink: { id: 'soft_drink', name: 'Nước ngọt', category: 'drink', placeholderColor: 0xd87773, placeholderShape: 'can', maxStack: 5, buyPrice: 6000, sellPrice: 10000 },
  milk: { id: 'milk', name: 'Sữa', category: 'drink', placeholderColor: 0x77aed0, placeholderShape: 'carton', maxStack: 5, buyPrice: 8000, sellPrice: 12000 },
  cookies: { id: 'cookies', name: 'Bánh quy', category: 'food', placeholderColor: 0xa99acb, placeholderShape: 'box', maxStack: 5, buyPrice: 9000, sellPrice: 15000 },
  fish_sauce: { id: 'fish_sauce', name: 'Nước mắm', category: 'seasoning', placeholderColor: 0x94aa69, placeholderShape: 'bottle', maxStack: 5, buyPrice: 15000, sellPrice: 25000 },
};

export function getProduct(id: ProductId): Product { return PRODUCTS[id]; }

export function createStack(productId: ProductId, quantity = getProduct(productId).maxStack, metadata: Pick<ProductStack, 'packed' | 'expiresOnDay'> = {}): ProductStack {
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > getProduct(productId).maxStack) {
    throw new RangeError('Product stack quantity must be a positive integer within maxStack');
  }
  if (metadata.packed !== undefined && typeof metadata.packed !== 'boolean' || metadata.expiresOnDay !== undefined && (!Number.isSafeInteger(metadata.expiresOnDay) || metadata.expiresOnDay < 1)) throw new RangeError('Invalid stack metadata');
  return Object.freeze({ productId, quantity, ...(metadata.packed !== undefined ? { packed: metadata.packed } : {}), ...(metadata.expiresOnDay !== undefined ? { expiresOnDay: metadata.expiresOnDay } : {}) });
}

export function describeStack(stack: ProductStack | null): string {
  return stack ? `${stack.packed ? 'Thùng ' : ''}${getProduct(stack.productId).name} x${stack.quantity}${stack.expiresOnDay ? ` · HSD ngày ${stack.expiresOnDay - 1}` : ''}` : 'Không';
}
