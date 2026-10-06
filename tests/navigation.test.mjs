import test from 'node:test';
import assert from 'node:assert/strict';
import { NavigationGrid } from '../src/game/navigation/NavigationGrid.ts';
import { findPath } from '../src/game/navigation/Pathfinder.ts';
import { NavigationAgent } from '../src/game/navigation/NavigationAgent.ts';
import { CUSTOMERS } from '../src/game/customers/CustomerConfig.ts';
import { SHOP, SHELF_SIZE, CRATE_SIZE } from '../src/game/world/ShopDefinition.ts';
import { WORLD, INVENTORY } from '../src/game/config/settings.ts';
import { CustomerBrain } from '../src/game/customers/CustomerBrain.ts';
import { ShelfInventory } from '../src/game/products/StockTransfer.ts';
import { PRODUCTS } from '../src/game/products/ProductCatalog.ts';
import { CheckoutSystem } from '../src/game/checkout/CheckoutSystem.ts';

test('A* routes around a blocked column without entering it', () => {
  const grid = new NavigationGrid(100, 100, 20, [{ x: 40, y: 0, width: 20, height: 80 }]);
  const path = findPath(grid, { x: 10, y: 10 }, { x: 90, y: 10 });
  assert.ok(path);
  assert.ok(path.some(point => point.y === 90));
  for (const point of path) assert.ok(grid.isWalkable(grid.toCell(point)));
  assert.deepEqual(path[0], { x: 10, y: 10 });
  assert.deepEqual(path.at(-1), { x: 90, y: 10 });
});

test('unreachable, blocked, and out-of-bounds endpoints return null', () => {
  const grid = new NavigationGrid(100, 100, 20, [{ x: 40, y: 0, width: 20, height: 100 }]);
  assert.equal(findPath(grid, { x: 10, y: 10 }, { x: 90, y: 10 }), null);
  assert.equal(findPath(grid, { x: 50, y: 10 }, { x: 90, y: 10 }), null);
  assert.equal(findPath(grid, { x: 10, y: 10 }, { x: 50, y: 10 }), null);
  for (const endpoint of [{ x: -1, y: 10 }, { x: 100, y: 10 }, { x: NaN, y: 10 }]) {
    assert.equal(findPath(grid, { x: 10, y: 10 }, endpoint), null);
  }
});

test('four-way paths do not cut diagonally through blocked corners', () => {
  const grid = new NavigationGrid(40, 40, 20, [
    { x: 20, y: 0, width: 20, height: 20 },
    { x: 0, y: 20, width: 20, height: 20 },
  ]);
  assert.equal(findPath(grid, { x: 10, y: 10 }, { x: 30, y: 30 }), null);
});

test('clearance expands obstacles and excludes narrow corridors', () => {
  const grid = new NavigationGrid(100, 100, 10, [{ x: 40, y: 40, width: 20, height: 20 }], 10);
  assert.equal(grid.isWalkable({ column: 3, row: 4 }), false);
  assert.equal(grid.isWalkable({ column: 0, row: 1 }), false);
  assert.equal(grid.isWalkable({ column: 2, row: 4 }), true);
});

test('path follower is frame-rate independent and stops exactly without overshoot', () => {
  const grid = new NavigationGrid(200, 200, 20, []);
  const first = new NavigationAgent(grid, { x: 13, y: 16 }, 100);
  const second = new NavigationAgent(grid, { x: 13, y: 16 }, 100);
  const target = { x: 173, y: 156 };
  assert.ok(first.goTo(target));
  assert.ok(second.goTo(target));
  first.update(1000);
  for (let step = 0; step < 100; step++) second.update(10);
  assert.ok(Math.hypot(first.position.x - second.position.x, first.position.y - second.position.y) < 1e-8);
  assert.ok(first.update(10000));
  assert.deepEqual(first.position, target);
  assert.ok(first.update(10000));
  assert.deepEqual(first.position, target);
});

test('same-cell destinations do not detour through cell centers', () => {
  const grid = new NavigationGrid(100, 100, 20, []);
  const agent = new NavigationAgent(grid, { x: 11, y: 12 }, 100);
  assert.ok(agent.goTo({ x: 13, y: 14 }));
  assert.ok(agent.update(1000));
  assert.deepEqual(agent.position, { x: 13, y: 14 });
});

test('failed route clears an old destination without moving the agent', () => {
  const grid = new NavigationGrid(100, 100, 20, []);
  const agent = new NavigationAgent(grid, { x: 10, y: 10 }, 100);
  assert.ok(agent.goTo({ x: 90, y: 90 }));
  assert.equal(agent.goTo({ x: -10, y: 10 }), false);
  assert.equal(agent.update(1000), false);
  assert.equal(agent.navigationTarget, null);
  assert.deepEqual(agent.position, { x: 10, y: 10 });
});

test('actual shop geometry permits entering, visiting every shelf, and leaving', () => {
  const centeredBounds = (position, size = position) => ({ x: position.x - size.width / 2, y: position.y - size.height / 2, width: size.width, height: size.height });
  const obstacles = [
    centeredBounds(SHOP.supplierTerminal),
    ...SHOP.walls.map(wall => centeredBounds(wall)),
    ...SHOP.counters.map(counter => centeredBounds(counter)),
    ...SHOP.shelves.map(shelf => centeredBounds(shelf, SHELF_SIZE)),
    ...SHOP.crates.map(crate => centeredBounds(crate, CRATE_SIZE)),
  ];
  const grid = new NavigationGrid(WORLD.width, WORLD.height, CUSTOMERS.gridCellSize, obstacles, CUSTOMERS.clearance);
  const routes = [[SHOP.customerSpawn, SHOP.customerEntrance]];
  routes.push([SHOP.spawns[0], SHOP.supplierTerminal.interactionPosition]);
  for (const shelf of SHOP.shelves) {
    const standingPoint = { x: shelf.x, y: shelf.y + SHELF_SIZE.standingOffsetY };
    routes.push([SHOP.customerEntrance, standingPoint], [standingPoint, SHOP.customerExit]);
  }
  for (const counter of SHOP.counters) {
    for (const position of counter.queuePositions) routes.push([SHOP.customerEntrance, position], [position, SHOP.customerExit]);
    for (let index = 1; index < counter.queuePositions.length; index++) routes.push([counter.queuePositions[index], counter.queuePositions[index - 1]]);
  }
  for (const position of SHOP.checkoutWaitingPositions) routes.push([SHOP.customerEntrance, position], [position, SHOP.counters[0].queuePositions[0]]);
  for (const [start, target] of routes) {
    const path = findPath(grid, start, target);
    assert.ok(path, `Missing route from ${JSON.stringify(start)} to ${JSON.stringify(target)}`);
    for (let index = 1; index < path.length; index++) {
      const a = path[index - 1], b = path[index];
      const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
      for (let step = 0; step <= steps; step++) {
        const t = steps === 0 ? 0 : step / steps;
        const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        for (const rect of obstacles) {
          const intersects = point.x > rect.x - CUSTOMERS.clearance && point.x < rect.x + rect.width + CUSTOMERS.clearance && point.y > rect.y - CUSTOMERS.clearance && point.y < rect.y + rect.height + CUSTOMERS.clearance;
          assert.equal(intersects, false, `Route intersects inflated obstacle at ${JSON.stringify(point)}`);
        }
      }
    }
  }
  const shelves = SHOP.shelves.map(shelf => ({ id: shelf.id, acceptedProductId: shelf.productId, interactionPosition: { x: shelf.x, y: shelf.y + SHELF_SIZE.standingOffsetY }, stock: new ShelfInventory(shelf.productId, INVENTORY.shelfCapacity, shelf.initialStock) }));
  const productIds = Object.values(PRODUCTS).map(product => product.id);
  const checkout = new CheckoutSystem(SHOP.counters, SHOP.checkoutWaitingPositions);
  const customers = shelves.map((shelf, index) => new CustomerBrain({
    customerId: index + 1, checkout,
    grid, shelves, spawnPosition: SHOP.customerSpawn, interiorEntrance: SHOP.customerEntrance, exitPosition: SHOP.customerExit,
    random: () => (productIds.indexOf(shelf.acceptedProductId) + 0.5) / productIds.length,
  }));
  for (let step = 0; step < 600; step++) {
    for (const station of checkout.stations) if (station.state === 'HAS_CUSTOMER') checkout.start(station.id, station.id === 'cashier-1' ? 1 : 2, step * 100);
    checkout.update(100, step * 100);
    for (const customer of customers) customer.update(100);
  }
  for (const customer of customers) {
    assert.equal(customer.state, 'DESPAWNED');
    assert.equal(customer.purchaseIntentFulfilled, true);
    assert.equal(customer.carriedQuantity, 1);
    assert.deepEqual(customer.position, SHOP.customerExit);
  }
  for (const [index, shelf] of shelves.entries()) assert.equal(shelf.stock.currentStock, SHOP.shelves[index].initialStock - 1);
  assert.equal(checkout.economy.statistics.totalCustomersServed, 5);
  assert.equal(checkout.economy.statistics.totalItemsSold, 5);
  assert.equal(checkout.economy.statistics.totalRevenue, Object.values(PRODUCTS).reduce((sum, product) => sum + product.sellPrice, 0));
});
