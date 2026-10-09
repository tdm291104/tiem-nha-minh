import Phaser from 'phaser';
import { cssColor } from '../presentation/VisualTheme';
import type { AudioManager } from '../audio/AudioManager';
import { UI, UI_TEXT } from './UiTheme';
import { VIEW } from '../config/settings';
export interface ButtonOptions { width?: number; height?: number; fontSize?: number }
export interface PanelButton { root: Phaser.GameObjects.Container; setEnabled(enabled: boolean): void; setSelected(selected: boolean): void; setLabel(label: string): void }

export function panelButton(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, label: string, action: () => void, audio?: AudioManager, secondary = false, options: ButtonOptions = {}): PanelButton {
  const text = scene.add.text(0, 0, label, { ...UI_TEXT, fontSize: `${options.fontSize ?? UI.button.fontSize}px`, fontStyle: 'bold', color: cssColor(secondary ? UI.colors.ink : UI.colors.white) }).setOrigin(0.5);
  const width = options.width ?? Math.max(48, text.width + 30), height = options.height ?? UI.button.height;
  const background = scene.add.graphics();
  let enabled = true, selected = false, hovered = false;
  const draw = (): void => {
    const filled = !secondary || selected;
    background.clear().fillStyle(filled ? hovered && enabled ? UI.colors.greenHover : UI.colors.green : hovered && enabled ? UI.colors.mint : UI.colors.sand)
      .fillRoundedRect(-width / 2, -height / 2, width, height, UI.button.radius);
    text.setColor(cssColor(filled ? UI.colors.white : UI.colors.ink));
    root.setAlpha(enabled ? 1 : 0.48);
  };
  const root = scene.add.container(x, y, [background, text]).setSize(width, height).setInteractive({ useHandCursor: true });
  root.on('pointerover', () => { hovered = true; draw(); }).on('pointerout', () => { hovered = false; draw(); });
  root.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
    event.stopPropagation(); if (enabled && parent.visible) { audio?.play('UI_CLICK'); action(); }
  });
  parent.add(root); draw();
  return {
    root,
    setEnabled(value) {
      if (enabled === value) return;
      enabled = value;
      draw();
    },
    setSelected(value) {
      if (selected === value) return;
      selected = value;
      draw();
    },
    setLabel(value) { text.setText(value); },
  };
}

export function drawPaper(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, color: number = UI.colors.paper): void {
  // Layered low-opacity offsets provide a soft edge without textures or shaders.
  for (let i = 3; i >= 1; i--) g.fillStyle(UI.colors.shade, 0.018).fillRoundedRect(x - i * 2, y + i * 2, width + i * 4, height + i * 3, UI.radius + i);
  g.fillStyle(color).fillRoundedRect(x, y, width, height, UI.radius);
}

export function modalPaper(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number): Phaser.GameObjects.Graphics {
  const mask = scene.add.rectangle(VIEW.width / 2, VIEW.height / 2, VIEW.width, VIEW.height, UI.colors.shade, 0.68).setInteractive();
  mask.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
  const paper = scene.add.graphics(); drawPaper(paper, x, y, width, height);
  parent.add([mask, paper]); return paper;
}
