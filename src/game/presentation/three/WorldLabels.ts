import Phaser from 'phaser';
import { UI, UI_TEXT } from '../../ui/UiTheme';
import type { Position } from '../../types/game';
import { THEME, cssColor } from '../VisualTheme';
import { SpeechBubble } from '../../ui/SpeechBubble';
import type { ProductId } from '../../products/Product';

export type WorldProjector = (position: Position, height?: number) => Position & { visible?: boolean };

export class WorldLabels {
  readonly root: Phaser.GameObjects.Container;
  private readonly labels = new Map<string, Phaser.GameObjects.Text>();
  private readonly bubbles = new Map<string, SpeechBubble>();
  private readonly touched = new Set<string>();
  constructor(private readonly scene: Phaser.Scene, private readonly project: WorldProjector) {
    this.root = scene.add.container(0, 0).setDepth(2500);
    scene.cameras.main.ignore(this.root);
  }
  beginFrame(): void { this.touched.clear(); }
  text(id: string, position: Position, height: number, message: string, color: number = THEME.colors.ink): void {
    this.touched.add(id);
    let label = this.labels.get(id);
    if (!label) {
      label = this.scene.add.text(0, 0, message, { ...UI_TEXT, fontSize: '12px', fontStyle: 'normal', align: 'center', backgroundColor: cssColor(UI.colors.paper), padding: { x: 6, y: 3 } }).setOrigin(0.5, 1);
      this.labels.set(id, label); this.root.add(label);
    }
    if (label.text !== message) label.setText(message);
    label.setColor(cssColor(color === THEME.colors.warning ? UI.colors.error : color === THEME.colors.blue ? UI.colors.blue : color === THEME.colors.orange ? UI.colors.orange : color === THEME.colors.green ? UI.colors.green : UI.colors.ink));
    const screen = this.project(position, height); label.setPosition(screen.x, screen.y).setVisible(screen.visible !== false);
  }
  bubble(id: string, position: Position, height: number, message: string, product: ProductId | null, warning: boolean): void {
    this.touched.add(id);
    let bubble = this.bubbles.get(id);
    if (!bubble) { bubble = new SpeechBubble(this.scene); this.bubbles.set(id, bubble); this.root.add(bubble); }
    bubble.showMessage(message, product, warning);
    const screen = this.project(position, height); bubble.setPosition(screen.x, screen.y).setVisible(screen.visible !== false);
  }
  endFrame(): void {
    for (const [id, label] of this.labels) if (!this.touched.has(id)) { label.destroy(); this.labels.delete(id); }
    for (const [id, bubble] of this.bubbles) if (!this.touched.has(id)) { bubble.destroy(); this.bubbles.delete(id); }
    const placed: Phaser.Geom.Rectangle[] = [];
    for (const bubble of [...this.bubbles.values()].filter(bubble => bubble.visible).sort((a, b) => a.y - b.y || a.x - b.x)) {
      let bounds = bubble.getBounds();
      for (let attempt = 0; attempt < 5 && placed.some(other => Phaser.Geom.Intersects.RectangleToRectangle(bounds, other)); attempt++) {
        if (bounds.y - 38 < 90) break;
        bubble.y -= 38; bounds = bubble.getBounds();
      }
      placed.push(bounds);
    }
  }
  destroy(): void { this.root.destroy(); this.labels.clear(); this.bubbles.clear(); }
}
