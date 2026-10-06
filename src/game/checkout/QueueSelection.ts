import type { Position } from '../types/game.ts';
import type { CashierStation } from './CashierStation.ts';

export function orderedCashiers(stations: readonly CashierStation[], position: Position): CashierStation[] {
  const distance = (station: CashierStation): number => Math.hypot(station.position.x - position.x, station.position.y - position.y);
  return stations.filter(station => station.queue.length < station.queue.capacity).sort((a, b) => a.queue.length - b.queue.length || distance(a) - distance(b) || a.id.localeCompare(b.id));
}
