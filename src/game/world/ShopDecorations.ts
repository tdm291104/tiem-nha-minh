import Phaser from 'phaser';
import { THEME, THEME_TEXT, cssColor } from '../presentation/VisualTheme';
import { drawContactShadow } from '../presentation/ContactShadow';

/** Flat environmental accents only: never add physics bodies or navigation blockers. */
export function createShopDecorations(scene: Phaser.Scene): void {
  const c = THEME.colors, g = scene.add.graphics().setDepth(-2);
  g.fillStyle(c.metalDark).fillRoundedRect(79, 64, 8, 23, 2);
  g.fillStyle(c.wallShade).fillCircle(83, 62, 20).fillStyle(c.ceramicLight).fillCircle(81, 60, 19);
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; g.fillStyle(c.metal).fillEllipse(82 + Math.cos(a) * 7, 61 + Math.sin(a) * 7, 14, 6); }
  g.lineStyle(1, c.metalDark, 0.45).strokeCircle(82, 61, 18).strokeCircle(82, 61, 13).strokeCircle(82, 61, 8).lineBetween(64, 61, 100, 61).lineBetween(82, 43, 82, 79);
  g.fillStyle(c.shadow, 0.09).fillRect(879, 39, 52, 59);
  g.fillStyle(c.paper).fillRect(876, 35, 52, 59).fillStyle(c.labelRed).fillRect(876, 35, 52, 12);
  scene.add.text(902, 54, 'TIỆM NHÀ MÌNH\nMỗi ngày một niềm vui', { ...THEME_TEXT, fontSize: '8px', align: 'center', lineSpacing: 5 }).setOrigin(0.5, 0).setDepth(-1);
  // Analog wall clock, frozen decorative time rather than a second gameplay clock.
  g.fillStyle(c.woodDark).fillCircle(830, 58, 17).fillStyle(c.paper).fillCircle(830, 58, 14);
  g.lineStyle(1, c.ink).lineBetween(830, 58, 830, 48).lineBetween(830, 58, 837, 62);
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.fillStyle(c.muted).fillCircle(830 + Math.sin(a) * 11, 58 + Math.cos(a) * 11, 0.8); }
  drawContactShadow(g, 56, 584, 29, 9);
  g.fillStyle(c.warning).fillPoints([{ x: 46, y: 566 }, { x: 51, y: 566 }, { x: 49, y: 586 }, { x: 44, y: 586 }], true).fillRect(66, 566, 5, 20);
  g.fillStyle(c.labelRed).fillRoundedRect(42, 556, 32, 13, 5).fillStyle(c.paper, 0.15).fillRoundedRect(45, 557, 26, 4, 2);
  g.lineStyle(3, c.woodDark).lineBetween(951, 470, 965, 537);
  g.fillStyle(c.biscuit).fillPoints([{ x: 954, y: 532 }, { x: 973, y: 529 }, { x: 979, y: 551 }, { x: 949, y: 554 }], true);
  for (let i = 0; i < 5; i++) g.lineStyle(1, c.woodDark, 0.3).lineBetween(954 + i * 4, 537, 954 + i * 5, 553);
  g.fillStyle(c.woodDark).fillRect(40, 185, 42, 25).fillStyle(c.woodLight).fillPoints([{ x: 40, y: 185 }, { x: 47, y: 177 }, { x: 88, y: 177 }, { x: 82, y: 185 }], true);
  g.fillStyle(c.apron).fillRect(56, 185, 6, 25);
  g.fillStyle(c.blue).fillEllipse(952, 186, 31, 22).fillStyle(c.ink).fillRoundedRect(938, 187, 28, 8, 3);
  drawContactShadow(g, 950, 815, 39, 10);
  g.fillStyle(c.warning).fillPoints([{ x: 933, y: 790 }, { x: 967, y: 790 }, { x: 963, y: 816 }, { x: 937, y: 816 }], true);
  g.fillStyle(c.woodDark).fillEllipse(950, 790, 32, 9);
  g.lineStyle(3, c.woodDark).lineBetween(950, 792, 950, 756);
  g.fillStyle(c.green).fillEllipse(940, 770, 19, 14).fillEllipse(960, 760, 21, 14).fillEllipse(944, 751, 23, 13);
  g.fillStyle(c.greenSoft, 0.25).fillEllipse(944, 767, 9, 4).fillEllipse(958, 757, 9, 4);
  g.fillStyle(c.wallShade).fillRect(405, 905, 190, 11);
  g.lineStyle(1, c.muted, 0.3).lineBetween(468, 905, 468, 916).lineBetween(531, 905, 531, 916);
  scene.add.text(80, 414, 'Sổ đặt hàng', { ...THEME_TEXT, fontSize: '11px', fontStyle: 'italic', color: cssColor(c.woodDark) }).setOrigin(0.5).setDepth(-1);
}
