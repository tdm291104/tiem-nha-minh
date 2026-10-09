import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseShoppingList, describePurchase } from '../src/game/customers/ShoppingList.ts';
import { CustomerBrain } from '../src/game/customers/CustomerBrain.ts';
import { CUSTOMERS } from '../src/game/customers/CustomerConfig.ts';
import { ShelfInventory } from '../src/game/products/StockTransfer.ts';
import { NavigationGrid } from '../src/game/navigation/NavigationGrid.ts';
import { CheckoutSystem } from '../src/game/checkout/CheckoutSystem.ts';
const cashier = { id: 'cashier', number: 1, x: 25, y: 85, width: 10, height: 10, interactionPosition: { x: 25, y: 95 }, queuePositions: [{ x: 25, y: 65 }, { x: 25, y: 55 }, { x: 25, y: 45 }, { x: 25, y: 35 }] };
const shelf = (id, stock, x) => ({ id, acceptedProductId: id, interactionPosition: { x, y: 25 }, stock: new ShelfInventory(id, 20, stock) });
function customer(shelves, extras = {}) {
  const samples = [0.9, 0, 0, 0];
  return new CustomerBrain({ customerId: 1, checkout: new CheckoutSystem([cashier], []), grid: new NavigationGrid(100, 100, 10, []), shelves, spawnPosition: { x: 15, y: 85 }, interiorEntrance: { x: 15, y: 65 }, exitPosition: { x: 15, y: 85 }, maxProductTypes: 3, random: () => samples.shift() ?? 0, settings: { ...CUSTOMERS, browseMinMs: 0, browseMaxMs: 0, outOfStockWaitMs: 0 }, ...extras });
}
function waitFor(brain, state) {
  for (let i = 0; i < 3000 && brain.state !== state; i++) brain.update(50);
  assert.equal(brain.state, state);
}
test('shopping list selects one to three distinct valid products deterministically', () => {
  const samples = [0.99, 0, 0, 0]; const list = chooseShoppingList(3, () => samples.shift());
  assert.deepEqual(list, ['instant_noodles', 'soft_drink', 'milk']); assert.ok(Object.isFrozen(list));
  assert.deepEqual(chooseShoppingList(1, () => 0), ['instant_noodles']);
});
test('shopping list rejects invalid configuration and random samples', () => {
  for (const max of [0, 6, -1, 1.5]) assert.throws(() => chooseShoppingList(max, () => 0));
  for (const sample of [-1, 1, NaN, Infinity]) assert.throws(() => chooseShoppingList(3, () => sample));
});
test('multi-product trip consumes each real shelf once and commits one complete cart', () => {
  const shelves = [shelf('instant_noodles', 5, 45), shelf('soft_drink', 5, 65), shelf('milk', 5, 85)], brain = customer(shelves);
  waitFor(brain, 'WAITING_FOR_CHECKOUT'); assert.deepEqual(brain.purchase, brain.shoppingList.map(productId => ({ productId, quantity: 1 })));
  assert.deepEqual(shelves.map(s => s.stock.currentStock), [4, 4, 4]); assert.equal(brain.purchaseIntentFulfilled, true);
  assert.equal(brain.checkout.start('cashier', 2, 10000), 'started'); brain.checkout.update(1000, 11000);
  const economy = brain.checkout.economy; assert.equal(economy.money, 127000); assert.equal(economy.statistics.totalItemsSold, 3); assert.equal(economy.statistics.totalCustomersServed, 1);
  brain.checkout.update(1000, 12000); assert.equal(economy.money, 127000);
  waitFor(brain, 'DESPAWNED'); assert.equal(economy.transactions[0].items.length, 3);
});
test('one unavailable requested product does not discard items already acquired', () => {
  const brain = customer([shelf('instant_noodles', 5, 45), shelf('soft_drink', 0, 65), shelf('milk', 5, 85)]);
  waitFor(brain, 'WAITING_FOR_CHECKOUT'); assert.deepEqual(brain.purchase, [{ productId: 'instant_noodles', quantity: 1 }, { productId: 'milk', quantity: 1 }]);
  assert.equal(brain.purchaseIntentFulfilled, false); assert.equal(brain.hadUnavailableProduct, true);
  brain.checkout.start('cashier', 1, 0); brain.checkout.update(1000, 1000); assert.equal(brain.checkout.economy.money, 117000);
});
test('all unavailable requests leave without a transaction and count failure once', () => {
  const departures = [], brain = customer([shelf('instant_noodles', 0, 45), shelf('soft_drink', 0, 65), shelf('milk', 0, 85)], { onOutOfStockDeparture: id => departures.push(id) });
  waitFor(brain, 'DESPAWNED'); brain.update(5000); assert.deepEqual(departures, [1]); assert.equal(brain.checkout.economy.transactions.length, 0);
});
test('partial multi-unit shelf take stays in cart and is paid for its actual quantity', () => {
  const brain = customer([shelf('instant_noodles', 1, 45)], { maxProductTypes: 1, random: () => 0, settings: { ...CUSTOMERS, desiredQuantity: 2, browseMinMs: 0, browseMaxMs: 0, outOfStockWaitMs: 0 } });
  waitFor(brain, 'WAITING_FOR_CHECKOUT'); assert.equal(brain.purchase[0].quantity, 1); brain.checkout.start('cashier', 1, 0); brain.checkout.update(1000, 1000); assert.equal(brain.checkout.economy.money, 105000);
});
test('missing shelf after obtaining goods skips inaccessible request and checks out', () => {
  const brain = customer([shelf('instant_noodles', 5, 45)]); waitFor(brain, 'WAITING_FOR_CHECKOUT'); assert.equal(brain.carriedQuantity, 1);
  assert.equal(brain.purchaseIntentFulfilled, false); assert.equal(brain.hadUnavailableProduct, false);
});
test('cart description names each actual item rather than attributing all units to last request', () => {
  assert.equal(describePurchase([{ productId: 'instant_noodles', quantity: 1 }, { productId: 'milk', quantity: 2 }]), 'Mì gói · Sữa x2');
});
