import Phaser from 'phaser';
import { UI, UI_TEXT } from './UiTheme';
import { drawUiIcon } from './UiIcons';
import { cssColor } from '../presentation/VisualTheme';
import { panelButton, modalPaper, type PanelButton } from './PanelPrimitives';
import { formatVnd } from '../economy/Money';
import { UPGRADE_TYPES, UPGRADES, shelfCapacity, deliveryDuration, checkoutDuration, type UpgradeSystem, type UpgradeType } from '../upgrades/UpgradeSystem';
import type { PlayerId } from '../types/game';
import type { AudioManager } from '../audio/AudioManager';

const NAMES: Record<UpgradeType, string> = { warehouse: 'Kho & vận chuyển', shelves: 'Kệ trưng bày', cashiers: 'Máy tính tiền' };
export class UpgradePanel extends Phaser.GameObjects.Container {
  private readonly buttons = new Map<UpgradeType, PanelButton>();
  private readonly rows = new Map<UpgradeType, Phaser.GameObjects.Text>();
  private readonly message: Phaser.GameObjects.Text;
  private playerId: PlayerId = 1;
  private readonly balance: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene, private readonly upgrades: UpgradeSystem, private readonly modalChanged: (open: boolean) => void, gameTime: () => number, audio: AudioManager, playerCount: number) {
    super(scene, 0, 0); scene.add.existing(this); this.setDepth(4200).setVisible(false); scene.cameras.main.ignore(this);
    const paper = modalPaper(scene, this, 170, 90, 760, 610);
    paper.fillStyle(UI.colors.mint).fillRoundedRect(190, 110, 720, 118, 12);
    this.text(210, 125, 'Chăm chút tiệm mình', 29);
    this.text(210, 172, 'Mua trong giờ chuẩn bị · Cả tiệm dùng chung · Tối đa 3 cấp', 16);
    this.balance = this.text(210, 203, '', 18);
    if (playerCount > 1) {
      panelButton(scene, this, 770, 205, 'P1', () => { this.playerId = 1; this.refresh(); }, audio, true);
      panelButton(scene, this, 850, 205, 'P2', () => { this.playerId = 2; this.refresh(); }, audio, true);
    }
    UPGRADE_TYPES.forEach((type, index) => {
      const y = 264 + index * 90;
      paper.fillStyle(index % 2 ? UI.colors.sand : UI.colors.white).fillRoundedRect(190, y - 6, 720, 83, 10);
      drawUiIcon(paper, 229, y + 33, type === 'warehouse' ? 'stock' : type === 'shelves' ? 'cooler' : 'cashier');
      this.rows.set(type, this.text(267, y + 3, '', 15));
      this.buttons.set(type, panelButton(scene, this, 828, y + 35, 'Nâng cấp', () => {
        const result = upgrades.purchase(type, this.playerId, upgrades.snapshot[type], gameTime());
        const messages = { upgraded: 'Đã nâng cấp!', closed: 'Chỉ nâng cấp khi chuẩn bị mở cửa.', max: 'Đã đạt cấp tối đa.', stale: 'Cấp nâng cấp đã thay đổi.', 'insufficient-funds': 'Không đủ tiền.' };
        this.message.setText(messages[result]); audio.play(result === 'upgraded' ? 'SALE_COMPLETE' : 'ERROR'); this.refresh();
      }, audio, false, { width: 128 }));
    });
    this.message = this.text(210, 565, '', 16).setColor(cssColor(UI.colors.error));
    panelButton(scene, this, 550, 652, 'Đóng bảng', () => this.close(), audio, true);
  }
  get isOpen(): boolean { return this.visible; }
  open(): void { if (this.visible) return; this.message.setText(''); this.refresh(); this.setVisible(true); this.modalChanged(true); }
  close(): void { if (!this.visible) return; this.setVisible(false); this.modalChanged(false); }
  private refresh(): void {
    const levels = this.upgrades.snapshot;
    const details: Record<UpgradeType, string> = { warehouse: `Giao hàng: ${deliveryDuration(levels) / 1000} giây - giảm 1 giây / cấp`, shelves: `Mỗi kệ: ${shelfCapacity(levels)} món - thêm 10 / cấp`, cashiers: `Tính tiền: ${checkoutDuration(levels) / 1000} giây - giảm 0,2 giây / cấp` };
    this.balance.setText(`P${this.playerId} mua cho tiệm · Tiền: ${formatVnd(this.upgrades.economy.money)}`);
    for (const [type, button] of this.buttons) { button.setEnabled(levels[type] < UPGRADES.maxLevel); button.setLabel(levels[type] === UPGRADES.maxLevel ? 'Tối đa' : 'Nâng cấp'); }
    for (const [type, label] of this.rows) label.setText(`${NAMES[type]} · Cấp ${levels[type]} / ${UPGRADES.maxLevel}\n${details[type]}\n${levels[type] === UPGRADES.maxLevel ? 'Đã nâng tối đa' : 'Cấp tiếp: ' + formatVnd(this.upgrades.cost(type))}`);
  }
  private text(x: number, y: number, value: string, size: number): Phaser.GameObjects.Text {
    const label = this.scene.add.text(x, y, value, { ...UI_TEXT, fontSize: `${size}px`, lineSpacing: 4 }); this.add(label); return label;
  }
}
