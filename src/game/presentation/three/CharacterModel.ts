import * as THREE from 'three';
import type { CharacterStyle } from '../CharacterStyles';
import type { Emotion, Facing } from '../PresentationRules';
import { VISUAL_SETTINGS, THEME } from '../VisualTheme.ts';
import type { ProductStack } from '../../products/Product';
import type { ModelFactory } from './ModelFactory.ts';
import { createStackModel } from './ProductModel.ts';
import { facingYaw, THREE_VIEW } from './ThreeRules.ts';

export class CharacterModel {
  readonly root = new THREE.Group();
  readonly figure = new THREE.Group();
  private readonly arms: THREE.Group[] = [];
  private readonly legs: THREE.Group[] = [];
  private readonly eyes: THREE.Mesh[] = [];
  private readonly mouth: THREE.Mesh;
  private readonly hair: THREE.Group;
  private held: THREE.Group | null = null;
  private heldProduct = '';
  private phase = 0;
  private moving = false;
  private yaw = 0;
  private readonly factory: ModelFactory;

  constructor(factory: ModelFactory, style: CharacterStyle) {
    this.factory = factory;
    const f = factory; const body = this.figure; this.root.add(body); body.scale.setScalar(style.build * THREE_VIEW.characterHeight / 0.81);
    // Face is local +Z. Rotating the figure provides real side/back silhouettes.
    f.sphere(body, 0, 0.435, 0, 0.29, 0.32, 0.2, style.shirt);
    f.box(body, 0, 0.3, 0, 0.22, 0.075, 0.16, THEME.colors.trousers);
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * 0.066, 0.28, 0); body.add(leg); this.legs.push(leg);
      f.box(leg, 0, -0.1, 0, 0.085, 0.19, 0.1, THEME.colors.trousers);
      f.box(leg, 0, -0.24, 0.034, 0.1, 0.08, 0.17, THEME.colors.shoe);
      f.box(leg, 0, -0.272, 0.043, 0.102, 0.018, 0.17, THEME.colors.paper);
      const arm = new THREE.Group(); arm.position.set(side * 0.163, 0.535, 0); body.add(arm); this.arms.push(arm);
      f.sphere(arm, 0, -0.05, 0, 0.095, 0.15, 0.1, style.shirt);
      f.sphere(arm, 0, -0.17, 0, 0.072, 0.12, 0.078, THEME.colors.skin);
      f.sphere(arm, 0, -0.233, 0, 0.075, 0.07, 0.075, THEME.colors.skin);
    }
    f.cylinder(body, 0, 0.585, 0, 0.045, 0.08, THEME.colors.skin);
    f.sphere(body, 0, 0.675, 0, 0.26, 0.235, 0.22, THEME.colors.skin);
    this.hair = new THREE.Group(); body.add(this.hair);
    f.sphere(this.hair, 0, 0.737, -0.018, 0.273, 0.145, 0.232, style.hair);
    f.sphere(this.hair, 0, 0.68, -0.067, 0.24, 0.2, 0.16, style.hair);
    for (const side of [-1, 1]) {
      f.sphere(body, side * 0.128, 0.67, 0, 0.05, 0.065, 0.05, THEME.colors.skin);
      const eye = f.sphere(body, side * 0.046, 0.681, 0.103, 0.019, 0.028, 0.012, THEME.colors.ink); this.eyes.push(eye);
      f.box(body, side * 0.046, 0.709, 0.097, 0.036, 0.009, 0.009, style.hair);
      f.sphere(body, side * 0.073, 0.643, 0.095, 0.028, 0.017, 0.012, THEME.colors.blush);
    }
    f.sphere(body, 0, 0.659, 0.111, 0.022, 0.026, 0.024, THEME.colors.skinShade);
    this.mouth = f.sphere(body, 0, 0.631, 0.101, 0.034, 0.012, 0.012, 0xab634b);
    if (style.hairstyle === 'ponytail') {
      f.sphere(this.hair, 0.04, 0.707, -0.165, 0.11, 0.13, 0.14, style.hair);
      f.sphere(this.hair, 0.04, 0.609, -0.168, 0.084, 0.19, 0.1, style.hair);
      f.box(this.hair, 0.04, 0.672, -0.174, 0.097, 0.02, 0.07, THEME.colors.orange);
    } else if (style.hairstyle === 'bob') for (const side of [-1, 1]) f.sphere(this.hair, side * 0.12, 0.644, -0.02, 0.07, 0.17, 0.18, style.hair);
    if (style.apron) {
      f.box(body, 0, 0.414, 0.103, 0.195, 0.235, 0.022, THEME.colors.apron);
      for (const side of [-1, 1]) {
        f.box(body, side * 0.065, 0.51, 0.094, 0.021, 0.14, 0.017, THEME.colors.apron);
        const strap = f.box(body, side * 0.045, 0.447, -0.094, 0.018, 0.23, 0.016, THEME.colors.apron); strap.rotation.z = side * 0.35;
      }
      f.box(body, 0, 0.364, 0.12, 0.094, 0.063, 0.012, THEME.colors.woodLight);
    }
    if (style.accessory === 'headband') f.sphere(this.hair, 0, 0.739, 0.065, 0.262, 0.025, 0.09, THEME.colors.orange);
    if (style.accessory === 'cap') { f.sphere(this.hair, 0, 0.778, 0, 0.29, 0.065, 0.24, style.shirt); f.box(this.hair, 0, 0.755, 0.117, 0.23, 0.025, 0.11, style.shirt); }
    if (style.accessory === 'glasses') for (const side of [-1, 1]) {
      const rim = f.box(body, side * 0.047, 0.681, 0.111, 0.066, 0.043, 0.014, THEME.colors.woodDark);
      f.box(rim, 0, 0, 0.01, 0.048, 0.029, 0.004, THEME.colors.glass);
    }
    if (style.accessory === 'tie') f.box(body, 0, 0.478, 0.102, 0.025, 0.11, 0.01, THEME.colors.orange);
    if (style.accessory === 'bag') { f.box(body, 0.185, 0.325, 0.02, 0.13, 0.17, 0.12, THEME.colors.wood); f.box(body, 0.145, 0.44, 0.016, 0.026, 0.27, 0.014, THEME.colors.woodDark); }
  }
  setHeld(stack: ProductStack | null): void {
    const product = stack ? `${stack.productId}:${Boolean(stack.packed)}` : '';
    if (product === this.heldProduct) return;
    if (this.held) this.figure.remove(this.held);
    this.heldProduct = product;
    this.held = stack ? createStackModel(this.factory, stack) : null;
    if (this.held) { this.held.position.set(0, 0.38, 0.19); this.figure.add(this.held); }
  }
  update(deltaMs: number, facing: Facing, moving: boolean, sprinting: boolean, emotion: Emotion): void {
    if (deltaMs <= 0) return;
    this.moving = moving;
    const target = facingYaw(facing);
    const difference = Math.atan2(Math.sin(target - this.yaw), Math.cos(target - this.yaw));
    this.yaw += difference * (1 - Math.exp(-deltaMs / 60)); this.figure.rotation.y = this.yaw;
    this.phase += deltaMs * (sprinting ? 0.015 : 0.01);
    const animate = this.moving && !VISUAL_SETTINGS.reducedMotion;
    const swing = animate ? Math.sin(this.phase) * (sprinting ? 0.42 : 0.29) : 0;
    this.figure.position.y = animate ? Math.abs(Math.sin(this.phase)) * (sprinting ? 0.021 : 0.012) : 0;
    this.legs.forEach((leg, i) => { leg.rotation.x = swing * (i === 0 ? 1 : -1); });
    this.arms.forEach((arm, i) => { arm.rotation.x = this.held ? -0.55 : -swing * (i === 0 ? 1 : -1); });
    this.hair.rotation.x = animate ? Math.sin(this.phase - 0.5) * 0.012 : 0;
    this.eyes.forEach(eye => { eye.scale.y = emotion === 'HAPPY' ? 0.008 : emotion === 'DISAPPOINTED' ? 0.01 : 0.014; });
    this.mouth.scale.y = emotion === 'HAPPY' ? 0.013 : 0.006;
    this.mouth.rotation.z = emotion === 'DISAPPOINTED' ? 0.22 : 0;
  }
}
