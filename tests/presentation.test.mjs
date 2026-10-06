import test from 'node:test';
import assert from 'node:assert/strict';
import { facingFromMovement, clampedRatio, motionPolicy, entranceLabel, heldItemOffset, GoalFeedbackLatch } from '../src/game/presentation/PresentationRules.ts';
import { customerArchetype, CUSTOMER_ARCHETYPES, PLAYER_STYLES } from '../src/game/presentation/CharacterStyles.ts';
import { THEME, VISUAL_SETTINGS, cssColor } from '../src/game/presentation/VisualTheme.ts';
import { AudioManager, SOUND_EVENTS } from '../src/game/audio/AudioManager.ts';
import { formatVnd } from '../src/game/economy/Money.ts';
import { CashierStation } from '../src/game/checkout/CashierStation.ts';
import { DayManager } from '../src/game/day/DayManager.ts';
import { StoreEconomy } from '../src/game/economy/StoreEconomy.ts';
import { createSale } from '../src/game/checkout/SaleTransaction.ts';

for (const [x, y, expected] of [[0, -1, 'UP'], [0, 1, 'DOWN'], [-1, 0, 'LEFT'], [1, 0, 'RIGHT']]) {
  test(`facing follows movement ${expected}`, () => assert.equal(facingFromMovement(x, y, 'DOWN'), expected));
}
test('idle and insignificant movement preserve last facing', () => {
  for (const facing of ['UP', 'DOWN', 'LEFT', 'RIGHT']) {
    assert.equal(facingFromMovement(0, 0, facing), facing);
    assert.equal(facingFromMovement(0.0001, 0, facing), facing);
  }
});
test('dominant axis chooses direction with deterministic diagonal tie', () => {
  assert.equal(facingFromMovement(-2, 1, 'DOWN'), 'LEFT');
  assert.equal(facingFromMovement(1, -2, 'DOWN'), 'UP');
  assert.equal(facingFromMovement(1, 1, 'LEFT'), 'DOWN');
});
test('invalid visual movement preserves facing rather than corrupting state', () => {
  assert.equal(facingFromMovement(NaN, 1, 'UP'), 'UP'); assert.equal(facingFromMovement(1, Infinity, 'LEFT'), 'LEFT');
});
test('indexed customer archetypes are deterministic and cycle through every variant', () => {
  for (let index = 0; index < 15; index++) assert.equal(customerArchetype(index), CUSTOMER_ARCHETYPES[index % 5]);
  assert.equal(customerArchetype(-1), CUSTOMER_ARCHETYPES[4]);
  assert.equal(new Set(CUSTOMER_ARCHETYPES.map(style => style.key)).size, 5);
});
test('invalid archetype indices fail explicitly', () => {
  for (const value of [0.5, NaN, Infinity]) assert.throws(() => customerArchetype(value), RangeError);
});
test('players differ in accessory and silhouette as well as color', () => {
  assert.notEqual(PLAYER_STYLES[0].shirt, PLAYER_STYLES[1].shirt);
  assert.equal(PLAYER_STYLES[0].accessory, 'apron'); assert.equal(PLAYER_STYLES[1].accessory, 'headband');
});
for (const [stock, expected] of [[0, 0], [10, 0.5], [20, 1]]) {
  test(`shelf visual ratio ${stock}/20`, () => assert.equal(clampedRatio(stock, 20), expected));
}
test('stock and progress ratios clamp overflow and invalid denominators', () => {
  assert.equal(clampedRatio(-5, 20), 0); assert.equal(clampedRatio(25, 20), 1);
  for (const max of [0, -1, NaN, Infinity]) assert.equal(clampedRatio(10, max), 0);
  assert.equal(clampedRatio(NaN, 20), 0);
});
test('checkout visual progress reads the real processing duration', () => {
  const station = new CashierStation({ id: 'cashier', number: 1, x: 0, y: 0, width: 10, height: 10, interactionPosition: { x: 0, y: 20 }, queuePositions: [{ x: 0, y: -20 }] }, 1);
  station.queue.join(1); station.markReady(1);
  const sale = createSale({ id: 'sale', customerId: 1, cashierId: 'cashier', playerId: 1, gameTimeMs: 0 }, [{ productId: 'instant_noodles', quantity: 1 }]);
  station.start(sale, 1000);
  assert.equal(clampedRatio(station.progress, 1), 0);
  station.update(500); assert.equal(clampedRatio(station.progress, 1), 0.5);
  assert.equal(station.update(500).id, 'sale');
  assert.equal(station.progress, 0); // The station clears its finished job synchronously.
  assert.equal(clampedRatio(1, 1), 1);
});
test('goal feedback triggers once per day including repeated completion events', () => {
  const latch = new GoalFeedbackLatch();
  assert.equal(latch.observe(1, false), false); assert.equal(latch.observe(1, true), true);
  assert.equal(latch.observe(1, true), false); assert.equal(latch.observe(1, false), false);
  assert.equal(latch.observe(1, true), false); assert.equal(latch.observe(2, false), false);
  assert.equal(latch.observe(2, true), true); assert.equal(latch.observe(2, true), false);
});
test('goal presentation uses authoritative real daily revenue and resets next day', () => {
  const economy = new StoreEconomy(), day = new DayManager(economy, { openDurationMs: 1, day1Goal: 5000, goalIncreasePerDay: 2500 });
  const latch = new GoalFeedbackLatch(); assert.equal(day.goalAchieved, false);
  economy.commit(createSale({ id: 'one', customerId: 1, cashierId: 'cashier', playerId: 2, gameTimeMs: 0 }, [{ productId: 'instant_noodles', quantity: 1 }]));
  assert.equal(day.goalAchieved, true); assert.equal(latch.observe(day.currentDay, day.goalAchieved), true);
  assert.equal(latch.observe(day.currentDay, day.goalAchieved), false);
  day.startDay(); day.update(1); day.finishClosing({ activeCustomers: 0, checkoutProcessing: false, activeDelivery: false }); day.nextDay(1);
  assert.equal(day.goalAchieved, false); assert.equal(latch.observe(day.currentDay, day.goalAchieved), false);
});
test('reduced motion disables bob pop shake and upward movement', () => {
  assert.deepEqual(motionPolicy(true), { bob: false, popScale: 1, floatDistance: 0, shake: false });
  assert.equal(VISUAL_SETTINGS.reducedMotion, false);
});
test('normal motion uses subtle bounded scale and floating movement', () => {
  const policy = motionPolicy(false); assert.equal(policy.bob, true); assert.equal(policy.shake, true);
  assert.ok(policy.popScale > 1 && policy.popScale <= 1.05); assert.ok(policy.floatDistance > 0);
});
for (const [state, expected] of [['PREPARATION', 'CHƯA MỞ CỬA'], ['OPEN', 'MỞ CỬA'], ['CLOSING', 'ĐÃ ĐÓNG CỬA'], ['SUMMARY', 'ĐÃ ĐÓNG CỬA']]) {
  test(`entrance label ${state}`, () => assert.equal(entranceLabel(state), expected));
}
test('held product position respects facing and only UP goes behind', () => {
  assert.equal(heldItemOffset('UP').behind, true); assert.ok(heldItemOffset('LEFT').x < 0);
  assert.ok(heldItemOffset('RIGHT').x > 0); assert.equal(heldItemOffset('DOWN').behind, false);
});
test('audio without a backend or missing assets safely no-ops', () => {
  const empty = new AudioManager(); const missing = new AudioManager({ has: () => false, play: () => { throw new Error('must not play'); } });
  for (const event of SOUND_EVENTS) { assert.equal(empty.play(event), false); assert.equal(missing.play(event), false); }
  assert.equal(empty.playMusic('music'), false);
});
test('audio plays explicit bindings only when master and category are enabled', () => {
  const played = []; const audio = new AudioManager({ has: () => true, play: key => played.push(key) });
  audio.bind('SALE_COMPLETE', 'sale'); assert.equal(audio.play('SALE_COMPLETE'), true);
  audio.configure({ sfxEnabled: false }); assert.equal(audio.play('PICKUP'), false);
  assert.equal(audio.playMusic('music'), true); audio.configure({ musicEnabled: false }); assert.equal(audio.playMusic('music'), false);
  audio.configure({ masterEnabled: false, sfxEnabled: true }); assert.equal(audio.play('SALE_COMPLETE'), false);
  assert.deepEqual(played, ['sale', 'music']); assert.ok(Object.isFrozen(audio.settings));
});
test('audio backend errors and shutdown never break gameplay', () => {
  const audio = new AudioManager({ has: () => { throw new Error('unavailable'); }, play: () => {} });
  assert.equal(audio.play('ERROR'), false);
  const stopped = new AudioManager({ has: () => true, play: () => { throw new Error('must not play'); } });
  stopped.shutdown(); assert.equal(stopped.play('UI_CLICK'), false);
  const failed = new AudioManager({ has: () => true, play: () => { throw new Error('locked audio'); } });
  assert.equal(failed.play('STORE_OPEN'), false);
});
test('central money formatting stays Vietnamese integer VND', () => {
  assert.equal(formatVnd(100000), '100.000đ'); assert.equal(formatVnd(0), '0đ'); assert.equal(formatVnd(5000), '5.000đ');
});
test('theme converts numeric colors into padded CSS colors', () => {
  assert.equal(cssColor(15), '#00000f'); assert.equal(cssColor(THEME.colors.paper), '#fff7df');
});
