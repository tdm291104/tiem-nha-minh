import { CHECKOUT } from '../checkout/CheckoutConfig.ts';
import { freezeSale } from '../checkout/SaleTransaction.ts';
import type { SaleTransaction } from '../checkout/SaleTransaction.ts';
import { addVnd, assertVnd } from './Money.ts';
import { SalesStats } from './SalesStats.ts';
import type { MoneyLedgerEntry } from './MoneyLedger.ts';

export class StoreEconomy {
  private balance: number;
  private readonly ledger = new Map<string, SaleTransaction>();
  private readonly servedCustomers = new Set<number>();
  private readonly salesStats = new SalesStats();
  private expenses = 0;
  private readonly spendingIds = new Set<string>();
  private readonly moneyEntries: MoneyLedgerEntry[] = [];
  constructor(initialMoney = CHECKOUT.initialMoney) { assertVnd(initialMoney); this.balance = initialMoney; }
  get money(): number { return this.balance; }
  get statistics(): SalesStats['snapshot'] { return this.salesStats.snapshot; }
  get accounting(): SalesStats['snapshot'] & { readonly totalExpenses: number; readonly profit: number } {
    return Object.freeze({ ...this.statistics, totalExpenses: this.expenses, profit: this.statistics.totalRevenue - this.expenses });
  }
  get moneyLedger(): readonly MoneyLedgerEntry[] { return Object.freeze([...this.moneyEntries]); }
  get transactions(): readonly SaleTransaction[] { return Object.freeze([...this.ledger.values()]); }
  hasServed(customerId: number): boolean { return this.servedCustomers.has(customerId); }
  commit(transaction: SaleTransaction): boolean {
    if (this.ledger.has(transaction.id) || this.hasServed(transaction.customerId)) return false;
    const sale = freezeSale(transaction);
    const balance = addVnd(this.balance, sale.total);
    this.salesStats.record(sale);
    this.balance = balance;
    this.ledger.set(sale.id, sale);
    this.servedCustomers.add(sale.customerId);
    this.moneyEntries.push(Object.freeze({ id: `sale:${sale.id}`, kind: 'SALE', referenceId: sale.id, amount: sale.total, balanceAfter: balance, gameTimeMs: sale.gameTimeMs }));
    return true;
  }
  trySpend(amount: number, referenceId: string, gameTimeMs = 0): boolean {
    assertVnd(amount);
    if (amount === 0 || !referenceId || !Number.isFinite(gameTimeMs) || gameTimeMs < 0) throw new RangeError('Invalid supplier spending');
    if (this.spendingIds.has(referenceId) || amount > this.balance) return false;
    const expenses = addVnd(this.expenses, amount), balance = this.balance - amount;
    this.expenses = expenses; this.balance = balance;
    this.spendingIds.add(referenceId);
    this.moneyEntries.push(Object.freeze({ id: `purchase:${referenceId}`, kind: 'SUPPLIER_PURCHASE', referenceId, amount: -amount, balanceAfter: balance, gameTimeMs }));
    return true;
  }
}
