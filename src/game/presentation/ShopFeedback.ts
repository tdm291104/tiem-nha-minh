import type { Player } from '../entities/Player';
import type { InventorySystem } from '../systems/InventorySystem';
import type { Shelf } from '../entities/Shelf';
import type { StorageCrate } from '../entities/StorageCrate';
import type { Cashier } from '../entities/Cashier';
import type { CheckoutSystem } from '../checkout/CheckoutSystem';
import type { SupplierSystem } from '../supplier/SupplierSystem';
import type { DayManager } from '../day/DayManager';
import type { AudioManager } from '../audio/AudioManager';
import type { FeedbackEffects } from './FeedbackEffects';
import { GoalFeedbackLatch } from './PresentationRules';
import { formatVnd } from '../economy/Money';

/** Domain notifications feed effects; no presentation callback changes game state. */
export class ShopFeedback {
  private readonly unsubscribe: Array<() => void>;
  constructor(inventory: InventorySystem, shelves: readonly Shelf[], crates: readonly StorageCrate[], cashiers: readonly Cashier[], checkout: CheckoutSystem, supplier: SupplierSystem, day: DayManager, effects: FeedbackEffects, audio: AudioManager, players: readonly Player[] = []) {
    const goal = new GoalFeedbackLatch();
    this.unsubscribe = [
      inventory.onAction(event => {
        audio.play(event.kind);
        if (event.kind !== 'ERROR') players.find(player => player.id === event.playerId)?.presentEmotion('HAPPY');
        const target = event.shelf ? shelves.find(shelf => shelf.stock === event.shelf) : crates.find(crate => crate.id === event.targetId);
        if (target) {
          if (event.kind === 'ERROR') { effects.shake(target); effects.floatingText(target, event.message ?? 'Không thể lấy / xếp hàng', true); }
          else { effects.pop(target); effects.floatingText(target, `${event.kind === 'STOCK_SHELF' ? '+' : '-'}${event.quantity}`); }
        } else if (event.kind !== 'ERROR') effects.floatingText(event.position, event.kind === 'DROP' ? 'Đã thả' : `+${event.quantity}`);
      }),
      checkout.onSale(sale => {
        const cashier = cashiers.find(candidate => candidate.id === sale.cashierId);
        if (cashier) { effects.pop(cashier); effects.floatingText(cashier, `+${formatVnd(sale.total)}`); }
        audio.play('SALE_COMPLETE');
        if (goal.observe(day.currentDay, day.goalAchieved)) { effects.banner('★ ĐẠT MỤC TIÊU NGÀY! ★', `Ngày ${day.currentDay} · Cả tiệm cùng cố gắng!`); audio.play('GOAL_COMPLETE'); }
      }),
      supplier.onChange(order => { const delivered = order.status === 'DELIVERED'; audio.play(delivered ? 'DELIVERY_COMPLETE' : 'SUPPLIER_ORDER'); if (delivered) effects.banner('ĐÃ GIAO HÀNG!', 'Kho đã nhận đủ hàng trong đơn.'); }),
      day.onStateChange(state => {
        if (state === 'OPEN') { effects.banner(`NGÀY ${day.currentDay} · BẮT ĐẦU BÁN HÀNG!`, 'Chúc tiệm mình một ngày đông khách!'); audio.play('STORE_OPEN'); }
        if (state === 'CLOSING') { effects.banner('HẾT GIỜ BÁN HÀNG', 'Đang phục vụ khách còn lại...'); audio.play('STORE_CLOSE'); }
        if (state === 'PREPARATION') goal.observe(day.currentDay, false);
      }),
    ];
  }
  shutdown(): void { for (const unsubscribe of this.unsubscribe) unsubscribe(); }
}
