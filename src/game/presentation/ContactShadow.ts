import type Phaser from 'phaser';
import { THEME } from './VisualTheme';

export function drawContactShadow(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number): void {
  g.fillStyle(THEME.colors.shadow, THEME.shadowOpacity * 0.35).fillEllipse(x + 2, y + 3, width + 8, height + 4);
  g.fillStyle(THEME.colors.shadow, THEME.shadowOpacity * 0.55).fillEllipse(x, y + 1, width, height);
  g.fillStyle(THEME.colors.shadow, THEME.shadowOpacity * 0.4).fillEllipse(x, y, width * 0.76, height * 0.66);
}
