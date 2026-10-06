import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS, createStack } from '../src/game/products/ProductCatalog.ts';
import { ShelfInventory, transferToShelf } from '../src/game/products/StockTransfer.ts';

const shelf = (currentStock, maxStock = 20) => ({ acceptedProductId: 'instant_noodles', currentStock, maxStock });

test('stock 5 into 10/20 leaves 15/20 and empty hands', () => {
  const result = transferToShelf(shelf(10), createStack('instant_noodles', 5));
  assert.deepEqual(result, { status: 'stocked', currentStock: 15, heldItem: null, transferred: 5 });
});

test('stock 5 into 18/20 preserves the remaining 3', () => {
  const result = transferToShelf(shelf(18), createStack('instant_noodles', 5));
  assert.equal(result.currentStock, 20);
  assert.equal(result.transferred, 2);
  assert.deepEqual(result.heldItem, createStack('instant_noodles', 3));
});

test('wrong product leaves both inventories unchanged', () => {
  const held = createStack('soft_drink', 5);
  const result = transferToShelf(shelf(10), held);
  assert.deepEqual(result, { status: 'wrong-product', currentStock: 10, heldItem: held, transferred: 0 });
});

test('full shelf preserves all held products', () => {
  const held = createStack('instant_noodles', 5);
  assert.deepEqual(transferToShelf(shelf(20), held), { status: 'full', currentStock: 20, heldItem: held, transferred: 0 });
});

test('empty-handed interaction leaves shelf stock unchanged', () => {
  assert.deepEqual(transferToShelf(shelf(10), null), { status: 'empty-handed', currentStock: 10, heldItem: null, transferred: 0 });
});

test('transfer never mutates its input objects', () => {
  const state = Object.freeze(shelf(18));
  const held = createStack('instant_noodles', 5);
  transferToShelf(state, held);
  assert.equal(state.currentStock, 18);
  assert.equal(held.quantity, 5);
});

test('all legal product quantities conserve goods and respect capacity', () => {
  for (const product of Object.values(PRODUCTS)) {
    for (let stock = 0; stock <= 20; stock++) {
      for (let quantity = 1; quantity <= product.maxStack; quantity++) {
        const state = { acceptedProductId: product.id, currentStock: stock, maxStock: 20 };
        const result = transferToShelf(state, createStack(product.id, quantity));
        assert.equal(result.currentStock + (result.heldItem?.quantity ?? 0), stock + quantity);
        assert.ok(result.currentStock >= 0 && result.currentStock <= 20);
        assert.ok(result.transferred >= 0 && result.transferred <= quantity);
      }
    }
  }
});

test('negative, fractional, non-finite, and unsafe quantities are rejected', () => {
  for (const invalid of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => transferToShelf(shelf(invalid), null), RangeError);
    assert.throws(() => transferToShelf(shelf(0, invalid), null), RangeError);
    assert.throws(() => transferToShelf(shelf(0), { productId: 'instant_noodles', quantity: invalid }), RangeError);
  }
  assert.throws(() => transferToShelf(shelf(21), null), RangeError);
  assert.throws(() => createStack('instant_noodles', 0), RangeError);
  assert.throws(() => createStack('instant_noodles', 6), RangeError);
});

test('two players stocking the same shelf sequentially cannot exceed capacity', () => {
  const inventory = new ShelfInventory('instant_noodles', 20, 18);
  const first = inventory.stockFrom(createStack('instant_noodles', 5));
  const second = inventory.stockFrom(createStack('instant_noodles', 5));
  assert.equal(inventory.currentStock, 20);
  assert.equal(first.heldItem.quantity, 3);
  assert.equal(second.heldItem.quantity, 5);
  assert.equal(second.status, 'full');
});

test('stocking with empty hands again cannot duplicate a deposited stack', () => {
  const inventory = new ShelfInventory('instant_noodles', 20, 10);
  const first = inventory.stockFrom(createStack('instant_noodles', 5));
  inventory.stockFrom(first.heldItem);
  assert.equal(inventory.currentStock, 15);
});

test('independent shelf inventories do not share stock', () => {
  const first = new ShelfInventory('instant_noodles', 20);
  const second = new ShelfInventory('milk', 20);
  first.stockFrom(createStack('instant_noodles', 5));
  second.stockFrom(createStack('milk', 3));
  assert.equal(first.currentStock, 5);
  assert.equal(second.currentStock, 3);
});

test('future consumers can take available stock without underflow', () => {
  const inventory = new ShelfInventory('milk', 20, 3);
  assert.equal(inventory.take(2), 2);
  assert.equal(inventory.currentStock, 1);
  assert.equal(inventory.take(5), 1);
  assert.equal(inventory.take(1), 0);
  assert.equal(inventory.currentStock, 0);
});

test('invalid stock consumption fails without changing shelf quantity', () => {
  const inventory = new ShelfInventory('milk', 20, 3);
  assert.throws(() => inventory.take(-1), RangeError);
  assert.throws(() => inventory.take(0.5), RangeError);
  assert.equal(inventory.currentStock, 3);
  assert.equal(inventory.take(0), 0);
});

test('catalog defines five distinct, valid products and shapes', () => {
  assert.equal(Object.keys(PRODUCTS).length, 5);
  assert.equal(new Set(Object.values(PRODUCTS).map(product => product.placeholderColor)).size, 5);
  assert.equal(new Set(Object.values(PRODUCTS).map(product => product.placeholderShape)).size, 5);
  for (const [id, product] of Object.entries(PRODUCTS)) {
    assert.equal(product.id, id);
    assert.deepEqual(createStack(product.id), { productId: id, quantity: product.maxStack });
  }
});

test('stock observers receive both player stocking and customer consumption changes', () => {
  const inventory = new ShelfInventory('milk', 20, 5);
  const changes = [];
  const unsubscribe = inventory.onChange(quantity => changes.push(quantity));
  inventory.stockFrom(createStack('milk', 5));
  inventory.take(1);
  inventory.stockFrom(null);
  inventory.take(0);
  assert.deepEqual(changes, [10, 9]);
  unsubscribe();
  inventory.take(1);
  assert.deepEqual(changes, [10, 9]);
  assert.equal(inventory.currentStock, 8);
});
