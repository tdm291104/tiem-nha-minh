import type { Player } from '../entities/Player';
import type { Shelf } from '../entities/Shelf';
import type { InventorySystem } from '../systems/InventorySystem';
import type { StoreEconomy } from '../economy/StoreEconomy';
import type { DayManager, DayState } from '../day/DayManager';
import type { CheckoutSystem } from '../checkout/CheckoutSystem';
import type { NavigationGrid } from '../navigation/NavigationGrid';
import type { Interactable } from '../interactions/Interactable';
import type { Position } from '../types/game';
import { CleaningSystem, type CleaningCheckpoint } from './CleaningSystem';
import { DeliveryCargo, type CargoCheckpoint } from './DeliveryCargo';
import { StorePlan, type PlanCheckpoint } from './StorePlan';
import type { StockBatch } from './StockBatches';
import type { StorageBatches } from '../inventory/StoreStorage';
import { EmployeeSystem, type EmployeeRecord } from '../employees/EmployeeSystem';
import { DELIVERY_DOCK, STOCK_RECEIVING, TOOL_RACK, OPERATIONS } from './OperationsConfig';

export interface OperationsCheckpoint {
  cargo: CargoCheckpoint; cleaning: CleaningCheckpoint; plan: PlanCheckpoint;
  employees: readonly EmployeeRecord[]; storageBatches: StorageBatches;
  shelfBatches: readonly { id: string; batches: readonly StockBatch[] }[];
  impatientIds: readonly number[]; spoiledUnits: number; statisticsDay: number;
}
export interface OperationsContext {
  players: readonly Player[]; shelves: readonly Shelf[]; inventory: InventorySystem;
  economy: StoreEconomy; day: DayManager; checkout: CheckoutSystem; grid: NavigationGrid;
  cargo: DeliveryCargo; cleaning: CleaningSystem; plan: StorePlan; notify: (message: string) => void;
}
export class ShopOperations {
  readonly staff: EmployeeSystem;
  readonly context: OperationsContext;
  private readonly impatientIds = new Set<number>();
  private spoiledUnits = 0;
  private statisticsDay: number;
  constructor(context: OperationsContext, saved?: OperationsCheckpoint) {
    this.context = context; this.statisticsDay = context.day.currentDay;
    this.staff = new EmployeeSystem(context.economy, context.inventory.storage, context.shelves, context.checkout, context.cleaning, context.grid, () => context.day.state === 'PREPARATION', saved?.employees);
    if (saved) { this.spoiledUnits = saved.spoiledUnits; this.statisticsDay = saved.statisticsDay; for (const id of saved.impatientIds) this.impatientIds.add(id); }
    context.inventory.canCarry = playerId => !context.cleaning.tool(playerId);
  }
  get checkpoint(): OperationsCheckpoint {
    const c = this.context;
    return { cargo: c.cargo.checkpoint, cleaning: c.cleaning.checkpoint, plan: c.plan.checkpoint, employees: this.staff.checkpoint, storageBatches: c.inventory.storage.batchSnapshot, shelfBatches: c.shelves.map(shelf => ({ id: shelf.id, batches: shelf.stock.batchSnapshot })), impatientIds: [...this.impatientIds], spoiledUnits: this.spoiledUnits, statisticsDay: this.statisticsDay };
  }
  get status(): string {
    const c = this.context;
    return `Sàn: ${c.cleaning.cleanliness}% · NV: ${this.staff.actors.length} · Khách chờ bỏ đi: ${this.impatientIds.size} · Hỏng: ${this.spoiledUnits}${c.cargo.hasFreight ? ' · Xe đang chờ dỡ hàng' : ''}`;
  }
  departure(id: number, impatient: boolean): void { this.context.cleaning.recordVisit(); if (impatient) { this.impatientIds.add(id); this.context.notify('Khách chờ lâu đã rời tiệm. Hàng chưa bán được trả về kho.'); } }
  onDayState(state: DayState): void {
    const c = this.context;
    if (state === 'OPEN') this.staff.startDay(c.day.currentDay, c.day.gameTimeMs);
    if (state === 'PREPARATION' && this.statisticsDay !== c.day.currentDay) {
      this.statisticsDay = c.day.currentDay; this.impatientIds.clear(); this.spoiledUnits = 0;
      this.spoiledUnits += c.inventory.storage.expire(c.day.currentDay, c.plan.checkpoint.decorations.includes('cooler'));
      for (const shelf of c.shelves) this.spoiledUnits += shelf.stock.expire(c.day.currentDay);
      this.spoiledUnits += c.inventory.expireFloor(c.day.currentDay) + c.cargo.expire(c.day.currentDay);
      for (const player of c.players) {
        const held = player.currentHeldItem;
        if (held?.expiresOnDay !== undefined && held.expiresOnDay <= c.day.currentDay + (held.productId === 'milk' ? 1 : 0)) { this.spoiledUnits += held.quantity; player.setHeldItem(null); }
      }
      if (this.spoiledUnits > 0) c.notify(`Đã loại ${this.spoiledUnits} sản phẩm hết hạn. Ưu tiên hàng cũ và bảo quản sữa trong tủ lạnh nhé!`);
    }
    if (state === 'SUMMARY') for (const worker of this.staff.actors) if (worker.held) { c.inventory.storage.addBatch([worker.held]); worker.held = null; }
  }
  update(deltaMs: number): void {
    const c = this.context;
    this.staff.update(deltaMs, c.day.currentDay, c.day.state === 'OPEN' || c.day.state === 'CLOSING', c.day.gameTimeMs);
    c.cleaning.update(deltaMs, actorId => {
      const player = c.players.find(player => actorId === `player-${player.id}`);
      return player?.feetPosition ?? this.staff.position(actorId);
    });
  }
  interactables(): Interactable[] {
    const c = this.context;
    const target = (id: string, position: Position, prompt: (player: Player) => string, action: (player: Player) => void): Interactable => ({ id, interactionPosition: position, interactionRange: id.startsWith('dirt-') ? OPERATIONS.cleaningRange : 70, canInteract: () => true, promptText: prompt, interact: action });
    const targets = [
      target('delivery-truck', DELIVERY_DOCK, () => c.cargo.hasFreight ? 'Lấy thùng trên xe' : 'Chưa có hàng trên xe', player => {
        if (player.currentHeldItem || c.cleaning.tool(player.id)) { c.notify('Cất đồ đang cầm trước khi lấy thùng.'); return; }
        const box = c.cargo.takeBox(); if (box) { player.setHeldItem(box); c.notify('Mang thùng vào điểm NHẬN HÀNG để mở.'); } else c.notify('Chưa có hàng trên xe.');
      }),
      target('receiving', STOCK_RECEIVING, () => 'Mở thùng, nhập kho', player => {
        const stack = player.currentHeldItem;
        if (!stack?.packed) { c.notify('Mang thùng hàng từ xe đến đây nhé!'); return; }
        c.inventory.storage.addBatch([stack]); player.setHeldItem(null); c.notify(`Đã nhập kho ${stack.quantity} sản phẩm.`);
      }),
      target('tool-rack', TOOL_RACK, player => !c.cleaning.tool(player.id) ? 'Lấy chổi' : c.cleaning.tool(player.id) === 'broom' ? 'Đổi sang cây lau' : 'Cất dụng cụ', player => {
        if (player.currentHeldItem) { c.notify('Thả hoặc xếp hàng trước khi lấy dụng cụ.'); return; }
        c.cleaning.cycleTool(player.id); c.notify(c.cleaning.tool(player.id) === 'broom' ? 'Chổi: dọn rác khô.' : c.cleaning.tool(player.id) === 'mop' ? 'Cây lau: lau nước đổ.' : 'Đã cất dụng cụ.');
      }),
    ];
    for (const spot of c.cleaning.dirt) targets.push(target(`dirt-${spot.id}`, spot.position, () => c.cleaning.progress(spot.id) > 0 ? 'Đang dọn...' : spot.kind === 'spill' ? 'Lau nước đổ' : 'Quét rác', player => {
      const tool = c.cleaning.tool(player.id);
      if (!tool || !c.cleaning.start(`player-${player.id}`, spot.id, tool)) c.notify(spot.kind === 'spill' ? 'Cần cây lau, hoặc đã có người dọn.' : 'Cần chổi, hoặc đã có người dọn.');
    }));
    return targets;
  }
}
