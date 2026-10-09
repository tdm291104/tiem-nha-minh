import Phaser from 'phaser';
import type { Interactable } from '../interactions/Interactable';
import type { Player } from './Player';
import type { Position } from '../types/game';
import { INVENTORY, TEXT_STYLE } from '../config/settings';
import { CHECKOUT } from '../checkout/CheckoutConfig';
import type { CashierDefinition, CashierStation } from '../checkout/CashierStation';
import type { CheckoutSystem } from '../checkout/CheckoutSystem';
import type { AudioManager } from '../audio/AudioManager';
import { FURNITURE_TEXTURE } from '../presentation/FurnitureTextures';
import { groundDepth } from '../presentation/VisualCatalog';
import { clampedRatio } from '../presentation/PresentationRules';
import { THEME, cssColor } from '../presentation/VisualTheme';

export class Cashier extends Phaser.GameObjects.Container implements Interactable {
  readonly id: string;
  readonly interactionPosition: Position;
  readonly interactionRange = INVENTORY.interactionRange;
  private readonly statusLabel: Phaser.GameObjects.Text;
  private readonly waiting: Phaser.GameObjects.Text;
  private readonly track: Phaser.GameObjects.Rectangle;
  private readonly progress: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, definition: CashierDefinition, private readonly station: CashierStation, obstacles: Phaser.Physics.Arcade.StaticGroup, private readonly checkout: CheckoutSystem, private readonly notify: (message: string) => void, private readonly gameTime: () => number = () => scene.time.now, private readonly audio?: AudioManager) {
    super(scene, definition.x, definition.y);
    scene.add.existing(this);
    this.id = station.id;
    this.interactionPosition = station.interactionPosition;
    const g = scene.add.image(0, 0, 'furniture-counter').setOrigin(0.5, FURNITURE_TEXTURE.counter.originY);
    const title = scene.add.text(-10, 10, `Quầy ${definition.number}`, { ...TEXT_STYLE, fontSize: '12px', fontStyle: 'bold' }).setOrigin(0.5);
    this.statusLabel = scene.add.text(0, -66, '', { ...TEXT_STYLE, fontSize: '13px', backgroundColor: cssColor(THEME.colors.paper), padding: { x: 5, y: 3 } }).setOrigin(0.5, 1);
    this.waiting = scene.add.text(-62, -32, '!', { ...TEXT_STYLE, fontSize: '15px', fontStyle: 'bold', color: cssColor(THEME.colors.warning), backgroundColor: cssColor(THEME.colors.amberSoft), padding: { x: 7, y: 1 } }).setOrigin(0.5);
    this.track = scene.add.rectangle(-36, -4, 72, 6, THEME.colors.ink, 0.2).setOrigin(0, 0.5);
    this.progress = scene.add.rectangle(-36, -4, 72, 5, THEME.colors.amberSoft).setOrigin(0, 0.5).setVisible(false);
    this.add([g, title, this.statusLabel, this.track, this.progress, this.waiting]).setDepth(groundDepth(definition.y, definition.height / 2));
    if (CHECKOUT.debugQueueMarkers) for (const point of station.queue.positions) {
      this.add(scene.add.ellipse(point.x - this.x, point.y - this.y, 26, 14).setStrokeStyle(1, THEME.colors.green, 0.4));
    }
    obstacles.add(scene.add.rectangle(this.x, this.y, definition.width, definition.height).setVisible(false));
    this.updateCashier(0);
  }
  canInteract(_player: Player): boolean { return true; }
  promptText(_player: Player): string { return this.station.state === 'PROCESSING' ? 'Đang tính tiền...' : 'Tính tiền'; }
  interact(player: Player): void {
    const result = this.checkout.start(this.id, player.id, this.gameTime());
    if (result === 'started') player.presentEmotion('FOCUSED', CHECKOUT.processingMs);
    this.audio?.play(result === 'started' ? 'CHECKOUT_START' : 'ERROR');
    if (result !== 'started') this.notify(result === 'busy' ? 'Quầy đang tính tiền.' : 'Chưa có khách sẵn sàng.');
  }
  updateCashier(_deltaMs: number): void {
    const state = this.station.state;
    const text = state === 'PROCESSING' ? `${this.station.operatingEmployeeId ? 'Nhân viên' : `P${this.station.operatingPlayerId}`} · Đang tính tiền...` : state === 'HAS_CUSTOMER' ? 'Khách đang chờ' : `Hàng chờ: ${this.station.queue.length}`;
    if (this.statusLabel.text !== text) this.statusLabel.setText(text);
    this.progress.setVisible(state === 'PROCESSING').setDisplaySize(72 * clampedRatio(this.station.progress, 1), 5);
    this.track.setVisible(state === 'PROCESSING');
    this.waiting.setVisible(state === 'HAS_CUSTOMER');
  }
}
