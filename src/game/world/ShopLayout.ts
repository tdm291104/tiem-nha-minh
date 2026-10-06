import Phaser from 'phaser';
import { cssColor, THEME } from '../presentation/VisualTheme';
import { TEXT_STYLE, WORLD } from '../config/settings';
import { Shelf } from '../entities/Shelf';
import { StorageCrate } from '../entities/StorageCrate';
import type { InventorySystem } from '../systems/InventorySystem';
import { SHOP } from './ShopDefinition';

export { SHOP } from './ShopDefinition';

export function createShopFixtures(scene: Phaser.Scene, obstacles: Phaser.Physics.Arcade.StaticGroup, inventory: InventorySystem): { shelves: Shelf[]; crates: StorageCrate[] } {
  return {
    shelves: SHOP.shelves.map(config => new Shelf(scene, config.id, config.productId, config, obstacles, inventory, config.initialStock)),
    crates: SHOP.crates.map(config => new StorageCrate(scene, config.id, config.productId, config, obstacles, inventory)),
  };
}

export function createShopLayout(scene: Phaser.Scene): Phaser.Physics.Arcade.StaticGroup {
  const obstacles = scene.physics.add.staticGroup();
  const g = scene.add.graphics().setDepth(-10);
  g.fillStyle(THEME.colors.floor).fillRoundedRect(0, 0, WORLD.width, WORLD.height, 18);
  for (let x = 24; x < WORLD.width - 24; x += 64) for (let y = 24; y < WORLD.height - 24; y += 64) {
    g.fillStyle((Math.floor(x / 64) + Math.floor(y / 64)) % 3 === 0 ? THEME.colors.ceramicLight : THEME.colors.floor, 0.5).fillRect(x + 1, y + 1, 62, 62);
    g.lineStyle(1, THEME.colors.tile, 0.35).strokeRect(x, y, 64, 64);
    g.lineStyle(1, THEME.colors.paper, 0.45).lineBetween(x + 2, y + 2, x + 60, y + 2);
  }
  g.fillStyle(THEME.colors.warehouse, 0.7).fillRect(24, 24, 952, 196);
  g.fillStyle(THEME.colors.amberSoft, 0.08).fillRect(24, 24, 952, 892);
  const label = (x: number, y: number, text: string, size = 16): void => {
    scene.add.text(x, y, text, { ...TEXT_STYLE, fontSize: `${size}px`, color: cssColor(THEME.colors.woodDark) }).setOrigin(0.5).setDepth(-1);
  };
  const block = (x: number, y: number, w: number, h: number, _color: number): void => {
    const face = scene.add.graphics().setDepth(w < h ? -1 : y + h / 2);
    face.fillStyle(THEME.colors.shadow, 0.07).fillRect(x - w / 2 + 4, y - h / 2, w, h + 5);
    face.fillStyle(THEME.colors.wallShade).fillRect(x - w / 2, y - h / 2 - 14, w, h + 14);
    face.fillStyle(THEME.colors.wall).fillRect(x - w / 2, y - h / 2 - 14, Math.max(1, w - 4), Math.max(1, h + 8));
    face.fillStyle(THEME.colors.wood).fillRect(x - w / 2, y + h / 2 - 6, w, 6);
    const collision = scene.add.rectangle(x, y, w, h).setVisible(false);
    obstacles.add(collision);
  };
  for (const wall of SHOP.walls) block(wall.x, wall.y, wall.width, wall.height, wall.color);
  label(500, 45, 'KHO HÀNG · TIỆM NHÀ MÌNH', 14);
  label(500, 575, 'Hàng ngon · Giá hiền', 17);
  label(500, 600, 'Một tiệm nhỏ, cả xóm thương', 12);
  // Folding shutters flank the unchanged central entrance and customer waypoints.
  g.fillStyle(THEME.colors.woodDark).fillRoundedRect(408, 859, 184, 44, 3);
  g.fillStyle(THEME.colors.woodLight).fillRoundedRect(414, 863, 172, 36, 2);
  for (let x = 420; x < 586; x += 10) g.lineStyle(1, THEME.colors.woodDark, 0.22).lineBetween(x, 867, x, 895);
  for (const side of [390, 604]) {
    g.fillStyle(THEME.colors.metal).fillRect(side, 856, 10, 51);
    for (let i = 0; i < 3; i++) g.lineStyle(1, THEME.colors.metalDark).lineBetween(side + 2 + i * 3, 858, side + 2 + i * 3, 905);
  }
  const threshold = scene.add.graphics().setDepth(950);
  threshold.fillStyle(THEME.colors.wallShade).fillRect(405, 902, 190, 24);
  threshold.fillStyle(THEME.colors.ceramicLight).fillRect(405, 902, 190, 10);
  threshold.lineStyle(1, THEME.colors.muted, 0.35).lineBetween(468, 902, 468, 926).lineBetween(531, 902, 531, 926);
  scene.add.text(500, 918, 'TIỆM NHÀ MÌNH', { ...TEXT_STYLE, fontSize: '11px' }).setOrigin(0.5).setDepth(951);
  return obstacles;
}
