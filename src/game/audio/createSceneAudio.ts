import type Phaser from 'phaser';
import { AudioManager } from './AudioManager';
export function createSceneAudio(scene: Phaser.Scene): AudioManager {
  const audio = new AudioManager({ has: key => scene.cache.audio.exists(key), play: key => { scene.sound.play(key); } });
  scene.events.once('shutdown', () => audio.shutdown());
  return audio;
}
