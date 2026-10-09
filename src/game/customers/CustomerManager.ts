import Phaser from 'phaser';
import { Customer } from '../entities/Customer';
import type { ShoppingShelf } from './ShoppingRequest';
import type { NavigationGrid } from '../navigation/NavigationGrid';
import { SHOP } from '../world/ShopDefinition';
import { CustomerBrain } from './CustomerBrain';
import { CUSTOMER_ARCHETYPES } from '../presentation/CharacterStyles';
import type { FeedbackEffects } from '../presentation/FeedbackEffects';
import { CustomerSpawner } from './CustomerSpawner';
import type { CheckoutSystem } from '../checkout/CheckoutSystem';
import { MAX_CUSTOMER_PRODUCTS } from './CustomerConfig';
import type { CustomerPurchase } from '../checkout/SaleTransaction';
import { OPERATIONS } from '../operations/OperationsConfig';

export class CustomerManager {
  private readonly customers = new Map<number, Customer>();
  private readonly spawner = new CustomerSpawner();
  private nextId = 1;
  private stopped = false;

  constructor(private readonly scene: Phaser.Scene, private readonly grid: NavigationGrid, private readonly shelves: readonly ShoppingShelf[], private readonly checkout: CheckoutSystem, private readonly effects: FeedbackEffects, private readonly onCreated: (customer: Customer) => void, private readonly onOutOfStockDeparture: (customerId: number) => void = () => {}, private readonly onAbandonedPurchase: (items: readonly CustomerPurchase[]) => void = () => {}, private readonly onDeparture: (id: number, impatient: boolean) => void = () => {}) {
    this.spawner.stop();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdown());
  }
  get activeCustomers(): readonly Customer[] { return [...this.customers.values()]; }
  get activeCustomerCount(): number { return this.customers.size; }
  get nextCustomerId(): number { return this.nextId; }
  restoreNextId(id: number): void {
    if (!Number.isSafeInteger(id) || id < 1 || this.activeCustomerCount > 0) throw new RangeError('Invalid customer sequence');
    this.nextId = id;
  }
  startSpawning(): boolean { return !this.stopped && this.spawner.start(); }
  stopSpawning(): void { this.spawner.stop(); }
  update(deltaMs: number, allowSpawning = false): void {
    if (this.stopped) return;
    for (const [id, customer] of this.customers) {
      customer.updateCustomer(deltaMs);
      if (customer.brain.state === 'DESPAWNED') {
        this.onDeparture(id, customer.brain.leftForWaiting);
        this.customers.delete(id);
        this.checkout.forgetCustomer(id);
        customer.destroy();
      }
    }
    if (this.spawner.update(deltaMs, this.customers.size, allowSpawning)) this.spawn();
  }
  private spawn(): void {
    const id = this.nextId++;
    const brain = new CustomerBrain({ customerId: id, checkout: this.checkout, grid: this.grid, shelves: this.shelves, spawnPosition: SHOP.customerSpawn, interiorEntrance: SHOP.customerEntrance, exitPosition: SHOP.customerExit, onOutOfStockDeparture: this.onOutOfStockDeparture, onAbandonedPurchase: this.onAbandonedPurchase, maxProductTypes: MAX_CUSTOMER_PRODUCTS, checkoutPatienceMs: OPERATIONS.checkoutPatienceMs });
    const customer = new Customer(this.scene, id, brain, (id - 1) % CUSTOMER_ARCHETYPES.length, this.checkout, this.effects);
    this.onCreated(customer);
    this.customers.set(id, customer);
  }
  private shutdown(): void {
    this.stopped = true;
    this.spawner.stop();
    for (const customer of this.customers.values()) { this.checkout.forgetCustomer(customer.id); customer.destroy(); }
    this.customers.clear();
  }
}
