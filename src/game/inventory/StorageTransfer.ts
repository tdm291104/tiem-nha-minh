import type { ProductId, ProductStack } from '../products/Product.ts';
import { getProduct } from '../products/ProductCatalog.ts';
import type { StoreStorage } from './StoreStorage.ts';

export function retrieveStorageStack(storage: StoreStorage, productId: ProductId, heldItem: ProductStack | null): { status: 'holding' | 'empty' | 'taken'; heldItem: ProductStack | null } {
  if (heldItem) return { status: 'holding', heldItem };
  const stack = storage.takeStack(productId, getProduct(productId).maxStack);
  return stack ? { status: 'taken', heldItem: stack } : { status: 'empty', heldItem: null };
}
