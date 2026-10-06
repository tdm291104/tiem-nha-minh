import type { DayState } from '../day/DayManager.ts';
export type Facing = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type Emotion = 'NEUTRAL' | 'FOCUSED' | 'HAPPY' | 'DISAPPOINTED';

export function facingFromMovement(x: number, y: number, previous: Facing): Facing {
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) < 0.001) return previous;
  return Math.abs(x) > Math.abs(y) ? x > 0 ? 'RIGHT' : 'LEFT' : y > 0 ? 'DOWN' : 'UP';
}
export function clampedRatio(value: number, maximum: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return Math.max(0, Math.min(1, value / maximum));
}
export function motionPolicy(reducedMotion: boolean): { bob: boolean; popScale: number; floatDistance: number; shake: boolean } {
  return reducedMotion ? { bob: false, popScale: 1, floatDistance: 0, shake: false } : { bob: true, popScale: 1.04, floatDistance: 28, shake: true };
}
export function entranceLabel(state: DayState): string {
  return state === 'PREPARATION' ? 'CHƯA MỞ CỬA' : state === 'OPEN' ? 'MỞ CỬA' : 'ĐÃ ĐÓNG CỬA';
}
export function heldItemOffset(facing: Facing): { x: number; y: number; behind: boolean } {
  return facing === 'UP' ? { x: 0, y: -35, behind: true } : facing === 'LEFT' ? { x: -21, y: -23, behind: false } : facing === 'RIGHT' ? { x: 21, y: -23, behind: false } : { x: 0, y: -15, behind: false };
}

export class GoalFeedbackLatch {
  private day = 0;
  private announced = false;
  observe(day: number, achieved: boolean): boolean {
    if (day !== this.day) { this.day = day; this.announced = false; }
    if (!achieved || this.announced) return false;
    this.announced = true; return true;
  }
}
