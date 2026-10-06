import Phaser from 'phaser';
import type { Controls } from '../types/game';

export class PlayerController {
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();
  private readonly codes: Set<string>;
  private enabled = true;

  constructor(scene: Phaser.Scene, readonly controls: Controls) {
    this.codes = new Set([controls.up, controls.down, controls.left, controls.right, controls.interact, controls.pickup, controls.sprint]);
    // DOM listeners prevent browser shortcuts immediately, before Phaser's frame queue.
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.reset);
    document.addEventListener('visibilitychange', this.reset);
    scene.game.events.on(Phaser.Core.Events.BLUR, this.reset);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', this.onDown);
      window.removeEventListener('keyup', this.onUp);
      window.removeEventListener('blur', this.reset);
      document.removeEventListener('visibilitychange', this.reset);
      scene.game.events.off(Phaser.Core.Events.BLUR, this.reset);
      this.reset();
    });
  }

  // Physical codes distinguish left/right Shift and keep co-op bindings independent.
  private readonly onDown = (event: KeyboardEvent): void => {
    if (!this.codes.has(event.code)) return;
    event.preventDefault();
    if (!this.enabled) return;
    if (!this.held.has(event.code) && !event.repeat) this.pressed.add(event.code);
    this.held.add(event.code);
  };
  private readonly onUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
  };
  private readonly reset = (): void => { this.held.clear(); this.pressed.clear(); };
  setEnabled(enabled: boolean): void { this.enabled = enabled; this.reset(); }

  direction(): Phaser.Math.Vector2 {
    const c = this.controls;
    return new Phaser.Math.Vector2(Number(this.held.has(c.right)) - Number(this.held.has(c.left)), Number(this.held.has(c.down)) - Number(this.held.has(c.up))).normalize();
  }
  get sprinting(): boolean { return this.held.has(this.controls.sprint); }
  consume(action: 'interact' | 'pickup'): boolean {
    return this.pressed.delete(this.controls[action]);
  }
  endFrame(): void { this.pressed.clear(); }
}
