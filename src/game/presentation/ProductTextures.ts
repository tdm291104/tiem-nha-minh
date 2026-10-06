import type Phaser from 'phaser';
import { PRODUCTS } from '../products/ProductCatalog';
import { THEME } from './VisualTheme';
import { productVisualType, VISUAL_SCALE } from './VisualCatalog';

/** One cached packaging illustration shared by every world and UI icon. No real brands. */
export function createProductTextures(scene: Phaser.Scene): void {
  const c = THEME.colors;
  for (const product of Object.values(PRODUCTS)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    switch (productVisualType(product.id)) {
      case 'noodle-packet':
        g.fillStyle(c.woodDark).fillRoundedRect(4, 13, 40, 28, 4);
        g.fillStyle(c.labelRed).fillRoundedRect(3, 9, 40, 28, 4);
        g.fillStyle(c.noodle).fillRect(4, 10, 38, 5).fillRect(4, 32, 38, 4);
        g.lineStyle(1, c.woodLight).lineBetween(7, 10, 7, 35).lineBetween(39, 10, 39, 35);
        g.fillStyle(c.paper).fillEllipse(24, 25, 25, 12);
        g.lineStyle(1.4, c.noodle);
        for (let i = 0; i < 4; i++) g.beginPath().moveTo(15, 22 + i * 1.6).lineTo(19, 20 + i * 1.6).lineTo(25, 23 + i * 1.6).lineTo(32, 21 + i * 1.6).strokePath();
        g.lineStyle(1.2, c.paper).lineBetween(15, 17, 31, 17); break;
      case 'drink-can':
        g.fillStyle(c.metalDark).fillRoundedRect(13, 7, 23, 36, 7);
        g.fillStyle(c.labelRed).fillRoundedRect(12, 7, 22, 35, 6);
        g.fillStyle(c.silver).fillEllipse(23, 8, 22, 7).fillEllipse(23, 40, 21, 4);
        g.lineStyle(1, c.metalDark).strokeEllipse(23, 8, 17, 4).lineBetween(21, 8, 27, 8);
        g.fillStyle(c.paper).fillTriangle(14, 21, 32, 15, 32, 22).fillTriangle(14, 21, 14, 28, 32, 22);
        g.fillStyle(c.paper, 0.3).fillRoundedRect(15, 13, 3, 23, 1); break;
      case 'milk-carton':
        g.fillStyle(c.labelBlue).fillRect(31, 15, 8, 27).fillTriangle(31, 15, 28, 5, 39, 15);
        g.fillStyle(c.ceramicLight).fillRect(10, 15, 21, 27).fillTriangle(10, 15, 20, 5, 31, 15);
        g.fillStyle(c.paper).fillTriangle(20, 5, 28, 5, 31, 15).fillRect(19, 3, 10, 3);
        g.fillStyle(c.labelBlue).fillRect(10, 30, 21, 12).fillEllipse(21, 24, 13, 8);
        g.lineStyle(1, c.wallShade).lineBetween(10, 15, 31, 15).lineBetween(31, 15, 31, 42);
        g.lineStyle(1.2, c.paper).lineBetween(14, 34, 27, 34).lineBetween(17, 37, 25, 37); break;
      case 'cookie-box':
        g.fillStyle(c.woodDark).fillRect(34, 11, 7, 31).fillTriangle(7, 11, 34, 11, 41, 6);
        g.fillStyle(c.biscuit).fillRoundedRect(7, 11, 27, 31, 2);
        g.fillStyle(c.woodLight).fillTriangle(7, 11, 14, 6, 41, 6);
        g.fillStyle(c.paper).fillRect(10, 14, 21, 6).fillEllipse(21, 30, 20, 17);
        g.fillStyle(c.biscuit).fillCircle(21, 29, 7);
        g.fillStyle(c.woodDark).fillCircle(18, 26, 1.3).fillCircle(24, 28, 1.4).fillCircle(20, 32, 1.1);
        g.lineStyle(1, c.woodDark).lineBetween(14, 17, 28, 17); break;
      case 'sauce-bottle':
        g.fillStyle(c.liquid).fillRoundedRect(14, 16, 21, 29, 6).fillRoundedRect(19, 8, 11, 15, 3);
        g.fillStyle(c.labelRed).fillRoundedRect(18, 4, 13, 6, 2);
        g.fillStyle(c.apron).fillRoundedRect(15, 26, 19, 12, 2);
        g.fillStyle(c.paper, 0.4).fillRoundedRect(17, 17, 3, 26, 1);
        g.lineStyle(1, c.labelRed).strokeEllipse(25, 31, 9, 5).lineBetween(23, 29, 27, 33);
        g.lineStyle(1, c.woodDark).lineBetween(21, 40, 30, 40); break;
    }
    g.generateTexture(`product-${product.id}`, VISUAL_SCALE.productTexture, VISUAL_SCALE.productTexture); g.destroy();
  }
}
