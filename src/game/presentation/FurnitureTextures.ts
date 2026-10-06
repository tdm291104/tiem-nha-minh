import type Phaser from 'phaser';
import { THEME } from './VisualTheme';
import { drawContactShadow } from './ContactShadow';
import { VISUAL_SCALE } from './VisualCatalog';

export const FURNITURE_TEXTURE = {
  shelf: { width: 160, height: 240, originY: 150 / 240 },
  crate: { width: 108, height: 106, originY: 56 / 106 },
  counter: { width: 180, height: 136, originY: 72 / 136 },
  desk: { width: 96, height: 102, originY: 60 / 102 },
} as const;

export function createFurnitureTextures(scene: Phaser.Scene): void {
  const c = THEME.colors;
  for (const refrigerated of [false, true]) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawContactShadow(g, 81, 196, 133, 30);
    g.fillStyle(refrigerated ? c.metalDark : c.woodDark).fillRect(20, 194, 121, 17);
    g.fillStyle(refrigerated ? c.glassDark : c.metalDark).fillPoints([{ x: 132, y: 37 }, { x: 142, y: 57 }, { x: 142, y: 205 }, { x: 132, y: 190 }], true);
    g.fillStyle(refrigerated ? c.glass : c.shelfSlot).fillRoundedRect(19, 44, 113, 148, 2);
    g.fillStyle(c.shadow, 0.12).fillRect(22, 48, 108, 12);
    g.fillStyle(c.ceramicLight).fillPoints([{ x: 19, y: 32 }, { x: 129, y: 32 }, { x: 142, y: 44 }, { x: 19, y: 44 }], true);
    g.fillStyle(refrigerated ? c.silver : c.metal).fillRect(16, 40, 6, 158).fillRect(130, 39, 6, 159);
    for (let row = 0; row < VISUAL_SCALE.shelfRows; row++) {
      const y = 77 + row * 44;
      g.fillStyle(c.metalDark).fillRect(23, y, 107, 6);
      g.fillStyle(c.paper).fillRect(23, y, 107, 3);
      g.fillStyle(c.woodLight).fillRect(30, y + 3, 19, 3).fillRect(83, y + 3, 22, 3);
    }
    g.fillStyle(refrigerated ? c.silver : c.wood).fillRect(20, 182, 112, 18);
    g.lineStyle(1, c.paper, 0.4).lineBetween(22, 184, 129, 184);
    if (refrigerated) {
      for (let i = 0; i < 7; i++) g.lineStyle(1, c.metalDark, 0.55).lineBetween(35 + i * 12, 190, 41 + i * 12, 190);
    } else {
      g.lineStyle(1, c.woodDark, 0.3).lineBetween(29, 191, 101, 191).lineBetween(55, 195, 122, 195);
    }
    g.generateTexture(refrigerated ? 'furniture-fridge' : 'furniture-shelf', 160, 240); g.destroy();
  }
  const glass = scene.make.graphics({ x: 0, y: 0 });
  glass.fillStyle(c.paper, 0.07).fillRect(22, 46, 106, 131);
  glass.lineStyle(2, c.metalDark).strokeRoundedRect(20, 43, 110, 137, 2);
  glass.lineStyle(2, c.paper, 0.2).lineBetween(33, 57, 53, 99).lineBetween(86, 66, 110, 119);
  glass.fillStyle(c.metalDark).fillRoundedRect(120, 96, 4, 26, 2);
  glass.generateTexture('furniture-fridge-glass', 160, 240); glass.destroy();

  const crate = scene.make.graphics({ x: 0, y: 0 });
  drawContactShadow(crate, 55, 77, 91, 21);
  crate.fillStyle(c.woodDark).fillPoints([{ x: 83, y: 29 }, { x: 98, y: 45 }, { x: 98, y: 85 }, { x: 83, y: 75 }], true);
  crate.fillStyle(c.wood).fillRect(10, 29, 73, 47);
  crate.fillStyle(c.woodLight).fillPoints([{ x: 10, y: 29 }, { x: 25, y: 9 }, { x: 98, y: 9 }, { x: 83, y: 29 }], true);
  crate.fillStyle(c.woodDark, 0.45).fillPoints([{ x: 22, y: 27 }, { x: 33, y: 14 }, { x: 88, y: 14 }, { x: 77, y: 27 }], true);
  crate.lineStyle(1, c.woodDark, 0.3).lineBetween(10, 65, 83, 65).lineBetween(29, 29, 29, 75);
  crate.fillStyle(c.apron, 0.65).fillRect(40, 29, 11, 47);
  crate.fillStyle(c.paper).fillRoundedRect(16, 42, 25, 15, 1);
  crate.lineStyle(1, c.muted).lineBetween(20, 47, 36, 47).lineBetween(20, 51, 30, 51);
  crate.generateTexture('furniture-crate', 108, 106); crate.destroy();

  const counter = scene.make.graphics({ x: 0, y: 0 });
  drawContactShadow(counter, 90, 101, 164, 24);
  counter.fillStyle(c.woodDark).fillRoundedRect(12, 43, 153, 64, 3);
  counter.fillStyle(c.wood).fillRect(12, 63, 140, 43);
  counter.fillStyle(c.metalDark).fillRect(153, 56, 14, 48);
  counter.fillStyle(c.woodLight).fillPoints([{ x: 10, y: 32 }, { x: 150, y: 32 }, { x: 168, y: 51 }, { x: 168, y: 63 }, { x: 10, y: 63 }], true);
  counter.fillStyle(c.paper, 0.45).fillRect(15, 61, 132, 2);
  counter.lineStyle(1, c.woodDark, 0.4).lineBetween(28, 75, 126, 75).lineBetween(23, 98, 136, 98);
  counter.fillStyle(c.metalDark).fillRoundedRect(22, 36, 48, 21, 2);
  counter.fillStyle(c.glassDark).fillRoundedRect(77, 39, 20, 12, 3);
  counter.lineStyle(1, c.paper, 0.4).strokeRect(81, 42, 12, 6);
  counter.fillStyle(c.silver).fillRoundedRect(111, 37, 38, 21, 2);
  counter.fillStyle(c.metalDark).fillRoundedRect(119, 16, 25, 23, 3);
  counter.fillStyle(c.glass).fillRect(122, 19, 19, 12);
  counter.lineStyle(1, c.paper, 0.6).lineBetween(124, 22, 137, 22);
  for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) counter.fillStyle(c.ink).fillRect(115 + col * 7, 43 + row * 4, 4, 2);
  counter.lineStyle(2, c.ink).lineBetween(116, 54, 142, 54);
  counter.fillStyle(c.apron).fillPoints([{ x: 38, y: 29 }, { x: 61, y: 29 }, { x: 65, y: 51 }, { x: 35, y: 51 }], true);
  counter.lineStyle(1, c.woodDark).strokeEllipse(50, 31, 11, 10);
  counter.generateTexture('furniture-counter', 180, 136); counter.destroy();

  const desk = scene.make.graphics({ x: 0, y: 0 });
  drawContactShadow(desk, 47, 77, 75, 17);
  desk.fillStyle(c.woodDark).fillRect(17, 55, 5, 25).fillRect(73, 55, 5, 25);
  desk.fillStyle(c.wood).fillRoundedRect(12, 40, 71, 23, 2);
  desk.fillStyle(c.woodLight).fillPoints([{ x: 12, y: 29 }, { x: 72, y: 29 }, { x: 83, y: 42 }, { x: 12, y: 42 }], true);
  desk.fillStyle(c.metalDark).fillRoundedRect(43, 15, 28, 22, 2).fillPoints([{ x: 42, y: 35 }, { x: 70, y: 35 }, { x: 74, y: 45 }, { x: 40, y: 45 }], true);
  desk.fillStyle(c.glass).fillRect(46, 18, 22, 14);
  desk.lineStyle(1, c.paper).lineBetween(50, 23, 63, 23).lineBetween(50, 27, 59, 27);
  desk.fillStyle(c.paper).fillRect(19, 32, 15, 13);
  desk.lineStyle(1, c.muted).lineBetween(22, 36, 31, 36).lineBetween(22, 40, 29, 40);
  desk.fillStyle(c.ink).fillRoundedRect(30, 27, 7, 12, 2);
  desk.generateTexture('furniture-desk', 96, 102); desk.destroy();
}
