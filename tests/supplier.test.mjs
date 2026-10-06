import test from 'node:test';
import assert from 'node:assert/strict';
import { StoreStorage } from '../src/game/inventory/StoreStorage.ts';
import { retrieveStorageStack } from '../src/game/inventory/StorageTransfer.ts';
import { StoreEconomy } from '../src/game/economy/StoreEconomy.ts';
import { PRODUCTS, createStack } from '../src/game/products/ProductCatalog.ts';
import { ShelfInventory } from '../src/game/products/StockTransfer.ts';
import { SupplierSystem } from '../src/game/supplier/SupplierSystem.ts';
import { createOrder, priceOrder } from '../src/game/supplier/SupplierOrder.ts';
import { SUPPLIER, INITIAL_STORAGE } from '../src/game/supplier/SupplierConfig.ts';
import { OrderDraft } from '../src/game/supplier/OrderDraft.ts';
import { formatSignedVnd } from '../src/game/economy/Money.ts';
import { createSale } from '../src/game/checkout/SaleTransaction.ts';
import { CheckoutSystem } from '../src/game/checkout/CheckoutSystem.ts';

const items = (quantity = 10, productId = 'instant_noodles') => [{ productId, quantity }];
function setup(initial = {}, money = 100000, settings = SUPPLIER) {
  const storage = new StoreStorage(initial), economy = new StoreEconomy(money);
  return { storage, economy, supplier: new SupplierSystem(storage, economy, settings) };
}
const sale = () => createSale({ id: 'test-sale', customerId: 1, cashierId: 'cashier', playerId: 2, gameTimeMs: 6000 }, items(1));

test('finite storage starts with configured ten units of every product', () => {
  const storage = new StoreStorage(INITIAL_STORAGE);
  for (const product of Object.values(PRODUCTS)) assert.equal(storage.getQuantity(product.id), 10);
  assert.ok(Object.isFrozen(storage.snapshot));
});

test('storage take 5 from 10 returns 5 and leaves 5', () => {
  const storage = new StoreStorage({ instant_noodles: 10 });
  assert.equal(storage.take('instant_noodles', 5), 5);
  assert.equal(storage.getQuantity('instant_noodles'), 5);
});

test('partial storage pickup produces a three-unit held stack', () => {
  const storage = new StoreStorage({ instant_noodles: 3 });
  const result = retrieveStorageStack(storage, 'instant_noodles', null);
  assert.equal(result.status, 'taken');
  assert.deepEqual(result.heldItem, createStack('instant_noodles', 3));
  assert.equal(storage.getQuantity('instant_noodles'), 0);
});

test('empty storage cannot generate goods', () => {
  const storage = new StoreStorage();
  assert.equal(storage.take('milk', 5), 0);
  assert.deepEqual(retrieveStorageStack(storage, 'milk', null), { status: 'empty', heldItem: null });
});

test('held goods prevent storage withdrawal and remain intact', () => {
  const storage = new StoreStorage({ milk: 10 });
  const held = createStack('instant_noodles', 2);
  assert.deepEqual(retrieveStorageStack(storage, 'milk', held), { status: 'holding', heldItem: held });
  assert.equal(storage.getQuantity('milk'), 10);
});

test('shared storage cannot give the same final units to two players', () => {
  const storage = new StoreStorage({ milk: 7 });
  const first = retrieveStorageStack(storage, 'milk', null), second = retrieveStorageStack(storage, 'milk', null);
  assert.equal(first.heldItem.quantity, 5);
  assert.equal(second.heldItem.quantity, 2);
  assert.equal(storage.getQuantity('milk'), 0);
  assert.equal(retrieveStorageStack(storage, 'milk', null).status, 'empty');
});

test('storage addition increases five units by ten to fifteen', () => {
  const storage = new StoreStorage({ milk: 5 });
  storage.add('milk', 10);
  assert.equal(storage.getQuantity('milk'), 15);
});

test('storage notifications update immediately and unsubscribe cleanly', () => {
  const storage = new StoreStorage({ milk: 10 }), changes = [];
  const unsubscribe = storage.onChange((id, quantity) => changes.push([id, quantity]));
  storage.take('milk', 5); storage.add('milk', 10); storage.take('milk', 0);
  assert.deepEqual(changes, [['milk', 5], ['milk', 15]]);
  unsubscribe(); storage.take('milk', 1);
  assert.equal(changes.length, 2);
});

test('storage validates a whole batch before mutation or notification', () => {
  const storage = new StoreStorage({ milk: Number.MAX_SAFE_INTEGER });
  let events = 0;
  storage.onChange(() => events++);
  assert.throws(() => storage.addBatch([...items(10), { productId: 'milk', quantity: 1 }]), RangeError);
  assert.equal(storage.getQuantity('instant_noodles'), 0);
  assert.equal(storage.getQuantity('milk'), Number.MAX_SAFE_INTEGER);
  assert.equal(events, 0);
});

test('delivery batch observers see every product updated together', () => {
  const storage = new StoreStorage();
  storage.onChange(() => { assert.equal(storage.getQuantity('milk'), 5); assert.equal(storage.getQuantity('instant_noodles'), 10); });
  storage.addBatch([...items(10), ...items(5, 'milk')]);
});

test('storage rejects invalid quantities and products without changing stock', () => {
  const storage = new StoreStorage({ milk: 10 });
  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => storage.take('milk', value), RangeError);
    assert.throws(() => storage.add('milk', value), RangeError);
    assert.throws(() => new StoreStorage({ milk: value }), RangeError);
  }
  assert.throws(() => storage.add('not-a-product', 1), RangeError);
  assert.throws(() => storage.getQuantity('toString'), RangeError);
  assert.equal(storage.getQuantity('milk'), 10);
});

test('repeated withdrawals never make storage negative', () => {
  const storage = new StoreStorage({ milk: 13 });
  let received = 0;
  for (let index = 0; index < 100; index++) { received += storage.take('milk', 5); assert.ok(storage.getQuantity('milk') >= 0); }
  assert.equal(received, 13);
  assert.equal(storage.getQuantity('milk'), 0);
});

test('central catalog contains integer buy prices below sell prices', () => {
  assert.deepEqual(Object.values(PRODUCTS).map(product => product.buyPrice), [3000, 6000, 8000, 9000, 15000]);
  for (const product of Object.values(PRODUCTS)) { assert.ok(Number.isSafeInteger(product.buyPrice)); assert.ok(product.buyPrice > 0 && product.buyPrice < product.sellPrice); }
});

test('order price for ten noodles is 30000 VND', () => {
  const quote = priceOrder(items());
  assert.equal(quote.totalCost, 30000);
  assert.equal(quote.items[0].unitBuyPrice, 3000);
  assert.equal(quote.items[0].lineTotal, 30000);
});

test('multiline order prices sum correctly and omit zero quantity', () => {
  const quote = priceOrder([...items(10), ...items(5, 'milk'), ...items(0, 'cookies')]);
  assert.equal(quote.totalCost, 70000);
  assert.equal(quote.items.length, 2);
});

test('order drafts adjust in fives and clamp to zero and fifty', () => {
  const draft = new OrderDraft();
  draft.adjust('milk', -1); assert.equal(draft.getQuantity('milk'), 0);
  draft.adjust('milk', 1); assert.equal(draft.getQuantity('milk'), 5); assert.equal(draft.totalCost, 40000);
  for (let step = 0; step < 20; step++) draft.adjust('milk', 1);
  assert.equal(draft.getQuantity('milk'), 50);
  draft.adjust('milk', -1); assert.equal(draft.getQuantity('milk'), 45);
  assert.ok(Object.isFrozen(draft.items));
});

test('order quantity above maximum, duplicates, and invalid values are rejected', () => {
  for (const quantity of [-1, 1.5, NaN, Infinity, 51, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => priceOrder(items(quantity)), RangeError);
  assert.throws(() => priceOrder([...items(5), ...items(5)]), RangeError);
  assert.throws(() => priceOrder(items(5, 'unknown')), RangeError);
  assert.throws(() => new OrderDraft(0), RangeError);
  assert.throws(() => new OrderDraft(5, -1), RangeError);
  assert.equal(priceOrder(items(50)).totalCost, 150000);
});

test('insufficient funds reject entire order without spending or delivery', () => {
  const { supplier, economy, storage } = setup({}, 10000);
  assert.equal(supplier.confirm('request', 1, items(), 0).status, 'insufficient-funds');
  assert.equal(economy.money, 10000); assert.equal(economy.accounting.totalExpenses, 0);
  assert.equal(economy.moneyLedger.length, 0); assert.equal(supplier.activeOrder, null);
  assert.equal(supplier.orders.length, 0); assert.equal(storage.getQuantity('instant_noodles'), 0);
});

test('valid purchase spends once and does not deliver before configured delay', () => {
  const { supplier, economy, storage } = setup();
  const result = supplier.confirm('request', 1, items(), 0);
  assert.equal(result.status, 'accepted'); assert.equal(result.order.status, 'DELIVERING');
  assert.equal(economy.money, 70000); assert.equal(economy.accounting.totalExpenses, 30000);
  assert.equal(supplier.deliver(result.order.id), false);
  supplier.update(4999); assert.equal(storage.getQuantity('instant_noodles'), 0);
  assert.equal(supplier.remainingMs, 1);
  supplier.update(1); assert.equal(storage.getQuantity('instant_noodles'), 10);
  assert.equal(supplier.orders[0].status, 'DELIVERED'); assert.equal(supplier.activeOrder, null);
});

test('delivery can be configured and adds to existing stock exactly once', () => {
  const { supplier, storage } = setup({ instant_noodles: 5 }, 100000, { ...SUPPLIER, deliveryMs: 100 });
  const result = supplier.confirm('request', 1, items(), 0);
  supplier.update(100); supplier.update(10000);
  assert.equal(storage.getQuantity('instant_noodles'), 15);
  assert.equal(supplier.deliver(result.order.id), false);
  assert.equal(storage.getQuantity('instant_noodles'), 15);
});

test('duplicate confirmation is rejected before and after delivery', () => {
  const { supplier, economy } = setup();
  supplier.confirm('request', 1, items(), 0);
  assert.equal(supplier.confirm('request', 2, items(), 0).status, 'duplicate');
  supplier.update(5000);
  assert.equal(supplier.confirm('request', 2, items(), 5000).status, 'duplicate');
  assert.equal(economy.money, 70000); assert.equal(supplier.orders.length, 1);
  assert.equal(economy.moneyLedger.length, 1);
});

test('one active delivery rejects another order and permits a new order after completion', () => {
  const { supplier, economy } = setup();
  supplier.confirm('first', 1, items(), 0);
  assert.equal(supplier.confirm('second', 2, items(), 1).status, 'busy');
  assert.equal(economy.money, 70000);
  supplier.update(5000);
  assert.equal(supplier.confirm('second', 2, items(), 5000).status, 'accepted');
  assert.equal(economy.money, 40000); assert.equal(supplier.orders.length, 2);
});

test('either player may order into the same shared storage and economy', () => {
  const { supplier, storage, economy } = setup();
  const first = supplier.confirm('p1', 1, items(5), 0); supplier.update(5000);
  const second = supplier.confirm('p2', 2, items(5), 5000); supplier.update(5000);
  assert.equal(first.order.playerId, 1); assert.equal(second.order.playerId, 2);
  assert.equal(storage.getQuantity('instant_noodles'), 10); assert.equal(economy.money, 70000);
});

test('supplier snapshots are immutable and pricing changes cannot alter an existing order', () => {
  const { supplier } = setup();
  const input = items();
  const result = supplier.confirm('request', 2, input, 0);
  input[0].quantity = 50;
  const previous = PRODUCTS.instant_noodles;
  try {
    PRODUCTS.instant_noodles = { ...previous, buyPrice: 9000 };
    assert.equal(result.order.totalCost, 30000); assert.equal(result.order.items[0].unitBuyPrice, 3000);
    assert.equal(priceOrder(items()).totalCost, 90000);
  } finally { PRODUCTS.instant_noodles = previous; }
  assert.ok(Object.isFrozen(result.order)); assert.ok(Object.isFrozen(result.order.items)); assert.ok(Object.isFrozen(result.order.items[0]));
  assert.throws(() => { result.order.items[0].quantity = 99; }, TypeError);
  supplier.update(5000);
  assert.equal(result.order.status, 'DELIVERING'); assert.equal(supplier.orders[0].status, 'DELIVERED');
});

test('invalid and zero orders cannot spend money', () => {
  const { supplier, economy } = setup();
  for (const request of [[], items(0), items(-1), items(51), items(5, 'unknown')]) assert.equal(supplier.confirm('request', 1, request, 0).status, 'invalid');
  assert.equal(supplier.confirm('', 1, items(), 0).status, 'invalid');
  assert.equal(supplier.confirm('request', 3, items(), 0).status, 'invalid');
  assert.equal(supplier.confirm('request', 1, items(), -1).status, 'invalid');
  assert.equal(economy.money, 100000); assert.equal(supplier.orders.length, 0);
  assert.throws(() => createOrder('id', 1, [], 0), RangeError);
});

test('spending validates integer currency and rejects duplicate ledger references', () => {
  const economy = new StoreEconomy();
  for (const value of [-1, 0, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => economy.trySpend(value, 'purchase'), RangeError);
  assert.equal(economy.trySpend(30000, 'purchase'), true);
  assert.equal(economy.trySpend(30000, 'purchase'), false);
  assert.equal(economy.trySpend(80000, 'too-expensive'), false);
  assert.equal(economy.money, 70000); assert.equal(economy.accounting.totalExpenses, 30000);
});

test('sale revenue and supplier expenses are separate and profit may be negative', () => {
  const economy = new StoreEconomy();
  economy.trySpend(30000, 'purchase'); economy.commit(sale());
  assert.equal(economy.money, 75000); assert.equal(economy.statistics.totalRevenue, 5000);
  assert.equal(economy.accounting.totalExpenses, 30000); assert.equal(economy.accounting.profit, -25000);
  assert.equal(formatSignedVnd(-25000), '-25.000đ');
  assert.deepEqual(economy.moneyLedger.map(entry => [entry.kind, entry.amount]), [['SUPPLIER_PURCHASE', -30000], ['SALE', 5000]]);
  assert.equal(economy.moneyLedger[1].balanceAfter, 75000);
  assert.ok(Object.isFrozen(economy.moneyLedger)); assert.ok(Object.isFrozen(economy.moneyLedger[0]));
  assert.equal(economy.commit(sale()), false); assert.equal(economy.moneyLedger.length, 2);
});

test('storage to independent players to partially full shelf conserves every unit', () => {
  const storage = new StoreStorage({ instant_noodles: 10 }), shelf = new ShelfInventory('instant_noodles', 20, 18);
  let first = retrieveStorageStack(storage, 'instant_noodles', null).heldItem;
  let second = retrieveStorageStack(storage, 'instant_noodles', null).heldItem;
  const total = () => storage.getQuantity('instant_noodles') + (first?.quantity ?? 0) + (second?.quantity ?? 0) + shelf.currentStock;
  assert.equal(total(), 28);
  first = shelf.stockFrom(first).heldItem; assert.equal(first.quantity, 3); assert.equal(total(), 28);
  second = shelf.stockFrom(second).heldItem; assert.equal(second.quantity, 5); assert.equal(total(), 28);
});

test('buy deliver stock and player checkout yields 75000 balance and -25000 profit', () => {
  const { supplier, economy, storage } = setup();
  const ordered = supplier.confirm('request', 1, items(), 0);
  assert.equal(economy.money, 70000); assert.equal(economy.accounting.totalExpenses, 30000);
  supplier.update(5000); assert.equal(storage.getQuantity('instant_noodles'), 10);
  let held = retrieveStorageStack(storage, 'instant_noodles', null).heldItem;
  assert.equal(storage.getQuantity('instant_noodles'), 5); assert.equal(held.quantity, 5);
  const shelf = new ShelfInventory('instant_noodles', 20);
  held = shelf.stockFrom(held).heldItem; assert.equal(held, null); assert.equal(shelf.currentStock, 5);
  const acquired = shelf.take(1); assert.equal(acquired, 1);
  assert.equal(storage.getQuantity('instant_noodles') + shelf.currentStock + acquired, 10);
  const cashier = { id: 'cashier', number: 1, x: 100, y: 100, width: 20, height: 20, interactionPosition: { x: 100, y: 120 }, queuePositions: [{ x: 100, y: 80 }, { x: 100, y: 60 }, { x: 100, y: 40 }, { x: 100, y: 20 }] };
  const checkout = new CheckoutSystem([cashier], [], economy);
  assert.equal(checkout.registerPurchase(1, items(acquired)), true);
  checkout.assign(1, { x: 100, y: 80 }, () => true); checkout.markReady(1);
  assert.equal(checkout.start('cashier', 2, 5000), 'started');
  checkout.update(1000, 6000);
  assert.equal(economy.money, 75000); assert.equal(economy.accounting.totalRevenue, 5000);
  assert.equal(economy.accounting.totalExpenses, 30000); assert.equal(economy.accounting.profit, -25000);
  assert.equal(economy.statistics.totalCustomersServed, 1); assert.equal(economy.statistics.totalItemsSold, 1);
  assert.equal(supplier.deliver(ordered.order.id), false); supplier.update(10000); checkout.update(10000, 16000);
  assert.equal(economy.commit(economy.transactions[0]), false);
  assert.equal(economy.money, 75000); assert.equal(storage.getQuantity('instant_noodles'), 5);
  assert.equal(shelf.currentStock, 4); assert.equal(economy.moneyLedger.length, 2);
});

test('delivery claims before notifications prevent reentrant duplicates', () => {
  const { supplier, storage } = setup();
  const result = supplier.confirm('request', 1, items(), 0);
  let events = 0;
  storage.onChange(() => { events++; assert.equal(supplier.deliver(result.order.id), false); });
  supplier.update(5000);
  assert.equal(events, 1); assert.equal(storage.getQuantity('instant_noodles'), 10);
});

test('shutdown discards delivery and subscriptions without later stock mutation', () => {
  const { supplier, storage, economy } = setup();
  const result = supplier.confirm('request', 1, items(), 0);
  let events = 0; supplier.onChange(() => events++);
  supplier.update(4000); supplier.shutdown(); storage.shutdown();
  supplier.update(10000); assert.equal(supplier.deliver(result.order.id), false);
  assert.equal(supplier.confirm('new', 2, items(), 10000).status, 'stopped');
  assert.equal(storage.getQuantity('instant_noodles'), 0); assert.equal(supplier.activeOrder, null);
  assert.equal(events, 0); assert.equal(economy.money, 70000);
});

test('custom maximum quantity is enforced by domain confirmation', () => {
  const { supplier, economy } = setup({}, 100000, { ...SUPPLIER, maxQuantity: 5 });
  assert.equal(supplier.confirm('request', 1, items(10), 0).status, 'invalid');
  assert.equal(economy.money, 100000);
  assert.equal(supplier.confirm('request', 1, items(5), 0).status, 'accepted');
});
