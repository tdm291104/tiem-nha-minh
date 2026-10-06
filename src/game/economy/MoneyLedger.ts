export interface MoneyLedgerEntry {
  readonly id: string;
  readonly kind: 'SALE' | 'SUPPLIER_PURCHASE';
  readonly referenceId: string;
  readonly amount: number;
  readonly balanceAfter: number;
  readonly gameTimeMs: number;
}
