import type Phaser from 'phaser';
import { AudioManager } from './AudioManager';
import { SynthAudioBackend } from './SynthAudioBackend';
import { preferences } from '../settings/Preferences';
import { VISUAL_SETTINGS } from '../presentation/VisualTheme';
export function createSceneAudio(scene: Phaser.Scene): AudioManager {
  const backend = new SynthAudioBackend();
  const audio = new AudioManager(backend, preferences.snapshot);
  VISUAL_SETTINGS.reducedMotion = preferences.snapshot.reducedMotion;
  const unsubscribe = preferences.onChange(settings => { audio.configure(settings); audio.playMusic('tiem-theme'); VISUAL_SETTINGS.reducedMotion = settings.reducedMotion; });
  audio.playMusic('tiem-theme');
  scene.events.once('shutdown', () => { unsubscribe(); audio.shutdown(); });
  return audio;
}
