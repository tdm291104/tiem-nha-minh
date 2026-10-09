import * as THREE from 'three';
import { THEME } from '../VisualTheme.ts';
import type { ProductId } from '../../products/Product';
import { shelfDisplayStyle } from '../VisualCatalog.ts';
import type { ModelFactory } from './ModelFactory.ts';
import { createProductModel } from './ProductModel.ts';
import { visiblePackages } from './ThreeRules.ts';

export class ShelfModel {
  readonly root = new THREE.Group();
  private readonly products: THREE.Group[] = [];
  private lastCount = -1;
  constructor(f: ModelFactory, productId: ProductId) {
    const c = THEME.colors; const fridge = shelfDisplayStyle(productId) === 'refrigerated';
    const frame = fridge ? c.paper : c.green;
    f.box(this.root, 0, 0.07, 0, 1.23, 0.14, 1.2, c.woodDark);
    f.box(this.root, 0, 0.62, -0.52, 1.2, 1.15, 0.12, fridge ? c.glass : c.woodLight);
    for (const side of [-1, 1]) f.box(this.root, side * 0.58, 0.63, 0, 0.08, 1.17, 1.18, frame);
    f.box(this.root, 0, 1.23, 0, 1.25, 0.11, 1.22, frame);
    for (let row = 0; row < 3; row++) {
      const height = 0.19 + row * 0.33;
      f.box(this.root, 0, height, 0.03, 1.13, 0.045, 1.09, fridge ? c.paper : c.wood);
      f.box(this.root, 0, height, 0.579, 1.11, 0.07, 0.015, c.paper);
      for (let column = 0; column < 5; column++) {
        const packageModel = createProductModel(f, productId);
        packageModel.position.set(-0.43 + column * 0.215, height + 0.026, 0.47);
        this.products.push(packageModel); this.root.add(packageModel);
      }
    }
    if (fridge) {
      const glass = f.box(this.root, 0, 0.71, 0.606, 1.07, 0.98, 0.012, c.glass);
      glass.material = f.material(c.glass, 0.14); glass.castShadow = false;
      f.box(this.root, 0, 0.72, 0.618, 0.026, 1, 0.022, c.silver);
      f.box(this.root, 0.09, 0.7, 0.655, 0.026, 0.29, 0.035, c.metalDark);
      const reflection = f.box(this.root, -0.34, 0.85, 0.622, 0.028, 0.54, 0.005, c.paper);
      reflection.rotation.z = -0.18; reflection.material = f.material(c.paper, 0.35); reflection.castShadow = false;
    }
  }
  setStock(stock: number, capacity: number): void {
    const count = visiblePackages(stock, capacity, this.products.length);
    if (count === this.lastCount) return;
    this.lastCount = count;
    this.products.forEach((product, i) => { product.visible = i < count; });
  }
}

export function createCrate(f: ModelFactory, productId: ProductId): { root: THREE.Group; products: THREE.Group[] } {
  const root = new THREE.Group(); const c = THEME.colors;
  const products: THREE.Group[] = [];
  f.box(root, 0, 0.18, 0, 0.86, 0.36, 0.66, c.wood);
  f.box(root, 0, 0.19, 0.335, 0.44, 0.16, 0.009, c.paper);
  for (const side of [-1, 1]) {
    f.box(root, side * 0.4, 0.36, 0, 0.035, 0.08, 0.64, c.woodLight);
    f.box(root, 0, 0.36, side * 0.3, 0.82, 0.08, 0.035, c.woodLight);
  }
  for (const x of [-0.23, 0, 0.23]) { const product = createProductModel(f, productId); product.position.set(x, 0.35, 0); root.add(product); products.push(product); }
  return { root, products };
}

export function createCounter(f: ModelFactory, number: number): { root: THREE.Group; screen: THREE.Mesh; bar: THREE.Mesh } {
  const root = new THREE.Group(); const c = THEME.colors;
  f.box(root, 0, 0.32, 0, 1.54, 0.64, 0.72, number === 1 ? c.blue : c.orange);
  f.box(root, 0, 0.665, 0, 1.6, 0.07, 0.78, c.woodLight);
  f.box(root, 0, 0.08, 0.372, 1.55, 0.08, 0.02, c.woodDark);
  f.box(root, -0.1, 0.706, -0.02, 0.55, 0.014, 0.57, c.metalDark);
  f.box(root, 0.41, 0.738, 0.14, 0.33, 0.08, 0.3, c.paper);
  f.box(root, 0.4, 0.83, 0.03, 0.055, 0.16, 0.05, c.metalDark);
  const screen = f.box(root, 0.4, 0.94, -0.02, 0.28, 0.19, 0.035, c.green); screen.rotation.x = -0.18;
  for (let i = 0; i < 3; i++) f.box(root, 0.32 + i * 0.075, 0.783, 0.19, 0.045, 0.012, 0.04, c.metalDark);
  f.box(root, -0.55, 0.798, 0.15, 0.21, 0.19, 0.12, c.paper);
  f.box(root, -0.55, 0.908, 0.15, 0.08, 0.04, 0.025, c.wood);
  f.sign(root, `QUẦY ${number}`, 0, 0.41, 0.368, 0.55, 0.14);
  const bar = f.box(root, 0, 1.09, 0.025, 0.6, 0.035, 0.025, c.green); bar.visible = false;
  return { root, screen, bar };
}

export function createSupplierDesk(f: ModelFactory): THREE.Group {
  const root = new THREE.Group(); const c = THEME.colors;
  for (const x of [-0.29, 0.29]) for (const z of [-0.19, 0.19]) f.box(root, x, 0.29, z, 0.04, 0.58, 0.04, c.woodDark);
  f.box(root, 0, 0.61, 0, 0.69, 0.07, 0.49, c.woodLight);
  f.box(root, -0.1, 0.654, 0.02, 0.28, 0.021, 0.2, c.metalDark);
  const screen = f.box(root, -0.1, 0.755, -0.08, 0.28, 0.19, 0.016, c.blue); screen.rotation.x = -0.14;
  f.box(root, 0.22, 0.653, 0.045, 0.13, 0.017, 0.19, c.paper);
  f.box(root, 0.245, 0.67, -0.11, 0.075, 0.022, 0.1, c.green);
  return root;
}
