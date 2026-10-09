import Phaser from 'phaser';
import { panelButton, modalPaper } from './PanelPrimitives';
import { cssColor } from '../presentation/VisualTheme';
import type { AudioManager } from '../audio/AudioManager';
import { UI, UI_TEXT } from './UiTheme';
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
    const paper = modalPaper(scene, this, 260, 55, 580, 690);
    paper.fillStyle(UI.colors.mint).fillRoundedRect(280, 75, 540, 136, 12);
    paper.lineStyle(1, UI.colors.line);
    for (let x = 295; x < 804; x += 14) paper.lineBetween(x, 236, x + 7, 236).lineBetween(x, 420, x + 7, 420).lineBetween(x, 582, x + 7, 582);
    this.text(550, 95, 'TIỆM NHÀ MÌNH', 15).setOrigin(0.5).setFontStyle('bold');
    this.heading = this.text(550, 133, '', 30).setOrigin(0.5).setFontStyle('bold');
    this.result = this.text(550, 180, '', 17).setOrigin(0.5).setFontStyle('bold');
    const labels = ['Doanh thu', 'Chi phí', 'Lợi nhuận', 'Khách đã phục vụ', 'Sản phẩm đã bán', 'Khách gặp hết hàng', 'Mục tiêu ngày'];
    const positions = [259, 313, 367, 445, 482, 519, 556];
    labels.forEach((label, index) => {
      const y = positions[index]!;
      this.text(300, y, label, index < 3 ? 18 : 15).setColor(cssColor(UI.colors.muted));
      this.values.push(this.text(800, y - 4, '', index < 3 ? 26 : 18).setOrigin(1, 0).setFontStyle(index < 3 ? 'bold' : 'normal'));
    });
    this.text(550, 609, 'Hết một ngày trông tiệm. Mai mình lại mở!', 15).setOrigin(0.5);
    this.text(550, 636, 'Tiền và hàng tồn được giữ cho ngày tiếp theo.', 13).setOrigin(0.5).setColor(cssColor(UI.colors.muted));
    panelButton(scene, this, 550, 695, 'Ngày tiếp theo', () => { if (this.visible) nextDay(this.presentedDay); }, audio, false, { width: 330, height: 48, fontSize: 18 });
  }
  showSummary(summary: DaySummary): void {
    this.presentedDay = summary.day; this.heading.setText(`Tổng kết ngày ${summary.day}`);
    const values = [formatVnd(summary.dailyRevenue), formatVnd(summary.dailyExpenses), formatSignedVnd(summary.dailyProfit), String(summary.customersServed), String(summary.itemsSold), String(summary.outOfStockCustomers), formatVnd(summary.goal)];
    this.values.forEach((text, index) => text.setText(values[index] ?? ''));
    this.result.setText(summary.goalAchieved ? 'Đã hoàn thành mục tiêu hôm nay!' : 'Chưa đạt mục tiêu. Mai mình thử lại nhé!').setColor(summary.goalAchieved ? cssColor(UI.colors.green) : cssColor(UI.colors.error));
    this.values[2]?.setColor(cssColor(summary.dailyProfit >= 0 ? UI.colors.green : UI.colors.error));
    this.setVisible(true);
  }
  private text(x: number, y: number, value: string, size: number): Phaser.GameObjects.Text {
    const text = this.scene.add.text(x, y, value, { ...UI_TEXT, fontSize: `${size}px` }); this.add(text); return text;
  }
}
