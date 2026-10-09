import { SHOP } from '../world/ShopDefinition.ts';
import type { StoreEconomy } from '../economy/StoreEconomy.ts';
import type { PlayerId, Position } from '../types/game.ts';
import { OPERATIONS } from './OperationsConfig.ts';
export const ANNEX_SHELVES = [
  { id: 'annex-noodles', x: 1100, y: 355, productId: 'instant_noodles' as const, initialStock: 0 },
  { id: 'annex-cookies', x: 1100, y: 555, productId: 'cookies' as const, initialStock: 0 },
  { id: 'annex-sauce', x: 1100, y: 755, productId: 'fish_sauce' as const, initialStock: 0 },
];
export type Decoration = 'plants' | 'sign' | 'seating' | 'cooler';
export const DECORATIONS: readonly Decoration[] = ['plants', 'sign', 'seating', 'cooler'];
export interface PlanCheckpoint { expanded: boolean; positions: readonly { id: string; x: number; y: number }[]; decorations: readonly Decoration[] }
export function initialPlan(): PlanCheckpoint { return { expanded: false, positions: SHOP.shelves.map(shelf => ({ id: shelf.id, x: shelf.x, y: shelf.y })), decorations: [] }; }
export function validatePlan(plan: PlanCheckpoint): void {
  if (typeof plan.expanded !== 'boolean' || plan.decorations.some(item => !DECORATIONS.includes(item)) || new Set(plan.decorations).size !== plan.decorations.length) throw new RangeError('Invalid shop decoration');
  const definitions = [...SHOP.shelves, ...(plan.expanded ? ANNEX_SHELVES : [])];
  if (plan.positions.length !== definitions.length || new Set(plan.positions.map(shelf => shelf.id)).size !== definitions.length) throw new RangeError('Invalid shelf plan');
  const occupied = new Set<string>();
  for (const position of plan.positions) {
    if (!definitions.some(shelf => shelf.id === position.id) || !definitions.some(slot => slot.x === position.x && slot.y === position.y) || occupied.has(`${position.x},${position.y}`)) throw new RangeError('Invalid shelf slot');
    occupied.add(`${position.x},${position.y}`);
  }
}
export function planShelves(plan: PlanCheckpoint): typeof SHOP.shelves {
  validatePlan(plan);
  return [...SHOP.shelves, ...(plan.expanded ? ANNEX_SHELVES : [])].map(shelf => ({ ...shelf, ...plan.positions.find(position => position.id === shelf.id)! }));
}
export class StorePlan {
  private current: PlanCheckpoint;
  private readonly economy: StoreEconomy;
  private readonly allowed: () => boolean;
  constructor(economy: StoreEconomy, allowed: () => boolean, initial = initialPlan()) { validatePlan(initial); this.current = structuredClone(initial); this.economy = economy; this.allowed = allowed; }
  get checkpoint(): PlanCheckpoint { return structuredClone(this.current); }
  get width(): number { return this.current.expanded ? OPERATIONS.expandedWidth : 1000; }
  swap(firstId: string, secondId: string, players: readonly Position[]): boolean {
    if (!this.allowed() || firstId === secondId) return false;
    const a = this.current.positions.find(shelf => shelf.id === firstId), b = this.current.positions.find(shelf => shelf.id === secondId);
    if (!a || !b || players.some(p => [a, b].some(slot => Math.abs(p.x - slot.x) < 85 && Math.abs(p.y - slot.y) < 95))) return false;
    const next = { ...this.current, positions: this.current.positions.map(shelf => shelf.id === a.id ? { id: a.id, x: b.x, y: b.y } : shelf.id === b.id ? { id: b.id, x: a.x, y: a.y } : shelf) };
    validatePlan(next); this.current = next; return true;
  }
  expand(playerId: PlayerId, gameTimeMs: number): boolean {
    if (!this.allowed() || this.current.expanded || !this.economy.trySpend(OPERATIONS.expansionCost, `expansion-p${playerId}`, gameTimeMs, 'UPGRADE_PURCHASE')) return false;
    this.current = { ...this.current, expanded: true, positions: [...this.current.positions, ...ANNEX_SHELVES.map(shelf => ({ id: shelf.id, x: shelf.x, y: shelf.y }))] }; return true;
  }
  decorate(kind: Decoration, playerId: PlayerId, gameTimeMs: number): boolean {
    if (!this.allowed() || this.current.decorations.includes(kind) || !DECORATIONS.includes(kind) || !this.economy.trySpend(OPERATIONS.decorationCost, `decoration-${kind}-p${playerId}`, gameTimeMs, 'UPGRADE_PURCHASE')) return false;
    this.current = { ...this.current, decorations: [...this.current.decorations, kind] }; return true;
  }
}
