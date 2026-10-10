import Phaser from 'phaser';
import { cssColor } from '../presentation/VisualTheme';
import { VIEW } from '../config/settings';
import type { Player } from '../entities/Player';
import { describeStack } from '../products/ProductCatalog';
import { PLAYER_STYLES } from '../presentation/CharacterStyles';
import type { StoreEconomy } from '../economy/StoreEconomy';
import { formatVnd, formatSignedVnd } from '../economy/Money';
import type { SupplierSystem } from '../supplier/SupplierSystem';
import type { DayManager } from '../day/DayManager';
import { formatCountdown } from '../day/DayRules';
import { UI, UI_TEXT, HUD_LAYOUT, uiRatio } from './UiTheme';
import { drawPaper, panelButton } from './PanelPrimitives';
import type { AudioManager } from '../audio/AudioManager';

const DAY_LABELS = { PREPARATION: 'Chuẩn bị mở cửa', OPEN: 'Đang bán hàng', CLOSING: 'Phục vụ nốt khách', SUMMARY: 'Đã đóng cửa' };

export class ShopHud {
  private readonly root: Phaser.GameObjects.Container;
  private readonly toast: Phaser.GameObjects.Container;
  private readonly message: Phaser.GameObjects.Text;
  private readonly toastPaper: Phaser.GameObjects.Graphics;
  private readonly saveWarning: Phaser.GameObjects.Text;
  private readonly statuses = new Map<Player, { text: Phaser.GameObjects.Text; icon: Phaser.GameObjects.Image }>();
  private messageTimer?: Phaser.Time.TimerEvent;
  private readonly uiCamera: Phaser.Cameras.Scene2D.Camera;
  private readonly sessionLabel: Phaser.GameObjects.Text;
  private readonly moneyLabel: Phaser.GameObjects.Text;
  private readonly deliveryLabel: Phaser.GameObjects.Text;
  private readonly dayLabel: Phaser.GameObjects.Text;
  private readonly phaseDetail: Phaser.GameObjects.Text;
  private readonly countdown: Phaser.GameObjects.Text;
  private readonly goalLabel: Phaser.GameObjects.Text;
  private readonly goalBar: Phaser.GameObjects.Graphics;
  private ratio = -1;

  constructor(private readonly scene: Phaser.Scene, players: Player[], private readonly economy: StoreEconomy, private readonly supplier: SupplierSystem, private readonly day: DayManager, private readonly customerCount: () => number, returnToMenu: () => void, retrySave: () => void) {
    const worldObjects = [...scene.children.list];
    this.root = scene.add.container(0, 0).setDepth(3000);
    const panels = scene.add.graphics();
    for (const rect of [HUD_LAYOUT.day, HUD_LAYOUT.goal, HUD_LAYOUT.money, HUD_LAYOUT.dock]) drawPaper(panels, rect.x, rect.y, rect.width, rect.height);
    panels.fillStyle(UI.colors.green).fillRoundedRect(34, 34, 48, 48, 12);
    this.root.add(panels);
    this.dayLabel = this.text(98, 32, '', 20, true);
    this.phaseDetail = this.text(98, 59, '', 13);
    this.countdown = this.text(58, 58, '', 17, true).setOrigin(0.5).setColor(cssColor(UI.colors.white));
    this.text(34, 88, 'TIỆM NHÀ MÌNH', 12, true).setColor(cssColor(UI.colors.muted));
    this.text(410, 32, 'Mục tiêu hôm nay', 13).setColor(cssColor(UI.colors.muted));
    this.goalLabel = this.text(410, 51, '', 14, true);
    this.goalBar = scene.add.graphics(); this.root.add(this.goalBar);
    this.text(880, 32, 'Tiền của tiệm', 13).setColor(cssColor(UI.colors.muted));
    this.moneyLabel = this.text(1060, 58, '', 26, true).setOrigin(1, 0).setColor(cssColor(UI.colors.green));
    panelButton(scene, this.root, 1047, 96, 'Menu', returnToMenu, undefined, true, { width: 56, height: 24, fontSize: 12 });
    this.sessionLabel = this.text(1068, 663, '', 12).setOrigin(1, 0).setColor(cssColor(UI.colors.ink)).setBackgroundColor(cssColor(UI.colors.paper)).setPadding(8, 4);
    this.deliveryLabel = this.text(1068, 643, '', 12).setOrigin(1, 0).setColor(cssColor(UI.colors.ink)).setBackgroundColor(cssColor(UI.colors.paper)).setPadding(8, 2);
    players.forEach((player, index) => {
      const p = HUD_LAYOUT.player, x = p.x + index * p.gap;
      drawPaper(panels, x, p.y, p.width, p.height);
      panels.fillStyle(player.id === 1 ? UI.colors.mint : UI.colors.coralSoft).fillCircle(x + 31, p.y + 32, 21);
      const portraitKey = `portrait-player-${player.id}`;
      const headKey = `${PLAYER_STYLES[index]!.key}-head-DOWN-NEUTRAL`;
      const portrait = scene.add.image(x + 31, p.y + 30, scene.textures.exists(portraitKey) ? portraitKey : headKey).setDisplaySize(44, 44);
      const icon = scene.add.image(x + 31, p.y + 64, 'product-instant_noodles').setDisplaySize(22, 22).setVisible(false);
      this.root.add([portrait, icon]);
      this.text(x + 63, p.y + 12, `P${player.id} · ${player.id === 1 ? 'Anh chủ tiệm' : 'Chị chủ tiệm'}`, 13, true).setColor(cssColor(player.id === 1 ? UI.colors.blue : UI.colors.orange));
      const text = this.text(x + 63, p.y + 34, '', 14).setWordWrapWidth(172).setLineSpacing(1);
      this.statuses.set(player, { text, icon });
    });
    this.text(646, 710, 'Cùng nhau trông tiệm', 12).setColor(cssColor(UI.colors.muted));
    this.text(20, 785, players.length > 1 ? 'P1 · WASD / E / F / Shift trái     P2 · Mũi tên / Enter / / / Shift phải' : 'WASD di chuyển   E tương tác   F nhặt / thả   Shift chạy nhanh', 11).setColor(cssColor(UI.colors.ink));
    this.toastPaper = scene.add.graphics();
    this.message = scene.add.text(0, 0, '', { ...UI_TEXT, fontSize: '15px', align: 'center', wordWrap: { width: 490 } }).setOrigin(0.5);
    this.toast = scene.add.container(VIEW.width / 2, 210, [this.toastPaper, this.message]).setVisible(false);
    this.root.add(this.toast);
    this.saveWarning = scene.add.text(VIEW.width / 2, VIEW.height, 'Chưa lưu được tiến trình. Đừng đóng trang; kiểm tra quyền lưu trữ. Bấm vào đây để thử lưu lại.', {
      ...UI_TEXT, fontSize: '14px', color: cssColor(UI.colors.error), backgroundColor: cssColor(UI.colors.paper), padding: { x: 12, y: 6 }, wordWrap: { width: VIEW.width - 48 }, align: 'center',
    }).setOrigin(0.5, 1).setDepth(5000).setVisible(false).setInteractive({ useHandCursor: true });
    this.saveWarning.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); retrySave(); });
    scene.cameras.main.ignore(this.saveWarning);
    this.uiCamera = scene.cameras.add(0, 0, VIEW.width, VIEW.height);
    this.uiCamera.ignore(worldObjects); scene.cameras.main.ignore(this.root);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.messageTimer?.remove());
    this.update();
  }
  addAction(index: number, label: string, action: () => void, audio?: AudioManager): void {
    const button = panelButton(this.scene, this.root, 697 + index * 106, 752, label, action, audio, index !== 0, { width: 98, height: 34, fontSize: 13 });
    this.scene.cameras.main.ignore(button.root);
  }
  private text(x: number, y: number, value: string, size: number, bold = false): Phaser.GameObjects.Text {
    const label = this.scene.add.text(x, y, value, { ...UI_TEXT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal' }); this.root.add(label); return label;
  }
  excludeWorldObject(object: Phaser.GameObjects.GameObject): void { this.uiCamera.ignore(object); }
  setSaveFailed(failed: boolean): void { this.saveWarning.setVisible(failed); }
  notify(message: string): void {
    this.message.setText(message); const w = this.message.width + 36, h = this.message.height + 24;
    this.toastPaper.clear(); drawPaper(this.toastPaper, -w / 2, -h / 2, w, h);
    this.toast.setVisible(true); this.messageTimer?.remove();
    this.messageTimer = this.scene.time.delayedCall(3000, () => this.toast.setVisible(false));
  }
  update(): void {
    const daily = this.day.statistics;
    this.dayLabel.setText(`Ngày ${this.day.currentDay}`);
    this.phaseDetail.setText(this.day.state === 'CLOSING' ? `Còn ${this.customerCount()} khách` : DAY_LABELS[this.day.state]);
    this.countdown.setText(this.day.state === 'OPEN' ? formatCountdown(this.day.remainingOpenTimeMs / 1000) : String(this.day.currentDay)).setFontSize(this.day.state === 'OPEN' ? 14 : 15);
    this.goalLabel.setText(`${formatVnd(daily.dailyRevenue)} / ${formatVnd(this.day.dailyGoal)}`);
    const ratio = uiRatio(daily.dailyRevenue, this.day.dailyGoal);
    if (ratio !== this.ratio) {
      this.ratio = ratio; this.goalBar.clear().fillStyle(UI.colors.line).fillRoundedRect(410, 77, 280, 9, 4);
      if (ratio > 0) this.goalBar.fillStyle(ratio === 1 ? UI.colors.green : UI.colors.coral).fillRoundedRect(410, 77, Math.max(9, 280 * ratio), 9, 4);
    }
    this.goalLabel.setScale(Math.min(1, 280 / Math.max(1, this.goalLabel.width)));
    this.moneyLabel.setText(formatVnd(this.economy.money)).setScale(Math.min(1, 180 / Math.max(1, this.moneyLabel.width)));
    const stats = this.economy.accounting;
    this.sessionLabel.setText(`Cả phiên · Thu ${formatVnd(stats.totalRevenue)} · Chi ${formatVnd(stats.totalExpenses)} · Lãi ${formatSignedVnd(stats.profit)} · ${stats.totalCustomersServed} khách`);
    this.sessionLabel.setScale(Math.min(1, 540 / Math.max(1, this.sessionLabel.width)));
    const order = this.supplier.activeOrder;
    this.deliveryLabel.setText(order ? `Xe đang tới · ${Math.ceil(this.supplier.remainingMs / 1000)} giây` : 'Đặt thêm hàng tại bàn bên trái');
    for (const [player, status] of this.statuses) {
      const stack = player.currentHeldItem, text = stack ? describeStack(stack) : 'Tay trống · Sẵn sàng làm việc';
      if (status.text.text !== text) status.text.setText(text);
      status.icon.setVisible(stack !== null); if (stack) status.icon.setTexture(`product-${stack.productId}`);
    }
  }
}
