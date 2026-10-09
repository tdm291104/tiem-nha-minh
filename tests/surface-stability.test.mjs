import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ModelFactory } from '../src/game/presentation/three/ModelFactory.ts';
import { createProductModel } from '../src/game/presentation/three/ProductModel.ts';
const bounds = object => { object.updateMatrixWorld(true); return new THREE.Box3().setFromObject(object); };
const separatedSidePlanes = (a, b) => Math.abs(a.min.x - b.min.x) > 0.001 && Math.abs(a.max.x - b.max.x) > 0.001;
test('noodle seal does not share exposed side planes with package body', () => {
  const f = new ModelFactory(); try { const model = createProductModel(f, 'instant_noodles'); assert.ok(separatedSidePlanes(bounds(model.children[0]), bounds(model.children[3]))); } finally { f.dispose(); }
});
test('milk roof does not share exposed side planes with carton body', () => {
  const f = new ModelFactory(); try { const model = createProductModel(f, 'milk'); assert.ok(separatedSidePlanes(bounds(model.children[0]), bounds(model.children[2]))); } finally { f.dispose(); }
});

import { buildShopEnvironment } from '../src/game/presentation/three/ShopEnvironment.ts';
import { initialPlan, ANNEX_SHELVES } from '../src/game/operations/StorePlan.ts';
// Text rasterization is unrelated to mesh overlap; keep this geometry test canvas-free.
class GeometryFactory extends ModelFactory {
  sign(parent, text, x, y, z, width, height, color = 0xffffff) {
    return this.box(parent, x, y, z, width, height, 0.001, color, false);
  }
}
for (const expanded of [false, true]) {
  test(`shop and courtyard floors meet without overlap (${expanded ? 'expanded' : 'original'})`, () => {
    const f = new GeometryFactory();
    try {
      const plan = initialPlan();
      const root = buildShopEnvironment(f, { ...plan, expanded, positions: expanded ? [...plan.positions, ...ANNEX_SHELVES] : plan.positions });
      const floor = bounds(root.getObjectByName('shop-floor'));
      const pavement = bounds(root.getObjectByName('courtyard-floor'));
      assert.ok(Math.abs(floor.max.z - pavement.min.z) < 0.00001);
      assert.ok(Math.abs(floor.max.y - pavement.max.y) < 0.00001);
      assert.ok(Math.abs(floor.max.x - (expanded ? 12.2 : 10)) < 0.00001);
      const tiles = bounds(root.children.find(child => child.isInstancedMesh));
      assert.ok(tiles.min.y > floor.max.y);
      assert.ok(tiles.max.x < floor.max.x && tiles.max.z < floor.max.z);
      for (const trim of root.children.filter(child => child.name === 'wall-trim')) {
        const wall = root.children.find(child => child !== trim && child.isMesh && Math.abs(child.position.x - trim.position.x) < 0.00001 && Math.abs(child.position.z - trim.position.z) < 0.00001 && child.geometry.parameters.height > 0.14);
        assert.ok(wall, 'trim has a matching wall');
        const a = bounds(trim); const b = bounds(wall);
        assert.ok(separatedSidePlanes(a, b));
        assert.ok(Math.abs(a.min.z - b.min.z) > 0.001 && Math.abs(a.max.z - b.max.z) > 0.001);
      }
    } finally { f.dispose(); }
  });
}
