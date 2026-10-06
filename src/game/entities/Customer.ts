import { groundDepth } from '../presentation/VisualCatalog';
import { THEME, cssColor } from '../presentation/VisualTheme';
import Phaser from 'phaser';
import type { CustomerBrain } from '../customers/CustomerBrain';
import { CUSTOMERS } from '../customers/CustomerConfig';
import { CharacterView } from '../presentation/CharacterView';
import { customerArchetype } from '../presentation/CharacterStyles';
import { SpeechBubble } from '../ui/SpeechBubble';
import type { CheckoutSystem } from '../checkout/CheckoutSystem';
import type { FeedbackEffects } from '../presentation/FeedbackEffects';
import { getProduct } from '../products/ProductCatalog';

export class Customer extends Phaser.GameObjects.Container {
  readonly brain: CustomerBrain;
  private readonly requestBubble: SpeechBubble;
  private readonly visual: CharacterView;
  private readonly unsubscribeSale: () => void;
  private lastState = '';
  private readonly stateLabel: Phaser.GameObjects.Text;
  private readonly carriedIcon: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, readonly id: number, brain: CustomerBrain, variation: number, checkout: CheckoutSystem, private readonly effects: FeedbackEffects) {
    super(scene, brain.position.x, brain.position.y);
    this.brain = brain;
    scene.add.existing(this);
    // World coordinates represent feet; navigation clearance applies to the footprint.
    this.visual = new CharacterView(scene, customerArchetype(variation));
    this.requestBubble = new SpeechBubble(scene);
    this.unsubscribeSale = checkout.onSale(sale => { if (sale.customerId === id) { this.visual.setEmotion('HAPPY'); this.effects.pop(this.visual.figure); } });
    this.stateLabel = scene.add.text(0, 12, '', { fontFamily: THEME.typography.fontFamily, fontSize: '10px', color: cssColor(THEME.colors.ink), backgroundColor: cssColor(THEME.colors.greenSoft), padding: { x: 3, y: 2 } }).setOrigin(0.5, 0).setVisible(CUSTOMERS.debugStates);
    this.carriedIcon = scene.add.image(18, -24, 'product-instant_noodles').setDisplaySize(22, 22).setVisible(false);
    this.add([this.visual, this.carriedIcon, this.requestBubble, this.stateLabel]);
    this.refresh();
  }
  updateCustomer(deltaMs: number): void {
    const oldX = this.brain.position.x; const oldY = this.brain.position.y;
    this.brain.update(deltaMs);
    this.visual.updateVisual(deltaMs, this.brain.position.x - oldX, this.brain.position.y - oldY);
    this.refresh();
  }
  destroy(fromScene?: boolean): void { this.unsubscribeSale(); super.destroy(fromScene); }
  private refresh(): void {
    const brain = this.brain;
    this.setPosition(brain.position.x, brain.position.y).setDepth(groundDepth(brain.position.y));
    const product = brain.targetProductId ? getProduct(brain.targetProductId) : null;
    const dialogue = brain.feedback === 'Cảm ơn!' ? 'Cảm ơn nhé!' : brain.feedback === 'Hết hàng!' ? 'Ôi, hết hàng rồi!' : brain.feedback;
    const text = dialogue || (product ? brain.carriedQuantity > 0 ? `${product.name} x${brain.carriedQuantity}` : product.name : 'Ghé tiệm chút nha!');
    this.requestBubble.showMessage(text, brain.feedback ? null : product?.id ?? null, brain.state === 'OUT_OF_STOCK');
    if (brain.state === 'OUT_OF_STOCK' && this.lastState !== brain.state) { this.visual.setEmotion('DISAPPOINTED'); this.effects.shake(this.visual.figure); }
    this.lastState = brain.state;
    if (this.stateLabel.text !== brain.state) this.stateLabel.setText(brain.state);
    this.carriedIcon.setVisible(brain.carriedQuantity > 0);
    if (product && brain.carriedQuantity > 0) this.carriedIcon.setTexture(`product-${product.id}`);
  }
}
