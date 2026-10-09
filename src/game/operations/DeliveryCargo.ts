import type { SupplierOrder } from '../supplier/SupplierOrder.ts';
import type { ProductId, ProductStack } from '../products/Product.ts';
import { createStack } from '../products/ProductCatalog.ts';
import { assertQuantity } from '../products/StockTransfer.ts';
import { OPERATIONS } from './OperationsConfig.ts';
import { expiryFor } from './StockBatches.ts';
export interface CargoCheckpoint { orderId: string | null; arrivedDay: number; remaining: readonly { productId: ProductId; quantity: number }[] }
export class DeliveryCargo {
  private orderId: string | null = null;
  private arrivedDay = 1;
  private remaining: { productId: ProductId; quantity: number }[] = [];
  get hasFreight(): boolean { return this.remaining.some(line => line.quantity > 0); }
  get checkpoint(): CargoCheckpoint { return { orderId: this.orderId, arrivedDay: this.arrivedDay, remaining: this.remaining.map(line => ({ ...line })) }; }
  arrive(order: SupplierOrder, day = 1): void {
    if (this.hasFreight || this.orderId === order.id) throw new RangeError('Delivery already arrived or dock occupied');
    if (!Number.isSafeInteger(day) || day < 1) throw new RangeError('Invalid arrival day');
    this.orderId = order.id; this.arrivedDay = day; this.remaining = order.items.map(line => ({ productId: line.productId, quantity: line.quantity }));
  }
  takeBox(): ProductStack | null {
    const line = this.remaining.find(line => line.quantity > 0);
    if (!line) return null;
    const box = createStack(line.productId, Math.min(OPERATIONS.boxSize, line.quantity), { packed: true, expiresOnDay: expiryFor(line.productId, this.arrivedDay) });
    line.quantity -= box.quantity; return box;
  }
  restore(saved: CargoCheckpoint, orders: readonly SupplierOrder[]): void {
    if (!Number.isSafeInteger(saved.arrivedDay) || saved.arrivedDay < 1) throw new RangeError('Invalid cargo date');
    const order = orders.find(order => order.id === saved.orderId);
    if (saved.orderId !== null && (!order || order.status !== 'DELIVERED')) throw new RangeError('Cargo has no arrived paid order');
    if (new Set(saved.remaining.map(line => line.productId)).size !== saved.remaining.length) throw new RangeError('Duplicate cargo lines');
    for (const line of saved.remaining) {
      assertQuantity(line.quantity);
      const purchased = order?.items.find(item => item.productId === line.productId);
      if (!purchased || line.quantity > purchased.quantity) throw new RangeError('Invalid cargo quantity');
    }
    this.orderId = saved.orderId; this.arrivedDay = saved.arrivedDay; this.remaining = saved.remaining.map(line => ({ ...line }));
  }
  expire(day: number): number { let removed = 0; for (const line of this.remaining) if (expiryFor(line.productId, this.arrivedDay, false) <= day) { removed += line.quantity; line.quantity = 0; } return removed; }
}
