import { FURNITURE_TEXTURE } from '../presentation/FurnitureTextures';
import { groundDepth } from '../presentation/VisualCatalog';
import { THEME, cssColor } from '../presentation/VisualTheme';
import Phaser from 'phaser';
import type { Interactable } from '../interactions/Interactable';
import type { Player } from './Player';
import type { PlayerId, Position } from '../types/game';
import { INVENTORY, TEXT_STYLE } from '../config/settings';

export interface TerminalDefinition extends Position { readonly width: number; readonly height: number; readonly interactionPosition: Position }

export class SupplierTerminal extends Phaser.GameObjects.Container implements Interactable {
  readonly id = 'supplier-terminal';
  readonly interactionRange = INVENTORY.interactionRange;
  readonly interactionPosition: Position;
  constructor(scene: Phaser.Scene, definition: TerminalDefinition, obstacles: Phaser.Physics.Arcade.StaticGroup, private readonly openPanel: (playerId: PlayerId) => void, private readonly orderingAllowed: () => boolean = () => true) {
    super(scene, definition.x, definition.y);
    scene.add.existing(this);
    this.interactionPosition = definition.interactionPosition;
    const g = scene.add.image(0, 0, 'furniture-desk').setOrigin(0.5, FURNITURE_TEXTURE.desk.originY);
    const label = scene.add.text(0, 32, 'ĐẶT HÀNG', { ...TEXT_STYLE, fontSize: '11px', fontStyle: 'bold', backgroundColor: cssColor(THEME.colors.paper), padding: { x: 5, y: 3 } }).setOrigin(0.5);
    this.add([g, label]).setDepth(groundDepth(definition.y, definition.height / 2));
    obstacles.add(scene.add.rectangle(this.x, this.y, definition.width, definition.height).setVisible(false));
  }
  canInteract(_player: Player): boolean { return this.orderingAllowed(); }
  promptText(_player: Player): string { return 'Đặt hàng'; }
  interact(player: Player): void { this.openPanel(player.id); }
}
