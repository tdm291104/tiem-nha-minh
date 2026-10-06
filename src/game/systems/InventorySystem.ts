import Phaser from 'phaser';
import type { Player } from '../entities/Player';
import { WorldItem } from '../entities/WorldItem';
import { INVENTORY } from '../config/settings';
import { describeStack, getProduct } from '../products/ProductCatalog';
import type { Position, PlayerId } from '../types/game';
import type { ProductId } from '../products/Product';
import type { ShelfInventory } from '../products/StockTransfer';
import { hasClearPath } from '../world/WorldCollision';
import type { StoreStorage } from '../inventory/StoreStorage';
import { retrieveStorageStack } from '../inventory/StorageTransfer';

export interface InventoryFeedback { kind: 'PICKUP' | 'DROP' | 'STOCK_SHELF' | 'ERROR'; playerId: PlayerId; position: Position; quantity: number; message?: string; targetId?: string; shelf?: ShelfInventory }

export class InventorySystem {
  private readonly items = new Map<number, WorldItem>();
  private readonly itemLayer: Phaser.GameObjects.Container;
  private readonly listeners = new Set<(event: InventoryFeedback) => void>();
  onAction(listener: (event: InventoryFeedback) => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private emit(player: Player, kind: InventoryFeedback['kind'], quantity = 0, targetId?: string, shelf?: ShelfInventory, message?: string): void {
    const event = { kind, playerId: player.id, position: player.feetPosition, quantity, targetId, shelf, message };
    for (const listener of this.listeners) listener(event);
  }
  private nextItemId = 1;

  constructor(private readonly scene: Phaser.Scene, private readonly obstacles: Phaser.Physics.Arcade.StaticGroup, readonly storage: StoreStorage, private readonly notify: (message: string) => void) {
    // A persistent world layer keeps later drops out of the HUD camera too.
    this.itemLayer = scene.add.container(0, 0).setDepth(3);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.items.clear(); this.listeners.clear(); });
  }
  get worldItems(): readonly WorldItem[] { return [...this.items.values()]; }
  update(players: Player[]): void {
    for (const player of players) {
      if (player.controller.consume('pickup')) this.pickupOrDrop(player);
    }
  }

  retrieve(player: Player, productId: ProductId, targetId?: string): void {
    const result = retrieveStorageStack(this.storage, productId, player.currentHeldItem);
    if (result.status === 'holding') {
      this.emit(player, 'ERROR', 0, targetId, undefined, 'Bạn đang cầm hàng.');
      this.notify(`P${player.id}: Bạn đang cầm hàng.`);
      return;
    }
    if (result.status === 'empty') { this.emit(player, 'ERROR', 0, targetId); this.notify(`P${player.id}: Hết hàng trong kho.`); return; }
    player.setHeldItem(result.heldItem);
    this.emit(player, 'PICKUP', result.heldItem?.quantity ?? 0, targetId);
    this.notify(`P${player.id}: Đã lấy ${describeStack(player.currentHeldItem)}.`);
  }

  stock(player: Player, shelf: ShelfInventory): void {
    const result = shelf.stockFrom(player.currentHeldItem);
    if (result.status === 'stocked') {
      player.setHeldItem(result.heldItem);
      this.emit(player, 'STOCK_SHELF', result.transferred, undefined, shelf);
      this.notify(`P${player.id}: Đã xếp ${getProduct(shelf.acceptedProductId).name} x${result.transferred} lên kệ.`);
    } else {
      const messages = { 'empty-handed': 'Bạn chưa cầm hàng. Lấy hàng ở kho nhé!', 'wrong-product': 'Kệ này không dành cho sản phẩm này.', full: 'Kệ đã đầy.' };
      this.emit(player, 'ERROR', 0, undefined, shelf, messages[result.status]);
      this.notify(`P${player.id}: ${messages[result.status]}`);
    }
  }

  pickupOrDrop(player: Player): void {
    const stack = player.currentHeldItem;
    if (stack) {
      const item = new WorldItem(this.scene, this.nextItemId++, stack, player.feetPosition);
      this.itemLayer.add(item);
      this.items.set(item.itemId, item);
      player.setHeldItem(null);
      this.emit(player, 'DROP', stack.quantity);
      this.notify(`P${player.id}: Đã thả ${describeStack(stack)}.`);
      return;
    }
    let nearest: WorldItem | undefined;
    let distance = INVENTORY.pickupRange;
    for (const item of this.items.values()) {
      const candidateDistance = Phaser.Math.Distance.BetweenPoints(player.feetPosition, item.worldPosition);
      if (candidateDistance <= distance && (!nearest || candidateDistance < distance) && hasClearPath(this.obstacles, player.feetPosition, item.worldPosition)) {
        nearest = item;
        distance = candidateDistance;
      }
    }
    if (!nearest) {
      this.emit(player, 'ERROR');
      this.notify(`P${player.id}: Không có hàng gần đây để nhặt.`);
      return;
    }
    // Claim synchronously before another player's input is processed this frame.
    this.items.delete(nearest.itemId);
    player.setHeldItem(nearest.stack);
    nearest.destroy();
    this.emit(player, 'PICKUP', nearest.stack.quantity);
    this.notify(`P${player.id}: Đã nhặt ${describeStack(player.currentHeldItem)}.`);
  }
}
