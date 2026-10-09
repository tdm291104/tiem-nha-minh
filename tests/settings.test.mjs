import test from 'node:test';
import assert from 'node:assert/strict';
import { Preferences, DEFAULT_PREFERENCES, sanitizePreferences } from '../src/game/settings/Preferences.ts';
import { AudioManager } from '../src/game/audio/AudioManager.ts';
test('settings have audible defaults and existing camera input sensitivity', () => {
  const settings = new Preferences().snapshot; assert.equal(settings.lookSensitivity, 1); assert.equal(settings.reducedMotion, false); assert.ok(settings.musicVolume > 0); assert.ok(Object.isFrozen(settings));
});
test('preferences clamp volume and look sensitivity while ignoring invalid booleans', () => {
  const settings = sanitizePreferences({ masterVolume: -1, musicVolume: 5, sfxVolume: NaN, lookSensitivity: 100, reducedMotion: 'false' });
  assert.equal(settings.masterVolume, 0); assert.equal(settings.musicVolume, 1); assert.equal(settings.sfxVolume, DEFAULT_PREFERENCES.sfxVolume); assert.equal(settings.lookSensitivity, 2.5); assert.equal(settings.reducedMotion, false);
});
test('preferences roundtrip without resetting unrelated fields', () => {
  let raw = null; const storage = { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
  const preferences = new Preferences(storage); preferences.configure({ musicEnabled: false, lookSensitivity: 0.5, reducedMotion: true });
  assert.deepEqual(new Preferences(storage).snapshot, preferences.snapshot); assert.equal(preferences.snapshot.sfxEnabled, true);
});
test('corrupt and blocked preference storage preserve usable defaults', () => {
  const corrupt = new Preferences({ getItem: () => '{no', setItem: () => { throw new Error('Blocked'); } }); assert.deepEqual(corrupt.snapshot, DEFAULT_PREFERENCES);
  corrupt.configure({ masterEnabled: false }); assert.equal(corrupt.snapshot.masterEnabled, false);
});
test('settings observers unsubscribe cleanly', () => {
  const prefs = new Preferences(), events = []; const off = prefs.onChange(value => events.push(value)); prefs.configure({ sfxEnabled: false }); off(); prefs.configure({ sfxEnabled: true }); assert.equal(events.length, 1);
});
test('audio combines master and category volume without changing gameplay', () => {
  const played = [], audio = new AudioManager({ has: () => true, play: (key, volume) => played.push([key, volume]) }); audio.configure({ masterVolume: 0.5, sfxVolume: 0.4, musicVolume: 0.2 });
  audio.play('PICKUP'); audio.playMusic('music'); assert.deepEqual(played, [['sfx-pickup', 0.2], ['music', 0.1]]);
});
test('zero volume and disabled category suppress playback', () => {
  let calls = 0; const audio = new AudioManager({ has: () => true, play: () => calls++ }); audio.configure({ masterVolume: 0 }); assert.equal(audio.play('PICKUP'), false);
  audio.configure({ masterVolume: 1, musicEnabled: false }); assert.equal(audio.playMusic('music'), false); assert.equal(calls, 0);
});
test('invalid audio volume clamps safely and backend lifecycle is called', () => {
  let stopped = 0, configured = 0; const audio = new AudioManager({ has: () => false, play: () => {}, configure: () => configured++, shutdown: () => stopped++ });
  audio.configure({ masterVolume: 3, musicVolume: -2, sfxVolume: NaN }); assert.equal(audio.settings.masterVolume, 1); assert.equal(audio.settings.musicVolume, 0); assert.equal(audio.settings.sfxVolume, 0);
  audio.shutdown(); assert.equal(stopped, 1); assert.ok(configured >= 2);
});
test('throwing audio backend configuration and shutdown never crash the game', () => {
  const audio = new AudioManager({ has: () => true, play: () => {}, configure: () => { throw new Error('unavailable'); }, shutdown: () => { throw new Error('closed'); } });
  assert.doesNotThrow(() => audio.configure({ masterEnabled: false })); assert.doesNotThrow(() => audio.shutdown());
});
