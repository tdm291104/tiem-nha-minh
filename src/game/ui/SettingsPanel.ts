import Phaser from 'phaser';
import { UI, UI_TEXT, uiRatio } from './UiTheme';
import type { AudioManager } from '../audio/AudioManager';
import { preferences, type GamePreferences } from '../settings/Preferences';
import { panelButton, modalPaper, type PanelButton } from './PanelPrimitives';
export class SettingsPanel extends Phaser.GameObjects.Container {
  private readonly switches = new Map<keyof GamePreferences, PanelButton>();
  private readonly meters: Phaser.GameObjects.Graphics;
  private readonly values = new Map<keyof GamePreferences, Phaser.GameObjects.Text>();
  constructor(scene: Phaser.Scene, private readonly modalChanged: (open: boolean) => void, audio: AudioManager, fixedCamera = true) {
    super(scene, 0, 0); scene.add.existing(this); this.setVisible(false).setDepth(4300); if (fixedCamera) scene.cameras.main.ignore(this);
    const paper = modalPaper(scene, this, 200, 75, 700, 650);
    paper.fillStyle(UI.colors.mint).fillRoundedRect(220, 95, 660, 78, 12);
    paper.lineStyle(1, UI.colors.line).lineBetween(250, 393, 850, 393);
    this.meters = scene.add.graphics(); this.add(this.meters);
    this.text(250, 106, 'Cài đặt tiệm mình', 28);
    this.text(250, 149, 'Tùy chỉnh dùng chung cho cả hai người chơi', 14);
    const toggles = [['masterEnabled', 'Âm thanh'], ['musicEnabled', 'Nhạc nền'], ['sfxEnabled', 'Hiệu ứng âm thanh'], ['reducedMotion', 'Giảm chuyển động']] as const;
    toggles.forEach(([key, label], index) => {
      const y = 205 + index * 49; this.text(250, y - 10, label, 18);
      this.switches.set(key, panelButton(scene, this, 800, y, 'Bật', () => { preferences.configure({ [key]: !preferences.snapshot[key] }); this.refresh(); }, audio, true, { width: 100, height: 34 }));
    });
    const ranges = [['masterVolume', 'Âm lượng chung', 0.1], ['musicVolume', 'Âm lượng nhạc', 0.1], ['sfxVolume', 'Âm lượng hiệu ứng', 0.1], ['lookSensitivity', 'Độ nhạy nhìn', 0.25]] as const;
    ranges.forEach(([key, label, step], index) => {
      const y = 419 + index * 49; this.text(250, y - 10, label, 18);
      this.values.set(key, this.text(735, y - 10, '', 18).setOrigin(0.5, 0));
      for (const direction of [-1, 1] as const) panelButton(scene, this, direction < 0 ? 660 : 820, y, direction < 0 ? '-' : '+', () => { preferences.configure({ [key]: Math.round((preferences.snapshot[key] + direction * step) * 100) / 100 }); this.refresh(); }, audio, true, { width: 44, height: 34 });
    });
    this.text(250, 619, 'Giảm chuyển động giúp hạn chế rung, nhún và hiệu ứng.', 14);
    panelButton(scene, this, 550, 675, 'Xong', () => this.close(), audio, true);
  }
  get isOpen(): boolean { return this.visible; }
  open(): void { if (this.visible) return; this.refresh(); this.setVisible(true); this.modalChanged(true); }
  close(): void { if (!this.visible) return; this.setVisible(false); this.modalChanged(false); }
  private refresh(): void {
    this.meters.clear();
    for (const [key, button] of this.switches) { const enabled = Boolean(preferences.snapshot[key]); button.setSelected(enabled); button.setLabel(enabled ? 'Bật' : 'Tắt'); }
    for (const [index, key] of (['masterVolume', 'musicVolume', 'sfxVolume'] as const).entries()) {
      const y = 427 + index * 49;
      this.meters.fillStyle(UI.colors.line).fillRoundedRect(513, y, 111, 6, 3);
      const fraction = uiRatio(preferences.snapshot[key], 1);
      if (fraction > 0) this.meters.fillStyle(UI.colors.green).fillRoundedRect(513, y, Math.max(6, 111 * fraction), 6, 3);
    }
    for (const [key, label] of this.values) {
      const value = preferences.snapshot[key];
      label.setText(typeof value === 'boolean' ? value ? 'Bật' : 'Tắt' : key === 'lookSensitivity' ? `${value.toFixed(2)}x` : `${Math.round(value * 100)}%`);
    }
  }
  private text(x: number, y: number, value: string, size: number): Phaser.GameObjects.Text {
    const text = this.scene.add.text(x, y, value, { ...UI_TEXT, fontSize: `${size}px` }); this.add(text); return text;
  }
}
