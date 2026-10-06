import type { ProductId, ProductStack } from '../products/Product.ts';
import { createStack, getProduct } from '../products/ProductCatalog.ts';
import type { StoreStorage } from './StoreStorage.ts';

export function retrieveStorageStack(storage: StoreStorage, productId: ProductId, heldItem: ProductStack | null): { status: 'holding' | 'empty' | 'taken'; heldItem: ProductStack | null } {
  if (heldItem) return { status: 'holding', heldItem };
  const quantity = storage.take(productId, getProduct(productId).maxStack);
  return quantity > 0 ? { status: 'taken', heldItem: createStack(productId, quantity) } : { status: 'empty', heldItem: null };
}
