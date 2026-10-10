import test from 'node:test';
import assert from 'node:assert/strict';
import { StoreEconomy } from '../src/game/economy/StoreEconomy.ts';
import { StoreStorage } from '../src/game/inventory/StoreStorage.ts';
import { DayManager } from '../src/game/day/DayManager.ts';
import { SupplierSystem } from '../src/game/supplier/SupplierSystem.ts';
import { SHOP } from '../src/game/world/ShopDefinition.ts';
import { createSale } from '../src/game/checkout/SaleTransaction.ts';
import { economyCheckpoint, restoreEconomy, decodeSave, SaveRepository } from '../src/game/persistence/GameSave.ts';
import { INITIAL_UPGRADES } from '../src/game/upgrades/UpgradeSystem.ts';
const makeSave = () => {
  const economy = new StoreEconomy(), day = new DayManager(economy), storage = new StoreStorage({ instant_noodles: 7 }), supplier = new SupplierSystem(storage, economy);
  return { version: 1, players: [{ id: 1, position: { x: 450, y: 735 }, held: { productId: 'milk', quantity: 3 } }], storage: storage.snapshot, shelves: SHOP.shelves.map(shelf => ({ id: shelf.id, stock: 4 })), drops: [{ position: { x: 550, y: 735 }, stack: { productId: 'cookies', quantity: 2 } }], economy: economyCheckpoint(economy), day: day.checkpoint, supplier: supplier.checkpoint, nextCustomerId: 1, upgrades: INITIAL_UPGRADES };
};
const sale = createSale({ id: 'sale-1', customerId: 1, cashierId: 'cashier-1', playerId: 2, gameTimeMs: 5000 }, [{ productId: 'milk', quantity: 1 }]);
test('save roundtrip preserves carried, floor, shelf and warehouse stock', () => {
  const saved = makeSave(); assert.deepEqual(decodeSave(JSON.stringify(saved)), saved);
});
test('restored economy retains history, expenses and payment deduplication', () => {
  const economy = new StoreEconomy(); economy.trySpend(30000, 'order-1'); economy.commit(sale);
  const restored = restoreEconomy(economyCheckpoint(economy));
  assert.equal(restored.money, 82000); assert.deepEqual(restored.accounting, economy.accounting);
  assert.equal(restored.commit(sale), false); assert.equal(restored.trySpend(30000, 'order-1'), false);
});
test('restored OPEN day preserves timer and preparation accounting baseline', () => {
  const economy = new StoreEconomy(), day = new DayManager(economy);
  economy.trySpend(30000, 'order-1'); day.startDay(); day.update(1234); economy.commit(sale);
  const restored = new DayManager(restoreEconomy(economyCheckpoint(economy))); restored.restore(day.checkpoint);
  assert.equal(restored.state, 'OPEN'); assert.equal(restored.remainingOpenTimeMs, 298766);
  assert.equal(restored.statistics.dailyRevenue, 12000); assert.equal(restored.statistics.dailyExpenses, 30000);
});
test('paid delivery resumes its remaining simulation time and adds stock once', () => {
  const economy = new StoreEconomy(), storage = new StoreStorage(), supplier = new SupplierSystem(storage, economy);
  supplier.confirm('draft', 2, [{ productId: 'instant_noodles', quantity: 10 }], 0); supplier.update(2000);
  const restoredStorage = new StoreStorage(storage.snapshot), restoredEconomy = restoreEconomy(economyCheckpoint(economy));
  const restored = new SupplierSystem(restoredStorage, restoredEconomy); restored.restore(supplier.checkpoint);
  restored.update(2999); assert.equal(restoredStorage.getQuantity('instant_noodles'), 0);
  restored.update(1); restored.update(5000); assert.equal(restoredStorage.getQuantity('instant_noodles'), 10);
  assert.equal(restoredEconomy.money, 70000);
});
test('completed supplier order is not redelivered after restore', () => {
  const economy = new StoreEconomy(), storage = new StoreStorage(), supplier = new SupplierSystem(storage, economy);
  supplier.confirm('draft', 1, [{ productId: 'milk', quantity: 5 }], 0); supplier.update(5000);
  const target = new StoreStorage(storage.snapshot), restored = new SupplierSystem(target, restoreEconomy(economyCheckpoint(economy)));
  restored.restore(supplier.checkpoint); restored.update(10000); assert.equal(target.getQuantity('milk'), 5);
});
test('summary reload restores frozen daily results and next day remains idempotent', () => {
  const economy = new StoreEconomy(), day = new DayManager(economy); day.startDay(); economy.commit(sale); day.update(300000);
  day.finishClosing({ activeCustomers: 0, checkoutProcessing: false, activeDelivery: false });
  const restored = new DayManager(restoreEconomy(economyCheckpoint(economy))); restored.restore(day.checkpoint);
  assert.deepEqual(restored.summary, day.summary); assert.equal(restored.nextDay(1), true); assert.equal(restored.nextDay(1), false);
  assert.equal(restored.statistics.dailyRevenue, 0); assert.equal(economy.money, 112000);
});
test('invalid version, stock, balance and customer sequences are rejected', () => {
  for (const patch of [{ version: 99 }, { nextCustomerId: 0 }, { players: [] }, { storage: { milk: -1 } }, { economy: { ...makeSave().economy, money: 999999 } }]) {
    assert.throws(() => decodeSave(JSON.stringify({ ...makeSave(), ...patch })));
  }
});
test('malformed JSON and inaccessible browser storage fail safely', () => {
  const storage = { getItem: () => '{broken', setItem: () => { throw new Error('Quota exceeded'); } };
  const repository = new SaveRepository(storage); assert.deepEqual(repository.load(), { save: null, error: true }); assert.equal(repository.write(makeSave()), false);
});
test('invalid save never overwrites an existing save slot', () => {
  let raw = null; const repository = new SaveRepository({ getItem: () => raw, setItem: (_key, value) => { raw = value; } });
  assert.equal(repository.write(makeSave()), true); const original = raw;
  assert.equal(repository.write({ ...makeSave(), nextCustomerId: -1 }), false); assert.equal(raw, original);
});
test('unknown and inherited product IDs are rejected in held and dropped goods', () => {
  for (const productId of ['unknown', '__proto__', 'constructor', 'toString']) {
    for (const location of ['held', 'drop']) {
      const saved = makeSave();
      const stack = location === 'held' ? saved.players[0].held : saved.drops[0].stack;
      stack.productId = productId;
      assert.throws(() => decodeSave(JSON.stringify(saved)), /Unknown product/);
    }
  }
});
test('economy replay still rejects forged intermediate ledger entries', () => {
  const economy = new StoreEconomy();
  economy.trySpend(30000, 'order-1', 1000); economy.commit(sale);
  economy.trySpend(1000, 'order-2', 6000);
  for (const [field, value] of [['id', 'forged'], ['balanceAfter', 1], ['gameTimeMs', 999]]) {
    const saved = structuredClone(economyCheckpoint(economy));
    saved.ledger[1][field] = value;
    assert.throws(() => restoreEconomy(saved), /Inconsistent saved ledger/);
  }
});
test('player carrier position touching top wall remains saveable', () => {
  const saved = makeSave(); saved.players[0].position.y = 20; assert.doesNotThrow(() => decodeSave(JSON.stringify(saved)));
});
test('missing warehouse quantities and unpaid upgrade levels reject the complete save', () => {
  for (const patch of [{ storage: undefined }, { storage: { milk: 10 } }, { upgrades: { ...INITIAL_UPGRADES, shelves: 1 } }]) assert.throws(() => decodeSave(JSON.stringify({ ...makeSave(), ...patch })));
});
test('unpaid customer carts return to saved warehouse while sold goods remain a sink', async () => {
  const { recoverUnpaidGoods } = await import('../src/game/persistence/GameSave.ts');
  const storage = new StoreStorage({ instant_noodles: 7, milk: 4 });
  const recovered = recoverUnpaidGoods(storage.snapshot, [{ id: 1, items: [{ productId: 'instant_noodles', quantity: 1 }, { productId: 'milk', quantity: 1 }] }, { id: 2, items: [{ productId: 'milk', quantity: 1 }] }], id => id === 2);
  assert.equal(recovered.instant_noodles, 8); assert.equal(recovered.milk, 5); assert.equal(storage.getQuantity('milk'), 4);
  assert.throws(() => recoverUnpaidGoods(storage.snapshot, [{ id: 1, items: [] }, { id: 1, items: [] }], () => false));
});
test('restored next sale ID never collides with an earlier transaction', async () => {
  const { CheckoutSystem } = await import('../src/game/checkout/CheckoutSystem.ts');
  const economy = new StoreEconomy(); economy.commit(sale);
  const restored = restoreEconomy(economyCheckpoint(economy));
  const definition = { id: 'cashier', number: 1, x: 25, y: 85, width: 10, height: 10, interactionPosition: { x: 25, y: 95 }, queuePositions: [{ x: 25, y: 65 }, { x: 25, y: 55 }, { x: 25, y: 45 }, { x: 25, y: 35 }] };
  const checkout = new CheckoutSystem([definition], [], restored); checkout.registerPurchase(2, [{ productId: 'instant_noodles', quantity: 1 }]); checkout.assign(2, { x: 25, y: 65 }, () => true); checkout.markReady(2); checkout.start('cashier', 1, 5000); checkout.update(1000, 6000);
  assert.equal(restored.transactions.at(-1).id, 'sale-2'); assert.equal(restored.money, 117000);
});

import { ShopProgress } from '../src/game/persistence/ShopProgress.ts';
import { initialPlan } from '../src/game/operations/StorePlan.ts';

function progressSources(withOperations) {
  const economy = new StoreEconomy();
  economy.commit(sale);
  const storage = new StoreStorage({ milk: 4 }, undefined, 1);
  const day = new DayManager(economy);
  const shelves = SHOP.shelves.map(shelf => ({
    id: shelf.id, currentStock: 4,
    stock: { batchSnapshot: [{ quantity: 4, expiresOnDay: 5 }] },
  }));
  return {
    players: [], shelves, economy, day,
    inventory: { storage, worldItems: [] },
    customers: {
      nextCustomerId: 3,
      activeCustomers: [
        { id: 1, brain: { purchase: [{ productId: 'milk', quantity: 1 }], hadUnavailableProduct: false } },
        { id: 2, brain: { purchase: [{ productId: 'milk', quantity: 2, expiresOnDay: 3 }], hadUnavailableProduct: true } },
      ],
    },
    supplier: new SupplierSystem(storage, economy),
    upgrades: { snapshot: INITIAL_UPGRADES },
    ...(withOperations ? {
      operations: {
        get checkpoint() { return { plan: initialPlan() }; },
        staff: { actors: [{ held: { productId: 'milk', quantity: 1, expiresOnDay: 4 } }] },
      },
    } : {}),
  };
}

test('legacy progress snapshot recovers unpaid carts once without changing live stock', () => {
  const sources = progressSources(false);
  const progress = new ShopProgress(sources);
  assert.equal(progress.snapshot().storage.milk, 6);
  assert.equal(progress.snapshot().storage.milk, 6);
  assert.equal(sources.inventory.storage.getQuantity('milk'), 4);
  assert.deepEqual(progress.snapshot().day.outOfStockIds, [2]);
  assert.equal(sources.day.statistics.outOfStockCustomers, 0);
});

test('operations snapshot retains expiry batches and employee goods without recovering sales', () => {
  const sources = progressSources(true);
  const progress = new ShopProgress(sources);
  const saved = progress.snapshot();
  assert.equal(saved.storage.milk, 7);
  assert.equal(saved.operations.storageBatches.milk.reduce((sum, batch) => sum + batch.quantity, 0), 7);
  assert.deepEqual(saved.operations.storageBatches.milk.map(batch => batch.expiresOnDay), [3, 4]);
  assert.deepEqual(saved.shelves, SHOP.shelves.map(shelf => ({ id: shelf.id, stock: 4 })));
  assert.deepEqual(saved.operations.shelfBatches[0].batches, [{ quantity: 4, expiresOnDay: 5 }]);
  assert.deepEqual(progress.snapshot(), saved);
  assert.equal(sources.inventory.storage.getQuantity('milk'), 4);
  assert.equal(sources.operations.staff.actors[0].held.quantity, 1);
});

test('progress snapshot rejects duplicate recovery in both save formats', () => {
  for (const withOperations of [false, true]) {
    const sources = progressSources(withOperations);
    sources.customers.activeCustomers.push(sources.customers.activeCustomers[1]);
    assert.throws(() => new ShopProgress(sources).snapshot(), /Duplicate customer recovery/);
    assert.equal(sources.inventory.storage.getQuantity('milk'), 4);
  }
});
test('autosave reports storage failure and successful retry without changing the old save', () => {
  const previousWindow = globalThis.window;
  let raw = JSON.stringify(makeSave()), blocked = true;
  const original = raw;
  const results = [];
  globalThis.window = { localStorage: {
    getItem: () => raw,
    setItem: (_key, value) => { if (blocked) throw new Error('Quota exceeded'); raw = value; },
  } };
  try {
    const sources = progressSources(false);
    const progress = new ShopProgress(sources, saved => results.push(saved));
    progress.snapshot = makeSave;
    progress.update(4999); assert.deepEqual(results, []);
    progress.update(1); assert.deepEqual(results, [false]); assert.equal(raw, original);
    blocked = false;
    assert.equal(progress.save(), true); assert.deepEqual(results, [false, true]);
    progress.snapshot = () => { throw new RangeError('Invalid snapshot'); };
    assert.equal(progress.save(), false); assert.deepEqual(results, [false, true, false]);
    assert.equal(raw, original);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
