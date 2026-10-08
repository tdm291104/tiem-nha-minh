export const THEME = {
  colors: {
    floor: 0xffefda, tile: 0xe8d6bc, warehouse: 0xf0d7ae,
    paper: 0xfff7df, ink: 0x354c47, muted: 0x72887b, green: 0x54ab86,
    greenSoft: 0xd6f0d9, amber: 0xf4c45b, amberSoft: 0xffe4a3,
    warning: 0xda775e, warningSoft: 0xffe0cd, wood: 0xd3a579, woodDark: 0x94704f,
    shelf: 0x9caa9b, shelfSlot: 0xdde0d1, shadow: 0x413c36,
    skin: 0xd7a980, hair: 0x413c36, blush: 0xc98c78, silver: 0xb9b5a7,
    blue: 0x3999c3, orange: 0xee9671, blueSoft: 0xd7eff6, orangeSoft: 0xffe0cd,
    wall: 0xfff8e9, wallShade: 0xe9d9bb, metal: 0x9bbdad, metalDark: 0x577d75,
    ceramicLight: 0xf4efe5, woodLight: 0xd6b993, glass: 0xc4d8d3, glassDark: 0x647f7b,
    trousers: 0x535e59, shoe: 0x665849, apron: 0xe8dac1, skinShade: 0xbd8a64,
    labelRed: 0xe77b61, labelBlue: 0x74b9d9, noodle: 0xe8a44e, biscuit: 0xf0c35e, liquid: 0x95643e,
    customerPalette: [0xc4a681, 0x83bd8c, 0x76a8d3, 0xe7ac65, 0xc498b1],
  },
  radius: { small: 6, panel: 14, bubble: 12 },
  outline: 2,
  shadowOpacity: 0.12,
  spacing: { small: 6, medium: 12, large: 24 },
  typography: { fontFamily: 'Trebuchet MS, Arial, sans-serif', small: 12, body: 16, heading: 24, title: 30 },
  motion: { effectMs: 650, popMs: 150, bannerMs: 2000, walkRate: 10, sprintRate: 15, bob: 0.85, sprintBob: 1.4 },
} as const;

export const VISUAL_SETTINGS = { reducedMotion: false };
export function cssColor(color: number): string { return `#${color.toString(16).padStart(6, '0')}`; }
export const THEME_TEXT = { fontFamily: THEME.typography.fontFamily, color: cssColor(THEME.colors.ink) };
