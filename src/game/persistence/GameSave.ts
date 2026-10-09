import type { PlayerId, Position } from '../types/game.ts';
import type { ProductStack } from '../products/Product.ts';
import { createStack, PRODUCTS } from '../products/ProductCatalog.ts';
import { WORLD } from '../config/settings.ts';
import { StoreStorage } from '../inventory/StoreStorage.ts';
import { StoreEconomy } from '../economy/StoreEconomy.ts';
import type { SaleTransaction } from '../checkout/SaleTransaction.ts';
import type { MoneyLedgerEntry } from '../economy/MoneyLedger.ts';
import { DayManager, type DayCheckpoint } from '../day/DayManager.ts';
import { SupplierSystem, type SupplierCheckpoint } from '../supplier/SupplierSystem.ts';
import { ShelfInventory } from '../products/StockTransfer.ts';
import { SHOP } from '../world/ShopDefinition.ts';
import { type UpgradeLevels, validateLevels, shelfCapacity, UPGRADE_TYPES } from '../upgrades/UpgradeSystem.ts';
import type { OperationsCheckpoint } from '../operations/ShopOperations.ts';
import { validatePlan, planShelves } from '../operations/StorePlan.ts';
import { CleaningSystem } from '../operations/CleaningSystem.ts';
import { DeliveryCargo } from '../operations/DeliveryCargo.ts';
import { OPERATIONS } from '../operations/OperationsConfig.ts';
import { validateEmployeeRecords } from '../employees/EmployeeSystem.ts';

export interface EconomyCheckpoint { initialMoney: number; money: number; transactions: readonly SaleTransaction[]; ledger: readonly MoneyLedgerEntry[] }
export interface SavedPlayer { id: PlayerId; position: Position; held: ProductStack | null }
export interface SavedDrop { position: Position; stack: ProductStack }
export interface GameSave {
  version: 1;
  players: readonly SavedPlayer[];
  storage: StoreStorage['snapshot'];
  shelves: readonly { id: string; stock: number }[];
  drops: readonly SavedDrop[];
  economy: EconomyCheckpoint;
  day: DayCheckpoint;
  supplier: SupplierCheckpoint;
  nextCustomerId: number;
  upgrades: UpgradeLevels;
  operations?: OperationsCheckpoint;
}

export function economyCheckpoint(economy: StoreEconomy): EconomyCheckpoint {
  return { initialMoney: economy.money - economy.statistics.totalRevenue + economy.accounting.totalExpenses, money: economy.money, transactions: economy.transactions, ledger: economy.moneyLedger };
}
export function recoverUnpaidGoods(storage: StoreStorage['snapshot'], customers: readonly { id: number; items: readonly { productId: ProductStack['productId']; quantity: number }[] }[], hasServed: (id: number) => boolean): StoreStorage['snapshot'] {
  const restored = new StoreStorage(storage);
  const seen = new Set<number>();
  for (const customer of customers) {
    if (seen.has(customer.id)) throw new RangeError('Duplicate customer recovery');
    seen.add(customer.id);
    if (!hasServed(customer.id)) restored.addBatch(customer.items);
  }
  return restored.snapshot;
}

export function restoreEconomy(saved: EconomyCheckpoint): StoreEconomy {
  const economy = new StoreEconomy(saved.initialMoney);
  const transactions = new Map(saved.transactions.map(sale => [sale.id, sale]));
  if (transactions.size !== saved.transactions.length) throw new RangeError('Duplicate saved sales');
  for (const entry of saved.ledger) {
    if (entry.kind === 'SALE') {
      const sale = transactions.get(entry.referenceId);
      if (!sale || sale.total !== entry.amount || !economy.commit(sale)) throw new RangeError('Invalid saved sale ledger');
    } else if (entry.kind === 'SUPPLIER_PURCHASE' || entry.kind === 'UPGRADE_PURCHASE' || entry.kind === 'STAFF_HIRE' || entry.kind === 'STAFF_WAGE') {
      if (!economy.trySpend(-entry.amount, entry.referenceId, entry.gameTimeMs, entry.kind)) throw new RangeError('Invalid saved expense');
    } else throw new RangeError('Unknown money entry');
    const actual = economy.moneyLedger.at(-1);
    if (!actual || actual.id !== entry.id || actual.balanceAfter !== entry.balanceAfter || actual.gameTimeMs !== entry.gameTimeMs) throw new RangeError('Inconsistent saved ledger');
  }
  if (economy.money !== saved.money || economy.transactions.length !== saved.transactions.length) throw new RangeError('Inconsistent saved balance');
  return economy;
}

function validatePosition(position: Position, width = WORLD.width, height = WORLD.height): void {
  // Carrier origins can sit above their ground footprint when touching the top wall.
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || position.x < 0 || position.x > width || position.y < 0 || position.y > height) throw new RangeError('Invalid saved position');
}

// Validate by reconstructing pure domains before creating any Phaser objects.
export function decodeSave(raw: string): GameSave {
  const saved = JSON.parse(raw) as GameSave;
  if (!saved || saved.version !== 1 || !Array.isArray(saved.players) || saved.players.length < 1 || saved.players.length > 2) throw new RangeError('Unsupported save');
  validateLevels(saved.upgrades);
  if (saved.operations) validatePlan(saved.operations.plan);
  const width = saved.operations?.plan.expanded ? OPERATIONS.expandedWidth : WORLD.width;
  const height = saved.operations ? OPERATIONS.exteriorHeight : WORLD.height;
  if (!saved.storage || Object.keys(saved.storage).length !== Object.keys(PRODUCTS).length || Object.keys(PRODUCTS).some(id => !Object.hasOwn(saved.storage, id))) throw new RangeError('Missing warehouse quantities');
  saved.players.forEach((player, index) => {
    if (player.id !== index + 1) throw new RangeError('Invalid saved players');
    validatePosition(player.position, width, height);
    if (player.held) createStack(player.held.productId, player.held.quantity, player.held);
  });
  const storage = new StoreStorage(saved.storage, saved.operations?.storageBatches), economy = restoreEconomy(saved.economy);
  for (const type of UPGRADE_TYPES) {
    const purchases = economy.moneyLedger.filter(entry => entry.kind === 'UPGRADE_PURCHASE' && entry.referenceId.startsWith(`upgrade-${type}-`));
    if (purchases.length !== saved.upgrades[type] || purchases.some((entry, index) => ![`upgrade-${type}-${index + 1}-p1`, `upgrade-${type}-${index + 1}-p2`].includes(entry.referenceId))) throw new RangeError('Upgrade has no matching payment');
  }
  const day = new DayManager(economy); day.restore(saved.day);
  const supplier = new SupplierSystem(storage, economy); supplier.restore(saved.supplier);
  if (saved.day.state === 'SUMMARY' && supplier.activeOrder) throw new RangeError('Summary cannot have a pending delivery');
  const definitions = saved.operations ? planShelves(saved.operations.plan) : SHOP.shelves;
  if (saved.shelves.length !== definitions.length) throw new RangeError('Missing saved shelves');
  definitions.forEach((shelf, index) => {
    const entry = saved.shelves[index];
    if (!entry || entry.id !== shelf.id) throw new RangeError('Unknown saved shelf');
    const batches = saved.operations?.shelfBatches.find(record => record.id === shelf.id)?.batches;
    if (saved.operations && !batches) throw new RangeError('Missing shelf batches');
    new ShelfInventory(shelf.productId, shelfCapacity(saved.upgrades), entry.stock, batches);
  });
  for (const drop of saved.drops) { validatePosition(drop.position, width, height); createStack(drop.stack.productId, drop.stack.quantity, drop.stack); }
  if (saved.operations) {
    const operations = saved.operations;
    const cargo = new DeliveryCargo(); cargo.restore(operations.cargo, supplier.orders);
    if (cargo.hasFreight && supplier.activeOrder) throw new RangeError('Occupied delivery dock has an inbound order');
    if (Object.keys(PRODUCTS).some(id => !Object.hasOwn(operations.storageBatches, id)) || operations.shelfBatches.length !== definitions.length || new Set(operations.shelfBatches.map(record => record.id)).size !== definitions.length) throw new RangeError('Missing or duplicate stock batches');
    new CleaningSystem().restore(operations.cleaning);
    if (saved.players.some(player => player.held && operations.cleaning.tools.some(tool => tool.playerId === player.id))) throw new RangeError('Player carries both goods and a cleaning tool');
    validateEmployeeRecords(operations.employees);
    if (!Number.isSafeInteger(operations.spoiledUnits) || operations.spoiledUnits < 0 || operations.statisticsDay !== saved.day.day || operations.impatientIds.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(operations.impatientIds).size !== operations.impatientIds.length) throw new RangeError('Invalid operations statistics');
    for (const employee of operations.employees) if (!economy.moneyLedger.some(entry => entry.kind === 'STAFF_HIRE' && entry.referenceId === `staff-hire-${employee.id}`) || employee.lastBilledDay > saved.day.day || employee.paidDay > saved.day.day) throw new RangeError('Employee has no valid hiring record');
    for (const employee of operations.employees) if (employee.paidDay > 0 && !economy.moneyLedger.some(entry => entry.kind === 'STAFF_WAGE' && entry.referenceId === `staff-wage-${employee.paidDay}-${employee.id}`)) throw new RangeError('Employee has no wage payment');
    if (operations.plan.expanded && !economy.moneyLedger.some(entry => entry.kind === 'UPGRADE_PURCHASE' && entry.referenceId.startsWith('expansion-p'))) throw new RangeError('Expansion has no payment');
    for (const decoration of operations.plan.decorations) if (!economy.moneyLedger.some(entry => entry.kind === 'UPGRADE_PURCHASE' && entry.referenceId.startsWith(`decoration-${decoration}-p`))) throw new RangeError('Decoration has no payment');
  }
  const previousIds = [...economy.transactions.map(sale => sale.customerId), ...saved.day.outOfStockIds, ...saved.operations?.impatientIds ?? []];
  if (!Number.isSafeInteger(saved.nextCustomerId) || saved.nextCustomerId <= Math.max(0, ...previousIds)) throw new RangeError('Invalid saved customer sequence');
  return saved;
}

export interface SaveStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
const SAVE_KEY = 'tiem-nha-minh:save:v1';
export class SaveRepository {
  private readonly storage: SaveStorage;
  constructor(storage: SaveStorage) { this.storage = storage; }
  load(): { save: GameSave | null; error: boolean } {
    try { const raw = this.storage.getItem(SAVE_KEY); return { save: raw ? decodeSave(raw) : null, error: false }; }
    catch { return { save: null, error: true }; }
  }
  write(save: GameSave): boolean {
    try { const raw = JSON.stringify(save); decodeSave(raw); this.storage.setItem(SAVE_KEY, raw); return true; }
    catch { return false; }
  }
}
export function browserSaves(): SaveRepository | null {
  try { return new SaveRepository(window.localStorage); } catch { return null; }
}
