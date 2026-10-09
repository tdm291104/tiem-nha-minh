import test from 'node:test';
import assert from 'node:assert/strict';
import { DeliveryCargo } from '../src/game/operations/DeliveryCargo.ts';
import { CleaningSystem } from '../src/game/operations/CleaningSystem.ts';
import { StockBatches, expiryFor } from '../src/game/operations/StockBatches.ts';
import { StorePlan, initialPlan, planShelves, validatePlan } from '../src/game/operations/StorePlan.ts';
import { EmployeeSystem } from '../src/game/employees/EmployeeSystem.ts';
import { StoreEconomy } from '../src/game/economy/StoreEconomy.ts';
import { StoreStorage } from '../src/game/inventory/StoreStorage.ts';
import { ShelfInventory } from '../src/game/products/StockTransfer.ts';
import { createStack } from '../src/game/products/ProductCatalog.ts';
import { retrieveStorageStack } from '../src/game/inventory/StorageTransfer.ts';
import { SupplierSystem } from '../src/game/supplier/SupplierSystem.ts';
import { SUPPLIER } from '../src/game/supplier/SupplierConfig.ts';
import { CheckoutSystem } from '../src/game/checkout/CheckoutSystem.ts';
import { CustomerBrain } from '../src/game/customers/CustomerBrain.ts';
import { CUSTOMERS } from '../src/game/customers/CustomerConfig.ts';
import { NavigationGrid } from '../src/game/navigation/NavigationGrid.ts';
import { DayManager } from '../src/game/day/DayManager.ts';
import { decodeSave, economyCheckpoint } from '../src/game/persistence/GameSave.ts';
import { INITIAL_UPGRADES } from '../src/game/upgrades/UpgradeSystem.ts';
import { createSale } from '../src/game/checkout/SaleTransaction.ts';
import { OPERATIONS } from '../src/game/operations/OperationsConfig.ts';
import { SHOP } from '../src/game/world/ShopDefinition.ts';
const shelf = (productId = 'instant_noodles', quantity = 5) => ({ id: productId, acceptedProductId: productId, interactionPosition: { x: 85, y: 25 }, stock: new ShelfInventory(productId, 20, quantity) });
const cashier = { id: 'cashier', number: 1, x: 25, y: 85, width: 10, height: 10, interactionPosition: { x: 25, y: 95 }, queuePositions: [{ x: 25, y: 65 }, { x: 25, y: 55 }, { x: 25, y: 45 }, { x: 25, y: 35 }] };
function delivery() {
  const economy = new StoreEconomy(), storage = new StoreStorage(), cargo = new DeliveryCargo();
  const supplier = new SupplierSystem(storage, economy, SUPPLIER, () => !cargo.hasFreight, order => cargo.arrive(order));
  supplier.confirm('draft', 1, [{ productId: 'instant_noodles', quantity: 10 }], 0);
  return { economy, storage, cargo, supplier };
}
test('physical delivery arrives at truck without minting warehouse stock', () => {
  const d = delivery(); d.supplier.update(5000); assert.equal(d.storage.getQuantity('instant_noodles'), 0); assert.equal(d.cargo.hasFreight, true); assert.equal(d.economy.money, 70000);
});
test('two players synchronously claim different finite boxes from truck', () => {
  const d = delivery(); d.supplier.update(5000); const a = d.cargo.takeBox(), b = d.cargo.takeBox();
  assert.equal(a.quantity, 5); assert.equal(b.quantity, 5); assert.equal(a.packed, true); assert.equal(d.cargo.takeBox(), null);
  d.storage.addBatch([a, b]); assert.equal(d.storage.getQuantity('instant_noodles'), 10);
});
test('partial truck box preserves all remaining units', () => {
  const cargo = new DeliveryCargo(), order = { id: 'partial', items: [{ productId: 'milk', quantity: 3 }] };
  cargo.arrive(order); assert.equal(cargo.takeBox().quantity, 3); assert.equal(cargo.hasFreight, false);
});
test('occupied delivery dock rejects new ordering without spending', () => {
  const d = delivery(); d.supplier.update(5000); assert.equal(d.supplier.confirm('next', 2, [{ productId: 'milk', quantity: 5 }], 0).status, 'closed'); assert.equal(d.economy.money, 70000);
});
test('duplicate arrival or timer cannot duplicate cargo', () => {
  const d = delivery(); d.supplier.update(5000); d.supplier.update(5000); assert.throws(() => d.cargo.arrive(d.supplier.orders[0])); assert.equal(d.cargo.checkpoint.remaining[0].quantity, 10);
});
test('boxed products cannot stock shelf before warehouse unpacking', () => {
  const target = new ShelfInventory('milk', 20); const stack = createStack('milk', 3, { packed: true, expiresOnDay: 3 }); assert.equal(target.stockFrom(stack).status, 'packed'); assert.equal(target.currentStock, 0);
});
test('stack metadata cannot overwrite quantity during partial transfer', () => {
  const target = new ShelfInventory('milk', 20, 18), stack = createStack('milk', 5, { expiresOnDay: 3 }); const transfer = target.stockFrom(stack);
  assert.equal(transfer.heldItem.quantity, 3); assert.equal(transfer.heldItem.expiresOnDay, 3); assert.equal(target.currentStock, 20);
});
test('cargo restore preserves claim remainder and requires an arrived paid order', () => {
  const d = delivery(); d.supplier.update(5000); d.cargo.takeBox(); const restored = new DeliveryCargo(); restored.restore(d.cargo.checkpoint, d.supplier.orders); assert.equal(restored.takeBox().quantity, 5); assert.equal(restored.takeBox(), null);
  assert.throws(() => restored.restore(d.cargo.checkpoint, []));
});
test('cargo expiry is an explicit quantity sink and occurs once', () => {
  const cargo = new DeliveryCargo(); cargo.arrive({ id: 'milk', items: [{ productId: 'milk', quantity: 10 }] }, 1); assert.equal(cargo.expire(2), 10); assert.equal(cargo.expire(2), 0);
});
test('store traffic creates bounded deterministic litter and spill positions', () => {
  const cleaning = new CleaningSystem(); for (let i = 0; i < 100; i++) cleaning.recordVisit(); assert.equal(cleaning.dirt.length, OPERATIONS.maxDirt); assert.equal(new Set(cleaning.dirt.map(d => `${d.position.x},${d.position.y}`)).size, OPERATIONS.maxDirt); assert.ok(cleaning.dirt.some(d => d.kind === 'spill'));
});
test('cleaning tools cycle without altering stock', () => {
  const cleaning = new CleaningSystem(); assert.equal(cleaning.tool(1), null); cleaning.cycleTool(1); assert.equal(cleaning.tool(1), 'broom'); cleaning.cycleTool(1); assert.equal(cleaning.tool(1), 'mop'); cleaning.cycleTool(1); assert.equal(cleaning.tool(1), null);
});
test('only matching tool can claim dirt and two players cannot claim same spot', () => {
  const c = new CleaningSystem(); c.recordVisit(); c.recordVisit(); const spot = c.dirt[0];
  assert.equal(c.start('player-1', spot.id, 'mop'), false); assert.equal(c.start('player-1', spot.id, 'broom'), true); assert.equal(c.start('player-2', spot.id, 'broom'), false);
});
test('cleaning progresses by simulation delta and finishes exactly once', () => {
  const c = new CleaningSystem(); c.recordVisit(); c.recordVisit(); const spot = c.dirt[0]; c.start('player-1', spot.id, 'broom'); c.update(800, () => spot.position); assert.equal(c.progress(spot.id), 0.5); c.update(800, () => spot.position); assert.equal(c.dirt.length, 0); c.update(800, () => spot.position); assert.equal(c.cleanliness, 100);
});
test('walking away cancels cleaning and saves do not resume stale claims', () => {
  const c = new CleaningSystem(); c.recordVisit(); c.recordVisit(); const spot = c.dirt[0]; c.start('player-1', spot.id, 'broom'); c.update(800, () => ({ x: 0, y: 0 })); assert.equal(c.isBusy('player-1'), false); const loaded = new CleaningSystem(); loaded.restore(c.checkpoint); assert.equal(loaded.dirt.length, 1); assert.equal(loaded.progress(spot.id), 0);
});
test('batch inventory consumes earliest expiry first and conserves remainders', () => {
  const batches = new StockBatches([{ quantity: 5, expiresOnDay: 5 }, { quantity: 3, expiresOnDay: 2 }]); assert.deepEqual(batches.take(4), [{ quantity: 3, expiresOnDay: 2 }, { quantity: 1, expiresOnDay: 5 }]); assert.equal(batches.quantity, 4);
});
test('batch expiry cannot become negative or expire twice', () => {
  const batches = new StockBatches([{ quantity: 3, expiresOnDay: 2 }, { quantity: 4, expiresOnDay: 4 }]); assert.equal(batches.expire(2), 3); assert.equal(batches.expire(2), 0); assert.equal(batches.quantity, 4); assert.throws(() => batches.add({ quantity: -1 })); assert.throws(() => batches.take(1.5));
});
test('warehouse pickup uses one dated batch without refreshing expiry', () => {
  const storage = new StoreStorage({}, undefined, 1); storage.addBatch([{ productId: 'milk', quantity: 3, expiresOnDay: 3 }, { productId: 'milk', quantity: 5, expiresOnDay: 4 }]); const stack = retrieveStorageStack(storage, 'milk', null).heldItem; assert.equal(stack.quantity, 3); assert.equal(stack.expiresOnDay, 3); assert.equal(storage.getQuantity('milk'), 5);
});
test('cold storage protects milk longer while shelf refrigeration preserves dates', () => {
  const warm = new StoreStorage({ milk: 5 }, undefined, 1), cold = new StoreStorage({ milk: 5 }, undefined, 1); assert.equal(warm.expire(2, false), 5); assert.equal(cold.expire(2, true), 0); assert.equal(cold.expire(3, true), 5);
  const stocked = new ShelfInventory('milk', 20, 0, undefined, 1); stocked.stockFrom(createStack('milk', 5, { expiresOnDay: 3 })); assert.equal(stocked.expire(2), 0); assert.equal(stocked.expire(3), 5);
});
test('warehouse batch restore rejects mismatched quantities atomically', () => { assert.throws(() => new StoreStorage({ milk: 10 }, { instant_noodles: [], soft_drink: [], milk: [{ quantity: 5 }], cookies: [], fish_sauce: [] })); });
test('shelf and warehouse quantity is conserved through dated transfers', () => {
  const storage = new StoreStorage({ instant_noodles: 10 }, undefined, 1), s = new ShelfInventory('instant_noodles', 20), held = storage.takeStack('instant_noodles'); const result = s.stockFrom(held); assert.equal(storage.getQuantity('instant_noodles') + s.currentStock + (result.heldItem?.quantity ?? 0), 10); assert.equal(s.batchSnapshot[0].expiresOnDay, expiryFor('instant_noodles', 1));
});
test('safe layout swapping changes positions without changing logical product IDs', () => {
  const plan = new StorePlan(new StoreEconomy(), () => true); assert.equal(plan.swap('shelf-noodles', 'shelf-milk', []), true); const definitions = planShelves(plan.checkpoint); assert.equal(definitions.find(s => s.id === 'shelf-noodles').x, 500); assert.equal(definitions.find(s => s.id === 'shelf-noodles').productId, 'instant_noodles');
});
test('layout changes reject active phase, occupied footprint and invalid slot', () => {
  const plan = new StorePlan(new StoreEconomy(), () => true); assert.equal(plan.swap('shelf-noodles', 'shelf-milk', [{ x: 190, y: 355 }]), false); assert.equal(new StorePlan(new StoreEconomy(), () => false).swap('shelf-noodles', 'shelf-milk', []), false); const bad = initialPlan(); bad.positions[0].x = 123; assert.throws(() => validatePlan(bad));
});
test('expansion debits once and adds three empty shelves with valid annex slots', () => {
  const economy = new StoreEconomy(), plan = new StorePlan(economy, () => true); assert.equal(plan.expand(2, 0), true); assert.equal(plan.expand(1, 0), false); assert.equal(economy.money, 25000); assert.equal(plan.width, 1220); assert.equal(planShelves(plan.checkpoint).length, 8); assert.ok(planShelves(plan.checkpoint).slice(5).every(s => s.initialStock === 0));
});
test('decoration purchases are unique expenses and insufficient money is rejected', () => {
  const economy = new StoreEconomy(5000), plan = new StorePlan(economy, () => true); assert.equal(plan.decorate('plants', 1, 0), true); assert.equal(plan.decorate('plants', 1, 0), false); assert.equal(plan.decorate('seating', 1, 0), false); assert.equal(economy.money, 0); assert.equal(economy.accounting.totalExpenses, 5000);
});
function staff(shelves = [], economy = new StoreEconomy(100000), storage = new StoreStorage({ instant_noodles: 10 })) {
  const cleaning = new CleaningSystem(), checkout = new CheckoutSystem([cashier], [], economy), grid = new NavigationGrid(1000, 1140, 20, []); const system = new EmployeeSystem(economy, storage, shelves, checkout, cleaning, grid, () => true); return { system, economy, storage, checkout, cleaning };
}
test('hiring records cost and daily wages cannot be charged twice', () => {
  const s = staff(); assert.equal(s.system.hire('stock', 0), true); s.system.startDay(1, 0); s.system.startDay(1, 0); assert.equal(s.economy.money, 85000); assert.equal(s.system.checkpoint[0].paidDay, 1); assert.equal(s.economy.moneyLedger[0].kind, 'STAFF_HIRE'); assert.equal(s.economy.moneyLedger[1].kind, 'STAFF_WAGE');
});
test('unaffordable employee wages never introduce debt and worker rests', () => {
  const s = staff([], new StoreEconomy(5000)); s.system.hire('cashier', 0); s.system.startDay(1, 0); s.system.update(1000, 1, true, 1000); assert.equal(s.economy.money, 0); assert.equal(s.system.checkpoint[0].paidDay, 0);
});
test('employee hiring respects configured cap and roles', () => {
  const s = staff(); for (let i = 0; i < 3; i++) assert.equal(s.system.hire('clean', 0), true); assert.equal(s.system.hire('stock', 0), false); assert.equal(s.system.actors.length, 3);
});
test('stock employee physically navigates and transfers finite warehouse goods', () => {
  const target = { ...shelf('instant_noodles', 0), interactionPosition: { x: 190, y: 440 } }, s = staff([target]); s.system.hire('stock', 0); s.system.startDay(1, 0);
  for (let i = 0; i < 1000; i++) s.system.update(50, 1, true, i * 50);
  assert.equal(target.stock.currentStock, 10); assert.equal(s.storage.getQuantity('instant_noodles'), 0); assert.equal(s.system.actors[0].held, null);
});
test('employee role change returns carried goods and pauses during preparation', () => {
  const s = staff(); s.system.hire('stock', 0); s.system.actors[0].held = createStack('instant_noodles', 3); assert.equal(s.system.assign(1, 'clean'), true); assert.equal(s.storage.getQuantity('instant_noodles'), 13); assert.equal(s.system.actors[0].held, null); const before = { ...s.system.actors[0].navigation.position }; s.system.update(5000, 1, false, 0); assert.deepEqual(s.system.actors[0].navigation.position, before);
});
test('employee checkout is slower, records employee identity and commits only once', () => {
  const s = staff(); s.checkout.registerPurchase(1, [{ productId: 'milk', quantity: 1 }]); s.checkout.assign(1, { x: 25, y: 65 }, () => true); s.checkout.markReady(1); assert.equal(s.checkout.startByEmployee('cashier', 1, 0), 'started'); assert.equal(s.checkout.start('cashier', 2, 0), 'busy'); s.checkout.update(1000, 1000); assert.equal(s.economy.money, 100000); s.checkout.update(500, 1500); assert.equal(s.economy.money, 112000); assert.equal(s.economy.transactions[0].employeeId, 1); assert.equal(s.economy.transactions[0].playerId, null); s.checkout.update(1500, 3000); assert.equal(s.economy.money, 112000);
});
function waitingCustomer(extras = {}) {
  const checkout = new CheckoutSystem([cashier], []), target = shelf(); const recovered = [];
  const brain = new CustomerBrain({ customerId: 1, checkout, grid: new NavigationGrid(100, 100, 10, []), shelves: [target], spawnPosition: { x: 15, y: 85 }, interiorEntrance: { x: 15, y: 65 }, exitPosition: { x: 15, y: 85 }, random: () => 0, settings: { ...CUSTOMERS, browseMinMs: 0, browseMaxMs: 0 }, checkoutPatienceMs: 10000, onAbandonedPurchase: items => recovered.push(...items), ...extras });
  for (let i = 0; i < 1000 && brain.state !== 'WAITING_FOR_CHECKOUT'; i++) brain.update(50); assert.equal(brain.state, 'WAITING_FOR_CHECKOUT'); return { brain, checkout, target, recovered };
}
test('impatient customer returns all unpaid goods and produces no sale', () => {
  const departures = [], c = waitingCustomer({ onImpatientDeparture: id => departures.push(id) }); c.brain.update(10000); for (let i = 0; i < 1000 && c.brain.state !== 'DESPAWNED'; i++) c.brain.update(50);
  assert.equal(c.brain.leftForWaiting, true); assert.equal(c.recovered.length, 1); assert.equal(c.checkout.economy.transactions.length, 0); assert.deepEqual(departures, [1]); c.brain.update(10000); assert.equal(c.recovered.length, 1);
});
test('claimed checkout protects customer from simultaneous patience expiration', () => {
  const c = waitingCustomer(); c.checkout.start('cashier', 1, 0); c.brain.update(10000); assert.equal(c.brain.state, 'CHECKOUT'); assert.equal(c.brain.leftForWaiting, false); assert.equal(c.recovered.length, 0);
});
test('invalid employee sale identity is rejected without money mutation', () => { assert.throws(() => createSale({ id: 'bad', customerId: 1, cashierId: 'cashier', playerId: 1, employeeId: 1, gameTimeMs: 0 }, [{ productId: 'milk', quantity: 1 }])); });
test('operations save preserves cargo, dirt, warehouse batches and empty new shelves', () => {
  const economy = new StoreEconomy(200000), day = new DayManager(economy), storage = new StoreStorage({ milk: 5 }, undefined, 1), plan = new StorePlan(economy, () => true); plan.expand(1, 0);
  const supplier = new SupplierSystem(storage, economy), cargo = new DeliveryCargo(), cleaning = new CleaningSystem(); cleaning.recordVisit(); cleaning.recordVisit();
  const definitions = planShelves(plan.checkpoint);
  const saved = { version: 1, players: [{ id: 1, position: { x: 500, y: 1020 }, held: null }], storage: storage.snapshot, shelves: definitions.map(s => ({ id: s.id, stock: 0 })), drops: [], economy: economyCheckpoint(economy), day: day.checkpoint, supplier: supplier.checkpoint, nextCustomerId: 1, upgrades: INITIAL_UPGRADES, operations: { cargo: cargo.checkpoint, cleaning: cleaning.checkpoint, plan: plan.checkpoint, employees: [], storageBatches: storage.batchSnapshot, shelfBatches: definitions.map(s => ({ id: s.id, batches: [] })), impatientIds: [], spoiledUnits: 0, statisticsDay: 1 } };
  assert.deepEqual(decodeSave(JSON.stringify(saved)), saved); const corrupted = structuredClone(saved); corrupted.operations.storageBatches.milk[0].quantity = 99; assert.throws(() => decodeSave(JSON.stringify(corrupted)));
});

test('operational paths reach dock, receiving, tools, shelves and queues before and after expansion', async () => {
  const { operationalWalls } = await import('../src/game/world/OperationalWalls.ts');
  const { findPath } = await import('../src/game/navigation/Pathfinder.ts');
  const { DELIVERY_DOCK, STOCK_RECEIVING, TOOL_RACK } = await import('../src/game/operations/OperationsConfig.ts');
  for (const expanded of [false, true]) {
    const plan = new StorePlan(new StoreEconomy(), () => true);
    if (expanded) assert.equal(plan.expand(1, 0), true);
    const shelves = planShelves(plan.checkpoint);
    const rectangles = [...operationalWalls(plan.checkpoint), ...shelves.map(s => ({ ...s, width: 125, height: 122 })), ...SHOP.crates.map(c => ({ ...c, width: 88, height: 68 })), ...SHOP.counters, SHOP.supplierTerminal, { x: 700, y: 1050, width: 190, height: 86 }];
    const grid = new NavigationGrid(plan.width, OPERATIONS.exteriorHeight, CUSTOMERS.gridCellSize, rectangles.map(r => ({ x: r.x - r.width / 2, y: r.y - r.height / 2, width: r.width, height: r.height })), CUSTOMERS.clearance);
    const destinations = [DELIVERY_DOCK, STOCK_RECEIVING, TOOL_RACK, ...shelves.map(s => ({ x: s.x, y: s.y + 86 })), ...SHOP.counters.flatMap(c => [c.interactionPosition, ...c.queuePositions])];
    for (const destination of destinations) assert.ok(findPath(grid, SHOP.spawns[0], destination), `${expanded ? 'expanded' : 'base'} path to ${JSON.stringify(destination)}`);
  }
});
test('cleaning restore rejects two spots at the same position', () => {
  const cleaning = new CleaningSystem(); cleaning.recordVisit(); cleaning.recordVisit();
  const saved = cleaning.checkpoint; saved.nextId = 3; saved.spots.push({ ...saved.spots[0], id: 2 });
  assert.throws(() => cleaning.restore(saved));
});
