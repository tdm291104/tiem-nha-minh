import test from 'node:test';
import assert from 'node:assert/strict';
import { UI, HUD_LAYOUT, uiRatio } from '../src/game/ui/UiTheme.ts';
const luminance = color => {
  const channels = [16, 8, 0].map(shift => ((color >> shift) & 255) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
for (const surface of ['paper', 'white', 'sand', 'mint', 'coralSoft']) test(`UI text is readable on ${surface}`, () => {
  for (const foreground of ['ink', 'muted', 'error']) assert.ok(contrast(UI.colors[foreground], UI.colors[surface]) >= 4.5, `${foreground} on ${surface}`);
});
test('primary button and both player keycaps meet text contrast', () => {
  for (const color of ['green', 'greenHover', 'blue', 'orange']) assert.ok(contrast(UI.colors.white, UI.colors[color]) >= 4.5, color);
});
test('all fixed HUD panels fit existing 1100 by 800 canvas', () => {
  for (const rect of Object.values(HUD_LAYOUT)) assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= 1100 && rect.y + rect.height <= 800);
});
test('co-op player panels and dock remain separated', () => {
  const p = HUD_LAYOUT.player;
  assert.ok(p.x + p.width < p.x + p.gap);
  assert.ok(p.x + p.gap + p.width < HUD_LAYOUT.dock.x);
});
test('primary HUD panels do not overlap', () => {
  assert.ok(HUD_LAYOUT.day.x + HUD_LAYOUT.day.width < HUD_LAYOUT.goal.x);
  assert.ok(HUD_LAYOUT.goal.x + HUD_LAYOUT.goal.width < HUD_LAYOUT.money.x);
});
test('display progress reflects zero, half, goal and excess', () => {
  assert.equal(uiRatio(0, 50000), 0); assert.equal(uiRatio(25000, 50000), 0.5);
  assert.equal(uiRatio(50000, 50000), 1); assert.equal(uiRatio(60000, 50000), 1);
});
test('display progress safely rejects invalid denominators and nonfinite values', () => {
  assert.equal(uiRatio(4, 0), 0); assert.equal(uiRatio(4, -1), 0); assert.equal(uiRatio(NaN, 5), 0); assert.equal(uiRatio(Infinity, 5), 0); assert.equal(uiRatio(4, Infinity), 0);
});
test('display progress clamps negative values without changing domain quantities', () => { assert.equal(uiRatio(-5, 10), 0); });
