import { VISUAL_SCALE } from '../presentation/VisualCatalog';
import { drawContactShadow } from '../presentation/ContactShadow';
import { THEME, cssColor } from '../presentation/VisualTheme';
import Phaser from 'phaser';
import { createStack, describeStack } from '../products/ProductCatalog';
import type { ProductStack } from '../products/Product';
import type { Position } from '../types/game';

export class WorldItem extends Phaser.GameObjects.Container {
  readonly stack: ProductStack;
  constructor(scene: Phaser.Scene, readonly itemId: number, stack: ProductStack, position: Position) {
    super(scene, position.x, position.y);
    this.stack = createStack(stack.productId, stack.quantity, stack);
    scene.add.existing(this);
    const shadow = scene.add.graphics(); drawContactShadow(shadow, 0, 7, 27, 9);
    const icon = scene.add.image(0, 0, `product-${stack.productId}`).setDisplaySize(VISUAL_SCALE.heldProduct, VISUAL_SCALE.heldProduct);
    const label = scene.add.text(0, 20, describeStack(stack), { fontFamily: THEME.typography.fontFamily, fontSize: '13px', color: cssColor(THEME.colors.ink), backgroundColor: cssColor(THEME.colors.paper), padding: { x: 4, y: 2 } }).setOrigin(0.5, 0);
    this.add([shadow, icon, label]);
  }
  get productId(): ProductStack['productId'] { return this.stack.productId; }
  get quantity(): number { return this.stack.quantity; }
  get worldPosition(): Position { return { x: this.x, y: this.y }; }
}
