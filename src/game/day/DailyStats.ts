export interface DayAccountingSnapshot {
  readonly totalRevenue: number;
  readonly totalExpenses: number;
  readonly totalCustomersServed: number;
  readonly totalItemsSold: number;
}
export interface DailyStatsSnapshot {
  readonly dailyRevenue: number;
  readonly dailyExpenses: number;
  readonly dailyProfit: number;
  readonly customersServed: number;
  readonly itemsSold: number;
  readonly outOfStockCustomers: number;
}
export function captureAccounting(source: DayAccountingSnapshot): DayAccountingSnapshot {
  return Object.freeze({ totalRevenue: source.totalRevenue, totalExpenses: source.totalExpenses, totalCustomersServed: source.totalCustomersServed, totalItemsSold: source.totalItemsSold });
}
export function dailyStats(current: DayAccountingSnapshot, start: DayAccountingSnapshot, outOfStockCustomers: number): DailyStatsSnapshot {
  const dailyRevenue = current.totalRevenue - start.totalRevenue, dailyExpenses = current.totalExpenses - start.totalExpenses;
  return Object.freeze({ dailyRevenue, dailyExpenses, dailyProfit: dailyRevenue - dailyExpenses, customersServed: current.totalCustomersServed - start.totalCustomersServed, itemsSold: current.totalItemsSold - start.totalItemsSold, outOfStockCustomers });
}
