import Phaser from 'phaser';
import { CAMERA_MODES, CAMERA_MODE_LABELS } from './ThreeRules';
import type { CameraMode } from './ThreeRules';
import { THEME, THEME_TEXT, cssColor } from '../VisualTheme';
import { VIEW } from '../../config/settings';
import type { ShopCamera3D } from './ShopCamera3D';

export class CameraModeControls {
  private readonly root: Phaser.GameObjects.Container;
  private readonly labels = new Map<CameraMode, Phaser.GameObjects.Text>();
  private readonly hint: Phaser.GameObjects.Text;
  private readonly crosshair: Phaser.GameObjects.Graphics;
  constructor(private readonly scene: Phaser.Scene, private readonly rig: ShopCamera3D, private readonly playerCount: number, private readonly changed: () => void) {
    this.root = scene.add.container(0, 0).setDepth(3100); scene.cameras.main.ignore(this.root);
    CAMERA_MODES.forEach((mode, index) => {
      const label = scene.add.text(VIEW.width - 350 + index * 115, 98, CAMERA_MODE_LABELS[mode], { ...THEME_TEXT, fontSize: '13px', padding: { x: 8, y: 5 }, backgroundColor: cssColor(THEME.colors.paper) }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      label.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); this.setMode(mode); });
      this.labels.set(mode, label); this.root.add(label);
    });
    this.hint = scene.add.text(VIEW.width - 20, 132, '', { ...THEME_TEXT, fontSize: '12px', backgroundColor: cssColor(THEME.colors.paper), padding: { x: 6, y: 3 } }).setOrigin(1, 0);
    this.crosshair = scene.add.graphics().lineStyle(2, THEME.colors.paper, 0.9).lineBetween(VIEW.width / 2 - 5, VIEW.height / 2, VIEW.width / 2 + 5, VIEW.height / 2).lineBetween(VIEW.width / 2, VIEW.height / 2 - 5, VIEW.width / 2, VIEW.height / 2 + 5);
    this.root.add([this.hint, this.crosshair]); this.refresh();
    window.addEventListener('keydown', this.onKey);
    scene.game.canvas.addEventListener('pointermove', this.onLook);
    scene.game.canvas.addEventListener('contextmenu', this.onContextMenu);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }
  private setMode(mode: CameraMode): void {
    if (this.scene.physics.world.isPaused) return;
    if (this.rig.setMode(mode, this.playerCount)) this.changed();
    this.refresh();
  }
  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.code !== 'KeyC' || event.repeat || this.scene.physics.world.isPaused || this.playerCount !== 1) return;
    event.preventDefault(); this.setMode(CAMERA_MODES[(CAMERA_MODES.indexOf(this.rig.mode) + 1) % CAMERA_MODES.length]!);
  };
  private readonly onLook = (event: PointerEvent): void => {
    if (!(event.buttons & 2) || this.scene.physics.world.isPaused || this.rig.mode === 'OBLIQUE') return;
    this.rig.look(event.movementX, event.movementY); this.changed();
  };
  private readonly onContextMenu = (event: MouseEvent): void => { if (this.rig.mode !== 'OBLIQUE') event.preventDefault(); };
  refresh(): void {
    for (const [mode, label] of this.labels) label.setColor(cssColor(mode === this.rig.mode ? THEME.colors.green : THEME.colors.ink)).setAlpha(this.playerCount > 1 && mode !== 'OBLIQUE' ? 0.4 : 1);
    this.hint.setText(this.playerCount > 1 ? 'Co-op · Camera chung' : this.rig.mode === 'OBLIQUE' ? 'C · Đổi góc nhìn' : 'C · Đổi góc | Giữ chuột phải và kéo để nhìn');
    this.crosshair.setVisible(this.rig.mode === 'FIRST_PERSON' && !this.scene.physics.world.isPaused);
  }
  private destroy(): void {
    window.removeEventListener('keydown', this.onKey);
    this.scene.game.canvas.removeEventListener('pointermove', this.onLook);
    this.scene.game.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.root.destroy();
  }
}
