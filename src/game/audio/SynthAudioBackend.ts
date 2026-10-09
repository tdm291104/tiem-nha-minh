import { SOUND_EVENTS, type AudioBackend, type AudioSettings, type SoundEvent } from './AudioManager';

const TONES: Record<SoundEvent, readonly number[]> = {
  UI_CLICK: [660], PICKUP: [440, 660], DROP: [330, 220], STOCK_SHELF: [392, 523, 659], ERROR: [196, 147], CUSTOMER_ENTER: [523, 587], CHECKOUT_START: [740, 880], SALE_COMPLETE: [659, 784, 1047], SUPPLIER_ORDER: [440, 554, 659], DELIVERY_COMPLETE: [523, 659, 784], STORE_OPEN: [392, 523, 659, 784], STORE_CLOSE: [523, 440, 392], GOAL_COMPLETE: [523, 659, 784, 1047],
};
const MELODY = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23, 329.63, 392, 493.88, 392, 293.66, 329.63, 392, 0];
const MUSIC_KEY = 'tiem-theme';
export class SynthAudioBackend implements AudioBackend {
  private context: AudioContext | null = null;
  private options: AudioSettings = { masterEnabled: true, musicEnabled: true, sfxEnabled: true };
  private readonly voices = new Map<OscillatorNode, boolean>();
  private musicRequested = false;
  private nextNoteTime = 0;
  private noteIndex = 0;
  private interval?: number;
  private stopped = false;
  constructor() {
    window.addEventListener('pointerdown', this.unlock, { capture: true });
    window.addEventListener('keydown', this.unlock, { capture: true });
    document.addEventListener('visibilitychange', this.visibility);
  }
  has(key: string): boolean { return key === MUSIC_KEY || SOUND_EVENTS.some(event => key === `sfx-${event.toLowerCase()}`); }
  configure(settings: AudioSettings): void {
    this.options = settings;
    for (const [voice, music] of this.voices) if (music || !settings.masterEnabled || !settings.sfxEnabled) { try { voice.stop(); } catch { /* Already ended. */ } }
    if (this.context) this.nextNoteTime = this.context.currentTime;
    this.syncMusic();
  }
  play(key: string, volume = 0.5): void {
    if (this.stopped) return;
    if (key === MUSIC_KEY) { this.musicRequested = true; this.syncMusic(); return; }
    if (!this.context || this.context.state !== 'running') return;
    const event = SOUND_EVENTS.find(event => key === `sfx-${event.toLowerCase()}`);
    if (event) TONES[event].forEach((frequency, index) => this.tone(frequency, this.context!.currentTime + index * 0.07, 0.1, volume * 0.16, false));
  }
  private readonly unlock = (): void => {
    if (this.stopped) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume().then(() => this.syncMusic()).catch(() => {});
      this.syncMusic();
    } catch { /* Unsupported or blocked audio never prevents gameplay. */ }
  };
  private readonly visibility = (): void => {
    if (document.hidden) {
      if (this.interval !== undefined) { window.clearInterval(this.interval); this.interval = undefined; }
      for (const voice of this.voices.keys()) try { voice.stop(); } catch { /* Already ended. */ }
      void this.context?.suspend().catch(() => {});
    } else if (this.context) { this.nextNoteTime = this.context.currentTime; this.unlock(); }
  };
  private syncMusic(): void {
    const active = this.context?.state === 'running' && !document.hidden && this.musicRequested && this.options.masterEnabled && this.options.musicEnabled && (this.options.masterVolume ?? 1) > 0 && (this.options.musicVolume ?? 0.3) > 0;
    if (!active || this.stopped) { if (this.interval !== undefined) window.clearInterval(this.interval); this.interval = undefined; return; }
    if (this.interval !== undefined) return;
    this.nextNoteTime = this.context!.currentTime + 0.03;
    this.interval = window.setInterval(() => this.scheduleMusic(), 100); this.scheduleMusic();
  }
  private scheduleMusic(): void {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    while (this.nextNoteTime < context.currentTime + 0.15) {
      const frequency = MELODY[this.noteIndex++ % MELODY.length]!;
      if (frequency > 0) this.tone(frequency, Math.max(context.currentTime, this.nextNoteTime), 0.3, (this.options.masterVolume ?? 1) * (this.options.musicVolume ?? 0.3) * 0.075, true);
      this.nextNoteTime += 0.48;
    }
  }
  private tone(frequency: number, start: number, duration: number, volume: number, music: boolean): void {
    const context = this.context;
    if (!context || volume <= 0) return;
    const oscillator = context.createOscillator(), envelope = context.createGain();
    oscillator.type = music ? 'sine' : 'triangle'; oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0.0001, start); envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.01); envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope); envelope.connect(context.destination); this.voices.set(oscillator, music);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); this.voices.delete(oscillator); };
    oscillator.start(start); oscillator.stop(start + duration + 0.02);
  }
  shutdown(): void {
    this.stopped = true;
    window.removeEventListener('pointerdown', this.unlock, { capture: true }); window.removeEventListener('keydown', this.unlock, { capture: true }); document.removeEventListener('visibilitychange', this.visibility);
    if (this.interval !== undefined) window.clearInterval(this.interval);
    for (const voice of this.voices.keys()) { voice.onended = null; try { voice.stop(); } catch { /* Already ended. */ } voice.disconnect(); }
    this.voices.clear(); if (this.context) void this.context.close().catch(() => {}); this.context = null;
  }
}
