import { THEME, cssColor } from '../presentation/VisualTheme';
import Phaser from 'phaser';
import { VISUAL_SCALE } from '../presentation/VisualCatalog';
import { heldItemOffset, type Facing } from '../presentation/PresentationRules';
import { describeStack } from '../products/ProductCatalog';
import type { ProductStack } from '../products/Product';

export class HeldItemView extends Phaser.GameObjects.Container {
  private readonly icon: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene) {
    super(scene);
    scene.add.existing(this);
    this.icon = scene.add.image(0, -15, 'product-instant_noodles');
    this.label = scene.add.text(0, -95, '', { fontFamily: THEME.typography.fontFamily, fontSize: '12px', color: cssColor(THEME.colors.ink), backgroundColor: cssColor(THEME.colors.paper), padding: { x: 5, y: 3 } }).setOrigin(0.5, 1);
    this.add([this.icon, this.label]).setVisible(false);
  }
  face(facing: Facing): void { const offset = heldItemOffset(facing); this.icon.setPosition(offset.x, offset.y).setDisplaySize(VISUAL_SCALE.heldProduct, VISUAL_SCALE.heldProduct); }
  showStack(stack: ProductStack | null): void {
    this.setVisible(stack !== null);
    if (stack) {
      this.icon.setTexture(`product-${stack.productId}`);
      this.label.setText(describeStack(stack));
    }
  }
}
