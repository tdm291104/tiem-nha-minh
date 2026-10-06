export const THEME = {
  colors: {
    floor: 0xece5d6, tile: 0xcfc5b4, warehouse: 0xd8cfbb,
    paper: 0xfff7df, ink: 0x3f483f, muted: 0x7a8170, green: 0x738475,
    greenSoft: 0xe0e6d9, amber: 0xc7a873, amberSoft: 0xefe0bc,
    warning: 0xa96655, warningSoft: 0xeeddd1, wood: 0xbda080, woodDark: 0x876c53,
    shelf: 0x9caa9b, shelfSlot: 0xdde0d1, shadow: 0x413c36,
    skin: 0xd7a980, hair: 0x413c36, blush: 0xc98c78, silver: 0xb9b5a7,
    blue: 0x668990, orange: 0xbc8169, blueSoft: 0xd7e4e4, orangeSoft: 0xf0d9c6,
    wall: 0xf3eee3, wallShade: 0xd8cdbb, metal: 0x879487, metalDark: 0x5f6e64,
    ceramicLight: 0xf4efe5, woodLight: 0xd6b993, glass: 0xc4d8d3, glassDark: 0x647f7b,
    trousers: 0x535e59, shoe: 0x665849, apron: 0xe8dac1, skinShade: 0xbd8a64,
    labelRed: 0xb0644f, labelBlue: 0x7296ac, noodle: 0xc88753, biscuit: 0xd4b174, liquid: 0x95643e,
    customerPalette: [0xa39b8d, 0x8a9a85, 0x7b8c9b, 0xc09a77, 0x967c76],
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
