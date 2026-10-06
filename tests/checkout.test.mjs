import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECKOUT } from '../src/game/checkout/CheckoutConfig.ts';
import { CheckoutSystem } from '../src/game/checkout/CheckoutSystem.ts';
import { CheckoutQueue } from '../src/game/checkout/CheckoutQueue.ts';
import { CashierStation } from '../src/game/checkout/CashierStation.ts';
import { orderedCashiers } from '../src/game/checkout/QueueSelection.ts';
import { createSale, freezeSale } from '../src/game/checkout/SaleTransaction.ts';
import { StoreEconomy } from '../src/game/economy/StoreEconomy.ts';
import { formatVnd } from '../src/game/economy/Money.ts';
import { CustomerBrain } from '../src/game/customers/CustomerBrain.ts';
import { CUSTOMERS } from '../src/game/customers/CustomerConfig.ts';
import { NavigationGrid } from '../src/game/navigation/NavigationGrid.ts';
import { ShelfInventory } from '../src/game/products/StockTransfer.ts';

const definitions = [
  { id: 'one', number: 1, x: 40, y: 170, width: 20, height: 20, interactionPosition: { x: 40, y: 195 }, queuePositions: [{ x: 40, y: 140 }, { x: 40, y: 110 }, { x: 40, y: 80 }, { x: 40, y: 50 }] },
  { id: 'two', number: 2, x: 160, y: 170, width: 20, height: 20, interactionPosition: { x: 160, y: 195 }, queuePositions: [{ x: 160, y: 140 }, { x: 160, y: 110 }, { x: 160, y: 80 }, { x: 160, y: 50 }] },
];
const waitingPositions = [{ x: 100, y: 170 }, { x: 100, y: 140 }, { x: 100, y: 110 }, { x: 100, y: 80 }, { x: 100, y: 50 }];
const purchase = (productId = 'instant_noodles', quantity = 1) => [{ productId, quantity }];
const sale = (extra = {}, items = purchase()) => createSale({ id: 'sale-test', customerId: 1, cashierId: 'one', playerId: 1, gameTimeMs: 1000, ...extra }, items);
const system = (stations = definitions, settings = CHECKOUT) => new CheckoutSystem(stations, waitingPositions, new StoreEconomy(), settings);
function enroll(checkout, customerId, origin = { x: 40, y: 140 }, items = purchase()) {
  assert.equal(checkout.registerPurchase(customerId, items), true);
  return checkout.assign(customerId, origin, () => true);
}

test('economy starts at 100000 and credits a 5000 sale to 105000', () => {
  const economy = new StoreEconomy();
  assert.equal(economy.money, 100000);
  assert.equal(economy.commit(sale()), true);
  assert.equal(economy.money, 105000);
});

test('transaction calculation supports quantity and multiple cart lines', () => {
  const transaction = sale({}, purchase('instant_noodles', 2));
  assert.equal(transaction.items[0].unitPrice, 5000);
  assert.equal(transaction.items[0].lineTotal, 10000);
  assert.equal(transaction.total, 10000);
  const multiple = sale({}, [...purchase('instant_noodles', 2), ...purchase('milk')]);
  assert.equal(multiple.total, 22000);
  assert.equal(multiple.items.length, 2);
});

test('completed sales are deeply immutable snapshots', () => {
  const cart = purchase();
  const transaction = sale({}, cart);
  cart[0].quantity = 5;
  assert.equal(transaction.items[0].quantity, 1);
  assert.ok(Object.isFrozen(transaction));
  assert.ok(Object.isFrozen(transaction.items));
  assert.ok(Object.isFrozen(transaction.items[0]));
  assert.throws(() => { transaction.total = 1; }, TypeError);
  assert.throws(() => { transaction.items[0].quantity = 99; }, TypeError);
});

test('currency rejects fractions, negative values, nonfinite values, and overflow', () => {
  for (const invalid of [1.5, -1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => new StoreEconomy(invalid), RangeError);
  assert.throws(() => sale({}, purchase('milk', 0.5)), RangeError);
  assert.throws(() => freezeSale({ ...sale(), items: [{ ...sale().items[0], unitPrice: 5000.5 }] }), RangeError);
  assert.throws(() => sale({}, purchase('fish_sauce', Number.MAX_SAFE_INTEGER)), RangeError);
  const economy = new StoreEconomy(Number.MAX_SAFE_INTEGER);
  assert.throws(() => economy.commit(sale()), RangeError);
  assert.equal(economy.money, Number.MAX_SAFE_INTEGER);
  assert.equal(economy.transactions.length, 0);
  assert.equal(economy.statistics.totalRevenue, 0);
});

test('inconsistent transaction totals and empty carts cannot be committed', () => {
  const economy = new StoreEconomy();
  assert.throws(() => sale({}, []), RangeError);
  assert.throws(() => economy.commit({ ...sale(), total: 1 }), RangeError);
  assert.throws(() => economy.commit({ ...sale(), items: [{ ...sale().items[0], lineTotal: 1 }] }), RangeError);
  assert.equal(economy.money, 100000);
  assert.equal(economy.transactions.length, 0);
});

test('VND displays Vietnamese thousands separators', () => {
  assert.equal(formatVnd(100000), '100.000đ');
  assert.equal(formatVnd(0), '0đ');
});

test('revenue and served customer IDs commit exactly once', () => {
  const economy = new StoreEconomy();
  const transaction = sale();
  assert.equal(economy.commit(transaction), true);
  assert.equal(economy.commit(transaction), false);
  assert.equal(economy.commit(sale({ id: 'another-id' })), false);
  assert.equal(economy.commit(sale({ customerId: 2 })), false);
  assert.equal(economy.money, 105000);
  assert.equal(economy.statistics.totalCustomersServed, 1);
  assert.equal(economy.statistics.totalItemsSold, 1);
  assert.equal(economy.transactions.length, 1);
});

test('session statistics track revenue, customers, units and product quantities', () => {
  const economy = new StoreEconomy();
  economy.commit(sale({}, purchase('instant_noodles', 2)));
  economy.commit(sale({ id: 'sale-2', customerId: 2, playerId: 2 }, purchase('milk')));
  assert.deepEqual(economy.statistics, { totalRevenue: 22000, totalCustomersServed: 2, totalItemsSold: 3, salesByProduct: { instant_noodles: 2, milk: 1 } });
  assert.ok(Object.isFrozen(economy.statistics.salesByProduct));
});

test('shortest queue wins: length 3 versus length 1', () => {
  const first = new CashierStation(definitions[0]), second = new CashierStation(definitions[1]);
  for (const id of [1, 2, 3]) first.queue.join(id);
  second.queue.join(4);
  assert.equal(orderedCashiers([first, second], { x: 40, y: 170 })[0].id, 'two');
});

test('equal queue lengths use distance then stable ID tie-break', () => {
  const first = new CashierStation(definitions[0]), second = new CashierStation(definitions[1]);
  assert.equal(orderedCashiers([second, first], { x: 100, y: 170 })[0].id, 'one');
  assert.equal(orderedCashiers([first, second], { x: 160, y: 170 })[0].id, 'two');
});

test('FIFO advancement changes logical slots and preserves remaining ordering', () => {
  const queue = new CheckoutQueue(definitions[0].queuePositions, 4);
  for (const id of [1, 2, 3]) assert.ok(queue.join(id));
  assert.equal(queue.join(2), false);
  assert.deepEqual(queue.positionFor(2), { x: 40, y: 110 });
  queue.remove(1);
  assert.equal(queue.front, 2);
  assert.deepEqual(queue.members, [2, 3]);
  assert.deepEqual(queue.positionFor(2), { x: 40, y: 140 });
  assert.deepEqual(queue.positionFor(3), { x: 40, y: 110 });
});

test('empty and unready queues produce no checkout or transaction', () => {
  const checkout = system();
  assert.equal(checkout.start('one', 1, 0), 'not-ready');
  assert.equal(checkout.registerPurchase(1, []), false);
  enroll(checkout, 1);
  assert.equal(checkout.start('one', 1, 0), 'not-ready');
  checkout.update(10000, 10000);
  assert.equal(checkout.economy.transactions.length, 0);
  assert.equal(checkout.economy.money, 100000);
});

test('two player attempts synchronously claim only one cashier job', () => {
  const checkout = system();
  enroll(checkout, 1);
  assert.ok(checkout.markReady(1));
  assert.equal(checkout.start('one', 1, 0), 'started');
  assert.equal(checkout.start('one', 2, 0), 'busy');
  assert.equal(checkout.stations[0].operatingPlayerId, 1);
  checkout.update(999, 999);
  assert.equal(checkout.economy.money, 100000);
  assert.equal(checkout.stations[0].state, 'PROCESSING');
  checkout.update(1, 1000);
  assert.equal(checkout.economy.money, 105000);
  assert.equal(checkout.economy.transactions[0].playerId, 1);
  checkout.update(10000, 11000);
  assert.equal(checkout.start('one', 2, 11000), 'not-ready');
  assert.equal(checkout.economy.transactions.length, 1);
});

test('currently processing customers count toward queue length', () => {
  const checkout = system();
  enroll(checkout, 1);
  checkout.markReady(1);
  checkout.start('one', 1, 0);
  assert.equal(checkout.stations[0].queue.length, 1);
  assert.equal(enroll(checkout, 2).cashierId, 'two');
});

test('queue membership is unique and customers never switch assigned queues', () => {
  const checkout = system();
  const assignment = enroll(checkout, 1);
  assert.equal(checkout.registerPurchase(1, purchase('milk')), false);
  assert.equal(checkout.assign(1, { x: 160, y: 170 }, () => true).cashierId, assignment.cashierId);
  assert.equal(checkout.stations.reduce((sum, station) => sum + station.queue.length, 0), 1);
});

test('capacity overflow uses unique standing points and later acquires a freed slot', () => {
  const checkout = system([definitions[0]], { ...CHECKOUT, maxQueueLength: 1 });
  assert.equal(enroll(checkout, 1).kind, 'queue');
  const second = enroll(checkout, 2), third = enroll(checkout, 3);
  assert.equal(second.kind, 'overflow');
  assert.equal(third.kind, 'overflow');
  assert.notDeepEqual(second.position, third.position);
  assert.equal(checkout.stations[0].queue.length, 1);
  checkout.forgetCustomer(1);
  assert.equal(checkout.assign(2, second.position, () => true).kind, 'queue');
  assert.equal(checkout.assignment(3).kind, 'overflow');
});

test('exhausted or unreachable standing points return failure without crashing', () => {
  const checkout = new CheckoutSystem([definitions[0]], [], new StoreEconomy(), { ...CHECKOUT, maxQueueLength: 1 });
  enroll(checkout, 1);
  assert.equal(enroll(checkout, 2), null);
  const blocked = system();
  blocked.registerPurchase(1, purchase());
  assert.equal(blocked.assign(1, { x: 100, y: 140 }, () => false), null);
});

test('duplicate or invalid queue standing points are rejected', () => {
  assert.throws(() => new CheckoutSystem(definitions, [{ x: 40, y: 140 }]), RangeError);
  assert.throws(() => new CheckoutSystem(definitions, [{ x: NaN, y: 140 }]), RangeError);
  assert.throws(() => new CheckoutQueue([], 1), RangeError);
});

test('checkout duration is configurable and completion emits only one sale', () => {
  const checkout = system(definitions, { ...CHECKOUT, processingMs: 2000 });
  let emitted = 0;
  const unsubscribe = checkout.onSale(() => emitted++);
  enroll(checkout, 1);
  checkout.markReady(1);
  checkout.start('one', 1, 0);
  checkout.update(1000, 1000);
  assert.equal(emitted, 0);
  assert.equal(checkout.stations[0].progress, 0.5);
  checkout.update(1000, 2000);
  checkout.update(1000, 3000);
  assert.equal(emitted, 1);
  unsubscribe();
  enroll(checkout, 2);
  checkout.markReady(2);
  checkout.start('one', 2, 3000);
  checkout.update(2000, 5000);
  assert.equal(emitted, 1);
  assert.equal(checkout.economy.transactions.length, 2);
});

test('scene shutdown cancels jobs, membership and sale callbacks', () => {
  const checkout = system();
  let emitted = 0;
  checkout.onSale(() => emitted++);
  enroll(checkout, 1);
  checkout.markReady(1);
  checkout.start('one', 1, 0);
  checkout.shutdown();
  checkout.update(10000, 10000);
  assert.equal(checkout.start('one', 1, 10000), 'not-ready');
  assert.equal(checkout.registerPurchase(2, purchase()), false);
  assert.equal(checkout.assignment(1), null);
  assert.equal(checkout.status(1), null);
  assert.equal(checkout.stations[0].queue.length, 0);
  assert.equal(checkout.stations[0].state, 'IDLE');
  assert.equal(checkout.economy.money, 100000);
  assert.equal(emitted, 0);
});

test('removing a processing customer cancels its uncommitted sale', () => {
  const checkout = system();
  enroll(checkout, 1);
  checkout.markReady(1);
  checkout.start('one', 1, 0);
  checkout.forgetCustomer(1);
  checkout.update(10000, 10000);
  assert.equal(checkout.economy.transactions.length, 0);
});

const shelf = (productId, stock, x) => ({ id: productId, acceptedProductId: productId, interactionPosition: { x, y: 45 }, stock: new ShelfInventory(productId, 20, stock) });
function customer(checkout, id, shelves, random = () => 0, speed = 1000) {
  return new CustomerBrain({ customerId: id, checkout, shelves, grid: new NavigationGrid(200, 200, 10, []), spawnPosition: { x: 105, y: 185 }, interiorEntrance: { x: 105, y: 155 }, exitPosition: { x: 105, y: 185 }, random, settings: { ...CUSTOMERS, movementSpeed: speed, browseMinMs: 0, browseMaxMs: 0 } });
}
function until(customers, predicate, maxSteps = 1000, delta = 50) {
  for (let step = 0; step < maxSteps && !predicate(); step++) for (const brain of customers) brain.update(delta);
  assert.ok(predicate());
}

test('customers never auto-pay or time out of a queue while holding a purchase', () => {
  const checkout = system();
  const brain = customer(checkout, 1, [shelf('instant_noodles', 1, 55)]);
  until([brain], () => brain.state === 'WAITING_FOR_CHECKOUT');
  for (let step = 0; step < 1000; step++) { checkout.update(100, step * 100); brain.update(100); }
  assert.equal(brain.state, 'WAITING_FOR_CHECKOUT');
  assert.deepEqual(brain.purchase, purchase());
  assert.equal(brain.carriedQuantity, 1);
  assert.equal(checkout.economy.money, 100000);
  assert.equal(checkout.economy.transactions.length, 0);
});

test('two independent cashier sales produce 117000 VND and resist duplicate completion', () => {
  const checkout = system();
  const noodles = shelf('instant_noodles', 1, 55), milk = shelf('milk', 1, 155);
  const first = customer(checkout, 1, [noodles, milk]);
  const second = customer(checkout, 2, [noodles, milk], () => 0.5);
  until([first, second], () => first.state === 'WAITING_FOR_CHECKOUT' && second.state === 'WAITING_FOR_CHECKOUT');
  assert.equal(checkout.assignment(1).cashierId, 'one');
  assert.equal(checkout.assignment(2).cashierId, 'two');
  assert.equal(noodles.stock.currentStock, 0);
  assert.equal(milk.stock.currentStock, 0);
  assert.equal(checkout.start('one', 1, 1000), 'started');
  assert.equal(checkout.start('two', 2, 1000), 'started');
  checkout.update(1000, 2000);
  assert.equal(checkout.economy.money, 117000);
  assert.deepEqual(checkout.economy.statistics, { totalRevenue: 17000, totalCustomersServed: 2, totalItemsSold: 2, salesByProduct: { instant_noodles: 1, milk: 1 } });
  assert.equal(checkout.economy.transactions.length, 2);
  assert.deepEqual(checkout.economy.transactions.map(transaction => transaction.playerId), [1, 2]);
  for (const transaction of checkout.economy.transactions) assert.equal(checkout.economy.commit(transaction), false);
  checkout.update(10000, 12000);
  assert.equal(checkout.economy.money, 117000);
  assert.equal(checkout.economy.statistics.totalCustomersServed, 2);
  until([first, second], () => first.state === 'DESPAWNED' && second.state === 'DESPAWNED');
  assert.equal(first.feedback, 'Cảm ơn!');
  assert.equal(second.feedback, 'Cảm ơn!');
});

test('queue advancement walks to the new slot instead of teleporting', () => {
  const checkout = system([definitions[0]]);
  const stock = shelf('instant_noodles', 3, 55);
  const first = customer(checkout, 1, [stock], () => 0, 100);
  const second = customer(checkout, 2, [stock], () => 0, 100);
  until([first, second], () => first.state === 'WAITING_FOR_CHECKOUT' && second.state === 'QUEUEING' && second.position.y === 110);
  const previous = second.position;
  checkout.start('one', 1, 0);
  checkout.update(1000, 1000);
  assert.deepEqual(second.position, previous);
  assert.deepEqual(checkout.assignment(2).position, { x: 40, y: 140 });
  second.update(50);
  assert.ok(Math.hypot(second.position.x - previous.x, second.position.y - previous.y) <= 5.00001);
  assert.notDeepEqual(second.position, { x: 40, y: 140 });
  until([second], () => second.state === 'WAITING_FOR_CHECKOUT');
  assert.deepEqual(second.position, { x: 40, y: 140 });
});

test('overflow customer waits separately and retries a freed cashier without teleporting', () => {
  const checkout = system([definitions[0]], { ...CHECKOUT, maxQueueLength: 1 });
  const stock = shelf('instant_noodles', 2, 55);
  const first = customer(checkout, 1, [stock]), second = customer(checkout, 2, [stock]);
  until([first, second], () => first.state === 'WAITING_FOR_CHECKOUT' && second.state === 'WAITING_FOR_QUEUE');
  const previous = second.position;
  assert.equal(checkout.assignment(2).kind, 'overflow');
  checkout.start('one', 1, 0);
  checkout.update(1000, 1000);
  second.update(1000);
  assert.equal(second.state, 'MOVING_TO_CHECKOUT');
  assert.deepEqual(second.position, previous);
  until([second], () => second.state === 'WAITING_FOR_CHECKOUT');
  assert.equal(checkout.assignment(2).kind, 'queue');
});

test('out-of-stock trip never joins checkout or changes revenue and statistics', () => {
  const checkout = system();
  const brain = customer(checkout, 1, [shelf('instant_noodles', 0, 55)]);
  until([brain], () => brain.state === 'DESPAWNED');
  assert.equal(checkout.assignment(1), null);
  assert.equal(checkout.status(1), null);
  assert.equal(checkout.economy.money, 100000);
  assert.equal(checkout.economy.statistics.totalRevenue, 0);
  assert.equal(checkout.economy.statistics.totalCustomersServed, 0);
  assert.equal(checkout.economy.statistics.totalItemsSold, 0);
});
