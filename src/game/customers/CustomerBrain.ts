import { PRODUCTS } from '../products/ProductCatalog.ts';
import type { ProductId } from '../products/Product.ts';
import type { Position } from '../types/game.ts';
import { NavigationAgent } from '../navigation/NavigationAgent.ts';
import type { NavigationGrid } from '../navigation/NavigationGrid.ts';
import { CUSTOMERS } from './CustomerConfig.ts';
import type { CustomerSettings } from './CustomerConfig.ts';
import { canTransition } from './CustomerState.ts';
import type { CustomerState } from './CustomerState.ts';
import { findShelvesForProduct, takeRequestedProduct } from './ShoppingRequest.ts';
import type { ShoppingShelf } from './ShoppingRequest.ts';
import type { CheckoutSystem } from '../checkout/CheckoutSystem.ts';
import { CHECKOUT } from '../checkout/CheckoutConfig.ts';
import { freezePurchase } from '../checkout/SaleTransaction.ts';
import type { CustomerPurchase } from '../checkout/SaleTransaction.ts';

export interface CustomerBrainOptions {
  customerId: number;
  checkout: CheckoutSystem;
  grid: NavigationGrid;
  shelves: readonly ShoppingShelf[];
  spawnPosition: Position;
  interiorEntrance: Position;
  exitPosition: Position;
  settings?: Readonly<CustomerSettings>;
  random?: () => number;
  onOutOfStockDeparture?: (customerId: number) => void;
}

export class CustomerBrain {
  readonly navigation: NavigationAgent;
  readonly desiredQuantity: number;
  readonly customerId: number;
  readonly checkout: CheckoutSystem;
  targetProductId: ProductId | null = null;
  targetShelf: ShoppingShelf | null = null;
  private cart: readonly CustomerPurchase[] = Object.freeze([]);
  purchaseIntentFulfilled = false;
  feedback = '';
  private currentState: CustomerState = 'SPAWNING';
  private stateElapsedMs = 0;
  private tripElapsedMs = 0;
  private browseDurationMs = 0;
  private queueDestination: Position | null = null;
  private paidElapsedMs = 0;
  private failedForStock = false;
  private readonly options: CustomerBrainOptions;
  private readonly settings: Readonly<CustomerSettings>;
  private readonly random: () => number;

  constructor(options: CustomerBrainOptions) {
    this.options = options;
    this.customerId = options.customerId;
    this.checkout = options.checkout;
    this.settings = options.settings ?? CUSTOMERS;
    this.random = options.random ?? Math.random;
    this.desiredQuantity = this.settings.desiredQuantity;
    this.navigation = new NavigationAgent(options.grid, options.spawnPosition, this.settings.movementSpeed);
  }
  get state(): CustomerState { return this.currentState; }
  get purchase(): readonly CustomerPurchase[] { return this.cart; }
  get carriedQuantity(): number { return this.cart.reduce((sum, line) => sum + line.quantity, 0); }
  get position(): Position { return this.navigation.position; }
  get movementSpeed(): number { return this.navigation.movementSpeed; }
  get patience(): number { return Math.max(0, this.settings.patienceMs - this.tripElapsedMs); }
  get navigationTarget(): Position | null { return this.navigation.navigationTarget; }

  update(deltaMs: number): void {
    if (this.state === 'DESPAWNED') return;
    this.stateElapsedMs += deltaMs;
    this.tripElapsedMs += deltaMs;
    // Purchased goods wait for a player; the shopping timeout cannot bypass payment.
    if (this.patience === 0 && this.cart.length === 0 && this.state !== 'LEAVING') { this.beginLeaving(); return; }
    switch (this.state) {
      case 'SPAWNING':
        if (this.navigation.goTo(this.options.interiorEntrance)) this.transition('ENTERING');
        else this.beginLeaving();
        break;
      case 'ENTERING':
        if (this.navigation.update(deltaMs)) this.transition('CHOOSING_PRODUCT');
        break;
      case 'CHOOSING_PRODUCT':
        this.chooseProductAndShelf();
        break;
      case 'MOVING_TO_SHELF':
        if (this.navigation.update(deltaMs)) {
          this.browseDurationMs = this.settings.browseMinMs + this.random() * (this.settings.browseMaxMs - this.settings.browseMinMs);
          this.transition('BROWSING');
        }
        break;
      case 'BROWSING':
        if (this.stateElapsedMs >= this.browseDurationMs) this.transition('TAKING_PRODUCT');
        break;
      case 'TAKING_PRODUCT':
        this.takeProduct();
        break;
      case 'OUT_OF_STOCK':
        if (this.stateElapsedMs >= this.settings.outOfStockWaitMs) { this.feedback = ''; this.beginLeaving(); }
        break;
      case 'MOVING_TO_CHECKOUT':
      case 'QUEUEING':
        this.updateQueueMovement(deltaMs);
        break;
      case 'WAITING_FOR_QUEUE':
        if (this.stateElapsedMs >= CHECKOUT.retryMs) {
          this.stateElapsedMs = 0;
          const assignment = this.checkout.assign(this.customerId, this.position, destination => this.navigation.goTo(destination));
          if (assignment?.kind === 'queue') {
            this.queueDestination = assignment.position;
            this.transition('MOVING_TO_CHECKOUT');
          }
        }
        break;
      case 'WAITING_FOR_CHECKOUT':
        if (this.checkout.status(this.customerId) === 'processing' || this.checkout.status(this.customerId) === 'paid') this.transition('CHECKOUT');
        break;
      case 'CHECKOUT':
        if (this.checkout.status(this.customerId) === 'paid') {
          this.feedback = 'Cảm ơn!';
          this.paidElapsedMs += deltaMs;
          if (this.paidElapsedMs >= CHECKOUT.thanksMs) this.beginLeaving();
        } else this.feedback = 'Đang tính tiền...';
        break;
      case 'LEAVING':
        if (this.navigation.update(deltaMs)) this.transition('DESPAWNED');
        break;
    }
  }
  private chooseProductAndShelf(): void {
    const products = Object.values(PRODUCTS);
    const product = products[Math.floor(this.random() * products.length)];
    if (!product) { this.beginLeaving(); return; }
    this.targetProductId = product.id;
    this.targetShelf = findShelvesForProduct(product.id, this.position, this.options.shelves).find(shelf => this.navigation.goTo(shelf.interactionPosition)) ?? null;
    if (this.targetShelf) this.transition('MOVING_TO_SHELF');
    else { this.feedback = 'Không tới được kệ!'; this.beginLeaving(); }
  }
  private takeProduct(): void {
    if (!this.targetShelf || !this.targetProductId) { this.beginLeaving(); return; }
    const result = takeRequestedProduct(this.targetShelf, this.targetProductId, this.desiredQuantity);
    this.cart = result.carriedQuantity > 0 ? freezePurchase([{ productId: this.targetProductId, quantity: result.carriedQuantity }]) : Object.freeze([]);
    this.purchaseIntentFulfilled = result.purchaseIntentFulfilled;
    if (result.purchaseIntentFulfilled) {
      if (!this.checkout.registerPurchase(this.customerId, this.cart)) { this.beginLeaving(); return; }
      this.transition('MOVING_TO_CHECKOUT');
      const assignment = this.checkout.assign(this.customerId, this.position, destination => this.navigation.goTo(destination));
      this.queueDestination = assignment?.position ?? null;
      if (!assignment) { this.feedback = 'Chờ quầy trống...'; this.transition('WAITING_FOR_QUEUE'); }
    }
    else { this.failedForStock = true; this.feedback = 'Hết hàng!'; this.transition('OUT_OF_STOCK'); }
  }
  private updateQueueMovement(deltaMs: number): void {
    const assignment = this.checkout.assignment(this.customerId);
    if (!assignment) { this.beginLeaving(); return; }
    if (!this.queueDestination || this.queueDestination.x !== assignment.position.x || this.queueDestination.y !== assignment.position.y) {
      if (!this.navigation.goTo(assignment.position)) { this.checkout.forgetCustomer(this.customerId); this.beginLeaving(); return; }
      this.queueDestination = assignment.position;
    }
    if (!this.navigation.update(deltaMs)) return;
    if (assignment.kind === 'overflow') {
      this.feedback = 'Chờ quầy trống...';
      this.transition('WAITING_FOR_QUEUE');
    } else if (this.state === 'MOVING_TO_CHECKOUT') {
      this.feedback = 'Xếp hàng';
      this.transition('QUEUEING');
    } else if (assignment.index === 0 && this.checkout.markReady(this.customerId)) {
      this.feedback = 'Chờ tính tiền...';
      this.transition('WAITING_FOR_CHECKOUT');
    }
  }
  private beginLeaving(): void {
    this.transition('LEAVING');
    if (!this.navigation.goTo(this.options.exitPosition)) this.transition('DESPAWNED');
  }
  private transition(next: CustomerState): void {
    if (!canTransition(this.currentState, next)) throw new Error(`Invalid customer transition: ${this.currentState} -> ${next}`);
    this.currentState = next;
    this.stateElapsedMs = 0;
    if (next === 'DESPAWNED' && this.failedForStock) this.options.onOutOfStockDeparture?.(this.customerId);
  }
}
