export interface MoneyLedgerEntry {
  readonly id: string;
  readonly kind: 'SALE' | 'SUPPLIER_PURCHASE' | 'UPGRADE_PURCHASE' | 'STAFF_HIRE' | 'STAFF_WAGE';
  readonly referenceId: string;
  readonly amount: number;
  readonly balanceAfter: number;
  readonly gameTimeMs: number;
}
