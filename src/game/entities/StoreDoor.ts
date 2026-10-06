import { THEME, cssColor } from '../presentation/VisualTheme';
import Phaser from 'phaser';
import { entranceLabel } from '../presentation/PresentationRules';
import type { Interactable } from '../interactions/Interactable';
import type { Player } from './Player';
import type { Position } from '../types/game';
import type { DayManager } from '../day/DayManager';
import { INVENTORY, TEXT_STYLE } from '../config/settings';

export class StoreDoor extends Phaser.GameObjects.Container implements Interactable {
  readonly id = 'store-door';
  readonly interactionRange = INVENTORY.interactionRange;
  readonly interactionPosition: Position;
  private readonly unsubscribeDay: () => void;
  constructor(scene: Phaser.Scene, position: Position, interactionPosition: Position, private readonly day: DayManager) {
    super(scene, position.x, position.y);
    scene.add.existing(this);
    this.interactionPosition = interactionPosition;
    const label = scene.add.text(122, 11, '', { ...TEXT_STYLE, fontSize: '11px', fontStyle: 'bold', backgroundColor: cssColor(THEME.colors.paper), padding: { x: 10, y: 5 } }).setOrigin(0.5);
    const refresh = (): void => { label.setText(entranceLabel(day.state)); };
    this.add(label).setDepth(952); refresh(); this.unsubscribeDay = day.onStateChange(refresh);
  }
  canInteract(_player: Player): boolean { return this.day.state === 'PREPARATION'; }
  promptText(_player: Player): string { return 'Mở cửa'; }
  interact(_player: Player): void { this.day.startDay(); }
  destroy(fromScene?: boolean): void { this.unsubscribeDay(); super.destroy(fromScene); }
}
