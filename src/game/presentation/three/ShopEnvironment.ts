import * as THREE from 'three';
import { SHOP } from '../../world/ShopDefinition.ts';
import { WORLD } from '../../config/settings.ts';
import { THEME } from '../VisualTheme.ts';
import { ModelFactory } from './ModelFactory.ts';
import { groundTo3D } from './ThreeRules.ts';
import type { PlanCheckpoint } from '../../operations/StorePlan';

export function buildShopEnvironment(f: ModelFactory, plan?: PlanCheckpoint): THREE.Group {
  const root = new THREE.Group(); const c = THEME.colors;
  const width = plan?.expanded ? 12.2 : 10;
  const floor = f.box(root, width / 2, -0.12, 4.7, width, 0.24, 9.4, c.woodLight, false);
  floor.name = 'shop-floor'; floor.castShadow = false;
  const tiles: Array<{ x: number; z: number; color: number }> = [];
  for (let x = 0.24; x + 0.626 < width - 0.1; x += 0.64) for (let z = 0.24; z + 0.626 < 9.3; z += 0.64) {
    tiles.push({ x: x + 0.313, z: z + 0.313, color: (Math.round(x * 10) + Math.round(z * 10)) % 3 ? c.floor : c.ceramicLight });
  }
  f.tiles(root, tiles);
  for (const wall of SHOP.walls) {
    if (plan && (wall.y === 928 || wall.y === 220) || plan?.expanded && wall.x === 988) continue;
    const p = groundTo3D(wall);
    // Cutaway foreground/side walls reveal the shop without changing their colliders.
    const height = wall.y < 30 ? 1.55 : wall.y === 220 ? 0.37 : 0.23;
    f.box(root, p.x, height / 2, p.z, wall.width / 100, height, wall.height / 100, c.wall);
    const trim = f.box(root, p.x, 0.07, p.z, wall.width / 100 + 0.012, 0.14, wall.height / 100 + 0.012, c.green);
    trim.name = 'wall-trim';
  }
  if (plan) {
    for (const x of [1.79, 8.21]) { f.box(root, x, 0.185, 2.2, 3.1, 0.37, 0.18, c.wall); const trim = f.box(root, x, 0.07, 2.2, 3.112, 0.14, 0.192, c.green); trim.name = 'wall-trim'; }
    // Adjacent footprints share a seam, never an overlapping floor surface.
    const pavement = f.box(root, width / 2, -0.06, 10.4, width, 0.12, 2, c.silver, false);
    pavement.name = 'courtyard-floor'; pavement.castShadow = false;
    for (const x of [2.02, 7.98]) f.box(root, x, 0.12, 9.28, 4.04, 0.24, 0.24, c.wall);
    if (plan.expanded) {
      f.box(root, 12.08, 0.12, 4.7, 0.24, 0.24, 9.4, c.wall);
      f.box(root, 11, 0.775, 0.12, 2.2, 1.55, 0.24, c.wall);
      f.box(root, 11, 0.12, 9.28, 2.2, 0.24, 0.24, c.wall);
      f.sign(root, 'GIAN HÀNG MỚI', 11, 1.05, 0.253, 1.7, 0.3, c.green);
    }
    if (plan.decorations.includes('plants')) { plant(f, root, 0.5, 7); plant(f, root, 9.5, 7); }
    if (plan.decorations.includes('seating')) { stool(f, root, 1, 10.7); stool(f, root, 1.5, 10.7); }
    if (plan.decorations.includes('sign')) f.sign(root, 'HÀNG NGON · GIÁ HIỀN', 5, 1.5, 0.255, 3.4, 0.25, c.labelRed);
    if (plan.decorations.includes('cooler')) { f.box(root, 0.55, 0.5, 0.5, 0.4, 1, 0.35, c.paper); f.box(root, 0.55, 0.54, 0.683, 0.34, 0.83, 0.02, c.glass); }
  }
  f.sign(root, 'TIỆM NHÀ MÌNH', 5, 1.05, 0.253, 3.1, 0.45, c.green);
  f.sign(root, 'KHO HÀNG', 2, 0.92, 0.253, 1.4, 0.32);
  // Calendar, clock and wall fan are decoration, excluded from navigation geometry.
  f.sign(root, '08 / 10', 8, 0.96, 0.255, 0.51, 0.37, c.labelRed);
  const clock = f.cylinder(root, 6.95, 1.05, 0.29, 0.15, 0.03, c.paper); clock.rotation.x = Math.PI / 2;
  f.box(root, 6.95, 1.096, 0.318, 0.009, 0.083, 0.01, c.ink);
  f.box(root, 6.995, 1.05, 0.32, 0.09, 0.009, 0.01, c.ink);
  const fan = f.cylinder(root, 0.85, 1.06, 0.3, 0.16, 0.045, c.blue); fan.rotation.x = Math.PI / 2;
  for (let i = 0; i < 3; i++) { const blade = f.box(root, 0.85, 1.06, 0.336, 0.24, 0.035, 0.015, c.paper); blade.rotation.z = i * Math.PI / 3; }
  f.box(root, 5, 0.018, 8.82, 1.8, 0.03, 0.44, c.green);
  for (const x of [4.09, 5.91]) {
    f.box(root, x, 0.26, 8.79, 0.085, 0.52, 0.5, c.silver);
    for (let i = 0; i < 4; i++) f.box(root, x, 0.27, 8.61 + i * 0.12, 0.097, 0.49, 0.026, c.metal);
  }
  plant(f, root, 0.54, 8.54); plant(f, root, 9.46, 8.54);
  stool(f, root, 0.53, 6.44); stool(f, root, 9.44, 6.44);
  f.box(root, 9.35, 0.14, 0.53, 0.46, 0.28, 0.42, c.wood);
  f.box(root, 9.32, 0.41, 0.54, 0.35, 0.24, 0.36, c.woodLight);
  const broom = f.box(root, 0.39, 0.39, 3.7, 0.018, 0.69, 0.018, c.woodDark); broom.rotation.z = -0.12;
  f.box(root, 0.43, 0.078, 3.7, 0.16, 0.13, 0.025, c.amber);
  f.box(root, WORLD.width / 200, -0.18, 9.7, 10.7, 0.12, 0.64, c.silver);
  return root;
}
function plant(f: ModelFactory, root: THREE.Group, x: number, z: number): void {
  f.cylinder(root, x, 0.13, z, 0.14, 0.26, THEME.colors.orange, 0.18);
  f.cylinder(root, x, 0.26, z, 0.17, 0.02, THEME.colors.woodDark);
  for (const offset of [-0.08, 0, 0.08]) f.sphere(root, x + offset, 0.4 + Math.abs(offset), z, 0.13, 0.27, 0.13, THEME.colors.green);
}
function stool(f: ModelFactory, root: THREE.Group, x: number, z: number): void {
  f.box(root, x, 0.27, z, 0.27, 0.047, 0.27, THEME.colors.labelRed);
  for (const dx of [-0.1, 0.1]) for (const dz of [-0.1, 0.1]) f.box(root, x + dx, 0.13, z + dz, 0.03, 0.26, 0.03, THEME.colors.labelRed);
}
