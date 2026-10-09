import test from 'node:test';
import assert from 'node:assert/strict';
import { StoreEconomy } from '../src/game/economy/StoreEconomy.ts';
import { UpgradeSystem, INITIAL_UPGRADES, shelfCapacity, deliveryDuration, checkoutDuration, validateLevels } from '../src/game/upgrades/UpgradeSystem.ts';
import { ShelfInventory } from '../src/game/products/StockTransfer.ts';
import { StoreStorage } from '../src/game/inventory/StoreStorage.ts';
import { SupplierSystem } from '../src/game/supplier/SupplierSystem.ts';
import { economyCheckpoint, restoreEconomy } from '../src/game/persistence/GameSave.ts';
test('upgrades begin at existing balance and capacity defaults', () => {
  assert.equal(shelfCapacity(INITIAL_UPGRADES), 20); assert.equal(deliveryDuration(INITIAL_UPGRADES), 5000); assert.equal(checkoutDuration(INITIAL_UPGRADES), 1000);
});
test('shelf upgrade spends once, raises capacity and notifies once', () => {
  const economy = new StoreEconomy(), upgrades = new UpgradeSystem(economy, () => true); let events = 0; upgrades.onChange(() => events++);
  assert.equal(upgrades.purchase('shelves', 2, 0, 0), 'upgraded'); assert.equal(upgrades.purchase('shelves', 1, 0, 0), 'stale');
  assert.equal(economy.money, 75000); assert.equal(economy.accounting.totalExpenses, 25000); assert.equal(economy.statistics.totalRevenue, 0);
  assert.equal(economy.moneyLedger[0].kind, 'UPGRADE_PURCHASE'); assert.equal(events, 1); assert.equal(shelfCapacity(upgrades.snapshot), 30);
});
test('closed shop phase and insufficient funds cannot buy upgrades', () => {
  assert.equal(new UpgradeSystem(new StoreEconomy(), () => false).purchase('cashiers', 1, 0, 0), 'closed');
  const economy = new StoreEconomy(1000), upgrades = new UpgradeSystem(economy, () => true);
  assert.equal(upgrades.purchase('warehouse', 1, 0, 0), 'insufficient-funds'); assert.equal(economy.money, 1000); assert.equal(upgrades.snapshot.warehouse, 0);
});
test('upgrade levels are capped and later levels have deterministic prices', () => {
  const economy = new StoreEconomy(1000000), upgrades = new UpgradeSystem(economy, () => true);
  for (let i = 0; i < 3; i++) { assert.equal(upgrades.cost('cashiers'), 30000 * (i + 1)); assert.equal(upgrades.purchase('cashiers', 1, i, i), 'upgraded'); }
  assert.equal(upgrades.purchase('cashiers', 1, 3, 3), 'max'); assert.equal(checkoutDuration(upgrades.snapshot), 400);
  assert.throws(() => validateLevels({ ...INITIAL_UPGRADES, shelves: -1 })); assert.throws(() => validateLevels({ ...INITIAL_UPGRADES, shelves: 4 }));
});
test('capacity upgrade preserves existing stock and immediately informs views', () => {
  const shelf = new ShelfInventory('milk', 20, 18), events = []; shelf.onChange(stock => events.push(stock)); shelf.setCapacity(30);
  assert.equal(shelf.currentStock, 18); assert.equal(shelf.maxStock, 30); assert.deepEqual(events, [18]); assert.throws(() => shelf.setCapacity(17));
});
test('warehouse upgrade affects next order without shortening an already paid delivery', () => {
  const economy = new StoreEconomy(), storage = new StoreStorage(), supplier = new SupplierSystem(storage, economy);
  supplier.confirm('first', 1, [{ productId: 'instant_noodles', quantity: 5 }], 0);
  supplier.setDeliveryDuration(2000); supplier.update(2000); assert.equal(storage.getQuantity('instant_noodles'), 0);
  supplier.update(3000); assert.equal(storage.getQuantity('instant_noodles'), 5);
  supplier.confirm('second', 2, [{ productId: 'instant_noodles', quantity: 5 }], 5000); supplier.update(2000); assert.equal(storage.getQuantity('instant_noodles'), 10);
});
test('restored accounting preserves upgrades as expenses rather than supplier purchases', () => {
  const economy = new StoreEconomy(), upgrades = new UpgradeSystem(economy, () => true); upgrades.purchase('warehouse', 1, 0, 0);
  const restored = restoreEconomy(economyCheckpoint(economy)); assert.deepEqual(restored.moneyLedger, economy.moneyLedger); assert.equal(restored.money, 80000);
});
