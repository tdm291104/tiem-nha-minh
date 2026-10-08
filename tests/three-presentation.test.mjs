import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { groundTo3D, facingYaw, cameraBlend, visiblePackages, THREE_VIEW } from '../src/game/presentation/three/ThreeRules.ts';
import { ShopCamera3D } from '../src/game/presentation/three/ShopCamera3D.ts';
import { ModelFactory } from '../src/game/presentation/three/ModelFactory.ts';
import { CharacterModel } from '../src/game/presentation/three/CharacterModel.ts';
import { createProductModel } from '../src/game/presentation/three/ProductModel.ts';
import { PLAYER_STYLES } from '../src/game/presentation/CharacterStyles.ts';
import { VISUAL_SETTINGS } from '../src/game/presentation/VisualTheme.ts';
import { PRODUCTS } from '../src/game/products/ProductCatalog.ts';
import { ShelfModel } from '../src/game/presentation/three/FurnitureModels.ts';

test('3D ground mapping preserves X/Z and keeps presentation height independent', () => {
  assert.deepEqual(groundTo3D({ x: 450, y: 735 }), { x: 4.5, y: 0, z: 7.3500000000000005 });
  const point = { x: 190, y: 355 };
  const floor = groundTo3D(point); const raised = groundTo3D(point, 1.3);
  assert.equal(floor.x, raised.x); assert.equal(floor.z, raised.z); assert.equal(raised.y, 1.3);
  assert.deepEqual(point, { x: 190, y: 355 });
});
test('four facing directions rotate the actual character forward axis', () => {
  const directions = { DOWN: [0, 0, 1], UP: [0, 0, -1], LEFT: [-1, 0, 0], RIGHT: [1, 0, 0] };
  for (const [facing, expected] of Object.entries(directions)) {
    const direction = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), facingYaw(facing));
    expected.forEach((value, i) => assert.ok(Math.abs(direction.getComponent(i) - value) < 1e-8));
  }
});
test('camera smoothing is frame-rate independent and stops with simulation pause', () => {
  assert.equal(cameraBlend(0), 0); assert.equal(cameraBlend(-10), 0);
  assert.ok(Math.abs(1 - cameraBlend(100) - (1 - cameraBlend(50)) ** 2) < 1e-10);
});
test('camera projection matches viewport center and raised anchors sit above feet', () => {
  const rig = new ShopCamera3D(1100, 800);
  const center = rig.project({ x: 500, y: 470 }, 0.4);
  assert.ok(Math.abs(center.x - 550) < 1e-8); assert.ok(Math.abs(center.y - 400) < 1e-8);
  assert.ok(rig.project({ x: 500, y: 470 }, 0.9).y < rig.project({ x: 500, y: 470 }).y);
});
test('camera directions keep existing keyboard orientation on screen', () => {
  const rig = new ShopCamera3D(1100, 800); const origin = rig.project({ x: 500, y: 500 });
  assert.ok(rig.project({ x: 600, y: 500 }).x > origin.x);
  assert.ok(rig.project({ x: 500, y: 600 }).y > origin.y);
});
test('shared camera keeps opposite-corner co-op players in the gameplay viewport', () => {
  const rig = new ShopCamera3D(1100, 800); const players = [{ x: 40, y: 40 }, { x: 960, y: 900 }];
  for (let i = 0; i < 120; i++) rig.update(16, players);
  for (const player of players) {
    const p = rig.project(player, 0.4);
    assert.ok(p.x > 12 && p.x < 1088); assert.ok(p.y > 82 && p.y < 708);
  }
});
test('paused camera does not snap to changed positions or zoom', () => {
  const rig = new ShopCamera3D(1100, 800); const before = rig.camera.projectionMatrix.clone(); const position = rig.camera.position.clone();
  rig.update(0, [{ x: 40, y: 40 }, { x: 960, y: 900 }]);
  assert.ok(rig.camera.projectionMatrix.equals(before)); assert.ok(rig.camera.position.equals(position));
});
test('empty player list leaves camera valid', () => {
  const rig = new ShopCamera3D(1100, 800); rig.update(1000, []);
  const p = rig.project({ x: 500, y: 470 }); assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
});
test('3D shelf density is bounded and represents real stock', () => {
  assert.equal(visiblePackages(0, 20), 0); assert.equal(visiblePackages(5, 20), 4);
  assert.equal(visiblePackages(10, 20), 8); assert.equal(visiblePackages(20, 20), 15);
  assert.equal(visiblePackages(100, 20), 15); assert.equal(visiblePackages(-2, 20), 0);
  assert.equal(visiblePackages(NaN, 20), 0); assert.equal(visiblePackages(5, 0), 0);
});
test('3D scale keeps shopkeepers smaller than a refrigerator', () => {
  assert.ok(THREE_VIEW.characterHeight > 0.6 && THREE_VIEW.characterHeight < 1.15);
  assert.ok(THREE_VIEW.unitsPerPixel > 0); assert.ok(THREE_VIEW.maxSpan >= THREE_VIEW.cameraSpan);
});
test('all product models have finite positive geometry without browser rendering', () => {
  const factory = new ModelFactory();
  try {
    for (const product of Object.values(PRODUCTS)) {
      const model = createProductModel(factory, product.id); const bounds = new THREE.Box3().setFromObject(model); const size = bounds.getSize(new THREE.Vector3());
      assert.ok(size.x > 0 && size.y > 0 && size.z > 0);
      assert.ok(size.x < 0.3 && size.y < 0.3 && size.z < 0.2);
    }
  } finally { factory.dispose(); }
});
test('male and female models have consistent scale and distinct silhouettes', () => {
  const factory = new ModelFactory();
  try {
    const models = PLAYER_STYLES.map(style => new CharacterModel(factory, style));
    const bounds = models.map(model => new THREE.Box3().setFromObject(model.root));
    bounds.forEach(bound => { const height = bound.max.y - bound.min.y; assert.ok(height > 0.7 && height < 0.9); });
    assert.notEqual(bounds[0].min.z, bounds[1].min.z);
  } finally { factory.dispose(); }
});
test('carrying changes only the 3D figure and never the ground position', () => {
  const factory = new ModelFactory();
  try {
    const actor = new CharacterModel(factory, PLAYER_STYLES[0]); actor.root.position.set(4.5, 0, 7.3);
    const before = actor.root.position.clone(); const originalChildren = actor.figure.children.length;
    actor.setHeld({ productId: 'milk', quantity: 3 }); assert.equal(actor.figure.children.length, originalChildren + 1);
    actor.setHeld({ productId: 'milk', quantity: 2 }); assert.equal(actor.figure.children.length, originalChildren + 1);
    actor.update(100, 'LEFT', true, true, 'HAPPY'); assert.ok(actor.root.position.equals(before));
    actor.setHeld(null); assert.equal(actor.figure.children.length, originalChildren);
  } finally { factory.dispose(); }
});
test('reduced motion disables 3D walk bob and limb swing without moving the ground anchor', () => {
  const factory = new ModelFactory(); const previous = VISUAL_SETTINGS.reducedMotion;
  try {
    VISUAL_SETTINGS.reducedMotion = true;
    const actor = new CharacterModel(factory, PLAYER_STYLES[0]); actor.update(100, 'DOWN', true, true, 'NEUTRAL');
    assert.equal(actor.figure.position.y, 0); assert.equal(actor.root.position.y, 0);
  } finally { VISUAL_SETTINGS.reducedMotion = previous; factory.dispose(); }
});

test('oblique camera sees shelf fronts and sides from a low three-quarter angle', () => {
  const elevation = Math.atan2(THREE_VIEW.cameraHeight, Math.hypot(THREE_VIEW.cameraOffsetX, THREE_VIEW.cameraDistance)) * 180 / Math.PI;
  assert.ok(elevation >= 25 && elevation <= 35);
  assert.ok(THREE_VIEW.cameraOffsetX > 0 && THREE_VIEW.cameraDistance > 0);
  const rig = new ShopCamera3D(1100, 800);
  const front = new THREE.Vector3(0, 0, 1).transformDirection(rig.camera.matrixWorldInverse);
  const side = new THREE.Vector3(1, 0, 0).transformDirection(rig.camera.matrixWorldInverse);
  assert.ok(front.z > 0); assert.ok(side.z > 0);
});

test('shelf structure does not obscure front labels in any of the three product rows', () => {
  const factory = new ModelFactory();
  try {
    const towardCamera = new THREE.Vector3(THREE_VIEW.cameraOffsetX, THREE_VIEW.cameraHeight, THREE_VIEW.cameraDistance).normalize();
    for (const productId of Object.keys(PRODUCTS)) {
      const shelf = new ShelfModel(factory, productId); shelf.setStock(20, 20); shelf.root.updateMatrixWorld(true);
      const packages = shelf.root.children.filter(child => child instanceof THREE.Group);
      const opaqueStructure = shelf.root.children.filter(child => child instanceof THREE.Mesh && !child.material.transparent);
      assert.equal(packages.length, 15);
      for (const product of packages) {
        const label = product.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.08, 0.05));
        const origin = label.clone().addScaledVector(towardCamera, 12);
        const ray = new THREE.Raycaster(origin, towardCamera.clone().negate(), 0, 11.999);
        assert.equal(ray.intersectObjects(opaqueStructure, false).length, 0, `${productId}: front packaging must be visible at ${product.position.toArray()}`);
      }
    }
  } finally { factory.dispose(); }
});

test('diagonally opposite co-op corners remain visible with the oblique camera', () => {
  const rig = new ShopCamera3D(1100, 800); const players = [{ x: 40, y: 900 }, { x: 960, y: 40 }];
  for (let i = 0; i < 120; i++) rig.update(16, players);
  for (const player of players) {
    const p = rig.project(player, 0.4);
    assert.ok(p.x > 12 && p.x < 1088); assert.ok(p.y > 82 && p.y < 708);
  }
});
