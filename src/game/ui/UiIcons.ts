import type Phaser from 'phaser';
import { UI } from './UiTheme';
export type UiIcon = 'staff' | 'stock' | 'clean' | 'cashier' | 'plants' | 'sign' | 'seating' | 'cooler';
export function drawUiIcon(g: Phaser.GameObjects.Graphics, x: number, y: number, type: UiIcon, size = 32, color: number = UI.colors.green): void {
  const s = size / 32;
  g.lineStyle(2 * s, color, 1);
  const line = (a: number, b: number, c: number, d: number): void => { g.lineBetween(x + a * s, y + b * s, x + c * s, y + d * s); };
  const box = (a: number, b: number, w: number, h: number): void => { g.strokeRoundedRect(x + a * s, y + b * s, w * s, h * s, 3 * s); };
  if (type === 'staff') { g.strokeCircle(x, y - 6 * s, 5 * s); g.strokeEllipse(x, y + 10 * s, 22 * s, 13 * s); }
  if (type === 'stock') { box(-13, -12, 26, 25); line(-13, -3, 13, -3); line(0, -12, 0, -3); }
  if (type === 'clean') { line(10, -14, -4, 5); g.strokeTriangle(x - 4 * s, y + 2 * s, x - 14 * s, y + 11 * s, x + 3 * s, y + 15 * s); line(-7, 8, -9, 12); }
  if (type === 'cashier') { box(-8, -14, 17, 12); line(0, -2, 0, 2); box(-14, 2, 28, 12); line(-9, 7, 8, 7); }
  if (type === 'plants') { box(-8, 4, 16, 11); line(0, 4, 0, -11); g.strokeEllipse(x - 5 * s, y - 5 * s, 10 * s, 6 * s); g.strokeEllipse(x + 5 * s, y - 10 * s, 10 * s, 6 * s); }
  if (type === 'sign') { box(-14, -7, 28, 20); line(-7, -7, 0, -14); line(0, -14, 7, -7); line(-8, 1, 8, 1); line(-6, 6, 6, 6); }
  if (type === 'seating') { box(-13, -2, 26, 6); line(-10, 4, -12, 15); line(10, 4, 12, 15); line(-10, -2, -10, -14); line(10, -2, 10, -14); line(-10, -12, 10, -12); }
  if (type === 'cooler') { box(-10, -15, 20, 30); line(-10, -3, 10, -3); line(5, -10, 5, -6); line(5, 2, 5, 8); }
}
