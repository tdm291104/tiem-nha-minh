import Phaser from 'phaser';
import type { CharacterStyle } from './CharacterStyles';
import type { Emotion, Facing } from './PresentationRules';
import { facingFromMovement, motionPolicy } from './PresentationRules';
import { directionalVisualKeys } from './VisualCatalog';
import { drawContactShadow } from './ContactShadow';
import { THEME, VISUAL_SETTINGS } from './VisualTheme';

export class CharacterView extends Phaser.GameObjects.Container {
  readonly figure: Phaser.GameObjects.Container;
  private readonly motion: Phaser.GameObjects.Container;
  private readonly head: Phaser.GameObjects.Image;
  private readonly torso: Phaser.GameObjects.Image;
  private readonly arms: Phaser.GameObjects.Image[];
  private readonly detail: Phaser.GameObjects.Image;
  private readonly feet: Phaser.GameObjects.Image[];
  private direction: Facing = 'DOWN';
  private expression: Emotion = 'NEUTRAL';
  private phase = 0;
  private bob = 0;
  constructor(scene: Phaser.Scene, private readonly style: CharacterStyle) {
    super(scene, 0, 0); scene.add.existing(this);
    const shadow = scene.add.graphics(); drawContactShadow(shadow, 0, 0, 28, 8);
    this.figure = scene.add.container(0, 0); this.motion = scene.add.container(0, 0);
    this.feet = [-6, 6].map(x => scene.add.image(x, -13, `${style.key}-leg-DOWN`));
    this.arms = [-15, 15].map(x => scene.add.image(x, -43, `${style.key}-arm-DOWN`).setOrigin(0.5, 0));
    this.torso = scene.add.image(0, -35, `${style.key}-torso-DOWN`);
    this.head = scene.add.image(0, -59, `${style.key}-head-DOWN-NEUTRAL`);
    this.detail = scene.add.image(0, -39, `${style.key}-detail-DOWN`);
    this.motion.setScale(style.build);
    this.motion.add([...this.feet, ...this.arms, this.torso, this.head, this.detail]); this.figure.add(this.motion); this.add([shadow, this.figure]);
  }
  get facing(): Facing { return this.direction; }
  get emotion(): Emotion { return this.expression; }
  setEmotion(emotion: Emotion): void { if (emotion !== this.expression) { this.expression = emotion; this.refreshTextures(); } }
  private refreshTextures(): void {
    const keys = directionalVisualKeys(this.style.key, this.direction, this.expression);
    this.head.setTexture(keys.head); this.torso.setTexture(keys.torso); this.detail.setTexture(keys.accessory);
    const side = this.direction === 'LEFT' || this.direction === 'RIGHT';
    this.arms.forEach((arm, index) => arm.setTexture(keys.arm).setX(side ? (this.direction === 'LEFT' ? -8 : 8) + index * 3 : index === 0 ? -14 : 14).setAlpha(side && index === 0 ? 0.7 : 1));
    this.feet.forEach((leg, index) => leg.setTexture(keys.legs).setX(side ? (index === 0 ? -3 : 3) : index === 0 ? -6 : 6));
  }
  updateVisual(deltaMs: number, movementX: number, movementY: number, sprinting = false): void {
    const facing = facingFromMovement(movementX, movementY, this.direction);
    if (facing !== this.direction) { this.direction = facing; this.refreshTextures(); }
    const walking = Math.hypot(movementX, movementY) > 0.001 && motionPolicy(VISUAL_SETTINGS.reducedMotion).bob;
    this.phase += deltaMs / 1000 * (sprinting ? THEME.motion.sprintRate : THEME.motion.walkRate);
    const blend = 1 - Math.exp(-deltaMs / 90);
    this.bob += ((walking ? -Math.abs(Math.sin(this.phase)) * (sprinting ? THEME.motion.sprintBob : THEME.motion.bob) : 0) - this.bob) * blend;
    if (VISUAL_SETTINGS.reducedMotion) this.bob = 0;
    this.motion.setY(this.bob).setScale(this.style.build, this.style.build);
    this.arms.forEach((arm, index) => arm.setRotation(walking ? Math.sin(this.phase) * (index === 0 ? 1 : -1) * 0.14 : 0));
    this.feet.forEach((foot, index) => foot.setY(-13 + (walking ? Math.sin(this.phase + index * Math.PI) * (sprinting ? 2.4 : 1.7) : 0)));
    this.detail.setRotation(walking ? Math.sin(this.phase - 0.3) * 0.025 : 0);
  }
}
