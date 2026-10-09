export const SOUND_EVENTS = ['UI_CLICK', 'PICKUP', 'DROP', 'STOCK_SHELF', 'ERROR', 'CUSTOMER_ENTER', 'CHECKOUT_START', 'SALE_COMPLETE', 'SUPPLIER_ORDER', 'DELIVERY_COMPLETE', 'STORE_OPEN', 'STORE_CLOSE', 'GOAL_COMPLETE'] as const;
export type SoundEvent = typeof SOUND_EVENTS[number];
export interface AudioSettings { readonly masterEnabled: boolean; readonly musicEnabled: boolean; readonly sfxEnabled: boolean; readonly masterVolume?: number; readonly musicVolume?: number; readonly sfxVolume?: number }
export interface AudioBackend { has(key: string): boolean; play(key: string, volume?: number): void; configure?(settings: AudioSettings): void; shutdown?(): void }
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = Object.freeze({ masterEnabled: true, musicEnabled: true, sfxEnabled: true });

export class AudioManager {
  private options: AudioSettings;
  private readonly backend?: AudioBackend;
  private readonly bindings = new Map<SoundEvent, string>();
  private stopped = false;
  constructor(backend?: AudioBackend, settings = DEFAULT_AUDIO_SETTINGS) { this.backend = backend; this.options = Object.freeze({ ...settings }); this.configure({}); }
  get settings(): AudioSettings { return this.options; }
  configure(settings: Partial<AudioSettings>): void {
    const next = { ...this.options, ...settings };
    for (const key of ['masterVolume', 'musicVolume', 'sfxVolume'] as const) if (next[key] !== undefined) next[key] = Number.isFinite(next[key]) ? Math.max(0, Math.min(1, next[key]!)) : 0;
    this.options = Object.freeze(next);
    try { this.backend?.configure?.(this.options); } catch { /* Playback settings cannot break gameplay. */ }
  }
  bind(event: SoundEvent, assetKey: string): void { this.bindings.set(event, assetKey); }
  play(event: SoundEvent): boolean { return this.options.sfxEnabled && this.playAsset(this.bindings.get(event) ?? `sfx-${event.toLowerCase()}`, this.options.sfxVolume ?? 1); }
  playMusic(assetKey: string): boolean { return this.options.musicEnabled && this.playAsset(assetKey, this.options.musicVolume ?? 1); }
  private playAsset(key: string, categoryVolume: number): boolean {
    if (this.stopped || !this.options.masterEnabled || !this.backend) return false;
    const volume = (this.options.masterVolume ?? 1) * categoryVolume;
    if (volume <= 0) return false;
    try { if (!this.backend.has(key)) return false; this.backend.play(key, volume); return true; }
    catch { return false; }
  }
  shutdown(): void { this.stopped = true; this.bindings.clear(); try { this.backend?.shutdown?.(); } catch { /* Audio may already be unavailable. */ } }
}
