import Phaser from 'phaser';
import * as THREE from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { ModelFactory } from './ModelFactory';
import { CharacterModel } from './CharacterModel';
import { createProductModel } from './ProductModel';
import { PLAYER_STYLES } from '../CharacterStyles';
import { buildShopEnvironment } from './ShopEnvironment';
import { ShelfModel, createCounter, createCrate, createSupplierDesk } from './FurnitureModels';
import { SHOP } from '../../world/ShopDefinition';
import { PRODUCTS } from '../../products/ProductCatalog';

export function createMenuArt(scene: Phaser.Scene): void {
  if (!WebGL.isWebGL2Available()) return;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  const factory = new ModelFactory(); const world = new THREE.Scene();
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
  const ambient = new THREE.HemisphereLight(0xfffbeb, 0x96c9b3, 2.4);
  const sun = new THREE.DirectionalLight(0xfff3d5, 3.1); sun.position.set(-2, 4, 3); world.add(ambient, sun);
  const snapshot = (key: string): void => {
    const canvas = document.createElement('canvas'); canvas.width = renderer.domElement.width; canvas.height = renderer.domElement.height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(renderer.domElement, 0, 0);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
  };
  try {
    const camera = new THREE.OrthographicCamera(-0.24, 0.24, 0.24, -0.24, 0.1, 10);
    renderer.setSize(96, 96);
    camera.position.set(0.25, 0.3, 0.8); camera.lookAt(0, 0.12, 0);
    for (const product of Object.values(PRODUCTS)) {
      const model = createProductModel(factory, product.id); world.add(model);
      renderer.render(world, camera); snapshot(`product-${product.id}`); world.remove(model);
    }
    camera.left = -0.22; camera.right = 0.22; camera.top = 0.22; camera.bottom = -0.22;
    camera.position.set(0, 0.72, 2); camera.lookAt(0, 0.64, 0); camera.updateProjectionMatrix();
    PLAYER_STYLES.forEach((style, i) => {
      const actor = new CharacterModel(factory, style); actor.update(100, 'DOWN', false, false, 'HAPPY'); world.add(actor.root);
      renderer.render(world, camera); snapshot(`portrait-player-${i + 1}`); world.remove(actor.root);
    });
    renderer.setSize(400, 220);
    camera.left = -0.9; camera.right = 0.9; camera.top = 0.495; camera.bottom = -0.495;
    camera.position.set(0, 1.05, 3); camera.lookAt(0, 0.42, 0); camera.updateProjectionMatrix();
    PLAYER_STYLES.forEach((style, i) => {
      const actor = new CharacterModel(factory, style);
      actor.root.position.x = i === 0 ? -0.3 : 0.3;
      actor.update(1000, i === 0 ? 'RIGHT' : 'LEFT', false, false, 'HAPPY');
      actor.figure.rotation.y = i === 0 ? 0.28 : -0.28;
      actor.setHeld({ productId: i === 0 ? 'instant_noodles' : 'milk', quantity: 1 });
      world.add(actor.root);
    });
    renderer.render(world, camera); snapshot('shopkeepers-3d');
    for (const child of [...world.children]) if (child instanceof THREE.Group) world.remove(child);
    world.add(buildShopEnvironment(factory));
    for (const definition of SHOP.shelves) { const shelf = new ShelfModel(factory, definition.productId); shelf.setStock(16, 20); shelf.root.position.set(definition.x / 100, 0, definition.y / 100); world.add(shelf.root); }
    for (const definition of SHOP.crates) { const crate = createCrate(factory, definition.productId); crate.root.position.set(definition.x / 100, 0, definition.y / 100); world.add(crate.root); }
    for (const definition of SHOP.counters) { const counter = createCounter(factory, definition.number); counter.root.position.set(definition.x / 100, 0, definition.y / 100); world.add(counter.root); }
    const desk = createSupplierDesk(factory); desk.position.set(SHOP.supplierTerminal.x / 100, 0, SHOP.supplierTerminal.y / 100); world.add(desk);
    PLAYER_STYLES.forEach((style, i) => { const actor = new CharacterModel(factory, style); actor.root.position.set(4.4 + i * 0.9, 0, 7.1); actor.update(100, 'DOWN', false, false, 'HAPPY'); world.add(actor.root); });
    renderer.setSize(720, 720);
    camera.left = -7.6; camera.right = 7.6; camera.top = 7.6; camera.bottom = -7.6;
    camera.position.set(16, 15, 20); camera.lookAt(5, 0.2, 4.7); camera.updateProjectionMatrix();
    renderer.render(world, camera); snapshot('menu-shop-3d');
  } finally { world.clear(); factory.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
}
