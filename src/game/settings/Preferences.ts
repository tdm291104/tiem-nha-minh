import type { SaveStorage } from '../persistence/GameSave.ts';
export interface GamePreferences {
  masterEnabled: boolean; musicEnabled: boolean; sfxEnabled: boolean;
  masterVolume: number; musicVolume: number; sfxVolume: number;
  lookSensitivity: number; reducedMotion: boolean;
}
export const DEFAULT_PREFERENCES: Readonly<GamePreferences> = Object.freeze({ masterEnabled: true, musicEnabled: true, sfxEnabled: true, masterVolume: 0.65, musicVolume: 0.3, sfxVolume: 0.65, lookSensitivity: 1, reducedMotion: false });
const KEY = 'tiem-nha-minh:settings:v1';
export function sanitizePreferences(value: unknown): Readonly<GamePreferences> {
  const input = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  const bool = (key: keyof GamePreferences): boolean => typeof input[key] === 'boolean' ? input[key] as boolean : DEFAULT_PREFERENCES[key] as boolean;
  const number = (key: keyof GamePreferences, min: number, max: number): number => typeof input[key] === 'number' && Number.isFinite(input[key]) ? Math.max(min, Math.min(max, input[key] as number)) : DEFAULT_PREFERENCES[key] as number;
  return Object.freeze({ masterEnabled: bool('masterEnabled'), musicEnabled: bool('musicEnabled'), sfxEnabled: bool('sfxEnabled'), reducedMotion: bool('reducedMotion'), masterVolume: number('masterVolume', 0, 1), musicVolume: number('musicVolume', 0, 1), sfxVolume: number('sfxVolume', 0, 1), lookSensitivity: number('lookSensitivity', 0.25, 2.5) });
}
export class Preferences {
  private current: Readonly<GamePreferences> = DEFAULT_PREFERENCES;
  private readonly listeners = new Set<(settings: Readonly<GamePreferences>) => void>();
  private readonly storage?: SaveStorage;
  constructor(storage?: SaveStorage) {
    this.storage = storage;
    try { const raw = storage?.getItem(KEY); if (raw) this.current = sanitizePreferences(JSON.parse(raw)); } catch { /* In-memory settings remain usable in private browsing. */ }
  }
  get snapshot(): Readonly<GamePreferences> { return this.current; }
  configure(patch: Partial<GamePreferences>): void {
    this.current = sanitizePreferences({ ...this.current, ...patch });
    try { this.storage?.setItem(KEY, JSON.stringify(this.current)); } catch { /* Audio and controls still update if saving is unavailable. */ }
    for (const listener of this.listeners) listener(this.current);
  }
  onChange(listener: (settings: Readonly<GamePreferences>) => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
}
function browserStorage(): SaveStorage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; } catch { return undefined; }
}
export const preferences = new Preferences(browserStorage());
