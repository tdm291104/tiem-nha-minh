import Phaser from 'phaser';
import { panelButton } from './PanelPrimitives';
import { THEME, cssColor } from '../presentation/VisualTheme';
import type { AudioManager } from '../audio/AudioManager';
import { PRODUCTS } from '../products/ProductCatalog';
import type { ProductId } from '../products/Product';
import type { PlayerId } from '../types/game';
import { TEXT_STYLE, VIEW } from '../config/settings';
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
  constructor(scene: Phaser.Scene, private readonly supplier: SupplierSystem, private readonly onModalChanged: (open: boolean) => void, private readonly gameTime: () => number = () => scene.time.now, private readonly audio?: AudioManager) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(4000).setVisible(false);
    scene.cameras.main.ignore(this);
    const mask = scene.add.rectangle(VIEW.width / 2, VIEW.height / 2, VIEW.width, VIEW.height, THEME.colors.ink, 0.8).setInteractive();
    mask.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
    const background = scene.add.graphics();
    background.fillStyle(THEME.colors.shadow, 0.2).fillRoundedRect(213, 100, 690, 620, 8);
    background.fillStyle(THEME.colors.woodDark).fillRoundedRect(205, 90, 690, 620, 8);
    background.fillStyle(THEME.colors.paper).fillRoundedRect(217, 103, 666, 594, 4);
    background.fillStyle(THEME.colors.metal).fillRoundedRect(490, 91, 120, 11, 3);
    background.lineStyle(1, THEME.colors.woodDark, 0.25).lineBetween(250, 182, 851, 182);
    this.add([mask, background]);
    this.heading = this.text(250, 116, 'PHIẾU ĐẶT HÀNG', 26);
    this.text(250, 158, `Chọn số lượng · Giao sau ${SUPPLIER.deliveryMs / 1000} giây chơi · Cả tiệm tạm dừng`, 15);
    this.text(250, 193, 'SẢN PHẨM', 12); this.text(570, 193, 'SỐ LƯỢNG', 12); this.text(825, 193, 'THÀNH TIỀN', 12).setOrigin(1, 0);
    Object.values(PRODUCTS).forEach((product, index) => {
      const y = 239 + index * 54;
      const row = scene.add.graphics().fillStyle(index % 2 ? THEME.colors.greenSoft : THEME.colors.amberSoft, 0.45).fillRoundedRect(239, y - 11, 622, 50, 6); this.add(row);
      this.add(scene.add.image(265, y + 12, `product-${product.id}`).setDisplaySize(34, 34));
      this.text(298, y - 5, product.name, 18);
      this.text(298, y + 20, `${formatVnd(product.buyPrice)} / cái`, 14);
      this.button(585, y + 12, `-${SUPPLIER.quantityStep}`, () => this.adjust(product.id, -1));
      const quantity = this.text(640, y, '0', 20).setOrigin(0.5, 0);
      this.quantities.set(product.id, quantity);
      this.lineCosts.set(product.id, this.text(838, y + 4, '', 16).setOrigin(1, 0));
      this.button(695, y + 12, `+${SUPPLIER.quantityStep}`, () => this.adjust(product.id, 1));
    });
    this.total = this.text(250, 530, '', 21);
    this.balance = this.text(250, 561, '', 16);
    this.message = this.text(250, 592, '', 16).setColor(cssColor(THEME.colors.warning));
    this.button(400, 660, 'ĐẶT HÀNG', () => this.confirm());
    this.button(720, 660, 'ĐÓNG', () => this.close());
  }
  get isOpen(): boolean { return this.visible; }
  open(playerId: PlayerId): void {
    if (this.isOpen || !this.supplier.canOrder) return;
    this.playerId = playerId; this.requestId = `draft-${this.nextDraftId++}`;
    this.draft = new OrderDraft(); this.message.setText('');
    this.heading.setText(`PHIẾU ĐẶT HÀNG · P${playerId}`);
    this.refresh(); this.setVisible(true); this.onModalChanged(true);
  }
  close(): void { if (!this.isOpen) return; this.setVisible(false); this.onModalChanged(false); }
  private adjust(productId: ProductId, direction: -1 | 1): void {
    if (!this.isOpen) return;
    this.draft.adjust(productId, direction); this.message.setText(''); this.refresh();
  }
  private refresh(): void {
    for (const [id, label] of this.quantities) label.setText(String(this.draft.getQuantity(id)));
    for (const [id, label] of this.lineCosts) label.setText(formatVnd(PRODUCTS[id].buyPrice * this.draft.getQuantity(id)));
    this.total.setText(`Tổng: ${formatVnd(this.draft.totalCost)}`);
    this.balance.setText(`Tiền hiện có: ${formatVnd(this.supplier.economy.money)}`);
    this.total.setColor(this.draft.totalCost > this.supplier.economy.money ? cssColor(THEME.colors.warning) : cssColor(THEME.colors.ink));
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
    const text = this.scene.add.text(x, y, value, { ...TEXT_STYLE, fontSize: `${size}px` });
    this.add(text); return text;
  }
  private button(x: number, y: number, value: string, action: () => void): void {
    panelButton(this.scene, this, x, y, value, action, this.audio, value === 'ĐÓNG' || value.startsWith('-') || value.startsWith('+'));
  }
}
