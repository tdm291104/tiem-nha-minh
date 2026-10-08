import * as THREE from 'three';
import type { ProductId } from '../../products/Product';
import type { ModelFactory } from './ModelFactory';

export function createProductModel(factory: ModelFactory, id: ProductId): THREE.Group {
  const root = new THREE.Group();
  const c = { red: 0xef7853, yellow: 0xffd25d, blue: 0x66bedc, cream: 0xfff7dd, brown: 0xa56632 };
  switch (id) {
    case 'instant_noodles':
      factory.box(root, 0, 0.09, 0, 0.21, 0.16, 0.08, c.red);
      factory.box(root, 0, 0.09, 0.047, 0.15, 0.09, 0.008, c.yellow);
      factory.sphere(root, 0, 0.082, 0.055, 0.1, 0.045, 0.008, c.cream);
      factory.box(root, 0, 0.165, 0, 0.21, 0.018, 0.07, c.yellow); break;
    case 'soft_drink':
      factory.cylinder(root, 0, 0.105, 0, 0.062, 0.2, 0x4bcab5);
      factory.cylinder(root, 0, 0.12, 0, 0.063, 0.068, c.cream);
      factory.cylinder(root, 0, 0.21, 0, 0.057, 0.014, 0xc4e8eb);
      factory.box(root, 0, 0.219, 0, 0.035, 0.006, 0.018, 0x82989b); break;
    case 'milk': {
      factory.box(root, 0, 0.12, 0, 0.13, 0.22, 0.12, c.cream);
      factory.box(root, 0, 0.08, 0.063, 0.12, 0.08, 0.008, c.blue);
      const top = factory.box(root, 0, 0.245, 0, 0.13, 0.07, 0.07, c.blue); top.rotation.x = Math.PI / 4;
      factory.box(root, 0, 0.279, 0, 0.13, 0.01, 0.016, c.cream); break;
    }
    case 'cookies':
      factory.box(root, 0, 0.105, 0, 0.21, 0.2, 0.08, c.yellow);
      for (const x of [-0.045, 0.045]) {
        factory.sphere(root, x, 0.105, 0.046, 0.07, 0.07, 0.016, c.brown);
        factory.sphere(root, x - 0.01, 0.11, 0.057, 0.014, 0.014, 0.008, 0x583c28);
      } break;
    case 'fish_sauce':
      factory.cylinder(root, 0, 0.09, 0, 0.052, 0.17, c.brown, 0.048);
      factory.cylinder(root, 0, 0.195, 0, 0.026, 0.06, c.brown);
      factory.cylinder(root, 0, 0.232, 0, 0.031, 0.03, c.red);
      factory.cylinder(root, 0, 0.09, 0, 0.053, 0.065, c.cream); break;
  }
  return root;
}
