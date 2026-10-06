import test from 'node:test';
import assert from 'node:assert/strict';
import { productVisualType, shelfDisplayStyle, VISUAL_SCALE, groundDepth, stockDensity, directionalVisualKeys } from '../src/game/presentation/VisualCatalog.ts';
import { PLAYER_STYLES, CUSTOMER_ARCHETYPES } from '../src/game/presentation/CharacterStyles.ts';
import { THEME, VISUAL_SETTINGS } from '../src/game/presentation/VisualTheme.ts';
import { entranceLabel, motionPolicy, facingFromMovement } from '../src/game/presentation/PresentationRules.ts';
import { PRODUCTS } from '../src/game/products/ProductCatalog.ts';
import { SHOP, SHELF_SIZE, CRATE_SIZE } from '../src/game/world/ShopDefinition.ts';

const expected = { instant_noodles: 'noodle-packet', soft_drink: 'drink-can', milk: 'milk-carton', cookies: 'cookie-box', fish_sauce: 'sauce-bottle' };
for (const [id, type] of Object.entries(expected)) {
  test(`product ${id} maps to recognizable generic ${type} artwork`, () => assert.equal(productVisualType(id), type));
}
test('every catalog product has a unique visual mapping without adding products', () => {
  assert.equal(Object.keys(PRODUCTS).length, 5);
  assert.equal(new Set(Object.keys(PRODUCTS).map(productVisualType)).size, 5);
});
test('dry grocery products use retail shelving', () => {
  for (const id of ['instant_noodles', 'cookies', 'fish_sauce']) assert.equal(shelfDisplayStyle(id), 'retail');
});
test('milk and soft drinks use refrigerator presentation on the same shelf model', () => {
  assert.equal(shelfDisplayStyle('milk'), 'refrigerated'); assert.equal(shelfDisplayStyle('soft_drink'), 'refrigerated');
});
test('P1 is a short-haired male shopkeeper in an apron', () => {
  assert.equal(PLAYER_STYLES[0].identity, 'male'); assert.equal(PLAYER_STYLES[0].hairstyle, 'short'); assert.equal(PLAYER_STYLES[0].apron, true);
});
test('P2 is a female shopkeeper with a ponytail and apron', () => {
  assert.equal(PLAYER_STYLES[1].identity, 'female'); assert.equal(PLAYER_STYLES[1].hairstyle, 'ponytail'); assert.equal(PLAYER_STYLES[1].apron, true);
  assert.notEqual(PLAYER_STYLES[0].shirt, PLAYER_STYLES[1].shirt);
});
test('five customer styles use the same modest body-scale range', () => {
  assert.equal(CUSTOMER_ARCHETYPES.length, 5);
  for (const style of [...PLAYER_STYLES, ...CUSTOMER_ARCHETYPES]) assert.ok(style.build >= 0.9 && style.build <= 1.1);
});
for (const facing of ['UP', 'DOWN', 'LEFT', 'RIGHT']) {
  test(`directional ${facing} uses intentional head body legs and accessory keys`, () => {
    const keys = directionalVisualKeys('player-2', facing, 'HAPPY');
    assert.equal(keys.head, `player-2-head-${facing}-HAPPY`);
    for (const part of ['torso', 'legs', 'arm', 'accessory']) assert.ok(keys[part].endsWith(`-${facing}`));
  });
}
test('focused expression changes only the head mapping, never facing or geometry', () => {
  const neutral = directionalVisualKeys('player-1', 'LEFT', 'NEUTRAL'), focused = directionalVisualKeys('player-1', 'LEFT', 'FOCUSED');
  assert.notEqual(neutral.head, focused.head); assert.equal(neutral.torso, focused.torso); assert.equal(neutral.legs, focused.legs);
});
test('visual scale is finite positive and semi-chibi rather than giant-headed', () => {
  for (const value of Object.values(VISUAL_SCALE)) assert.ok(Number.isFinite(value) && value > 0);
  const headRatio = VISUAL_SCALE.headHeight / VISUAL_SCALE.characterHeight;
  assert.ok(headRatio >= 0.25 && headRatio <= 0.3);
  assert.ok(VISUAL_SCALE.heldProduct < VISUAL_SCALE.characterWidth);
  assert.ok(VISUAL_SCALE.shelfRise + SHELF_SIZE.height > VISUAL_SCALE.characterHeight);
  assert.equal(VISUAL_SCALE.shelfRows * VISUAL_SCALE.shelfColumns, 15);
});
test('depth depends on floor baseline and places actors behind/above and in front/below', () => {
  const shelfDepth = groundDepth(355, SHELF_SIZE.height / 2);
  assert.ok(groundDepth(270) < shelfDepth); assert.ok(groundDepth(441) > shelfDepth);
  assert.equal(groundDepth(100, 34), 134); assert.equal(groundDepth(Infinity), 0);
});
test('shelf density is empty sparse half full and bounded to decorative slots', () => {
  assert.deepEqual([0, 5, 10, 20].map(stock => stockDensity(stock, 20)), [0, 4, 8, 15]);
  assert.equal(stockDensity(1000, 20), 15); assert.equal(stockDensity(-5, 20), 0);
  assert.equal(stockDensity(1, 0), 0); assert.equal(stockDensity(1, 20, -1), 0); assert.equal(stockDensity(20, 20, 6), 6);
});
test('entrance presentation follows authoritative day state', () => {
  assert.deepEqual(['PREPARATION', 'OPEN', 'CLOSING', 'SUMMARY'].map(entranceLabel), ['CHƯA MỞ CỬA', 'MỞ CỬA', 'ĐÃ ĐÓNG CỬA', 'ĐÃ ĐÓNG CỬA']);
});
test('theme has all material and product colors as valid RGB integers', () => {
  for (const key of ['wall', 'wallShade', 'floor', 'tile', 'paper', 'wood', 'woodDark', 'woodLight', 'metal', 'metalDark', 'glass', 'glassDark', 'skin', 'skinShade', 'apron', 'trousers', 'shoe', 'labelRed', 'labelBlue', 'noodle', 'biscuit', 'liquid']) {
    assert.ok(Number.isInteger(THEME.colors[key]) && THEME.colors[key] >= 0 && THEME.colors[key] <= 0xffffff, key);
  }
  assert.ok(THEME.shadowOpacity > 0 && THEME.shadowOpacity < 0.2);
});
test('reduced motion still disables bob secondary motion policy and feedback movement', () => {
  assert.equal(VISUAL_SETTINGS.reducedMotion, false);
  assert.deepEqual(motionPolicy(true), { bob: false, popScale: 1, floatDistance: 0, shake: false });
  assert.equal(facingFromMovement(1, 0, 'DOWN'), 'RIGHT'); // Direction does not depend on animation settings.
});
test('redesign leaves layout topology, footprints, quantities, and prices unchanged', () => {
  assert.deepEqual(SHELF_SIZE, { width: 125, height: 122, standingOffsetY: 86 });
  assert.deepEqual(CRATE_SIZE, { width: 88, height: 68, standingOffsetY: 52 });
  assert.deepEqual(SHOP.shelves.map(shelf => [shelf.x, shelf.y, shelf.initialStock]), [[190, 355, 5], [810, 355, 5], [500, 355, 5], [190, 555, 5], [810, 555, 5]]);
  assert.deepEqual(Object.values(PRODUCTS).map(product => [product.buyPrice, product.sellPrice]), [[3000, 5000], [6000, 10000], [8000, 12000], [9000, 15000], [15000, 25000]]);
});
