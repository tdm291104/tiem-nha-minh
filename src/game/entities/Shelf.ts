import Phaser from 'phaser';
import { ShelfView } from '../presentation/ShelfView';
import { groundDepth } from '../presentation/VisualCatalog';
import { INVENTORY } from '../config/settings';
import type { Interactable } from '../interactions/Interactable';
import { getProduct } from '../products/ProductCatalog';
import type { ProductId } from '../products/Product';
import { ShelfInventory } from '../products/StockTransfer';
import type { Position } from '../types/game';
import type { InventorySystem } from '../systems/InventorySystem';
import type { Player } from './Player';
import { SHELF_SIZE } from '../world/ShopDefinition';
import type { StockBatch } from '../operations/StockBatches';

export class Shelf extends Phaser.GameObjects.Container implements Interactable {
  readonly interactionRange = INVENTORY.interactionRange;
  readonly interactionPosition: Position;
  readonly stock: ShelfInventory;
  readonly view: ShelfView;
  private lastStock = -1;
  private lastCapacity = -1;
  private readonly unsubscribeStock: () => void;

  constructor(scene: Phaser.Scene, readonly id: string, readonly acceptedProductId: ProductId, position: Position, obstacles: Phaser.Physics.Arcade.StaticGroup, private readonly inventory: InventorySystem, initialStock = 0, maxStock = INVENTORY.shelfCapacity, batches?: readonly StockBatch[], day?: number) {
    super(scene, position.x, position.y);
    scene.add.existing(this);
    this.stock = new ShelfInventory(acceptedProductId, maxStock, initialStock, batches, day);
    this.interactionPosition = { x: position.x, y: position.y + SHELF_SIZE.standingOffsetY };
    this.view = new ShelfView(scene, acceptedProductId);
    this.add(this.view).setDepth(groundDepth(position.y, SHELF_SIZE.height / 2));
    obstacles.add(scene.add.rectangle(position.x, position.y, SHELF_SIZE.width, SHELF_SIZE.height).setVisible(false));
    this.unsubscribeStock = this.stock.onChange(() => this.refresh());
    this.refresh();
  }
  get currentStock(): number { return this.stock.currentStock; }
  get maxStock(): number { return this.stock.maxStock; }
  canInteract(_player: Player): boolean { return true; }
  promptText(_player: Player): string { return `Xếp ${getProduct(this.acceptedProductId).name}`; }
  interact(player: Player): void { this.inventory.stock(player, this.stock); }
  private refresh(): void {
    if (this.lastStock === this.currentStock && this.lastCapacity === this.maxStock) return;
    this.lastStock = this.currentStock;
    this.lastCapacity = this.maxStock;
    this.view.setStock(this.currentStock, this.maxStock);
  }
  destroy(fromScene?: boolean): void {
    this.unsubscribeStock();
    super.destroy(fromScene);
  }
}
