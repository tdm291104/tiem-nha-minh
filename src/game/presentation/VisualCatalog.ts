import type { ProductId } from '../products/Product.ts';
import type { Facing, Emotion } from './PresentationRules.ts';
import { clampedRatio } from './PresentationRules.ts';

export type ProductVisualType = 'noodle-packet' | 'drink-can' | 'milk-carton' | 'cookie-box' | 'sauce-bottle';
export type ShelfDisplayStyle = 'retail' | 'refrigerated';
const PRODUCT_VISUALS: Readonly<Record<ProductId, ProductVisualType>> = {
  instant_noodles: 'noodle-packet', soft_drink: 'drink-can', milk: 'milk-carton', cookies: 'cookie-box', fish_sauce: 'sauce-bottle',
};
export function productVisualType(id: ProductId): ProductVisualType { return PRODUCT_VISUALS[id]; }
export function shelfDisplayStyle(id: ProductId): ShelfDisplayStyle { return id === 'milk' || id === 'soft_drink' ? 'refrigerated' : 'retail'; }
export const VISUAL_SCALE = {
  characterHeight: 72, headHeight: 21, characterWidth: 32,
  productTexture: 48, heldProduct: 25, shelfProduct: 18,
  shelfRise: 58, counterRise: 27, crateRise: 19,
  shelfRows: 3, shelfColumns: 5,
} as const;
/** A ground-plane baseline, independent of artwork height and collider transforms. */
export function groundDepth(y: number, offset = 0): number { return Number.isFinite(y + offset) ? y + offset : 0; }
export function stockDensity(stock: number, capacity: number, slots = VISUAL_SCALE.shelfRows * VISUAL_SCALE.shelfColumns): number {
  if (!Number.isSafeInteger(slots) || slots <= 0) return 0;
  return Math.ceil(clampedRatio(stock, capacity) * slots);
}
export function directionalVisualKeys(key: string, facing: Facing, emotion: Emotion) {
  return { head: `${key}-head-${facing}-${emotion}`, torso: `${key}-torso-${facing}`, legs: `${key}-leg-${facing}`, arm: `${key}-arm-${facing}`, accessory: `${key}-detail-${facing}` };
}
