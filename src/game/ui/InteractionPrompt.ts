import Phaser from 'phaser';
import type { Player } from '../entities/Player';
import type { Interactable } from '../interactions/Interactable';
import { cssColor } from '../presentation/VisualTheme';
import { UI, UI_TEXT } from './UiTheme';
import type { WorldProjector } from '../presentation/three/WorldLabels';

export class InteractionPrompt {
  private readonly root: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly key: Phaser.GameObjects.Text;
  private readonly action: Phaser.GameObjects.Text;
  private readonly highlight: Phaser.GameObjects.Graphics;
  private project?: WorldProjector;
  constructor(scene: Phaser.Scene) {
    this.highlight = scene.add.graphics().setDepth(2);
    this.panel = scene.add.graphics();
    this.key = scene.add.text(0, 0, '', { ...UI_TEXT, fontSize: '12px', fontStyle: 'bold', color: cssColor(UI.colors.white) }).setOrigin(0.5);
    this.action = scene.add.text(0, 0, '', { ...UI_TEXT, fontSize: '14px' }).setOrigin(0, 0.5);
    this.root = scene.add.container(0, 0, [this.panel, this.key, this.action]).setDepth(2000).setVisible(false);
  }
  setProjector(project: WorldProjector): void { this.project = project; }
  show(player: Player, target: Interactable): void {
    const color = player.id === 1 ? UI.colors.blue : UI.colors.orange;
    this.key.setText(player.controls.interactLabel.toUpperCase());
    this.action.setText(`P${player.id} · ${target.promptText(player)}`);
    const keyWidth = this.key.width + 16; const width = keyWidth + this.action.width + 24;
    this.panel.clear().fillStyle(UI.colors.shade, 0.08).fillRoundedRect(-width / 2 - 2, -13, width + 4, 33, 11).fillStyle(UI.colors.paper).fillRoundedRect(-width / 2, -15, width, 30, 10)
      .fillStyle(color).fillRoundedRect(-width / 2 + 4, -11, keyWidth, 22, 4);
    this.key.setX(-width / 2 + 4 + keyWidth / 2); this.action.setX(-width / 2 + keyWidth + 12);
    const position = this.project ? this.project(target.interactionPosition, 0.35) : target.interactionPosition;
    this.root.setPosition(position.x, position.y + 32 + (player.id - 1) * 34).setVisible(!('visible' in position) || position.visible !== false);
    this.highlight.clear();
    if (!this.project) this.highlight.fillStyle(UI.colors.gold, 0.28).fillEllipse(target.interactionPosition.x, target.interactionPosition.y, 40, 22).lineStyle(1, color, 0.5).strokeEllipse(target.interactionPosition.x, target.interactionPosition.y, 38 + player.id * 4, 20 + player.id * 3);
  }
  hide(): void { this.root.setVisible(false); this.highlight.clear(); }
}
