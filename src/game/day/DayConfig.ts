export interface DaySettings { readonly openDurationMs: number; readonly day1Goal: number; readonly goalIncreasePerDay: number }
export const DAY: DaySettings = Object.freeze({ openDurationMs: 300_000, day1Goal: 50_000, goalIncreasePerDay: 25_000 });
