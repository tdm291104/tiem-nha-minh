import Phaser from 'phaser';
import { CAMERA_MODES, CAMERA_MODE_LABELS, type CameraMode } from './ThreeRules';
import { THEME, cssColor } from '../VisualTheme';
import { UI, UI_TEXT } from '../../ui/UiTheme';
import { panelButton, drawPaper, type PanelButton } from '../../ui/PanelPrimitives';
import { VIEW } from '../../config/settings';
import type { ShopCamera3D } from './ShopCamera3D';

export class CameraModeControls {
  private readonly root: Phaser.GameObjects.Container;
  private readonly labels = new Map<CameraMode, PanelButton>();
  private readonly hint: Phaser.GameObjects.Text;
  private readonly crosshair: Phaser.GameObjects.Graphics;
  constructor(private readonly scene: Phaser.Scene, private readonly rig: ShopCamera3D, private readonly playerCount: number, private readonly changed: () => void) {
    this.root = scene.add.container(0, 0).setDepth(3100); scene.cameras.main.ignore(this.root);
    const paper = scene.add.graphics(); drawPaper(paper, VIEW.width - 365, 126, 345, 70); this.root.add(paper);
    CAMERA_MODES.forEach((mode, index) => {
      this.labels.set(mode, panelButton(scene, this.root, VIEW.width - 308 + index * 110, 149, CAMERA_MODE_LABELS[mode], () => this.setMode(mode), undefined, true, { width: 103, height: 32, fontSize: 13 }));
    });
    this.hint = scene.add.text(VIEW.width - 36, 176, '', { ...UI_TEXT, fontSize: '11px', color: cssColor(UI.colors.muted) }).setOrigin(1, 0);
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
    for (const [mode, button] of this.labels) { button.setSelected(mode === this.rig.mode); button.setEnabled(this.playerCount === 1 || mode === 'OBLIQUE'); }
    this.hint.setText(this.playerCount > 1 ? 'Co-op · Camera chung' : this.rig.mode === 'OBLIQUE' ? 'C · Đổi góc nhìn' : 'C đổi góc · Giữ chuột phải để nhìn');
    this.crosshair.setVisible(this.rig.mode === 'FIRST_PERSON' && !this.scene.physics.world.isPaused);
  }
  private destroy(): void {
    window.removeEventListener('keydown', this.onKey);
    this.scene.game.canvas.removeEventListener('pointermove', this.onLook);
    this.scene.game.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.root.destroy();
  }
}
