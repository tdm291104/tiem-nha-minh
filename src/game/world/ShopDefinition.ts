import { THEME } from '../presentation/VisualTheme.ts';
import type { ProductId } from '../products/Product.ts';
import type { Position } from '../types/game.ts';

interface ShelfPlacement extends Position { id: string; productId: ProductId; initialStock: number }
interface CratePlacement extends Position { id: string; productId: ProductId }

export const SHELF_SIZE = { width: 125, height: 122, standingOffsetY: 86 };
export const CRATE_SIZE = { width: 88, height: 68, standingOffsetY: 52 };

export const SHOP = {
  supplierTerminal: { x: 80, y: 470, width: 70, height: 50, interactionPosition: { x: 80, y: 525 } },
  spawns: [{ x: 450, y: 735 }, { x: 550, y: 735 }],
  customerSpawn: { x: 500, y: 890 },
  customerEntrance: { x: 500, y: 830 },
  customerExit: { x: 500, y: 890 },
  checkoutWaitingPositions: [{ x: 350, y: 850 }, { x: 425, y: 850 }, { x: 500, y: 850 }, { x: 575, y: 850 }, { x: 650, y: 850 }],
  walls: [
    { x: 12, y: 470, width: 24, height: 940, color: THEME.colors.green },
    { x: 988, y: 470, width: 24, height: 940, color: THEME.colors.green },
    { x: 500, y: 12, width: 1000, height: 24, color: THEME.colors.green },
    { x: 500, y: 928, width: 1000, height: 24, color: THEME.colors.green },
    { x: 205, y: 220, width: 362, height: 18, color: THEME.colors.muted },
    { x: 795, y: 220, width: 362, height: 18, color: THEME.colors.muted },
  ],
  counters: [
    { id: 'cashier-1', x: 195, y: 770, width: 160, height: 78, number: 1, interactionPosition: { x: 195, y: 850 }, queuePositions: [{ x: 195, y: 690 }, { x: 285, y: 690 }, { x: 375, y: 690 }, { x: 465, y: 690 }] },
    { id: 'cashier-2', x: 805, y: 770, width: 160, height: 78, number: 2, interactionPosition: { x: 805, y: 850 }, queuePositions: [{ x: 805, y: 690 }, { x: 715, y: 690 }, { x: 625, y: 690 }, { x: 535, y: 690 }] },
  ],
  shelves: [
    { id: 'shelf-noodles', x: 190, y: 355, productId: 'instant_noodles', initialStock: 5 },
    { id: 'shelf-drink', x: 810, y: 355, productId: 'soft_drink', initialStock: 5 },
    { id: 'shelf-milk', x: 500, y: 355, productId: 'milk', initialStock: 5 },
    { id: 'shelf-cookies', x: 190, y: 555, productId: 'cookies', initialStock: 5 },
    { id: 'shelf-sauce', x: 810, y: 555, productId: 'fish_sauce', initialStock: 5 },
  ] satisfies ShelfPlacement[],
  crates: [
    { id: 'crate-noodles', x: 140, y: 130, productId: 'instant_noodles' },
    { id: 'crate-drink', x: 310, y: 130, productId: 'soft_drink' },
    { id: 'crate-milk', x: 500, y: 130, productId: 'milk' },
    { id: 'crate-cookies', x: 690, y: 130, productId: 'cookies' },
    { id: 'crate-sauce', x: 860, y: 130, productId: 'fish_sauce' },
  ] satisfies CratePlacement[],
};
