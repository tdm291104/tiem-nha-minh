import { THEME } from './VisualTheme.ts';
export interface CharacterStyle { readonly identity: 'male' | 'female'; readonly hairstyle: 'short' | 'ponytail' | 'bob'; readonly apron: boolean; readonly build: number; readonly key: string; readonly shirt: number; readonly hair: number; readonly accessory: 'apron' | 'headband' | 'glasses' | 'cap' | 'tie' | 'bag' | 'none' }
export const PLAYER_STYLES: readonly CharacterStyle[] = [
  { identity: 'male', hairstyle: 'short', apron: true, build: 1, key: 'player-1', shirt: THEME.colors.blue, hair: THEME.colors.hair, accessory: 'apron' },
  { identity: 'female', hairstyle: 'ponytail', apron: true, build: 0.94, key: 'player-2', shirt: THEME.colors.orange, hair: THEME.colors.hair, accessory: 'headband' },
];
export const CUSTOMER_ARCHETYPES: readonly CharacterStyle[] = [
  { identity: 'male', hairstyle: 'short', apron: false, build: 0.96, key: 'customer-0', shirt: THEME.colors.customerPalette[0], hair: THEME.colors.silver, accessory: 'glasses' },
  { identity: 'female', hairstyle: 'ponytail', apron: false, build: 0.93, key: 'customer-1', shirt: THEME.colors.customerPalette[1], hair: THEME.colors.hair, accessory: 'cap' },
  { identity: 'male', hairstyle: 'short', apron: false, build: 1, key: 'customer-2', shirt: THEME.colors.customerPalette[2], hair: THEME.colors.hair, accessory: 'tie' },
  { identity: 'female', hairstyle: 'bob', apron: false, build: 0.96, key: 'customer-3', shirt: THEME.colors.customerPalette[3], hair: THEME.colors.hair, accessory: 'bag' },
  { identity: 'male', hairstyle: 'short', apron: false, build: 1.04, key: 'customer-4', shirt: THEME.colors.customerPalette[4], hair: THEME.colors.hair, accessory: 'none' },
];
export function customerArchetype(index: number): CharacterStyle {
  if (!Number.isSafeInteger(index)) throw new RangeError('Archetype index must be an integer');
  const style = CUSTOMER_ARCHETYPES[((index % CUSTOMER_ARCHETYPES.length) + CUSTOMER_ARCHETYPES.length) % CUSTOMER_ARCHETYPES.length];
  if (!style) throw new Error('Customer archetypes are missing');
  return style;
}
