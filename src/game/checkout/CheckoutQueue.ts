import type { Position } from '../types/game.ts';

export class CheckoutQueue {
  readonly positions: readonly Position[];
  private ids: number[] = [];
  constructor(positions: readonly Position[], capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0 || capacity > positions.length) throw new RangeError('Queue capacity must fit its standing positions');
    this.positions = Object.freeze(positions.slice(0, capacity).map(position => Object.freeze({ ...position })));
  }
  get capacity(): number { return this.positions.length; }
  get length(): number { return this.ids.length; }
  get members(): readonly number[] { return [...this.ids]; }
  get front(): number | null { return this.ids[0] ?? null; }
  join(customerId: number): boolean {
    if (this.ids.includes(customerId) || this.length >= this.capacity) return false;
    this.ids.push(customerId);
    return true;
  }
  indexOf(customerId: number): number { return this.ids.indexOf(customerId); }
  positionFor(customerId: number): Position | null {
    const position = this.positions[this.indexOf(customerId)];
    return position ? { ...position } : null;
  }
  remove(customerId: number): void { this.ids = this.ids.filter(id => id !== customerId); }
  clear(): void { this.ids = []; }
}
