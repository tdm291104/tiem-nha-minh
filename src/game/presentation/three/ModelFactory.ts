import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { THEME } from '../VisualTheme.ts';

/** Scene-owned shared resources. Replacing these model builders never changes domain entities. */
export class ModelFactory {
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();
  private readonly geometries = new Map<string, THREE.BufferGeometry>();
  private readonly textures: THREE.Texture[] = [];
  material(color: number, opacity = 1): THREE.MeshStandardMaterial {
    const key = `${color}:${opacity}`;
    let material = this.materials.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, roughness: 0.75, transparent: opacity < 1, opacity, depthWrite: opacity === 1 });
      this.materials.set(key, material);
    }
    return material;
  }
  private geometry(key: string, create: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let geometry = this.geometries.get(key);
    if (!geometry) { geometry = create(); this.geometries.set(key, geometry); }
    return geometry;
  }
  box(parent: THREE.Object3D, x: number, y: number, z: number, width: number, height: number, depth: number, color: number, rounded = true): THREE.Mesh {
    const key = `box:${width}:${height}:${depth}:${rounded}`;
    const geometry = this.geometry(key, () => rounded
      ? new RoundedBoxGeometry(width, height, depth, 2, Math.min(width, height, depth, 0.1) * 0.15)
      : new THREE.BoxGeometry(width, height, depth));
    const mesh = new THREE.Mesh(geometry, this.material(color));
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  sphere(parent: THREE.Object3D, x: number, y: number, z: number, width: number, height: number, depth: number, color: number): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry('sphere', () => new THREE.SphereGeometry(1, 16, 12)), this.material(color));
    mesh.position.set(x, y, z); mesh.scale.set(width / 2, height / 2, depth / 2); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  cylinder(parent: THREE.Object3D, x: number, y: number, z: number, radius: number, height: number, color: number, topRadius = radius): THREE.Mesh {
    const key = `cylinder:${radius}:${topRadius}:${height}`;
    const mesh = new THREE.Mesh(this.geometry(key, () => new THREE.CylinderGeometry(topRadius, radius, height, 16)), this.material(color));
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  tiles(parent: THREE.Object3D, tiles: readonly { x: number; z: number; color: number }[]): void {
    const geometry = this.geometry('floor-tile', () => new THREE.BoxGeometry(0.626, 0.012, 0.626));
    const mesh = new THREE.InstancedMesh(geometry, this.material(0xffffff), tiles.length);
    const matrix = new THREE.Matrix4(); const color = new THREE.Color();
    tiles.forEach((tile, i) => {
      matrix.makeTranslation(tile.x, 0.008, tile.z); mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, color.setHex(tile.color));
    });
    mesh.receiveShadow = true; parent.add(mesh);
  }
  sign(parent: THREE.Object3D, text: string, x: number, y: number, z: number, width: number, height: number, color: number = THEME.colors.ink): THREE.Mesh {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Cannot create shop signage');
    context.fillStyle = '#fff9e9'; context.fillRect(0, 0, 512, 128);
    context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    context.font = 'bold 44px Trebuchet MS, Arial, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(text, 256, 67, 490);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.textures.push(texture);
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 });
    this.materials.set(`sign:${this.textures.length}`, material);
    const mesh = new THREE.Mesh(this.geometry(`plane:${width}:${height}`, () => new THREE.PlaneGeometry(width, height)), material);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  dispose(): void {
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.geometries.clear(); this.materials.clear(); this.textures.length = 0;
  }
}
