/** Interface tokens are separate from materials in the 3D shop. */
export const UI = {
  colors: {
    paper: 0xfff8ed, white: 0xfffcf5, ink: 0x243e37, muted: 0x596b60,
    green: 0x287f68, greenHover: 0x216c59, mint: 0xe0efe3,
    coral: 0xd76447, coralSoft: 0xfbe5d8, gold: 0xf1c567,
    line: 0xe5dac6, sand: 0xf3ead9, shade: 0x172f29,
    blue: 0x287d9d, orange: 0xa64b30, error: 0xa83e2d,
  },
  font: 'Trebuchet MS, Arial, sans-serif',
  radius: 16,
  button: { height: 44, radius: 10, fontSize: 15 },
} as const;
export const UI_TEXT = { fontFamily: UI.font, color: '#243e37' };
export function uiRatio(value: number, maximum: number): number {
  return Number.isFinite(value) && Number.isFinite(maximum) && maximum > 0 ? Math.min(1, Math.max(0, value / maximum)) : 0;
}
export const HUD_LAYOUT = {
  day: { x: 20, y: 20, width: 310, height: 92 },
  goal: { x: 390, y: 20, width: 320, height: 72 },
  money: { x: 860, y: 20, width: 220, height: 92 },
  player: { x: 20, y: 698, width: 245, height: 80, gap: 265 },
  dock: { x: 626, y: 698, width: 454, height: 80 },
} as const;
