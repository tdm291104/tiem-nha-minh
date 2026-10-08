import Phaser from 'phaser';
import { CharacterView } from '../presentation/CharacterView';
import { PLAYER_STYLES } from '../presentation/CharacterStyles';
import { createSceneAudio } from '../audio/createSceneAudio';
import type { AudioManager } from '../audio/AudioManager';
import { THEME, cssColor } from '../presentation/VisualTheme';
import { TEXT_STYLE, VIEW } from '../config/settings';

export class MenuScene extends Phaser.Scene {
  private audio!: AudioManager;
  constructor() { super('MenuScene'); }
  create(): void {
    this.audio = createSceneAudio(this);
    this.cameras.main.setBackgroundColor(cssColor(THEME.colors.floor));
    const g = this.add.graphics();
    g.fillStyle(THEME.colors.green).fillRect(0, 0, VIEW.width, 20);
    for (let i = 0; i < 11; i++) {
      g.fillStyle(i % 2 ? THEME.colors.amber : THEME.colors.warning).fillRoundedRect(i * 100, 20, 100, 65, { tl: 0, tr: 0, bl: 20, br: 20 });
    }
    this.add.text(550, 175, 'CHUẨN BỊ MỞ TIỆM, GHÉ CHƠI NHA!', { ...TEXT_STYLE, fontSize: '15px', letterSpacing: 3 }).setOrigin(0.5);
    this.add.text(550, 250, 'TIỆM NHÀ MÌNH', { ...TEXT_STYLE, fontSize: '62px', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(550, 315, 'Một tiệm nhỏ. Cả xóm thương.', { ...TEXT_STYLE, fontSize: '23px' }).setOrigin(0.5);
    if (this.textures.exists('shopkeepers-3d')) this.add.image(550, 392, 'shopkeepers-3d').setDisplaySize(280, 154);
    else {
      new CharacterView(this, PLAYER_STYLES[0]!).setPosition(485, 428).setScale(1.4);
      new CharacterView(this, PLAYER_STYLES[1]!).setPosition(615, 428).setScale(1.4);
    }
    this.button(500, 'Chơi 1 người', 1);
    this.button(590, 'Chơi 2 người', 2);
    this.add.text(550, 685, 'WASD / Phím mũi tên · Cùng nhau trông tiệm', { ...TEXT_STYLE, fontSize: '17px' }).setOrigin(0.5);
    this.add.text(550, 752, 'PHIÊN BẢN 3D  /  MỖI NGÀY MỘT TIỆM VUI', { ...TEXT_STYLE, fontSize: '12px', letterSpacing: 2 }).setOrigin(0.5).setAlpha(0.6);
    const keyboard = this.input.keyboard;
    keyboard?.once('keydown-ONE', () => this.scene.start('ShopScene', { playerCount: 1 }));
    keyboard?.once('keydown-TWO', () => this.scene.start('ShopScene', { playerCount: 2 }));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard?.removeAllListeners('keydown-ONE');
      keyboard?.removeAllListeners('keydown-TWO');
    });
  }
  private button(y: number, title: string, playerCount: 1 | 2): void {
    const rect = this.add.rectangle(550, y, 340, 66, playerCount === 1 ? THEME.colors.green : THEME.colors.amber).setStrokeStyle(2, THEME.colors.green).setInteractive({ useHandCursor: true });
    this.add.text(550, y, title, { ...TEXT_STYLE, fontSize: '24px', fontStyle: 'bold', color: playerCount === 1 ? cssColor(THEME.colors.paper) : cssColor(THEME.colors.ink) }).setOrigin(0.5);
    rect.on('pointerover', () => rect.setAlpha(0.8));
    rect.on('pointerout', () => rect.setAlpha(1));
    rect.on('pointerdown', () => { this.audio.play('UI_CLICK'); this.scene.start('ShopScene', { playerCount }); });
  }
}
