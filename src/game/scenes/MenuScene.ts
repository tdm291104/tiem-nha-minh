import Phaser from 'phaser';
import { CharacterView } from '../presentation/CharacterView';
import { PLAYER_STYLES } from '../presentation/CharacterStyles';
import { createSceneAudio } from '../audio/createSceneAudio';
import { cssColor } from '../presentation/VisualTheme';
import { VIEW } from '../config/settings';
import { browserSaves } from '../persistence/GameSave';
import { SettingsPanel } from '../ui/SettingsPanel';
import { UI, UI_TEXT } from '../ui/UiTheme';
import { panelButton, modalPaper } from '../ui/PanelPrimitives';

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }
  create(): void {
    const audio = createSceneAudio(this);
    this.cameras.main.setBackgroundColor(cssColor(UI.colors.paper));
    const root = this.add.container(0, 0), g = this.add.graphics(); root.add(g);
    g.fillStyle(UI.colors.mint).fillCircle(945, 328, 370);
    g.fillStyle(UI.colors.coralSoft).fillCircle(1115, 704, 180);
    g.fillStyle(UI.colors.green).fillRect(0, 0, VIEW.width, 10);
    for (let i = 0; i < 22; i++) g.fillStyle(i % 2 ? UI.colors.paper : UI.colors.green).fillRoundedRect(i * 50, 10, 50, 45, { tl: 0, tr: 0, bl: 12, br: 12 });
    const text = (x: number, y: number, value: string, size: number, bold = false): Phaser.GameObjects.Text => { const label = this.add.text(x, y, value, { ...UI_TEXT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal' }); root.add(label); return label; };
    text(64, 172, 'Tiệm\nNhà Mình', 66, true).setLineSpacing(-4).setColor(cssColor(UI.colors.green));
    text(68, 342, 'Một tiệm nhỏ. Cả xóm thương.', 23);
    text(68, 384, 'Nhập hàng, xếp kệ, đón khách.\nMột mình hay cùng nhau, hôm nay mình mở tiệm!', 16).setLineSpacing(8).setColor(cssColor(UI.colors.muted));
    if (this.textures.exists('menu-shop-3d')) root.add(this.add.image(824, 393, 'menu-shop-3d').setDisplaySize(680, 680));
    else if (this.textures.exists('shopkeepers-3d')) root.add(this.add.image(812, 423, 'shopkeepers-3d').setDisplaySize(410, 225));
    else { root.add(new CharacterView(this, PLAYER_STYLES[0]!).setPosition(725, 478).setScale(2)); root.add(new CharacterView(this, PLAYER_STYLES[1]!).setPosition(865, 478).setScale(2)); }
    text(812, 683, 'Mỗi ngày một tiệm vui', 18, true).setOrigin(0.5).setColor(cssColor(UI.colors.green));
    const loaded = browserSaves()?.load();
    const confirmation = this.add.container(0, 0).setDepth(4500).setVisible(false);
    let pendingPlayers: 1 | 2 = 1;
    modalPaper(this, confirmation, 250, 250, 600, 290);
    confirmation.add(this.add.text(290, 282, 'Mở tiệm mới?', { ...UI_TEXT, fontSize: '28px', fontStyle: 'bold' }));
    const warning = this.add.text(290, 334, '', { ...UI_TEXT, fontSize: '18px', wordWrap: { width: 520 }, lineSpacing: 8 });
    confirmation.add(warning);
    const confirmNewShop = (): void => {
      if (!confirmation.visible) return;
      confirmation.setVisible(false);
      this.scene.start('ShopScene', { playerCount: pendingPlayers });
    };
    panelButton(this, confirmation, 405, 486, 'Giữ tiệm cũ', () => confirmation.setVisible(false), audio, true, { width: 220, height: 46 });
    panelButton(this, confirmation, 685, 486, 'Thay bằng tiệm mới', confirmNewShop, audio, false, { width: 250, height: 46 });
    confirmation.add(this.add.text(550, 520, 'Esc: giữ tiệm cũ · Enter: thay bằng tiệm mới', { ...UI_TEXT, fontSize: '13px', color: cssColor(UI.colors.muted) }).setOrigin(0.5));
    const start = (playerCount: 1 | 2): void => {
      if (confirmation.visible) return;
      if (loaded?.save || loaded?.error) {
        pendingPlayers = playerCount;
        warning.setText(`Tiệm mới ${playerCount} người sẽ thay thế bản lưu hiện tại. Tiến trình cũ sẽ mất và không thể khôi phục.`);
        confirmation.setVisible(true);
      } else this.scene.start('ShopScene', { playerCount });
    };
    if (loaded?.save) {
      panelButton(this, root, 245, 492, `Tiếp tục · Ngày ${loaded.save.day.day}`, () => this.scene.start('ShopScene', { playerCount: loaded.save!.players.length, continueSave: true }), audio, false, { width: 360, height: 54, fontSize: 20 });
      panelButton(this, root, 151, 551, 'Tiệm mới · 1 người', () => start(1), audio, true, { width: 173, height: 46, fontSize: 14 });
      panelButton(this, root, 339, 551, 'Tiệm mới · 2 người', () => start(2), audio, true, { width: 173, height: 46, fontSize: 14 });
    } else {
      panelButton(this, root, 245, 492, 'Chơi 1 người', () => start(1), audio, false, { width: 360, height: 54, fontSize: 20 });
      panelButton(this, root, 245, 553, 'Chơi 2 người · Cùng trông tiệm', () => start(2), audio, true, { width: 360, height: 48, fontSize: 17 });
    }
    if (loaded?.error) text(68, 443, 'Không đọc được bản lưu. Bạn có thể mở tiệm mới.', 13).setColor(cssColor(UI.colors.error));
    const settings = new SettingsPanel(this, () => {}, audio, false);
    panelButton(this, root, 160, 617, 'Âm thanh & cài đặt', () => settings.open(), audio, true, { width: 190, height: 36, fontSize: 13 });
    text(68, 662, 'WASD / Mũi tên · E / Enter để tương tác', 13).setColor(cssColor(UI.colors.muted));
    g.lineStyle(1, UI.colors.line).lineBetween(64, 741, 1036, 741);
    text(64, 762, 'TIỆM NHÀ MÌNH', 12, true); text(1036, 762, 'Cùng nhau trông tiệm', 13).setOrigin(1, 0).setColor(cssColor(UI.colors.muted));
    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-ONE', () => { if (!settings.isOpen) start(1); });
    keyboard?.on('keydown-TWO', () => { if (!settings.isOpen) start(2); });
    const close = (): void => { if (confirmation.visible) confirmation.setVisible(false); else settings.close(); };
    const confirmKey = (event: KeyboardEvent): void => { if (!event.repeat) confirmNewShop(); };
    keyboard?.on('keydown-ESC', close);
    keyboard?.on('keydown-ENTER', confirmKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { keyboard?.removeAllListeners('keydown-ONE'); keyboard?.removeAllListeners('keydown-TWO'); keyboard?.off('keydown-ESC', close); keyboard?.off('keydown-ENTER', confirmKey); });
  }
}
