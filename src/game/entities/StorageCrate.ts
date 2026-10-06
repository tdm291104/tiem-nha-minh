import Phaser from 'phaser';
import { THEME, cssColor } from '../presentation/VisualTheme';
import { groundDepth } from '../presentation/VisualCatalog';
import { FURNITURE_TEXTURE } from '../presentation/FurnitureTextures';
import { INVENTORY, TEXT_STYLE } from '../config/settings';
import type { Interactable } from '../interactions/Interactable';
import { getProduct } from '../products/ProductCatalog';
import type { ProductId } from '../products/Product';
import type { Position } from '../types/game';
import type { InventorySystem } from '../systems/InventorySystem';
import type { Player } from './Player';
import { CRATE_SIZE } from '../world/ShopDefinition';

export class StorageCrate extends Phaser.GameObjects.Container implements Interactable {
  readonly interactionRange = INVENTORY.interactionRange;
  readonly interactionPosition: Position;
  private readonly unsubscribeStorage: () => void;
  constructor(scene: Phaser.Scene, readonly id: string, readonly productId: ProductId, position: Position, obstacles: Phaser.Physics.Arcade.StaticGroup, private readonly inventory: InventorySystem) {
    super(scene, position.x, position.y);
    scene.add.existing(this);
    this.interactionPosition = { x: position.x, y: position.y + CRATE_SIZE.standingOffsetY };
    const product = getProduct(productId);
    const g = scene.add.image(0, 0, 'furniture-crate').setOrigin(0.5, FURNITURE_TEXTURE.crate.originY);
    const icon = scene.add.image(0, -30, `product-${productId}`).setDisplaySize(26, 26);
    const label = scene.add.text(0, -6, '', { ...TEXT_STYLE, fontSize: '12px', backgroundColor: cssColor(THEME.colors.paper), padding: { x: 4, y: 2 }, align: 'center', fontStyle: 'bold' }).setOrigin(0.5, 0);
    const updateLabel = (quantity: number): void => { label.setText(`${product.name}\nKho: ${quantity}`); };
    updateLabel(inventory.storage.getQuantity(productId));
    this.unsubscribeStorage = inventory.storage.onChange((changedProductId, quantity) => { if (changedProductId === productId) updateLabel(quantity); });
    this.add([g, icon, label]).setDepth(groundDepth(position.y, CRATE_SIZE.height / 2));
    obstacles.add(scene.add.rectangle(position.x, position.y, CRATE_SIZE.width, CRATE_SIZE.height).setVisible(false));
  }
  canInteract(_player: Player): boolean { return true; }
  promptText(_player: Player): string { return `Lấy ${getProduct(this.productId).name}`; }
  interact(player: Player): void { this.inventory.retrieve(player, this.productId, this.id); }
  destroy(fromScene?: boolean): void { this.unsubscribeStorage(); super.destroy(fromScene); }
}
