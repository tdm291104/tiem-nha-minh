import Phaser from 'phaser';
import { panelButton } from './PanelPrimitives';
import { THEME, cssColor } from '../presentation/VisualTheme';
import type { AudioManager } from '../audio/AudioManager';
import { TEXT_STYLE, VIEW } from '../config/settings';
import type { DaySummary } from '../day/DayManager';
import { formatVnd, formatSignedVnd } from '../economy/Money';

export class DaySummaryPanel extends Phaser.GameObjects.Container {
  private readonly heading: Phaser.GameObjects.Text;
  private readonly values: Phaser.GameObjects.Text[] = [];
  private readonly result: Phaser.GameObjects.Text;
  private presentedDay = 0;
  constructor(scene: Phaser.Scene, nextDay: (day: number) => void, audio?: AudioManager) {
    super(scene, 0, 0);
    scene.add.existing(this); this.setDepth(4100).setVisible(false);
    scene.cameras.main.ignore(this);
    const mask = scene.add.rectangle(VIEW.width / 2, VIEW.height / 2, VIEW.width, VIEW.height, THEME.colors.ink, 0.9).setInteractive();
    mask.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
    const paper = scene.add.graphics();
    paper.fillStyle(THEME.colors.shadow, 0.15).fillRect(215, 95, 690, 630);
    paper.fillStyle(THEME.colors.paper).fillRect(205, 85, 690, 630);
    paper.lineStyle(1, THEME.colors.woodDark, 0.35);
    for (let x = 240; x < 860; x += 12) paper.lineBetween(x, 204, x + 6, 204).lineBetween(x, 537, x + 6, 537);
    for (let x = 205; x < 895; x += 18) paper.fillStyle(THEME.colors.woodLight, 0.25).fillTriangle(x, 714, x + 9, 704, x + 18, 714);
    this.add([mask, paper]);
    this.text(550, 109, 'TIỆM NHÀ MÌNH · SỔ BÁN HÀNG', 12).setOrigin(0.5);
    this.heading = this.text(550, 143, '', 25).setOrigin(0.5);
    this.result = this.text(550, 179, '', 22).setOrigin(0.5).setFontStyle('bold');
    const labels = ['DOANH THU', 'CHI PHÍ', 'LỢI NHUẬN', 'KHÁCH ĐÃ PHỤC VỤ', 'SẢN PHẨM ĐÃ BÁN', 'KHÁCH BỎ ĐI VÌ HẾT HÀNG', 'MỤC TIÊU'];
    labels.forEach((label, index) => {
      const y = 241 + index * 44;
      this.text(250, y, label, index < 3 ? 18 : 14);
      this.values.push(this.text(850, y, '', index < 3 ? 24 : 18).setOrigin(1, 0));
    });
    this.text(550, 556, 'Hết một ngày trông tiệm. Mai mình lại mở!', 16).setOrigin(0.5);
    this.text(550, 596, 'Giữ tiền và hàng tồn · Chuẩn bị cho ngày tiếp theo', 15).setOrigin(0.5);
    panelButton(scene, this, 550, 658, 'NGÀY TIẾP THEO', () => { if (this.visible) nextDay(this.presentedDay); }, audio);
  }
  showSummary(summary: DaySummary): void {
    this.presentedDay = summary.day; this.heading.setText(`TỔNG KẾT NGÀY ${summary.day}`);
    const values = [formatVnd(summary.dailyRevenue), formatVnd(summary.dailyExpenses), formatSignedVnd(summary.dailyProfit), String(summary.customersServed), String(summary.itemsSold), String(summary.outOfStockCustomers), formatVnd(summary.goal)];
    this.values.forEach((text, index) => text.setText(values[index] ?? ''));
    this.result.setText(summary.goalAchieved ? '✓ HOÀN THÀNH MỤC TIÊU' : 'CHƯA ĐẠT MỤC TIÊU').setColor(summary.goalAchieved ? cssColor(THEME.colors.green) : cssColor(THEME.colors.warning));
    this.setVisible(true);
  }
  private text(x: number, y: number, value: string, size: number): Phaser.GameObjects.Text {
    const text = this.scene.add.text(x, y, value, { ...TEXT_STYLE, fontSize: `${size}px` }); this.add(text); return text;
  }
}
