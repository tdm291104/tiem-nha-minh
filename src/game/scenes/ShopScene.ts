import Phaser from 'phaser';
import { createSceneAudio } from '../audio/createSceneAudio';
import { FeedbackEffects } from '../presentation/FeedbackEffects';
import { ShopFeedback } from '../presentation/ShopFeedback';
import { createShopDecorations } from '../world/ShopDecorations';
import { CONTROLS, WORLD } from '../config/settings';
import { ShopCamera } from '../components/ShopCamera';
import { Player } from '../entities/Player';
import { InteractionSystem } from '../interactions/InteractionSystem';
import { createShopFixtures, createShopLayout, SHOP } from '../world/ShopLayout';
import { InventorySystem } from '../systems/InventorySystem';
import { ShopHud } from '../ui/ShopHud';
import { CustomerManager } from '../customers/CustomerManager';
import { createShopNavigation } from '../navigation/createShopNavigation';
import type { PlayerId, ShopSceneData } from '../types/game';
import { Cashier } from '../entities/Cashier';
import { CheckoutSystem } from '../checkout/CheckoutSystem';
import { StoreEconomy } from '../economy/StoreEconomy';
import { StoreStorage } from '../inventory/StoreStorage';
import { INITIAL_STORAGE, SUPPLIER } from '../supplier/SupplierConfig';
import { SupplierSystem } from '../supplier/SupplierSystem';
import { SupplierTerminal } from '../entities/SupplierTerminal';
import { SupplierOrderPanel } from '../ui/SupplierOrderPanel';
import { DayManager } from '../day/DayManager';
import { DaySummaryPanel } from '../ui/DaySummaryPanel';
import { StoreDoor } from '../entities/StoreDoor';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { ShopThreeView } from '../presentation/three/ShopThreeView';

export class ShopScene extends Phaser.Scene {
  players: Player[] = [];
  private interactions!: InteractionSystem;
  private shopCamera?: ShopCamera;
  private threeView?: ShopThreeView;
  private inventory!: InventorySystem;
  private hud!: ShopHud;
  private customers!: CustomerManager;
  private checkout!: CheckoutSystem;
  private cashiers: Cashier[] = [];
  private supplier!: SupplierSystem;
  private orderPanel!: SupplierOrderPanel;
  private day!: DayManager;
  private summaryPanel!: DaySummaryPanel;
  constructor() { super('ShopScene'); }

  create(data: ShopSceneData): void {
    this.players = [];
    this.shopCamera = undefined; this.threeView = undefined;
    this.cameras.main.stopFollow().setZoom(1).setScroll(0, 0).removeBounds();
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.physics.world.setBounds(WORLD.wall, WORLD.wall, WORLD.width - WORLD.wall * 2, WORLD.height - WORLD.wall * 2);
    const audio = createSceneAudio(this);
    const effects = new FeedbackEffects(this);
    const obstacles = createShopLayout(this);
    createShopDecorations(this);
    this.physics.world.resume();
    const storage = new StoreStorage(INITIAL_STORAGE);
    this.inventory = new InventorySystem(this, obstacles, storage, message => this.hud.notify(message));
    const fixtures = createShopFixtures(this, obstacles, this.inventory);
    const economy = new StoreEconomy();
    this.day = new DayManager(economy);
    this.supplier = new SupplierSystem(storage, economy, SUPPLIER, () => this.day.canOrder);
    const terminal = new SupplierTerminal(this, SHOP.supplierTerminal, obstacles, playerId => this.orderPanel.open(playerId), () => this.supplier.canOrder);
    const door = new StoreDoor(this, SHOP.customerExit, { x: SHOP.customerExit.x, y: SHOP.customerExit.y - 40 }, this.day);
    this.checkout = new CheckoutSystem(SHOP.counters, SHOP.checkoutWaitingPositions, economy);
    this.cashiers = SHOP.counters.map(definition => {
      const station = this.checkout.stations.find(candidate => candidate.id === definition.id);
      if (!station) throw new Error('Cashier definition has no station');
      return new Cashier(this, definition, station, obstacles, this.checkout, message => this.hud.notify(message), () => this.day.gameTimeMs, audio);
    });
    for (let i = 0; i < data.playerCount; i++) {
      const id = (i + 1) as PlayerId;
      const spawn = SHOP.spawns[i];
      if (!spawn) throw new Error('Missing player spawn');
      const player = new Player(this, id, spawn, CONTROLS[id]);
      this.players.push(player);
      this.physics.add.collider(player, obstacles);
    }
    const worldObjects = [...this.children.list].filter(object => object !== effects.layer);
    this.interactions = new InteractionSystem(this, this.players, [...fixtures.crates, ...fixtures.shelves, ...this.cashiers, terminal, door], obstacles);
    this.hud = new ShopHud(this, this.players, economy, this.supplier, this.day, () => this.customers?.activeCustomerCount ?? 0, () => this.returnToMenu());
    this.orderPanel = new SupplierOrderPanel(this, this.supplier, open => this.setGameplayPaused(open), () => this.day.gameTimeMs, audio);
    this.summaryPanel = new DaySummaryPanel(this, day => this.startNextDay(day), audio);
    const unsubscribeSupplier = this.supplier.onChange(order => this.hud.notify(order.status === 'DELIVERED' ? 'Đã giao hàng!' : 'Đơn hàng đang được giao...'));
    this.customers = new CustomerManager(this, createShopNavigation(obstacles), fixtures.shelves, this.checkout, effects, customer => { this.hud.excludeWorldObject(customer); if (this.threeView) customer.setVisible(false); audio.play('CUSTOMER_ENTER'); }, id => { this.day.recordOutOfStock(id); });
    if (WebGL.isWebGL2Available()) {
      this.threeView = new ShopThreeView(this, { players: this.players, shelves: fixtures.shelves, crates: fixtures.crates, inventory: this.inventory, customers: this.customers, checkout: this.checkout, day: this.day });
      this.cameras.main.ignore(worldObjects);
      for (const object of worldObjects) if ('setVisible' in object && typeof object.setVisible === 'function') object.setVisible(false);
      effects.setProjector(this.threeView.project);
      this.interactions.setPresentation(this.threeView.promptProject, (id, target) => this.threeView?.select(id, target));
    } else {
      this.shopCamera = new ShopCamera(this.cameras.main, this.players);
      this.hud.notify('Trình duyệt chưa hỗ trợ WebGL 2. Đang dùng hình ảnh 2D.');
    }
    const unsubscribeDay = this.day.onStateChange(state => {
      if (state === 'OPEN') this.customers.startSpawning(); else this.customers.stopSpawning();
      if (state === 'CLOSING') this.hud.notify('Cửa hàng đã đóng cửa. Phục vụ nốt khách nhé!');
      if (state === 'SUMMARY' && this.day.summary) { this.setGameplayPaused(true); this.summaryPanel.showSummary(this.day.summary); }
      if (state === 'PREPARATION') { this.summaryPanel.setVisible(false); this.setGameplayPaused(false); }
    });
    const feedback = new ShopFeedback(this.inventory, fixtures.shelves, fixtures.crates, this.cashiers, this.checkout, this.supplier, this.day, effects, audio, this.players);
    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-ESC', this.returnToMenu, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard?.off('keydown-ESC', this.returnToMenu, this);
      feedback.shutdown(); effects.shutdown();
      this.checkout.shutdown();
      this.supplier.shutdown(); storage.shutdown(); unsubscribeSupplier();
      unsubscribeDay(); this.day.shutdown();
    });
  }
  private returnToMenu(): void {
    if (this.orderPanel?.isOpen) { this.orderPanel.close(); return; }
    this.scene.start('MenuScene');
  }
  private setGameplayPaused(paused: boolean): void {
    for (const player of this.players) { player.controller.setEnabled(!paused); player.setVelocity(0, 0); }
    if (paused) { this.physics.world.pause(); this.tweens.pauseAll(); this.interactions.hide(); }
    else { this.physics.world.resume(); this.tweens.resumeAll(); }
  }
  private startNextDay(expectedDay: number): void {
    if (this.day.state !== 'SUMMARY' || this.day.currentDay !== expectedDay || !this.checkout.prepareNextDay()) return;
    this.day.nextDay(expectedDay); this.hud.update();
  }
  update(_time: number, delta: number): void {
    if (this.orderPanel.isOpen || this.day.state === 'SUMMARY') return;
    this.threeView?.prepareMovement();
    for (const player of this.players) player.updateMovement(delta);
    this.interactions.update(this.players);
    if (this.orderPanel.isOpen) { this.interactions.hide(); return; }
    this.inventory.update(this.players);
    for (const player of this.players) player.controller.endFrame();
    this.day.update(delta);
    this.checkout.update(delta, this.day.gameTimeMs);
    this.supplier.update(delta);
    this.customers.update(delta, this.day.canSpawnCustomers);
    for (const cashier of this.cashiers) cashier.updateCashier(delta);
    this.day.finishClosing({ activeCustomers: this.customers.activeCustomerCount, checkoutProcessing: this.checkout.hasActiveProcessing(), activeDelivery: this.supplier.activeOrder !== null });
    this.hud.update();
    this.shopCamera?.update(delta);
  }
}
