import Phaser from 'phaser';
import { THEME, THEME_TEXT, cssColor } from '../presentation/VisualTheme';
import type { AudioManager } from '../audio/AudioManager';

export function panelButton(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, label: string, action: () => void, audio?: AudioManager, secondary = false): void {
  const text = scene.add.text(0, 0, label, { ...THEME_TEXT, fontSize: '17px', fontStyle: 'bold', color: cssColor(THEME.colors.ink) }).setOrigin(0.5);
  const width = Math.max(52, text.width + 32); const height = 42;
  const background = scene.add.graphics();
  const draw = (hover: boolean): void => { background.clear().fillStyle(hover ? THEME.colors.wallShade : secondary ? THEME.colors.ceramicLight : THEME.colors.amberSoft).fillRoundedRect(-width / 2, -height / 2, width, height, THEME.radius.small).lineStyle(1, THEME.colors.woodDark, 0.25).strokeRoundedRect(-width / 2, -height / 2, width, height, THEME.radius.small); };
  draw(false);
  const root = scene.add.container(x, y, [background, text]).setSize(width, height).setInteractive({ useHandCursor: true });
  root.on('pointerover', () => draw(true)).on('pointerout', () => draw(false));
  root.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
    event.stopPropagation(); if (parent.visible) { audio?.play('UI_CLICK'); action(); }
  });
  parent.add(root);
}
