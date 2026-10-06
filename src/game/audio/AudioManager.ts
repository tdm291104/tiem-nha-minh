export const SOUND_EVENTS = ['UI_CLICK', 'PICKUP', 'DROP', 'STOCK_SHELF', 'ERROR', 'CUSTOMER_ENTER', 'CHECKOUT_START', 'SALE_COMPLETE', 'SUPPLIER_ORDER', 'DELIVERY_COMPLETE', 'STORE_OPEN', 'STORE_CLOSE', 'GOAL_COMPLETE'] as const;
export type SoundEvent = typeof SOUND_EVENTS[number];
export interface AudioSettings { readonly masterEnabled: boolean; readonly musicEnabled: boolean; readonly sfxEnabled: boolean }
export interface AudioBackend { has(key: string): boolean; play(key: string): void }
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = Object.freeze({ masterEnabled: true, musicEnabled: true, sfxEnabled: true });

export class AudioManager {
  private options: AudioSettings;
  private readonly backend?: AudioBackend;
  private readonly bindings = new Map<SoundEvent, string>();
  private stopped = false;
  constructor(backend?: AudioBackend, settings = DEFAULT_AUDIO_SETTINGS) { this.backend = backend; this.options = Object.freeze({ ...settings }); }
  get settings(): AudioSettings { return this.options; }
  configure(settings: Partial<AudioSettings>): void { this.options = Object.freeze({ ...this.options, ...settings }); }
  bind(event: SoundEvent, assetKey: string): void { this.bindings.set(event, assetKey); }
  play(event: SoundEvent): boolean { return this.options.sfxEnabled && this.playAsset(this.bindings.get(event) ?? `sfx-${event.toLowerCase()}`); }
  playMusic(assetKey: string): boolean { return this.options.musicEnabled && this.playAsset(assetKey); }
  private playAsset(key: string): boolean {
    if (this.stopped || !this.options.masterEnabled || !this.backend) return false;
    try { if (!this.backend.has(key)) return false; this.backend.play(key); return true; }
    catch { return false; }
  }
  shutdown(): void { this.stopped = true; this.bindings.clear(); }
}
