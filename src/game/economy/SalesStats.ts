import type { SaleTransaction } from '../checkout/SaleTransaction.ts';
import type { ProductId } from '../products/Product.ts';
import { addVnd } from './Money.ts';

export interface SalesStatsSnapshot {
  readonly totalRevenue: number;
  readonly totalCustomersServed: number;
  readonly totalItemsSold: number;
  readonly salesByProduct: Readonly<Partial<Record<ProductId, number>>>;
}

export class SalesStats {
  private revenue = 0;
  private served = 0;
  private sold = 0;
  private products: Partial<Record<ProductId, number>> = {};
  get snapshot(): SalesStatsSnapshot {
    return Object.freeze({ totalRevenue: this.revenue, totalCustomersServed: this.served, totalItemsSold: this.sold, salesByProduct: Object.freeze({ ...this.products }) });
  }
  record(sale: SaleTransaction): void {
    const revenue = addVnd(this.revenue, sale.total), served = addVnd(this.served, 1);
    const sold = sale.items.reduce((sum, line) => addVnd(sum, line.quantity), this.sold);
    const products = { ...this.products };
    for (const line of sale.items) products[line.productId] = addVnd(products[line.productId] ?? 0, line.quantity);
    this.revenue = revenue; this.served = served; this.sold = sold; this.products = products;
  }
}
