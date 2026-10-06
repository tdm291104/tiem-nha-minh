import Phaser from 'phaser';
import { THEME, THEME_TEXT, VISUAL_SETTINGS, cssColor } from './VisualTheme';
import { motionPolicy } from './PresentationRules';
import type { Position } from '../types/game';
import { VIEW } from '../config/settings';

/** Presentation only: targets must be visual containers, never physics objects. */
export class FeedbackEffects {
  private readonly world: Phaser.GameObjects.Container;
  private readonly active = new Map<Phaser.GameObjects.GameObject, Phaser.Tweens.Tween>();
  private bannerView?: Phaser.GameObjects.Container;
  private stopped = false;
  constructor(private readonly scene: Phaser.Scene) {
    this.world = scene.add.container(0, 0).setDepth(2100);
  }
  private animate(config: Phaser.Types.Tweens.TweenBuilderConfig): void {
    if (this.stopped) return;
    const target = config.targets;
    if (!(target instanceof Phaser.GameObjects.GameObject)) return;
    this.cancel(target);
    const tween = this.scene.tweens.add(config);
    this.active.set(target, tween);
    const onDestroyed = (): void => { tween.stop(); this.active.delete(target); };
    const cleanup = (): void => { target.off(Phaser.GameObjects.Events.DESTROY, onDestroyed); if (this.active.get(target) === tween) this.active.delete(target); };
    target.once(Phaser.GameObjects.Events.DESTROY, onDestroyed);
    tween.once('complete', cleanup).once('stop', cleanup);
  }
  private cancel(target: Phaser.GameObjects.GameObject): void { this.active.get(target)?.stop(); this.active.delete(target); }

  floatingText(position: Position, message: string, warning = false): void {
    if (this.stopped) return;
    const text = this.scene.add.text(position.x, position.y - 30, message, {
      ...THEME_TEXT, fontSize: warning ? '14px' : '20px', fontStyle: 'bold', color: cssColor(warning ? THEME.colors.warning : THEME.colors.green),
      backgroundColor: cssColor(THEME.colors.paper), padding: { x: 8, y: 4 },
    }).setOrigin(0.5);
    this.world.add(text);
    this.animate({ targets: text, y: text.y - motionPolicy(VISUAL_SETTINGS.reducedMotion).floatDistance, alpha: 0,
      duration: THEME.motion.effectMs, onComplete: () => text.destroy() });
  }
  pop(target: Phaser.GameObjects.Container): void {
    this.cancel(target); target.setScale(1).setRotation(0);
    const scale = motionPolicy(VISUAL_SETTINGS.reducedMotion).popScale;
    if (scale === 1) return;
    this.animate({ targets: target, scaleX: scale, scaleY: scale, duration: THEME.motion.popMs, yoyo: true });
  }
  shake(target: Phaser.GameObjects.Container): void {
    this.cancel(target); target.setScale(1).setRotation(0);
    if (!motionPolicy(VISUAL_SETTINGS.reducedMotion).shake) return;
    this.animate({ targets: target, rotation: 0.025, duration: 65, yoyo: true, repeat: 2, onComplete: () => { if (target.scene) target.setRotation(0); } });
  }
  banner(title: string, detail = ''): void {
    if (this.stopped) return;
    if (this.bannerView) { this.cancel(this.bannerView); this.bannerView.destroy(); }
    const root = this.scene.add.container(VIEW.width / 2, 176).setDepth(4000);
    const g = this.scene.add.graphics().fillStyle(THEME.colors.ink, 0.96).fillRoundedRect(-250, -40, 500, 90, THEME.radius.panel);
    const heading = this.scene.add.text(0, -19, title, { ...THEME_TEXT, fontSize: '24px', fontStyle: 'bold', color: cssColor(THEME.colors.paper) }).setOrigin(0.5);
    const caption = this.scene.add.text(0, 20, detail, { ...THEME_TEXT, fontSize: '15px', color: cssColor(THEME.colors.amberSoft) }).setOrigin(0.5);
    root.add([g, heading, caption]); this.scene.cameras.main.ignore(root); this.bannerView = root;
    this.animate({ targets: root, alpha: 0, delay: THEME.motion.bannerMs, duration: 250, onComplete: () => { root.destroy(); if (this.bannerView === root) this.bannerView = undefined; } });
  }
  shutdown(): void {
    this.stopped = true;
    for (const tween of this.active.values()) tween.stop(); this.active.clear();
    this.bannerView?.destroy(); this.world.destroy();
  }
}
