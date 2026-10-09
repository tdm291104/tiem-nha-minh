import Phaser from 'phaser';
import { panelButton, modalPaper } from './PanelPrimitives';
import { cssColor } from '../presentation/VisualTheme';
import type { AudioManager } from '../audio/AudioManager';
import { PRODUCTS } from '../products/ProductCatalog';
import type { ProductId } from '../products/Product';
import type { PlayerId } from '../types/game';
import { UI, UI_TEXT } from './UiTheme';
import { formatVnd } from '../economy/Money';
import { OrderDraft } from '../supplier/OrderDraft';
import type { SupplierSystem } from '../supplier/SupplierSystem';
import { SUPPLIER } from '../supplier/SupplierConfig';

export class SupplierOrderPanel extends Phaser.GameObjects.Container {
  private draft = new OrderDraft();
  private playerId: PlayerId = 1;
  private nextDraftId = 1;
  private requestId = '';
  private readonly lineCosts = new Map<ProductId, Phaser.GameObjects.Text>();
  private readonly quantities = new Map<ProductId, Phaser.GameObjects.Text>();
  private readonly total: Phaser.GameObjects.Text;
  private readonly balance: Phaser.GameObjects.Text;
  private readonly message: Phaser.GameObjects.Text;
  private readonly heading: Phaser.GameObjects.Text;
  private readonly deliveryHint: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene, private readonly supplier: SupplierSystem, private readonly onModalChanged: (open: boolean) => void, private readonly gameTime: () => number = () => scene.time.now, private readonly audio?: AudioManager) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(4000).setVisible(false);
    scene.cameras.main.ignore(this);
    const background = modalPaper(scene, this, 175, 70, 750, 670);
    background.fillStyle(UI.colors.mint).fillRoundedRect(195, 90, 710, 92, 12);
    background.lineStyle(1, UI.colors.line).lineBetween(215, 213, 885, 213).lineBetween(215, 538, 885, 538);
    this.heading = this.text(215, 106, 'Phiếu đặt hàng', 29).setFontStyle('bold');
    this.deliveryHint = this.text(215, 149, '', 14);
    this.text(215, 193, 'Sản phẩm', 13); this.text(582, 193, 'Số lượng', 13); this.text(885, 193, 'Thành tiền', 13).setOrigin(1, 0);
    Object.values(PRODUCTS).forEach((product, index) => {
      const y = 239 + index * 60;
      background.fillStyle(index % 2 ? UI.colors.sand : UI.colors.white).fillRoundedRect(199, y - 12, 702, 56, 8);
      this.add(scene.add.image(237, y + 15, `product-${product.id}`).setDisplaySize(42, 42));
      this.text(278, y - 3, product.name, 18).setFontStyle('bold');
      this.text(278, y + 22, `${formatVnd(product.buyPrice)} / cái`, 13).setColor(cssColor(UI.colors.muted));
      this.button(577, y + 15, `-${SUPPLIER.quantityStep}`, () => this.adjust(product.id, -1));
      const quantity = this.text(641, y + 3, '0', 22).setOrigin(0.5, 0).setFontStyle('bold');
      this.quantities.set(product.id, quantity);
      this.lineCosts.set(product.id, this.text(884, y + 8, '', 17).setOrigin(1, 0));
      this.button(705, y + 15, `+${SUPPLIER.quantityStep}`, () => this.adjust(product.id, 1));
    });
    this.total = this.text(215, 554, '', 25).setFontStyle('bold');
    this.balance = this.text(215, 593, '', 15).setColor(cssColor(UI.colors.muted));
    this.message = this.text(215, 625, '', 14).setColor(cssColor(UI.colors.error)).setWordWrapWidth(650);
    panelButton(scene, this, 760, 687, 'Đặt hàng', () => this.confirm(), this.audio, false, { width: 250, height: 48, fontSize: 18 });
    panelButton(scene, this, 295, 687, 'Đóng phiếu', () => this.close(), this.audio, true, { width: 160, height: 48 });
  }
  get isOpen(): boolean { return this.visible; }
  open(playerId: PlayerId): void {
    if (this.isOpen || !this.supplier.canOrder) return;
    this.playerId = playerId; this.requestId = `${this.supplier.draftPrefix}-draft-${this.nextDraftId++}`;
    this.draft = new OrderDraft(); this.message.setText('');
    this.heading.setText(`Phiếu đặt hàng · P${playerId}`);
    this.refresh(); this.setVisible(true); this.onModalChanged(true);
  }
  close(): void { if (!this.isOpen) return; this.setVisible(false); this.onModalChanged(false); }
  private adjust(productId: ProductId, direction: -1 | 1): void {
    if (!this.isOpen) return;
    this.draft.adjust(productId, direction); this.message.setText(''); this.refresh();
  }
  private refresh(): void {
    this.deliveryHint.setText(`Giao sau ${this.supplier.deliveryTimeMs / 1000} giây · Nhận thùng tại xe ngoài cửa`);
    for (const [id, label] of this.quantities) label.setText(String(this.draft.getQuantity(id)));
    for (const [id, label] of this.lineCosts) label.setText(formatVnd(PRODUCTS[id].buyPrice * this.draft.getQuantity(id)));
    this.total.setText(`Tổng: ${formatVnd(this.draft.totalCost)}`);
    this.balance.setText(`Tiền hiện có: ${formatVnd(this.supplier.economy.money)}`);
    this.total.setColor(this.draft.totalCost > this.supplier.economy.money ? cssColor(UI.colors.error) : cssColor(UI.colors.ink));
  }
  private confirm(): void {
    if (!this.isOpen) return;
    const result = this.supplier.confirm(this.requestId, this.playerId, this.draft.items, this.gameTime());
    if (result.status === 'accepted') { this.close(); return; }
    const messages = { busy: 'Đang có đơn hàng được giao.', 'insufficient-funds': 'Không đủ tiền.', invalid: 'Chọn số lượng hợp lệ lớn hơn 0.', duplicate: 'Đơn hàng này đã được đặt.', stopped: 'Tiệm đã đóng.', closed: 'Chỉ đặt hàng khi chuẩn bị hoặc mở cửa.' };
    this.audio?.play('ERROR');
    this.message.setText(messages[result.status]); this.refresh();
  }
  private text(x: number, y: number, value: string, size: number): Phaser.GameObjects.Text {
    const text = this.scene.add.text(x, y, value, { ...UI_TEXT, fontSize: `${size}px` });
    this.add(text); return text;
  }
  private button(x: number, y: number, value: string, action: () => void): void {
    panelButton(this.scene, this, x, y, value, action, this.audio, value === 'ĐÓNG' || value.startsWith('-') || value.startsWith('+'));
  }
}
