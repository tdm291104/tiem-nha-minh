import test from 'node:test';
import assert from 'node:assert/strict';
import { DayManager } from '../src/game/day/DayManager.ts';
import { DAY } from '../src/game/day/DayConfig.ts';
import { dailyGoal, evaluateGoal, formatCountdown } from '../src/game/day/DayRules.ts';
import { StoreEconomy } from '../src/game/economy/StoreEconomy.ts';
import { StoreStorage } from '../src/game/inventory/StoreStorage.ts';
import { ShelfInventory } from '../src/game/products/StockTransfer.ts';
import { SupplierSystem } from '../src/game/supplier/SupplierSystem.ts';
import { SUPPLIER } from '../src/game/supplier/SupplierConfig.ts';
import { createSale } from '../src/game/checkout/SaleTransaction.ts';
import { CheckoutSystem } from '../src/game/checkout/CheckoutSystem.ts';
import { CustomerSpawner } from '../src/game/customers/CustomerSpawner.ts';
import { CustomerBrain } from '../src/game/customers/CustomerBrain.ts';
import { CUSTOMERS } from '../src/game/customers/CustomerConfig.ts';
import { NavigationGrid } from '../src/game/navigation/NavigationGrid.ts';

const empty = { activeCustomers: 0, checkoutProcessing: false, activeDelivery: false };
const settings = { ...DAY, openDurationMs: 1000 };
const makeDay = (economy = new StoreEconomy(), config = settings) => new DayManager(economy, config);
const sale = (customerId = 1, productId = 'instant_noodles', quantity = 1) => createSale({ id: `sale-${customerId}`, customerId, cashierId: 'cashier', playerId: customerId % 2 ? 1 : 2, gameTimeMs: 100 }, [{ productId, quantity }]);
function endDay(day) { day.update(day.remainingOpenTimeMs); assert.equal(day.finishClosing(empty), true); }
const cashier = { id: 'cashier', number: 1, x: 25, y: 85, width: 10, height: 10, interactionPosition: { x: 25, y: 95 }, queuePositions: [{ x: 25, y: 65 }, { x: 25, y: 55 }, { x: 25, y: 45 }, { x: 25, y: 35 }] };

test('day one starts in PREPARATION with full configured timer and goal', () => {
  const day = new DayManager(new StoreEconomy());
  assert.equal(day.currentDay, 1); assert.equal(day.state, 'PREPARATION');
  assert.equal(day.remainingOpenTimeMs, 300000); assert.equal(day.dailyGoal, 50000);
  assert.equal(day.canSpawnCustomers, false); assert.equal(day.canOrder, true);
});

test('preparation has no countdown regardless of preparation elapsed time', () => {
  const day = makeDay(); day.update(100000);
  assert.equal(day.remainingOpenTimeMs, 1000); assert.equal(day.state, 'PREPARATION');
  assert.equal(day.gameTimeMs, 100000);
});

test('startDay enters OPEN without resetting preparation accounting', () => {
  const economy = new StoreEconomy(), day = makeDay(economy);
  economy.trySpend(30000, 'prep');
  assert.equal(day.startDay(), true); assert.equal(day.state, 'OPEN');
  assert.equal(day.canSpawnCustomers, true); assert.equal(day.statistics.dailyExpenses, 30000);
});

test('two co-op opening attempts claim one transition and preserve start snapshot', () => {
  const day = makeDay(), events = [], baseline = day.dayStartSnapshot;
  day.onStateChange(state => events.push(state));
  assert.equal(day.startDay(), true); assert.equal(day.startDay(), false);
  assert.deepEqual(events, ['OPEN']); assert.equal(day.dayStartSnapshot, baseline);
  day.update(100); assert.equal(day.startDay(), false); assert.equal(day.remainingOpenTimeMs, 900);
});

test('open countdown decreases with delta and reaches CLOSING exactly at zero', () => {
  const day = makeDay(); day.startDay(); day.update(999);
  assert.equal(day.remainingOpenTimeMs, 1); assert.equal(day.state, 'OPEN');
  day.update(1); assert.equal(day.remainingOpenTimeMs, 0); assert.equal(day.state, 'CLOSING');
  assert.equal(day.canSpawnCustomers, false); assert.equal(day.canOrder, false);
});

test('oversized updates never make countdown negative', () => {
  const day = makeDay(); day.startDay(); day.update(1000000); day.update(1000000);
  assert.equal(day.remainingOpenTimeMs, 0); assert.equal(day.state, 'CLOSING');
});

test('timer advancement is frame-rate independent', () => {
  const first = makeDay(), second = makeDay(); first.startDay(); second.startDay();
  first.update(500); for (let frame = 0; frame < 50; frame++) second.update(10);
  assert.equal(first.remainingOpenTimeMs, second.remainingOpenTimeMs); assert.equal(first.gameTimeMs, second.gameTimeMs);
});

test('invalid day time and balancing values fail without mutation', () => {
  for (const duration of [0, -1, 0.5, Infinity, NaN]) assert.throws(() => makeDay(new StoreEconomy(), { ...settings, openDurationMs: duration }), RangeError);
  assert.throws(() => makeDay(new StoreEconomy(), { ...settings, day1Goal: -1 }), RangeError);
  const day = makeDay(); day.startDay();
  for (const elapsed of [-1, NaN, Infinity]) assert.throws(() => day.update(elapsed), RangeError);
  assert.equal(day.remainingOpenTimeMs, 1000); assert.equal(day.gameTimeMs, 0);
});

test('closing retains active customers and does not permit premature summary', () => {
  const day = makeDay(); day.startDay(); day.update(1000);
  assert.equal(day.finishClosing({ ...empty, activeCustomers: 3 }), false);
  assert.equal(day.state, 'CLOSING'); assert.equal(day.summary, null);
});

test('summary cannot begin while a checkout is processing', () => {
  const day = makeDay(); day.startDay(); day.update(1000);
  assert.equal(day.finishClosing({ ...empty, checkoutProcessing: true }), false);
  assert.equal(day.state, 'CLOSING');
});

test('closing waits for a paid active delivery before summary', () => {
  const day = makeDay(); day.startDay(); day.update(1000);
  assert.equal(day.finishClosing({ ...empty, activeDelivery: true }), false);
  assert.equal(day.finishClosing(empty), true); assert.equal(day.state, 'SUMMARY');
});

test('summary requires closing, zero time, no customers and idle checkout/delivery', () => {
  const day = makeDay(); assert.equal(day.finishClosing(empty), false);
  day.startDay(); assert.equal(day.finishClosing(empty), false);
  day.update(1000); assert.equal(day.finishClosing(empty), true);
  assert.equal(day.finishClosing(empty), false); assert.equal(day.state, 'SUMMARY');
});

test('summary freezes daily results and stops clock and all day actions', () => {
  const economy = new StoreEconomy(), day = makeDay(economy);
  day.startDay(); economy.commit(sale()); endDay(day);
  const summary = day.summary, time = day.gameTimeMs;
  day.update(99999); assert.equal(day.gameTimeMs, time);
  assert.equal(day.startDay(), false); assert.equal(day.canOrder, false); assert.equal(day.canSpawnCustomers, false);
  assert.equal(day.recordOutOfStock(2), false); assert.ok(Object.isFrozen(summary));
  assert.throws(() => { summary.dailyRevenue = 0; }, TypeError);
  assert.equal(day.summary, summary);
});

test('goal exact boundary succeeds while below goal fails', () => {
  assert.equal(evaluateGoal(50000, 50000), true); assert.equal(evaluateGoal(49999, 50000), false);
  assert.equal(evaluateGoal(60000, 50000), true);
});

test('revenue goal ignores expenses and store balance', () => {
  const economy = new StoreEconomy(1000000), day = makeDay(economy);
  economy.trySpend(100000, 'purchase'); day.startDay(); economy.commit(sale(1, 'fish_sauce', 2));
  endDay(day); assert.equal(day.summary.goalAchieved, true);
  assert.equal(day.summary.dailyRevenue, 50000); assert.equal(day.summary.dailyProfit, -50000);
  const rich = makeDay(new StoreEconomy(1000000)); rich.startDay(); endDay(rich);
  assert.equal(rich.summary.goalAchieved, false);
});

test('goals grow deterministically across days and reject invalid day numbers', () => {
  assert.deepEqual([1, 2, 3, 4].map(day => dailyGoal(day)), [50000, 75000, 100000, 125000]);
  assert.equal(dailyGoal(3, { ...settings, day1Goal: 10000, goalIncreasePerDay: 5000 }), 20000);
  for (const day of [0, -1, 1.5, Infinity]) assert.throws(() => dailyGoal(day), RangeError);
});

test('daily revenue served customers and items use real sales deltas', () => {
  const economy = new StoreEconomy(); economy.commit(sale(1));
  const day = makeDay(economy); day.startDay(); economy.commit(sale(2, 'milk', 2));
  assert.equal(day.statistics.dailyRevenue, 24000); assert.equal(day.statistics.customersServed, 1);
  assert.equal(day.statistics.itemsSold, 2); assert.equal(economy.statistics.totalRevenue, 29000);
});

test('preparation purchases belong to the day that just began', () => {
  const economy = new StoreEconomy(), day = makeDay(economy);
  const supplier = new SupplierSystem(new StoreStorage(), economy, SUPPLIER, () => day.canOrder);
  assert.equal(supplier.confirm('first', 1, [{ productId: 'instant_noodles', quantity: 10 }], day.gameTimeMs).status, 'accepted');
  assert.equal(day.statistics.dailyExpenses, 30000); supplier.update(5000);
  day.startDay(); endDay(day); day.nextDay(1);
  assert.equal(supplier.confirm('second', 2, [{ productId: 'instant_noodles', quantity: 5 }], day.gameTimeMs).status, 'accepted');
  assert.equal(day.statistics.dailyExpenses, 15000); assert.equal(economy.accounting.totalExpenses, 45000);
});

test('daily profit uses revenue minus expenses rather than balance', () => {
  const economy = new StoreEconomy(), day = makeDay(economy);
  economy.trySpend(30000, 'purchase'); day.startDay(); economy.commit(sale(1, 'milk', 5));
  assert.equal(day.statistics.dailyRevenue, 60000); assert.equal(day.statistics.dailyExpenses, 30000);
  assert.equal(day.statistics.dailyProfit, 30000); assert.equal(economy.money, 130000);
});

test('out-of-stock departure IDs count once during open and closing', () => {
  const day = makeDay(); assert.equal(day.recordOutOfStock(1), false); day.startDay();
  assert.equal(day.recordOutOfStock(1), true); assert.equal(day.recordOutOfStock(1), false);
  day.update(1000); assert.equal(day.recordOutOfStock(2), true);
  assert.equal(day.statistics.outOfStockCustomers, 2); day.finishClosing(empty);
  assert.equal(day.summary.outOfStockCustomers, 2); assert.equal(day.recordOutOfStock(3), false);
});

function brainFor(day, stock = 0, extra = {}) {
  return new CustomerBrain({ customerId: 1, checkout: new CheckoutSystem([cashier], []),
    grid: new NavigationGrid(100, 100, 10, []), shelves: [{ id: 'noodles', acceptedProductId: 'instant_noodles', interactionPosition: { x: 85, y: 25 }, stock: new ShelfInventory('instant_noodles', 20, stock) }],
    spawnPosition: { x: 15, y: 85 }, interiorEntrance: { x: 15, y: 65 }, exitPosition: { x: 15, y: 85 }, random: () => 0,
    settings: { ...CUSTOMERS, movementSpeed: 1000, browseMinMs: 0, browseMaxMs: 0, outOfStockWaitMs: 0 },
    onOutOfStockDeparture: id => { day.recordOutOfStock(id); }, ...extra });
}

test('real empty-shelf customer emits one departure only after leaving', () => {
  const day = makeDay(); day.startDay(); let events = 0;
  const brain = brainFor(day, 0, { onOutOfStockDeparture: id => { events++; day.recordOutOfStock(id); } });
  for (let step = 0; step < 100 && brain.state !== 'OUT_OF_STOCK'; step++) brain.update(20);
  assert.equal(brain.state, 'OUT_OF_STOCK'); assert.equal(events, 0);
  for (let step = 0; step < 100; step++) brain.update(20);
  assert.equal(brain.state, 'DESPAWNED'); assert.equal(events, 1); assert.equal(day.statistics.outOfStockCustomers, 1);
});

test('navigation failure is not an out-of-stock departure', () => {
  const day = makeDay(); day.startDay();
  const brain = brainFor(day, 0, { shelves: [] });
  for (let step = 0; step < 100; step++) brain.update(20);
  assert.equal(brain.state, 'DESPAWNED'); assert.equal(day.statistics.outOfStockCustomers, 0);
});

test('nextDay increments once, rejects stale clicks, and resets timer and goal', () => {
  const day = makeDay(); assert.equal(day.nextDay(1), false); day.startDay(); endDay(day);
  assert.equal(day.nextDay(2), false); assert.equal(day.nextDay(1), true); assert.equal(day.nextDay(1), false);
  assert.equal(day.currentDay, 2); assert.equal(day.state, 'PREPARATION');
  assert.equal(day.remainingOpenTimeMs, 1000); assert.equal(day.dailyGoal, 75000);
  day.startDay(); endDay(day); assert.equal(day.nextDay(1), false); assert.equal(day.currentDay, 2);
});

test('failed goals do not prevent next day', () => {
  const day = makeDay(); day.startDay(); endDay(day);
  assert.equal(day.summary.goalAchieved, false); assert.equal(day.nextDay(1), true);
});

test('next day resets daily stats while preserving session stats and history', () => {
  const economy = new StoreEconomy(), day = makeDay(economy); day.startDay();
  for (let id = 1; id <= 5; id++) economy.commit(sale(id, 'soft_drink'));
  day.recordOutOfStock(99); endDay(day); const priorSummary = day.summary;
  assert.equal(priorSummary.dailyRevenue, 50000); assert.equal(priorSummary.customersServed, 5);
  day.nextDay(1);
  assert.deepEqual(day.statistics, { dailyRevenue: 0, dailyExpenses: 0, dailyProfit: 0, customersServed: 0, itemsSold: 0, outOfStockCustomers: 0 });
  assert.equal(economy.statistics.totalRevenue, 50000); assert.equal(economy.statistics.totalCustomersServed, 5);
  assert.equal(economy.transactions.length, 5); assert.equal(priorSummary.dailyRevenue, 50000);
});

test('money physical storage shelves and held/floor values survive next day unchanged', () => {
  const economy = new StoreEconomy(175000), day = makeDay(economy), storage = new StoreStorage({ instant_noodles: 7 }), shelf = new ShelfInventory('instant_noodles', 20, 4);
  const held = Object.freeze({ productId: 'milk', quantity: 3 }), dropped = Object.freeze({ productId: 'cookies', quantity: 2 });
  day.startDay(); endDay(day); day.nextDay(1);
  assert.equal(economy.money, 175000); assert.equal(storage.getQuantity('instant_noodles'), 7);
  assert.equal(shelf.currentStock, 4); assert.equal(held.quantity, 3); assert.equal(dropped.quantity, 2);
});

test('supplier confirmations are blocked during closing and summary with no spending', () => {
  const economy = new StoreEconomy(), day = makeDay(economy), supplier = new SupplierSystem(new StoreStorage(), economy, SUPPLIER, () => day.canOrder);
  day.startDay(); day.update(1000);
  assert.equal(supplier.confirm('closing', 1, [{ productId: 'milk', quantity: 5 }], 1000).status, 'closed');
  day.finishClosing(empty);
  assert.equal(supplier.confirm('summary', 2, [{ productId: 'milk', quantity: 5 }], 1000).status, 'closed');
  assert.equal(economy.money, 100000); assert.equal(supplier.orders.length, 0);
});

test('existing delivery continues in closing and expense remains with paying day', () => {
  const economy = new StoreEconomy(), storage = new StoreStorage(), day = makeDay(economy);
  const supplier = new SupplierSystem(storage, economy, SUPPLIER, () => day.canOrder);
  supplier.confirm('prep-order', 2, [{ productId: 'instant_noodles', quantity: 10 }], 0);
  day.startDay(); day.update(1000); supplier.update(1000);
  assert.equal(day.finishClosing({ ...empty, activeDelivery: supplier.activeOrder !== null }), false);
  day.update(4000); supplier.update(4000);
  assert.equal(storage.getQuantity('instant_noodles'), 10);
  assert.equal(day.finishClosing({ ...empty, activeDelivery: supplier.activeOrder !== null }), true);
  assert.equal(day.summary.dailyExpenses, 30000); day.nextDay(1);
  assert.equal(day.statistics.dailyExpenses, 0); assert.equal(storage.getQuantity('instant_noodles'), 10);
  assert.equal(supplier.orders[0].status, 'DELIVERED');
});

test('spawner is gated in preparation closing and summary and restarts with fresh delay', () => {
  const day = makeDay(), spawner = new CustomerSpawner({ ...CUSTOMERS, initialDelayMs: 100 }, () => 0);
  spawner.stop();
  day.onStateChange(state => { if (state === 'OPEN') spawner.start(); else spawner.stop(); });
  assert.equal(spawner.update(10000, 0, day.canSpawnCustomers), false);
  day.startDay(); assert.equal(spawner.update(99, 0, day.canSpawnCustomers), false);
  assert.equal(spawner.update(1, 0, day.canSpawnCustomers), true);
  day.update(1000); assert.equal(spawner.update(10000, 0, day.canSpawnCustomers), false);
  day.finishClosing(empty); assert.equal(spawner.update(10000, 0, day.canSpawnCustomers), false);
  day.nextDay(1); assert.equal(spawner.update(10000, 0, day.canSpawnCustomers), false);
  day.startDay(); assert.equal(spawner.update(99, 0, day.canSpawnCustomers), false);
  assert.equal(spawner.update(1, 0, day.canSpawnCustomers), true);
});

test('duplicate spawner start does not reset an already running initial delay', () => {
  const spawner = new CustomerSpawner({ ...CUSTOMERS, initialDelayMs: 100 }, () => 0); spawner.stop();
  assert.equal(spawner.start(), true); assert.equal(spawner.update(99, 0), false);
  assert.equal(spawner.start(), false); assert.equal(spawner.update(1, 0), true);
});

test('spawn permission gate pauses even an enabled spawner without consuming its delay', () => {
  const spawner = new CustomerSpawner({ ...CUSTOMERS, initialDelayMs: 100 }, () => 0);
  assert.equal(spawner.update(5000, 0, false), false);
  assert.equal(spawner.update(99, 0, true), false);
  assert.equal(spawner.update(1, 0, true), true);
});

test('pausing day update freezes countdown and shared simulation clock', () => {
  const day = makeDay(); day.startDay(); day.update(100);
  day.update(100000, true); assert.equal(day.remainingOpenTimeMs, 900); assert.equal(day.gameTimeMs, 100);
  day.update(100); assert.equal(day.remainingOpenTimeMs, 800); assert.equal(day.gameTimeMs, 200);
});

test('summary freezes clock until next preparation while keeping time monotonic', () => {
  const day = makeDay(); day.update(100); day.startDay(); endDay(day);
  const time = day.gameTimeMs; day.update(300000); assert.equal(day.gameTimeMs, time);
  day.nextDay(1); day.update(100); assert.equal(day.gameTimeMs, time + 100);
});

test('MM:SS formatting handles minutes boundaries fractions and zero', () => {
  assert.equal(formatCountdown(300), '05:00'); assert.equal(formatCountdown(59), '00:59');
  assert.equal(formatCountdown(9), '00:09'); assert.equal(formatCountdown(0), '00:00');
  assert.equal(formatCountdown(-1), '00:00'); assert.equal(formatCountdown(0.1), '00:01');
});

test('processing query and next-day queue cleanup preserve checkout history and IDs', () => {
  const checkout = new CheckoutSystem([cashier], []);
  const enroll = id => { checkout.registerPurchase(id, [{ productId: 'instant_noodles', quantity: 1 }]); checkout.assign(id, { x: 25, y: 65 }, () => true); checkout.markReady(id); };
  assert.equal(checkout.hasActiveProcessing(), false); enroll(1); checkout.start('cashier', 1, 0);
  assert.equal(checkout.hasActiveProcessing(), true); assert.equal(checkout.prepareNextDay(), false);
  checkout.update(1000, 1000); assert.equal(checkout.hasActiveProcessing(), false);
  assert.equal(checkout.prepareNextDay(), true); assert.equal(checkout.stations[0].state, 'IDLE');
  assert.equal(checkout.stations[0].queue.length, 0); assert.equal(checkout.economy.money, 105000);
  enroll(2); checkout.start('cashier', 2, 1000); checkout.update(1000, 2000);
  assert.deepEqual(checkout.economy.transactions.map(transaction => transaction.id), ['sale-1', 'sale-2']);
});

test('real customer continues shopping and player checkout after closing', () => {
  const economy = new StoreEconomy(), day = makeDay(economy), checkout = new CheckoutSystem([cashier], [], economy);
  day.startDay(); const brain = brainFor(day, 1, { checkout });
  for (let step = 0; step < 100 && brain.state !== 'BROWSING'; step++) brain.update(20);
  assert.equal(brain.state, 'BROWSING'); day.update(1000);
  for (let step = 0; step < 100 && brain.state !== 'WAITING_FOR_CHECKOUT'; step++) brain.update(20);
  assert.equal(brain.state, 'WAITING_FOR_CHECKOUT');
  assert.equal(day.finishClosing({ ...empty, activeCustomers: 1 }), false);
  assert.equal(checkout.start('cashier', 2, day.gameTimeMs), 'started');
  assert.equal(day.finishClosing({ ...empty, checkoutProcessing: checkout.hasActiveProcessing() }), false);
  checkout.update(1000, day.gameTimeMs + 1000);
  for (let step = 0; step < 100; step++) brain.update(20);
  assert.equal(brain.state, 'DESPAWNED'); assert.equal(day.statistics.dailyRevenue, 5000);
  assert.equal(day.finishClosing(empty), true); assert.equal(day.summary.customersServed, 1);
});

test('complete multi-day supplier sales summary scenario preserves 130000 balance and stock', () => {
  const economy = new StoreEconomy(), day = makeDay(economy), storage = new StoreStorage({ instant_noodles: 7 }), shelf = new ShelfInventory('instant_noodles', 20, 4);
  const supplier = new SupplierSystem(storage, economy, SUPPLIER, () => day.canOrder);
  supplier.confirm('prep', 1, [{ productId: 'instant_noodles', quantity: 10 }], day.gameTimeMs);
  assert.equal(day.statistics.dailyExpenses, 30000); supplier.update(5000); assert.equal(storage.getQuantity('instant_noodles'), 17);
  day.startDay(); economy.commit(sale(1, 'milk', 5));
  assert.equal(day.statistics.dailyRevenue, 60000); assert.equal(day.statistics.dailyProfit, 30000);
  endDay(day); assert.equal(day.summary.goalAchieved, true); assert.equal(day.summary.goal, 50000);
  const ledger = economy.moneyLedger, orders = supplier.orders;
  assert.equal(day.nextDay(1), true); assert.equal(day.currentDay, 2);
  assert.equal(day.statistics.dailyRevenue, 0); assert.equal(day.statistics.dailyExpenses, 0);
  assert.equal(economy.statistics.totalRevenue, 60000); assert.equal(economy.money, 130000);
  assert.equal(storage.getQuantity('instant_noodles'), 17); assert.equal(shelf.currentStock, 4);
  assert.deepEqual(economy.moneyLedger, ledger); assert.deepEqual(supplier.orders, orders);
});

test('shutdown stops clock transitions statistics and lifecycle notifications', () => {
  const day = makeDay(), events = [];
  day.onStateChange(state => events.push(state)); day.shutdown(); day.update(100000);
  assert.equal(day.startDay(), false); assert.equal(day.nextDay(1), false); assert.equal(day.finishClosing(empty), false);
  assert.equal(day.recordOutOfStock(1), false); assert.equal(day.canOrder, false); assert.equal(day.canSpawnCustomers, false);
  assert.equal(day.gameTimeMs, 0); assert.deepEqual(events, []);
});
