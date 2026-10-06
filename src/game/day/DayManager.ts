import type { StoreEconomy } from '../economy/StoreEconomy.ts';
import { DAY } from './DayConfig.ts';
import type { DaySettings } from './DayConfig.ts';
import { dailyGoal, evaluateGoal } from './DayRules.ts';
import { captureAccounting, dailyStats } from './DailyStats.ts';
import type { DayAccountingSnapshot, DailyStatsSnapshot } from './DailyStats.ts';

export type DayState = 'PREPARATION' | 'OPEN' | 'CLOSING' | 'SUMMARY';
export interface ClosingActivity { readonly activeCustomers: number; readonly checkoutProcessing: boolean; readonly activeDelivery: boolean }
export interface DaySummary extends DailyStatsSnapshot { readonly day: number; readonly goal: number; readonly goalAchieved: boolean }

export class DayManager {
  private currentState: DayState = 'PREPARATION';
  private dayNumber = 1;
  private remainingMs: number;
  private elapsedMs = 0;
  private goal: number;
  private baseline: DayAccountingSnapshot;
  private completedSummary: DaySummary | null = null;
  private readonly outOfStockIds = new Set<number>();
  private readonly listeners = new Set<(state: DayState) => void>();
  private stopped = false;
  private readonly economy: StoreEconomy;
  private readonly settings: Readonly<DaySettings>;
  constructor(economy: StoreEconomy, settings: Readonly<DaySettings> = DAY) {
    if (!Number.isSafeInteger(settings.openDurationMs) || settings.openDurationMs <= 0) throw new RangeError('Open duration must be positive integer milliseconds');
    this.economy = economy; this.settings = Object.freeze({ ...settings });
    this.remainingMs = settings.openDurationMs; this.goal = dailyGoal(1, settings);
    // Preparation purchases belong to this day, so capture before any opening input.
    this.baseline = captureAccounting(economy.accounting);
  }
  get currentDay(): number { return this.dayNumber; }
  get state(): DayState { return this.currentState; }
  get remainingOpenTimeMs(): number { return this.remainingMs; }
  get gameTimeMs(): number { return this.elapsedMs; }
  get dailyGoal(): number { return this.goal; }
  get goalAchieved(): boolean { return evaluateGoal(this.statistics.dailyRevenue, this.goal); }
  get dayStartSnapshot(): DayAccountingSnapshot { return this.baseline; }
  get statistics(): DailyStatsSnapshot { return this.completedSummary ?? dailyStats(this.economy.accounting, this.baseline, this.outOfStockIds.size); }
  get summary(): DaySummary | null { return this.completedSummary; }
  get canOrder(): boolean { return !this.stopped && (this.state === 'PREPARATION' || this.state === 'OPEN'); }
  get canSpawnCustomers(): boolean { return !this.stopped && this.state === 'OPEN'; }
  startDay(): boolean {
    if (this.stopped || this.state !== 'PREPARATION') return false;
    this.transition('OPEN'); return true;
  }
  update(deltaMs: number, paused = false): void {
    if (this.stopped || paused || this.state === 'SUMMARY') return;
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Day elapsed time must be nonnegative');
    const elapsed = this.elapsedMs + deltaMs;
    if (!Number.isFinite(elapsed)) throw new RangeError('Game clock overflow');
    this.elapsedMs = elapsed;
    if (this.state === 'OPEN') {
      this.remainingMs = Math.max(0, this.remainingMs - deltaMs);
      if (this.remainingMs === 0) this.transition('CLOSING');
    }
  }
  finishClosing(activity: ClosingActivity): boolean {
    if (this.stopped || this.state !== 'CLOSING' || this.remainingMs !== 0 || activity.activeCustomers !== 0 || activity.checkoutProcessing || activity.activeDelivery) return false;
    const stats = this.statistics;
    this.completedSummary = Object.freeze({ ...stats, day: this.currentDay, goal: this.goal, goalAchieved: evaluateGoal(stats.dailyRevenue, this.goal) });
    this.transition('SUMMARY'); return true;
  }
  recordOutOfStock(customerId: number): boolean {
    if (this.stopped || (this.state !== 'OPEN' && this.state !== 'CLOSING') || this.outOfStockIds.has(customerId)) return false;
    if (!Number.isSafeInteger(customerId) || customerId <= 0) throw new RangeError('Customer ID must be positive');
    this.outOfStockIds.add(customerId); return true;
  }
  nextDay(expectedDay: number): boolean {
    if (this.stopped || this.state !== 'SUMMARY' || expectedDay !== this.currentDay) return false;
    const next = this.currentDay + 1, goal = dailyGoal(next, this.settings);
    this.dayNumber = next; this.goal = goal; this.remainingMs = this.settings.openDurationMs;
    this.baseline = captureAccounting(this.economy.accounting); this.outOfStockIds.clear(); this.completedSummary = null;
    this.transition('PREPARATION'); return true;
  }
  onStateChange(listener: (state: DayState) => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private transition(state: DayState): void {
    this.currentState = state;
    for (const listener of this.listeners) listener(state);
  }
  shutdown(): void { this.stopped = true; this.listeners.clear(); }
}
