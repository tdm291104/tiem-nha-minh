export type ProductId = 'instant_noodles' | 'soft_drink' | 'milk' | 'cookies' | 'fish_sauce';

export interface Product {
  readonly id: ProductId;
  readonly name: string;
  readonly category: 'food' | 'drink' | 'seasoning';
  readonly placeholderColor: number;
  readonly placeholderShape: 'packet' | 'can' | 'carton' | 'box' | 'bottle';
  readonly maxStack: number;
  readonly buyPrice: number;
  readonly sellPrice: number;
}

export interface ProductStack {
  readonly productId: ProductId;
  readonly quantity: number;
}
