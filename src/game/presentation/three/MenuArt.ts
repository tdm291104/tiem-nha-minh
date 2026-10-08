import Phaser from 'phaser';
import * as THREE from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { ModelFactory } from './ModelFactory';
import { CharacterModel } from './CharacterModel';
import { createProductModel } from './ProductModel';
import { PLAYER_STYLES } from '../CharacterStyles';
import { PRODUCTS } from '../../products/ProductCatalog';

/** Cache UI illustrations from the same 3D models used in the playable shop. */
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
    renderer.setSize(400, 220);
    camera.left = -0.9; camera.right = 0.9; camera.top = 0.495; camera.bottom = -0.495;
    camera.position.set(0, 1.05, 3); camera.lookAt(0, 0.42, 0); camera.updateProjectionMatrix();
    PLAYER_STYLES.forEach((style, i) => {
      const actor = new CharacterModel(factory, style);
      actor.root.position.x = i === 0 ? -0.3 : 0.3;
      actor.update(1000, i === 0 ? 'RIGHT' : 'LEFT', false, false, 'HAPPY');
      // A slight inward turn keeps both faces visible in the menu portrait.
      actor.figure.rotation.y = i === 0 ? 0.28 : -0.28;
      actor.setHeld({ productId: i === 0 ? 'instant_noodles' : 'milk', quantity: 1 });
      world.add(actor.root);
    });
    renderer.render(world, camera); snapshot('shopkeepers-3d');
  } finally { world.clear(); factory.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
}
