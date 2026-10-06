import test from 'node:test';
import assert from 'node:assert/strict';
import { ShelfInventory } from '../src/game/products/StockTransfer.ts';
import { PRODUCTS } from '../src/game/products/ProductCatalog.ts';
import { findShelvesForProduct, takeRequestedProduct } from '../src/game/customers/ShoppingRequest.ts';
import { CustomerBrain } from '../src/game/customers/CustomerBrain.ts';
import { CustomerSpawner } from '../src/game/customers/CustomerSpawner.ts';
import { CUSTOMERS } from '../src/game/customers/CustomerConfig.ts';
import { canTransition } from '../src/game/customers/CustomerState.ts';
import { NavigationGrid } from '../src/game/navigation/NavigationGrid.ts';
import { CheckoutSystem } from '../src/game/checkout/CheckoutSystem.ts';

let nextCustomerId = 1;
const clocks = new WeakMap();
const cashier = { id: 'test-cashier', number: 1, x: 25, y: 85, width: 10, height: 10, interactionPosition: { x: 25, y: 95 }, queuePositions: [{ x: 25, y: 65 }, { x: 25, y: 55 }, { x: 25, y: 45 }, { x: 25, y: 35 }] };
function stepBrain(brain, deltaMs) {
  const time = (clocks.get(brain) ?? 0) + deltaMs;
  clocks.set(brain, time);
  // Test driver supplies explicit player input; production never auto-starts checkout.
  for (const station of brain.checkout.stations) if (station.state === 'HAS_CUSTOMER') brain.checkout.start(station.id, 1, time);
  brain.checkout.update(deltaMs, time);
  brain.update(deltaMs);
}

const makeShelf = (productId = 'instant_noodles', stock = 5, x = 85, y = 25, id = productId) => ({ id, acceptedProductId: productId, interactionPosition: { x, y }, stock: new ShelfInventory(productId, 20, stock) });
const settings = { ...CUSTOMERS, movementSpeed: 100, browseMinMs: 500, browseMaxMs: 500, outOfStockWaitMs: 1200 };
const makeBrain = (shelves, extra = {}) => new CustomerBrain({
  customerId: nextCustomerId++, checkout: new CheckoutSystem([cashier], [{ x: 45, y: 85 }]),
  grid: new NavigationGrid(100, 100, 10, []),
  shelves,
  spawnPosition: { x: 15, y: 85 },
  interiorEntrance: { x: 15, y: 65 },
  exitPosition: { x: 15, y: 85 },
  settings,
  random: () => 0,
  ...extra,
});
function advanceUntil(brain, state, stepMs = 50) {
  for (let step = 0; step < 2000 && brain.state !== state; step++) stepBrain(brain, stepMs);
  assert.equal(brain.state, state);
}

test('shelf discovery uses product data and prioritizes nearest stocked shelf', () => {
  const empty = makeShelf('instant_noodles', 0, 5, 5, 'empty');
  const far = makeShelf('instant_noodles', 5, 85, 85, 'far');
  const near = makeShelf('instant_noodles', 3, 25, 25, 'near');
  const other = makeShelf('milk', 5, 15, 15);
  const shelves = [empty, far, other, near];
  assert.deepEqual(findShelvesForProduct('instant_noodles', { x: 5, y: 5 }, shelves).map(shelf => shelf.id), ['near', 'far', 'empty']);
  assert.deepEqual(findShelvesForProduct('cookies', { x: 5, y: 5 }, shelves), []);
  assert.deepEqual(shelves, [empty, far, other, near]);
});

test('stocked shelf consumption takes real stock and fulfills the request', () => {
  const shelf = makeShelf();
  assert.deepEqual(takeRequestedProduct(shelf, 'instant_noodles', 1), { carriedQuantity: 1, purchaseIntentFulfilled: true });
  assert.equal(shelf.stock.currentStock, 4);
});

test('empty shelf and mismatched product cannot create goods', () => {
  const empty = makeShelf('instant_noodles', 0);
  assert.deepEqual(takeRequestedProduct(empty, 'instant_noodles', 1), { carriedQuantity: 0, purchaseIntentFulfilled: false });
  const wrong = makeShelf('milk', 5);
  assert.deepEqual(takeRequestedProduct(wrong, 'instant_noodles', 1), { carriedQuantity: 0, purchaseIntentFulfilled: false });
  assert.equal(wrong.stock.currentStock, 5);
});

test('future multi-unit requests preserve available units without stock underflow', () => {
  const shelf = makeShelf('instant_noodles', 2);
  assert.deepEqual(takeRequestedProduct(shelf, 'instant_noodles', 3), { carriedQuantity: 2, purchaseIntentFulfilled: false });
  assert.equal(shelf.stock.currentStock, 0);
  assert.throws(() => takeRequestedProduct(shelf, 'instant_noodles', -1), RangeError);
  assert.throws(() => takeRequestedProduct(shelf, 'instant_noodles', 0), RangeError);
});

test('successful lifecycle enters, browses, consumes once, leaves, and despawns', () => {
  const shelf = makeShelf();
  const brain = makeBrain([shelf]);
  const states = new Set([brain.state]);
  for (let frame = 0; frame < 2000 && brain.state !== 'DESPAWNED'; frame++) { stepBrain(brain, 50); states.add(brain.state); }
  assert.deepEqual([...states], ['SPAWNING', 'ENTERING', 'CHOOSING_PRODUCT', 'MOVING_TO_SHELF', 'BROWSING', 'TAKING_PRODUCT', 'MOVING_TO_CHECKOUT', 'QUEUEING', 'WAITING_FOR_CHECKOUT', 'CHECKOUT', 'LEAVING', 'DESPAWNED']);
  assert.equal(brain.targetProductId, 'instant_noodles');
  assert.equal(brain.carriedQuantity, 1);
  assert.equal(brain.purchaseIntentFulfilled, true);
  assert.equal(shelf.stock.currentStock, 4);
  assert.equal(brain.checkout.economy.statistics.totalCustomersServed, 1);
  assert.deepEqual(brain.position, { x: 15, y: 85 });
  brain.update(1000);
  assert.equal(shelf.stock.currentStock, 4);
});

test('browsing waits for its configured duration before taking any stock', () => {
  const shelf = makeShelf();
  const brain = makeBrain([shelf]);
  advanceUntil(brain, 'BROWSING');
  brain.update(499);
  assert.equal(brain.state, 'BROWSING');
  assert.equal(shelf.stock.currentStock, 5);
  brain.update(1);
  assert.equal(brain.state, 'TAKING_PRODUCT');
  assert.equal(shelf.stock.currentStock, 5);
  brain.update(1);
  assert.equal(shelf.stock.currentStock, 4);
});

test('out-of-stock customers show feedback, wait, and leave with nothing', () => {
  const shelf = makeShelf('instant_noodles', 0);
  const brain = makeBrain([shelf]);
  advanceUntil(brain, 'OUT_OF_STOCK');
  assert.equal(brain.feedback, 'Hết hàng!');
  assert.equal(brain.carriedQuantity, 0);
  assert.equal(brain.purchaseIntentFulfilled, false);
  brain.update(1199);
  assert.equal(brain.state, 'OUT_OF_STOCK');
  brain.update(1);
  assert.equal(brain.state, 'LEAVING');
  assert.equal(brain.feedback, '');
  advanceUntil(brain, 'DESPAWNED');
  assert.equal(shelf.stock.currentStock, 0);
  assert.equal(brain.checkout.economy.transactions.length, 0);
});

test('two customers target the last item without reservation or duplication', () => {
  const shelf = makeShelf('instant_noodles', 1);
  const first = makeBrain([shelf]), second = makeBrain([shelf]);
  advanceUntil(first, 'TAKING_PRODUCT');
  advanceUntil(second, 'TAKING_PRODUCT');
  assert.equal(shelf.stock.currentStock, 1);
  first.update(1);
  second.update(1);
  assert.equal(first.carriedQuantity, 1);
  assert.equal(first.purchaseIntentFulfilled, true);
  assert.equal(second.carriedQuantity, 0);
  assert.equal(second.state, 'OUT_OF_STOCK');
  assert.equal(second.feedback, 'Hết hàng!');
  assert.equal(shelf.stock.currentStock, 0);
});

test('restocking before arrival is visible to the real customer inventory', () => {
  const shelf = makeShelf('instant_noodles', 0);
  const brain = makeBrain([shelf]);
  advanceUntil(brain, 'MOVING_TO_SHELF');
  shelf.stock.stockFrom({ productId: 'instant_noodles', quantity: 5 });
  advanceUntil(brain, 'DESPAWNED');
  assert.equal(brain.carriedQuantity, 1);
  assert.equal(shelf.stock.currentStock, 4);
});

test('every requested product is chosen from the five-product catalog', () => {
  const products = Object.values(PRODUCTS);
  products.forEach((product, index) => {
    const shelf = makeShelf(product.id);
    const brain = makeBrain([shelf], { random: () => (index + 0.5) / products.length });
    advanceUntil(brain, 'DESPAWNED');
    assert.equal(brain.targetProductId, product.id);
    assert.equal(brain.carriedQuantity, 1);
    assert.equal(shelf.stock.currentStock, 4);
  });
});

test('missing shelf or unreachable destination fails gracefully and leaves', () => {
  const missing = makeBrain([]);
  advanceUntil(missing, 'DESPAWNED');
  assert.equal(missing.purchaseIntentFulfilled, false);
  const blocked = makeBrain([makeShelf()], { grid: new NavigationGrid(100, 100, 10, [{ x: 80, y: 20, width: 10, height: 10 }]) });
  advanceUntil(blocked, 'DESPAWNED');
  assert.equal(blocked.carriedQuantity, 0);
  const invalidEntrance = makeBrain([makeShelf()], { interiorEntrance: { x: -1, y: 15 } });
  advanceUntil(invalidEntrance, 'DESPAWNED');
  const invalidExit = makeBrain([], { exitPosition: { x: -1, y: 15 } });
  advanceUntil(invalidExit, 'DESPAWNED');
});

test('customer skips unreachable matching shelves and uses a reachable one', () => {
  const blockedShelf = makeShelf('instant_noodles', 5, 25, 55, 'blocked');
  const accessibleShelf = makeShelf('instant_noodles', 5, 85, 25, 'accessible');
  const brain = makeBrain([blockedShelf, accessibleShelf], { grid: new NavigationGrid(100, 100, 10, [{ x: 20, y: 50, width: 10, height: 10 }]) });
  advanceUntil(brain, 'DESPAWNED');
  assert.equal(brain.targetShelf.id, 'accessible');
  assert.equal(blockedShelf.stock.currentStock, 5);
  assert.equal(accessibleShelf.stock.currentStock, 4);
});

test('patience expiry aborts the trip without consuming goods', () => {
  const shelf = makeShelf();
  const brain = makeBrain([shelf], { settings: { ...settings, patienceMs: 100 } });
  brain.update(100);
  assert.equal(brain.state, 'LEAVING');
  advanceUntil(brain, 'DESPAWNED');
  assert.equal(brain.purchaseIntentFulfilled, false);
  assert.equal(shelf.stock.currentStock, 5);
});

test('transition table prevents repeated taking and reviving despawned customers', () => {
  assert.equal(canTransition('BROWSING', 'TAKING_PRODUCT'), true);
  assert.equal(canTransition('TAKING_PRODUCT', 'LEAVING'), true);
  assert.equal(canTransition('TAKING_PRODUCT', 'TAKING_PRODUCT'), false);
  assert.equal(canTransition('LEAVING', 'TAKING_PRODUCT'), false);
  assert.equal(canTransition('DESPAWNED', 'SPAWNING'), false);
});

test('spawning starts after two seconds, respects capacity, and stops cleanly', () => {
  const spawner = new CustomerSpawner(CUSTOMERS, () => 0);
  assert.equal(spawner.update(1999, 0), false);
  assert.equal(spawner.update(1, 0), true);
  assert.equal(spawner.update(3999, 1), false);
  assert.equal(spawner.update(1, 1), true);
  assert.equal(spawner.update(8000, 5), false);
  assert.equal(spawner.update(8000, 5), false);
  assert.equal(spawner.update(1, 4), true);
  assert.equal(spawner.update(1, 4), false);
  spawner.stop();
  assert.equal(spawner.update(100000, 0), false);
});

test('randomized spawn interval reaches the configured upper limit', () => {
  const spawner = new CustomerSpawner(CUSTOMERS, () => 1);
  assert.equal(spawner.update(2000, 0), true);
  assert.equal(spawner.update(7999, 1), false);
  assert.equal(spawner.update(1, 1), true);
});
