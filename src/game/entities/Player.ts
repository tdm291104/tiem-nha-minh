import { groundDepth } from '../presentation/VisualCatalog';
import { THEME, cssColor } from '../presentation/VisualTheme';
import Phaser from 'phaser';
import { PlayerController } from '../components/PlayerController';
import { PLAYER } from '../config/settings';
import type { Controls, PlayerId, Position } from '../types/game';
import type { ProductStack } from '../products/Product';
import { createStack } from '../products/ProductCatalog';
import { CharacterView } from '../presentation/CharacterView';
import { PLAYER_STYLES } from '../presentation/CharacterStyles';
import type { Facing, Emotion } from '../presentation/PresentationRules';
import { HeldItemView } from '../ui/HeldItemView';

export class Player extends Phaser.Physics.Arcade.Sprite {
  readonly controller: PlayerController;
  readonly movementSpeed = PLAYER.speed;
  readonly interactionRange = PLAYER.interactionRange;
  readonly visual: CharacterView;
  private expressionRemainingMs = 0;
  private heldItem: ProductStack | null = null;
  private readonly heldItemView: HeldItemView;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, readonly id: PlayerId, spawn: Position, readonly controls: Controls) {
    super(scene, spawn.x, spawn.y, `player-${id}`);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.setSize(PLAYER.bodyWidth, PLAYER.bodyHeight).setOffset(12, 36);
    this.setAlpha(0);
    this.visual = new CharacterView(scene, PLAYER_STYLES[id - 1]!);
    this.controller = new PlayerController(scene, controls);
    this.heldItemView = new HeldItemView(scene);
    this.label = scene.add.text(spawn.x, spawn.y - 45, `P${id}`, { fontFamily: THEME.typography.fontFamily, fontSize: '13px', fontStyle: 'bold', color: cssColor(THEME.colors.paper), backgroundColor: id === 1 ? cssColor(THEME.colors.blue) : cssColor(THEME.colors.orange), padding: { x: 7, y: 3 } }).setOrigin(0.5);
  }
  get position(): Position { return { x: this.x, y: this.y }; }
  get feetPosition(): Position { return this.body ? { x: this.body.center.x, y: this.body.center.y } : this.position; }
  get currentHeldItem(): ProductStack | null { return this.heldItem; }
  setHeldItem(stack: ProductStack | null): void {
    this.heldItem = stack ? createStack(stack.productId, stack.quantity, stack) : null;
    this.heldItemView.showStack(this.heldItem);
  }
  presentEmotion(emotion: Emotion, durationMs = 650): void { this.expressionRemainingMs = durationMs; this.visual.setEmotion(emotion); }
  get facing(): Facing { return this.visual.facing; }
  updateMovement(deltaMs: number): void {
    this.expressionRemainingMs = Math.max(0, this.expressionRemainingMs - deltaMs);
    if (this.expressionRemainingMs === 0) this.visual.setEmotion(this.heldItem ? 'FOCUSED' : 'NEUTRAL');
    const direction = this.controller.direction();
    const speed = this.movementSpeed * (this.controller.sprinting ? PLAYER.sprintMultiplier : 1);
    this.setVelocity(direction.x * speed, direction.y * speed);
    const feet = this.feetPosition;
    this.visual.setPosition(feet.x, feet.y).setDepth(groundDepth(feet.y));
    this.visual.updateVisual(deltaMs, direction.x, direction.y, this.controller.sprinting);
    this.setDepth(groundDepth(feet.y));
    this.label.setPosition(this.x, feet.y - 80).setDepth(this.depth + 1);
    this.heldItemView.setPosition(feet.x, feet.y);
    this.heldItemView.face(this.facing);
    this.heldItemView.setDepth(this.depth + (this.facing === 'UP' ? -1 : 2));
  }
  destroy(fromScene?: boolean): void {
    this.visual.destroy();
    this.label.destroy();
    this.heldItemView.destroy();
    super.destroy(fromScene);
  }
}
