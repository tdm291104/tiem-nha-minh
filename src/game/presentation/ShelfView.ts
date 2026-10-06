import Phaser from 'phaser';
import type { ProductId } from '../products/Product';
import { getProduct } from '../products/ProductCatalog';
import { formatVnd } from '../economy/Money';
import { THEME_TEXT, THEME, cssColor } from './VisualTheme';
import { shelfDisplayStyle, stockDensity, VISUAL_SCALE } from './VisualCatalog';
import { FURNITURE_TEXTURE } from './FurnitureTextures';

export class ShelfView extends Phaser.GameObjects.Container {
  private readonly packages: Phaser.GameObjects.Image[] = [];
  private readonly quantity: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene, productId: ProductId) {
    super(scene); scene.add.existing(this);
    const refrigerated = shelfDisplayStyle(productId) === 'refrigerated';
    const body = scene.add.image(0, 0, refrigerated ? 'furniture-fridge' : 'furniture-shelf').setOrigin(0.5, FURNITURE_TEXTURE.shelf.originY);
    this.add(body);
    for (let row = 0; row < VISUAL_SCALE.shelfRows; row++) for (let col = 0; col < VISUAL_SCALE.shelfColumns; col++) {
      const icon = scene.add.image(-45 + col * 22, -86 + row * 44, `product-${productId}`).setDisplaySize(VISUAL_SCALE.shelfProduct, VISUAL_SCALE.shelfProduct);
      this.packages.push(icon); this.add(icon);
    }
    if (refrigerated) this.add(scene.add.image(0, 0, 'furniture-fridge-glass').setOrigin(0.5, FURNITURE_TEXTURE.shelf.originY));
    const product = getProduct(productId);
    const name = scene.add.text(0, -126, product.name, { ...THEME_TEXT, fontSize: '13px', fontStyle: 'bold', backgroundColor: cssColor(THEME.colors.paper), padding: { x: 5, y: 3 } }).setOrigin(0.5, 1);
    const price = scene.add.text(-37, 27, formatVnd(product.sellPrice), { ...THEME_TEXT, fontSize: '10px', color: cssColor(THEME.colors.woodDark) }).setOrigin(0.5);
    this.quantity = scene.add.text(20, 36, '', { ...THEME_TEXT, fontSize: '12px', fontStyle: 'bold' }).setOrigin(0.5);
    this.add([name, price, this.quantity]);
  }
  setStock(stock: number, capacity: number): void {
    const visible = stockDensity(stock, capacity, this.packages.length);
    // Spread low stock across levels instead of filling one solid rectangle.
    this.packages.forEach((icon, index) => { const row = Math.floor(index / 5), col = index % 5; icon.setVisible(col * 3 + row < visible); });
    this.quantity.setText(`${stock} / ${capacity}`);
  }
}
