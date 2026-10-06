import Phaser from 'phaser';
import type { Player } from '../entities/Player';
import type { Interactable } from '../interactions/Interactable';
import { THEME, THEME_TEXT, cssColor } from '../presentation/VisualTheme';

export class InteractionPrompt {
  private readonly root: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly key: Phaser.GameObjects.Text;
  private readonly action: Phaser.GameObjects.Text;
  private readonly highlight: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene) {
    this.highlight = scene.add.graphics().setDepth(2);
    this.panel = scene.add.graphics();
    this.key = scene.add.text(0, 0, '', { ...THEME_TEXT, fontSize: '12px', fontStyle: 'bold', color: cssColor(THEME.colors.paper) }).setOrigin(0.5);
    this.action = scene.add.text(0, 0, '', { ...THEME_TEXT, fontSize: '13px' }).setOrigin(0, 0.5);
    this.root = scene.add.container(0, 0, [this.panel, this.key, this.action]).setDepth(2000).setVisible(false);
  }
  show(player: Player, target: Interactable): void {
    const color = player.id === 1 ? THEME.colors.blue : THEME.colors.orange;
    this.key.setText(player.controls.interactLabel.toUpperCase());
    this.action.setText(`P${player.id} · ${target.promptText(player)}`);
    const keyWidth = this.key.width + 16; const width = keyWidth + this.action.width + 24;
    this.panel.clear().fillStyle(THEME.colors.paper).fillRoundedRect(-width / 2, -15, width, 30, THEME.radius.small)
      .lineStyle(1, color).strokeRoundedRect(-width / 2, -15, width, 30, THEME.radius.small)
      .fillStyle(color).fillRoundedRect(-width / 2 + 4, -11, keyWidth, 22, 4);
    this.key.setX(-width / 2 + 4 + keyWidth / 2); this.action.setX(-width / 2 + keyWidth + 12);
    this.root.setPosition(target.interactionPosition.x, target.interactionPosition.y + 32 + (player.id - 1) * 34).setVisible(true);
    this.highlight.clear().fillStyle(THEME.colors.amberSoft, 0.28).fillEllipse(target.interactionPosition.x, target.interactionPosition.y, 40, 22).lineStyle(1, color, 0.5).strokeEllipse(target.interactionPosition.x, target.interactionPosition.y, 38 + player.id * 4, 20 + player.id * 3);
  }
  hide(): void { this.root.setVisible(false); this.highlight.clear(); }
}
