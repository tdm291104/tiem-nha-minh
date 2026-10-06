import type Phaser from 'phaser';
import { THEME } from './VisualTheme';
import { PLAYER_STYLES, CUSTOMER_ARCHETYPES } from './CharacterStyles';
import type { CharacterStyle } from './CharacterStyles';
import type { Emotion, Facing } from './PresentationRules';
import { directionalVisualKeys } from './VisualCatalog';

type Graphics = Phaser.GameObjects.Graphics;
function drawHead(g: Graphics, style: CharacterStyle, facing: Facing, emotion: Emotion): void {
  const c = THEME.colors, side = facing === 'LEFT' ? -1 : facing === 'RIGHT' ? 1 : 0;
  g.fillStyle(c.skinShade).fillEllipse(20, 17, 21, 21);
  g.fillStyle(c.skin).fillEllipse(19, 16, 20, 20);
  g.fillStyle(style.hair).fillEllipse(19, 10, 22, 10);
  if (facing === 'UP') {
    g.fillStyle(style.hair).fillEllipse(19, 16, 21, 22);
    g.lineStyle(1, c.woodDark, 0.3).lineBetween(15, 8, 12, 19).lineBetween(20, 7, 24, 15);
  } else {
    g.fillStyle(style.hair).fillTriangle(9, 10, 18, 7, 10, 20).fillTriangle(18, 8, 29, 10, 26, 15);
    const eyeXs = side ? [19 + side * 6] : [15, 23];
    for (const x of eyeXs) {
      g.lineStyle(1, c.hair).lineBetween(x - 2, emotion === 'FOCUSED' ? 16 : 14, x + 2, 14);
      if (emotion === 'HAPPY') g.lineStyle(1.4, c.ink).lineBetween(x - 2, 19, x, 17).lineBetween(x, 17, x + 2, 19);
      else g.fillStyle(c.ink).fillEllipse(x, 18, 2.1, 3);
      if (style.accessory === 'glasses') g.lineStyle(1, c.hair).strokeRoundedRect(x - 4, 15, 8, 6, 2);
    }
    const noseX = 19 + side * 9;
    g.lineStyle(1, c.skinShade).lineBetween(noseX, 19, noseX + 1, 21);
    if (side) g.fillStyle(c.skin).fillTriangle(noseX, 18, noseX + side * 4, 21, noseX, 23);
    g.lineStyle(1.1, c.warning).beginPath().moveTo(17 + side * 6, 24).lineTo(20 + side * 6, emotion === 'HAPPY' ? 26 : emotion === 'DISAPPOINTED' ? 22 : 24.5).lineTo(22 + side * 6, 24).strokePath();
    g.fillStyle(c.blush, 0.35).fillEllipse(12 + side * 5, 22, 4, 2);
  }
  if (style.hairstyle === 'bob') g.fillStyle(style.hair).fillRoundedRect(7, 10, 5, 19, 3).fillRoundedRect(27, 11, 5, 18, 3);
  if (style.hairstyle === 'ponytail') g.fillStyle(style.hair).fillEllipse(side === -1 ? 28 : 10, 12, 7, 10);
  if (style.accessory === 'headband') g.lineStyle(1.4, c.apron).beginPath().moveTo(10, 10).lineTo(17, 7).lineTo(26, 9).strokePath();
  if (style.accessory === 'cap') g.fillStyle(style.shirt).fillRoundedRect(7, 3, 24, 9, 5).fillRoundedRect(side === -1 ? 3 : 16, 10, 18, 3, 1);
}
function drawTorso(g: Graphics, style: CharacterStyle, facing: Facing): void {
  const c = THEME.colors, side = facing === 'LEFT' || facing === 'RIGHT';
  g.fillStyle(c.skinShade).fillRoundedRect(17, 1, 7, 7, 2);
  // Sloped shoulders, waist taper, and asymmetric shading replace a rectangular body.
  g.fillStyle(style.shirt).fillPoints([{ x: side ? 13 : 7, y: 10 }, { x: 16, y: 5 }, { x: 24, y: 5 }, { x: side ? 28 : 34, y: 10 }, { x: side ? 27 : 31, y: 24 }, { x: 29, y: 36 }, { x: 12, y: 36 }, { x: side ? 12 : 9, y: 24 }], true);
  g.fillStyle(c.shadow, 0.12).fillTriangle(25, 8, 31, 12, 28, 35);
  g.lineStyle(1, c.paper, 0.2).lineBetween(13, 13, 14, 31);
  g.lineStyle(1.3, c.ink, 0.3).strokeEllipse(20, 7, 9, 4);
  if (style.apron) {
    if (facing === 'UP') g.lineStyle(2, c.apron).lineBetween(13, 9, 26, 28).lineBetween(27, 9, 14, 28).lineBetween(11, 27, 29, 27);
    else {
      g.lineStyle(2, c.apron).lineBetween(15, 8, 16, 18).lineBetween(25, 8, 24, 18);
      g.fillStyle(c.apron).fillPoints([{ x: side ? 17 : 14, y: 17 }, { x: 26, y: 17 }, { x: 29, y: 34 }, { x: 12, y: 34 }], true);
      g.lineStyle(1, c.woodDark, 0.5).strokeRoundedRect(17, 23, 7, 5, 1);
    }
  }
  if (style.accessory === 'tie' && facing !== 'UP') {
    g.fillStyle(c.paper).fillTriangle(14, 7, 20, 12, 26, 7);
    g.fillStyle(c.woodDark).fillTriangle(20, 11, 17, 27, 23, 27);
  }
  if (style.accessory === 'bag') g.lineStyle(2, c.woodDark).lineBetween(12, 7, 29, 28).fillStyle(c.wood).fillRoundedRect(26, 24, 10, 12, 2);
}
export function createChibiTextures(scene: Phaser.Scene): void {
  const c = THEME.colors;
  for (const style of [...PLAYER_STYLES, ...CUSTOMER_ARCHETYPES]) {
    for (const facing of ['UP', 'DOWN', 'LEFT', 'RIGHT'] as const) {
      const keys = directionalVisualKeys(style.key, facing, 'NEUTRAL');
      for (const emotion of ['NEUTRAL', 'FOCUSED', 'HAPPY', 'DISAPPOINTED'] as const) {
        const g = scene.make.graphics({ x: 0, y: 0 }); drawHead(g, style, facing, emotion);
        g.generateTexture(directionalVisualKeys(style.key, facing, emotion).head, 40, 34); g.destroy();
      }
      const torso = scene.make.graphics({ x: 0, y: 0 }); drawTorso(torso, style, facing);
      torso.generateTexture(keys.torso, 40, 40); torso.destroy();
      const arm = scene.make.graphics({ x: 0, y: 0 });
      arm.fillStyle(c.skinShade).fillRoundedRect(3, 7, 7, 19, 3).fillStyle(c.skin).fillRoundedRect(2, 7, 6, 18, 3);
      arm.fillStyle(style.shirt).fillRoundedRect(1, 0, 10, 11, 3).fillStyle(c.shadow, 0.1).fillRect(8, 2, 2, 7);
      arm.generateTexture(keys.arm, 12, 27); arm.destroy();
      const leg = scene.make.graphics({ x: 0, y: 0 });
      leg.fillStyle(c.trousers).fillRoundedRect(3, 0, 8, 22, 3).fillStyle(c.shadow, 0.12).fillRect(facing === 'LEFT' ? 3 : 8, 3, 3, 18);
      leg.lineStyle(1, c.paper, 0.15).lineBetween(5, 3, 5, 18);
      leg.fillStyle(c.shoe).fillRoundedRect(2, 18, 11, 7, 3).fillStyle(c.apron).fillRect(3, 23, 9, 2);
      leg.generateTexture(keys.legs, 15, 27); leg.destroy();
      const detail = scene.make.graphics({ x: 0, y: 0 });
      if (style.hairstyle === 'ponytail') {
        const x = facing === 'LEFT' ? 27 : 9;
        detail.fillStyle(style.hair).fillEllipse(x, 9, 7, 19).fillStyle(c.apron).fillEllipse(x, 2, 6, 3);
      }
      if (style.apron && facing !== 'UP') {
        detail.fillStyle(c.apron).fillPoints([{ x: 12, y: 45 }, { x: 29, y: 45 }, { x: 30, y: 53 }, { x: 11, y: 53 }], true);
        detail.lineStyle(1, c.woodDark, 0.3).lineBetween(13, 51, 28, 51);
      }
      detail.generateTexture(keys.accessory, 40, 56); detail.destroy();
    }
    // Invisible Arcade carriers retain Phase 1 dimensions; menu uses the actual view.
    const carrier = scene.make.graphics({ x: 0, y: 0 });
    carrier.fillStyle(style.shirt).fillRect(12, 36, 28, 24); carrier.generateTexture(style.key, 52, 64); carrier.destroy();
  }
}
