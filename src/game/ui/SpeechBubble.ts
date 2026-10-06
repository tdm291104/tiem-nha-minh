import Phaser from 'phaser';
import { THEME, THEME_TEXT, cssColor } from '../presentation/VisualTheme';
import type { ProductId } from '../products/Product';

export class SpeechBubble extends Phaser.GameObjects.Container {
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly icon: Phaser.GameObjects.Image;
  private message = '';
  private product: ProductId | null = null;
  private warning = false;
  constructor(scene: Phaser.Scene) {
    super(scene, 0, -86);
    this.panel = scene.add.graphics();
    this.label = scene.add.text(0, -15, '', { ...THEME_TEXT, fontSize: '13px' }).setOrigin(0.5);
    this.icon = scene.add.image(0, -15, 'product-instant_noodles').setDisplaySize(24, 24);
    this.add([this.panel, this.icon, this.label]);
  }
  showMessage(message: string, product: ProductId | null, warning = false): void {
    if (this.message === message && this.product === product && this.warning === warning) return;
    this.message = message; this.product = product; this.warning = warning;
    this.label.setText(message).setColor(cssColor(warning ? THEME.colors.warning : THEME.colors.ink));
    const width = this.label.width + (product ? 46 : 22);
    this.panel.clear().fillStyle(THEME.colors.shadow, 0.08).fillRoundedRect(-width / 2 + 2, -30, width, 35, THEME.radius.bubble).fillStyle(warning ? THEME.colors.warningSoft : THEME.colors.paper)
      .fillRoundedRect(-width / 2, -33, width, 35, THEME.radius.bubble).fillTriangle(-5, 1, 5, 1, 0, 8);
    this.label.setX(product ? 12 : 0);
    this.icon.setVisible(product !== null).setX(-width / 2 + 17);
    if (product) this.icon.setTexture(`product-${product}`);
  }
}
