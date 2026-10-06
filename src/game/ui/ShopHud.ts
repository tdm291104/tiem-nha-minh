import Phaser from 'phaser';
import { THEME, cssColor } from '../presentation/VisualTheme';
import { TEXT_STYLE, VIEW } from '../config/settings';
import type { Player } from '../entities/Player';
import { describeStack } from '../products/ProductCatalog';
import type { StoreEconomy } from '../economy/StoreEconomy';
import { formatVnd, formatSignedVnd } from '../economy/Money';
import type { SupplierSystem } from '../supplier/SupplierSystem';
import type { DayManager } from '../day/DayManager';
import { formatCountdown } from '../day/DayRules';

export class ShopHud {
  private readonly message: Phaser.GameObjects.Text;
  private readonly statuses = new Map<Player, Phaser.GameObjects.Text>();
  private messageTimer?: Phaser.Time.TimerEvent;
  private readonly uiCamera: Phaser.Cameras.Scene2D.Camera;
  private readonly sessionLabel: Phaser.GameObjects.Text;
  private readonly moneyLabel: Phaser.GameObjects.Text;
  private readonly deliveryLabel: Phaser.GameObjects.Text;
  private readonly dayLabel: Phaser.GameObjects.Text;
  private readonly phaseDetail: Phaser.GameObjects.Text;
  private readonly countdown: Phaser.GameObjects.Text;
  private readonly goalLabel: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene, players: Player[], private readonly economy: StoreEconomy, private readonly supplier: SupplierSystem, private readonly day: DayManager, private readonly customerCount: () => number, returnToMenu: () => void) {
    const worldObjects = [...scene.children.list];
    const hud = scene.add.container(0, 0).setDepth(3000);
    const panels = scene.add.graphics();
    panels.fillStyle(THEME.colors.shadow, 0.08).fillRoundedRect(14, 11, VIEW.width - 24, 74, THEME.radius.small);
    panels.fillStyle(THEME.colors.paper, 0.98).fillRoundedRect(12, 8, VIEW.width - 24, 74, THEME.radius.small);
    panels.fillStyle(THEME.colors.paper, 0.98).fillRoundedRect(12, VIEW.height - 92, VIEW.width - 24, 84, THEME.radius.small);
    panels.lineStyle(1, THEME.colors.woodDark, 0.2).strokeRoundedRect(12, VIEW.height - 92, VIEW.width - 24, 84, THEME.radius.small);
    panels.lineStyle(1, THEME.colors.woodDark, 0.2).strokeRoundedRect(12, 8, VIEW.width - 24, 74, THEME.radius.small);
    for (const x of [267, 545, 715, 936]) panels.lineStyle(1, THEME.colors.tile, 0.5).lineBetween(x, 18, x, 64);
    const title = scene.add.text(24, 14, 'TIỆM NHÀ MÌNH', { ...TEXT_STYLE, fontSize: '21px', fontStyle: 'bold' });
    const subtitle = scene.add.text(24, 44, 'Xếp kệ · Tính tiền · Cả xóm vui', { ...TEXT_STYLE, fontSize: '12px', color: cssColor(THEME.colors.muted) });
    this.dayLabel = scene.add.text(290, 14, '', { ...TEXT_STYLE, fontSize: '16px', fontStyle: 'bold' });
    this.phaseDetail = scene.add.text(290, 42, '', { ...TEXT_STYLE, fontSize: '12px' });
    this.countdown = scene.add.text(565, 18, '', { ...TEXT_STYLE, fontSize: '24px', fontStyle: 'bold' });
    this.goalLabel = scene.add.text(740, 15, '', { ...TEXT_STYLE, fontSize: '14px', lineSpacing: 6 });
    this.moneyLabel = scene.add.text(1068, 14, '', { ...TEXT_STYLE, fontSize: '20px', fontStyle: 'bold', align: 'right' }).setOrigin(1, 0);
    const back = scene.add.text(1068, 66, 'ESC · Menu', { ...TEXT_STYLE, fontSize: '12px', color: cssColor(THEME.colors.muted) }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).on('pointerdown', returnToMenu);
    const help = scene.add.text(24, 771, 'P1: WASD · E · F · Shift trái' + (players.length > 1 ? '     P2: Mũi tên · Enter · / · Shift phải' : '     E tương tác · F nhặt/thả'), { ...TEXT_STYLE, fontSize: '12px', color: cssColor(THEME.colors.ink) });
    this.deliveryLabel = scene.add.text(1068, 754, '', { ...TEXT_STYLE, fontSize: '12px', color: cssColor(THEME.colors.woodDark) }).setOrigin(1, 0);
    this.message = scene.add.text(550, 121, '', { ...TEXT_STYLE, fontSize: '15px', backgroundColor: cssColor(THEME.colors.paper), padding: { x: 14, y: 8 } }).setOrigin(0.5).setVisible(false);
    hud.add([panels, title, subtitle, back, help, this.dayLabel, this.phaseDetail, this.countdown, this.goalLabel, this.moneyLabel, this.deliveryLabel, this.message]);
    this.sessionLabel = scene.add.text(1068, 718, '', { ...TEXT_STYLE, fontSize: '12px', color: cssColor(THEME.colors.ink), align: 'right', lineSpacing: 5 }).setOrigin(1, 0);
    hud.add(this.sessionLabel);
    players.forEach((player, index) => {
      const status = scene.add.text(24 + index * 270, 720, '', { ...TEXT_STYLE, fontSize: '15px', color: cssColor(THEME.colors.ink), lineSpacing: 7 });
      hud.add(scene.add.rectangle(15 + index * 270, 739, 3, 36, player.id === 1 ? THEME.colors.blue : THEME.colors.orange));
      hud.add(status); this.statuses.set(player, status);
    });
    this.uiCamera = scene.cameras.add(0, 0, VIEW.width, VIEW.height);
    this.uiCamera.ignore(worldObjects);
    scene.cameras.main.ignore(hud);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.messageTimer?.remove());
    this.update();
  }
  excludeWorldObject(object: Phaser.GameObjects.GameObject): void { this.uiCamera.ignore(object); }
  notify(message: string): void {
    this.message.setText(message).setVisible(true);
    this.messageTimer?.remove();
    this.messageTimer = this.scene.time.delayedCall(3000, () => this.message.setVisible(false));
  }
  update(): void {
    const phaseNames = { PREPARATION: 'CHUẨN BỊ', OPEN: 'MỞ CỬA', CLOSING: 'ĐÓNG CỬA', SUMMARY: 'TỔNG KẾT' };
    this.dayLabel.setText(`NGÀY ${this.day.currentDay} · ${phaseNames[this.day.state]}`);
    this.phaseDetail.setText(this.day.state === 'PREPARATION' ? 'Tương tác tại lối vào để mở cửa' : this.day.state === 'CLOSING' ? `Còn ${this.customerCount()} khách · Phục vụ nốt nhé!` : 'Cùng nhau trông tiệm');
    this.countdown.setText(this.day.state === 'OPEN' ? ` ${formatCountdown(this.day.remainingOpenTimeMs / 1000)}` : '');
    this.goalLabel.setText(`MỤC TIÊU NGÀY\n${formatVnd(this.day.statistics.dailyRevenue)} / ${formatVnd(this.day.dailyGoal)}`);
    const stats = this.economy.accounting;
    this.moneyLabel.setText(`TIỀN
${formatVnd(this.economy.money)}`);
    this.sessionLabel.setText(`CẢ PHIÊN · Thu ${formatVnd(stats.totalRevenue)} · Chi ${formatVnd(stats.totalExpenses)}
Lãi ${formatSignedVnd(stats.profit)} · Khách ${stats.totalCustomersServed}`);
    const order = this.supplier.activeOrder;
    const delivery = order ? `${order.id} · Đang giao · ${Math.ceil(this.supplier.remainingMs / 1000)} giây` : 'Kho hữu hạn · Đặt hàng tại bàn bên trái';
    if (this.deliveryLabel.text !== delivery) this.deliveryLabel.setText(delivery);
    for (const [player, label] of this.statuses) {
      const text = `P${player.id}\nCầm: ${describeStack(player.currentHeldItem)}`;
      if (label.text !== text) label.setText(text);
    }
  }
}
