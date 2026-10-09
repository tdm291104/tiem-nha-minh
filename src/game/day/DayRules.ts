import { assertVnd } from '../economy/Money.ts';
import { DAY, type DaySettings } from './DayConfig.ts';

export function dailyGoal(day: number, settings: Readonly<DaySettings> = DAY): number {
  if (!Number.isSafeInteger(day) || day < 1) throw new RangeError('Day must be a positive safe integer');
  assertVnd(settings.day1Goal); assertVnd(settings.goalIncreasePerDay);
  const goal = settings.day1Goal + (day - 1) * settings.goalIncreasePerDay;
  assertVnd(goal);
  return goal;
}
export function evaluateGoal(revenue: number, target: number): boolean { assertVnd(revenue); assertVnd(target); return revenue >= target; }
export function formatCountdown(seconds: number): string {
  if (!Number.isFinite(seconds)) throw new RangeError('Countdown must be finite');
  const remaining = Math.ceil(Math.max(0, seconds));
  return `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
}
