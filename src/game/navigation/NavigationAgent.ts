import type { Position } from '../types/game.ts';
import type { NavigationGrid } from './NavigationGrid.ts';
import { findPath } from './Pathfinder.ts';

export class NavigationAgent {
  readonly movementSpeed: number;
  private currentPosition: Position;
  private route: Position[] = [];
  private nextWaypoint = 0;
  private destination: Position | null = null;
  private readonly grid: NavigationGrid;

  constructor(grid: NavigationGrid, position: Position, movementSpeed: number) {
    if (!Number.isFinite(movementSpeed) || movementSpeed <= 0) throw new RangeError('Navigation speed must be positive');
    this.grid = grid;
    this.currentPosition = { ...position };
    this.movementSpeed = movementSpeed;
  }
  get position(): Position { return { ...this.currentPosition }; }
  get navigationTarget(): Position | null { return this.destination ? { ...this.destination } : null; }
  goTo(destination: Position): boolean {
    const route = findPath(this.grid, this.currentPosition, destination);
    this.route = route ?? [];
    this.nextWaypoint = 0;
    this.destination = route ? { ...destination } : null;
    return route !== null;
  }
  update(deltaMs: number): boolean {
    let remainingDistance = this.movementSpeed * Math.max(0, deltaMs) / 1000;
    while (this.nextWaypoint < this.route.length) {
      const target = this.route[this.nextWaypoint];
      if (!target) break;
      const dx = target.x - this.currentPosition.x, dy = target.y - this.currentPosition.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= remainingDistance) {
        this.currentPosition = { ...target };
        this.nextWaypoint++;
        remainingDistance -= distance;
      } else {
        this.currentPosition.x += dx / distance * remainingDistance;
        this.currentPosition.y += dy / distance * remainingDistance;
        break;
      }
    }
    return this.destination !== null && this.nextWaypoint >= this.route.length;
  }
}
