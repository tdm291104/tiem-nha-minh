import type { Position } from '../types/game.ts';
import type { ProductStack } from '../products/Product.ts';
import type { StoreEconomy } from '../economy/StoreEconomy.ts';
import type { StoreStorage } from '../inventory/StoreStorage.ts';
import type { ShoppingShelf } from '../customers/ShoppingRequest.ts';
import type { CheckoutSystem } from '../checkout/CheckoutSystem.ts';
import type { NavigationGrid } from '../navigation/NavigationGrid.ts';
import { NavigationAgent } from '../navigation/NavigationAgent.ts';
import { retrieveStorageStack } from '../inventory/StorageTransfer.ts';
import type { CleaningSystem } from '../operations/CleaningSystem.ts';
import { OPERATIONS, STOCK_RECEIVING } from '../operations/OperationsConfig.ts';
export type EmployeeRole = 'stock' | 'clean' | 'cashier';
export interface EmployeeRecord { id: number; name: string; role: EmployeeRole; paidDay: number; lastBilledDay: number }
export interface EmployeeActor { record: EmployeeRecord; navigation: NavigationAgent; held: ProductStack | null; task: string; destinationId: string | number | null }
const NAMES = ['An', 'Bình', 'Linh'];
export function validateEmployeeRecords(saved: readonly EmployeeRecord[]): void {
  if (saved.length > OPERATIONS.maxEmployees || new Set(saved.map(record => record.id)).size !== saved.length) throw new RangeError('Invalid saved employees');
  for (const record of saved) if (!Number.isSafeInteger(record.id) || record.id < 1 || record.id > OPERATIONS.maxEmployees || !['stock', 'clean', 'cashier'].includes(record.role) || record.name !== NAMES[record.id - 1] || !Number.isSafeInteger(record.paidDay) || record.paidDay < 0 || !Number.isSafeInteger(record.lastBilledDay) || record.lastBilledDay < record.paidDay) throw new RangeError('Invalid saved employee');
}

export class EmployeeSystem {
  private readonly workers: EmployeeActor[] = [];
  private readonly economy: StoreEconomy;
  private readonly storage: StoreStorage;
  private readonly shelves: readonly ShoppingShelf[];
  private readonly checkout: CheckoutSystem;
  private readonly cleaning: CleaningSystem;
  private readonly grid: NavigationGrid;
  private readonly allowed: () => boolean;
  constructor(economy: StoreEconomy, storage: StoreStorage, shelves: readonly ShoppingShelf[], checkout: CheckoutSystem, cleaning: CleaningSystem, grid: NavigationGrid, allowed: () => boolean, saved: readonly EmployeeRecord[] = []) {
    this.economy = economy; this.storage = storage; this.shelves = shelves; this.checkout = checkout; this.cleaning = cleaning; this.grid = grid; this.allowed = allowed;
    validateEmployeeRecords(saved); for (const record of saved) this.add(record);
  }

  private add(record: EmployeeRecord): void { this.workers.push({ record: { ...record }, navigation: new NavigationAgent(this.grid, { x: 410 + record.id * 45, y: 795 }, OPERATIONS.employeeSpeed), held: null, task: 'Nghỉ', destinationId: null }); }
  get actors(): readonly EmployeeActor[] { return this.workers; }
  get checkpoint(): readonly EmployeeRecord[] { return this.workers.map(worker => ({ ...worker.record })); }
  hire(role: EmployeeRole, gameTimeMs: number): boolean {
    if (!this.allowed() || !['stock', 'clean', 'cashier'].includes(role) || this.workers.length >= OPERATIONS.maxEmployees) return false;
    const id = Math.max(0, ...this.workers.map(worker => worker.record.id)) + 1;
    if (!this.economy.trySpend(OPERATIONS.employeeHireCost, `staff-hire-${id}`, gameTimeMs, 'STAFF_HIRE')) return false;
    this.add({ id, name: NAMES[id - 1]!, role, paidDay: 0, lastBilledDay: 0 }); return true;
  }
  assign(id: number, role: EmployeeRole): boolean {
    const worker = this.workers.find(worker => worker.record.id === id);
    if (!this.allowed() || !worker || !['stock', 'clean', 'cashier'].includes(role)) return false;
    if (worker.held) this.storage.addBatch([worker.held]);
    worker.held = null; worker.record.role = role; worker.task = 'Nghỉ'; worker.destinationId = null; return true;
  }
  startDay(day: number, gameTimeMs: number): void {
    for (const worker of this.workers) {
      if (worker.record.lastBilledDay >= day) continue;
      worker.record.lastBilledDay = day;
      if (this.economy.trySpend(OPERATIONS.employeeWage, `staff-wage-${day}-${worker.record.id}`, gameTimeMs, 'STAFF_WAGE')) worker.record.paidDay = day;
    }
  }
  position(actorId: string): Position | null { const worker = this.workers.find(worker => actorId === `employee-${worker.record.id}`); return worker?.navigation.position ?? null; }
  update(deltaMs: number, day: number, active: boolean, gameTimeMs: number): void {
    for (const worker of this.workers) {
      if (!active || worker.record.paidDay !== day) { worker.task = active && worker.record.lastBilledDay === day ? 'Thiếu tiền lương' : 'Nghỉ'; continue; }
      if (worker.record.role === 'cashier') this.cashier(worker, deltaMs, gameTimeMs);
      else if (worker.record.role === 'stock') this.stock(worker, deltaMs);
      else this.clean(worker, deltaMs);
    }
  }
  private go(worker: EmployeeActor, destination: Position, id: string | number): boolean {
    if (worker.destinationId === id) return true;
    if (!worker.navigation.goTo(destination)) return false;
    worker.destinationId = id; return true;
  }
  private cashier(worker: EmployeeActor, deltaMs: number, gameTimeMs: number): void {
    const station = this.checkout.stations.find(station => station.state === 'HAS_CUSTOMER');
    if (!station) { worker.task = 'Chờ khách'; return; }
    worker.task = 'Tính tiền';
    if (this.go(worker, station.interactionPosition, station.id) && worker.navigation.update(deltaMs)) this.checkout.startByEmployee(station.id, worker.record.id, gameTimeMs);
  }
  private stock(worker: EmployeeActor, deltaMs: number): void {
    const shelf = this.shelves.find(shelf => shelf.stock.currentStock < shelf.stock.maxStock && (worker.held ? shelf.acceptedProductId === worker.held.productId : this.storage.getQuantity(shelf.acceptedProductId) > 0));
    if (!shelf) { if (worker.held) { this.storage.addBatch([worker.held]); worker.held = null; } worker.task = 'Chờ hàng'; worker.destinationId = null; return; }
    if (!worker.held) {
      worker.task = 'Lấy hàng ở kho';
      if (this.go(worker, STOCK_RECEIVING, 'warehouse') && worker.navigation.update(deltaMs)) { worker.held = retrieveStorageStack(this.storage, shelf.acceptedProductId, null).heldItem; worker.destinationId = null; }
    } else {
      worker.task = 'Xếp kệ';
      if (this.go(worker, shelf.interactionPosition, shelf.id) && worker.navigation.update(deltaMs)) { worker.held = shelf.stock.stockFrom(worker.held).heldItem; worker.destinationId = null; }
    }
  }
  private clean(worker: EmployeeActor, deltaMs: number): void {
    const actorId = `employee-${worker.record.id}`;
    if (this.cleaning.isBusy(actorId)) { worker.task = 'Đang lau dọn'; return; }
    const spot = this.cleaning.dirt.find(spot => this.cleaning.progress(spot.id) === 0);
    if (!spot) { worker.task = 'Sàn sạch'; worker.destinationId = null; return; }
    worker.task = 'Đi dọn sàn';
    if (this.go(worker, spot.position, spot.id) && worker.navigation.update(deltaMs)) { this.cleaning.start(actorId, spot.id, spot.kind === 'spill' ? 'mop' : 'broom'); worker.destinationId = null; }
  }
}
