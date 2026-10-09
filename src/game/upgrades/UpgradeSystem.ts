import type { StoreEconomy } from '../economy/StoreEconomy.ts';
import type { PlayerId } from '../types/game.ts';
import { INVENTORY } from '../config/settings.ts';
import { SUPPLIER } from '../supplier/SupplierConfig.ts';
import { CHECKOUT } from '../checkout/CheckoutConfig.ts';
export const UPGRADE_TYPES = ['warehouse', 'shelves', 'cashiers'] as const;
export type UpgradeType = typeof UPGRADE_TYPES[number];
export type UpgradeLevels = Readonly<Record<UpgradeType, number>>;
export const INITIAL_UPGRADES: UpgradeLevels = Object.freeze({ warehouse: 0, shelves: 0, cashiers: 0 });
export const UPGRADES = Object.freeze({ maxLevel: 3, cost: Object.freeze({ warehouse: 20000, shelves: 25000, cashiers: 30000 }), shelfBase: INVENTORY.shelfCapacity, shelfStep: 10, deliveryBaseMs: SUPPLIER.deliveryMs, deliveryStepMs: 1000, checkoutBaseMs: CHECKOUT.processingMs, checkoutStepMs: 200 });
export function validateLevels(levels: UpgradeLevels): void {
  for (const type of UPGRADE_TYPES) if (!Number.isSafeInteger(levels[type]) || levels[type] < 0 || levels[type] > UPGRADES.maxLevel) throw new RangeError('Invalid upgrade level');
}
export function shelfCapacity(levels: UpgradeLevels): number { validateLevels(levels); return UPGRADES.shelfBase + levels.shelves * UPGRADES.shelfStep; }
export function deliveryDuration(levels: UpgradeLevels): number { validateLevels(levels); return UPGRADES.deliveryBaseMs - levels.warehouse * UPGRADES.deliveryStepMs; }
export function checkoutDuration(levels: UpgradeLevels): number { validateLevels(levels); return UPGRADES.checkoutBaseMs - levels.cashiers * UPGRADES.checkoutStepMs; }
export class UpgradeSystem {
  private levels: UpgradeLevels;
  readonly economy: StoreEconomy;
  private readonly allowed: () => boolean;
  private readonly listeners = new Set<() => void>();
  constructor(economy: StoreEconomy, allowed: () => boolean, levels: UpgradeLevels = INITIAL_UPGRADES) {
    validateLevels(levels); this.levels = Object.freeze({ ...levels }); this.economy = economy; this.allowed = allowed;
  }
  get snapshot(): UpgradeLevels { return this.levels; }
  cost(type: UpgradeType): number { return UPGRADES.cost[type] * (this.levels[type] + 1); }
  purchase(type: UpgradeType, playerId: PlayerId, expectedLevel: number, gameTimeMs: number): 'upgraded' | 'closed' | 'max' | 'stale' | 'insufficient-funds' {
    if (playerId !== 1 && playerId !== 2) throw new RangeError('Invalid upgrade player');
    if (!this.allowed()) return 'closed';
    if (this.levels[type] !== expectedLevel) return 'stale';
    if (expectedLevel >= UPGRADES.maxLevel) return 'max';
    if (!this.economy.trySpend(this.cost(type), `upgrade-${type}-${expectedLevel + 1}-p${playerId}`, gameTimeMs, 'UPGRADE_PURCHASE')) return 'insufficient-funds';
    this.levels = Object.freeze({ ...this.levels, [type]: expectedLevel + 1 });
    for (const listener of this.listeners) listener();
    return 'upgraded';
  }
  onChange(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
}
