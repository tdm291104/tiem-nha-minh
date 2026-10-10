import Phaser from 'phaser';
import { createSceneAudio } from '../audio/createSceneAudio';
import { FeedbackEffects } from '../presentation/FeedbackEffects';
import { ShopFeedback } from '../presentation/ShopFeedback';
import { createShopDecorations } from '../world/ShopDecorations';
import { CONTROLS, WORLD, TEXT_STYLE } from '../config/settings';
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
import { browserSaves, restoreEconomy } from '../persistence/GameSave';
import { ShopProgress } from '../persistence/ShopProgress';
import { UpgradeSystem, INITIAL_UPGRADES, shelfCapacity, deliveryDuration, checkoutDuration } from '../upgrades/UpgradeSystem';
import { UpgradePanel } from '../ui/UpgradePanel';
import { SettingsPanel } from '../ui/SettingsPanel';
import { StorePlan } from '../operations/StorePlan';
import { DeliveryCargo } from '../operations/DeliveryCargo';
import { CleaningSystem } from '../operations/CleaningSystem';
import { ShopOperations } from '../operations/ShopOperations';
import { OPERATIONS } from '../operations/OperationsConfig';
import { OperationsPanel } from '../ui/OperationsPanel';
import type { Interactable } from '../interactions/Interactable';
import { Operations2DView } from '../presentation/Operations2DView';

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
  private progress?: ShopProgress;
  private upgradePanel!: UpgradePanel;
  private settingsPanel!: SettingsPanel;
  private operations!: ShopOperations;
  private operationsPanel!: OperationsPanel;
  private baseTargets: Interactable[] = [];
  private operationsStatus!: Phaser.GameObjects.Text;
  private operations2D?: Operations2DView;
  constructor() { super('ShopScene'); }

  create(data: ShopSceneData): void {
    const loaded = data.continueSave ? browserSaves()?.load() : undefined;
    const saved = data.resumeState ?? loaded?.save ?? null;
    if (data.continueSave && !saved) { this.scene.start('MenuScene'); return; }
    this.progress = undefined;
    this.operations2D = undefined;
    this.players = [];
    this.shopCamera = undefined; this.threeView = undefined;
    this.cameras.main.stopFollow().setZoom(1).setScroll(0, 0).removeBounds();
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    const economy = saved ? restoreEconomy(saved.economy) : new StoreEconomy();
    this.day = new DayManager(economy);
    if (saved) this.day.restore(saved.day);
    const plan = new StorePlan(economy, () => this.day.state === 'PREPARATION', saved?.operations?.plan);
    const cargo = new DeliveryCargo(), cleaning = new CleaningSystem();
    if (saved?.operations) cleaning.restore(saved.operations.cleaning);
    this.physics.world.setBounds(WORLD.wall, WORLD.wall, plan.width - WORLD.wall * 2, OPERATIONS.exteriorHeight - WORLD.wall * 2);
    const audio = createSceneAudio(this);
    const effects = new FeedbackEffects(this);
    const obstacles = createShopLayout(this, plan.checkpoint);
    createShopDecorations(this);
    this.physics.world.resume();
    const storage = new StoreStorage(saved?.storage ?? INITIAL_STORAGE, saved?.operations?.storageBatches, this.day.currentDay);
    this.inventory = new InventorySystem(this, obstacles, storage, message => this.hud.notify(message));
    const levels = saved?.upgrades ?? INITIAL_UPGRADES;
    const fixtures = createShopFixtures(this, obstacles, this.inventory, saved?.shelves, shelfCapacity(levels), plan.checkpoint, saved?.operations?.shelfBatches, this.day.currentDay);
    const upgrades = new UpgradeSystem(economy, () => this.day.state === 'PREPARATION', levels);
    this.supplier = new SupplierSystem(storage, economy, SUPPLIER, () => this.day.canOrder && !cargo.hasFreight, order => cargo.arrive(order, this.day.currentDay));
    if (saved) this.supplier.restore(saved.supplier);
    if (saved?.operations) cargo.restore(saved.operations.cargo, this.supplier.orders);
    const terminal = new SupplierTerminal(this, SHOP.supplierTerminal, obstacles, playerId => this.orderPanel.open(playerId), () => this.supplier.canOrder);
    const door = new StoreDoor(this, SHOP.customerExit, { x: SHOP.customerExit.x, y: SHOP.customerExit.y - 40 }, this.day);
    this.checkout = new CheckoutSystem(SHOP.counters, SHOP.checkoutWaitingPositions, economy);
    const applyUpgrades = (): void => {
      for (const shelf of fixtures.shelves) shelf.stock.setCapacity(shelfCapacity(upgrades.snapshot));
      this.supplier.setDeliveryDuration(deliveryDuration(upgrades.snapshot));
      this.checkout.setProcessingDuration(checkoutDuration(upgrades.snapshot));
      this.progress?.save();
    };
    applyUpgrades();
    const unsubscribeUpgrades = upgrades.onChange(applyUpgrades);
    this.cashiers = SHOP.counters.map(definition => {
      const station = this.checkout.stations.find(candidate => candidate.id === definition.id);
      if (!station) throw new Error('Cashier definition has no station');
      return new Cashier(this, definition, station, obstacles, this.checkout, message => this.hud.notify(message), () => this.day.gameTimeMs, audio);
    });
    for (let i = 0; i < (saved?.players.length ?? data.playerCount); i++) {
      const id = (i + 1) as PlayerId;
      const spawn = SHOP.spawns[i];
      if (!spawn) throw new Error('Missing player spawn');
      const player = new Player(this, id, saved?.players[i]?.position ?? spawn, CONTROLS[id]);
      player.setHeldItem(saved?.players[i]?.held ?? null);
      this.players.push(player);
      this.physics.add.collider(player, obstacles);
    }
    for (const drop of saved?.drops ?? []) this.inventory.restoreWorldItem(drop.stack, drop.position);
    const worldObjects = [...this.children.list].filter(object => object !== effects.layer);
    this.baseTargets = [...fixtures.crates, ...fixtures.shelves, ...this.cashiers, terminal, door];
    this.interactions = new InteractionSystem(this, this.players, [...this.baseTargets], obstacles);
    this.hud = new ShopHud(this, this.players, economy, this.supplier, this.day, () => this.customers?.activeCustomerCount ?? 0, () => this.returnToMenu(), () => this.progress?.save());
    this.orderPanel = new SupplierOrderPanel(this, this.supplier, open => this.setGameplayPaused(open), () => this.day.gameTimeMs, audio);
    this.summaryPanel = new DaySummaryPanel(this, day => this.startNextDay(day), audio);
    this.upgradePanel = new UpgradePanel(this, upgrades, open => this.setGameplayPaused(open), () => this.day.gameTimeMs, audio, this.players.length);
    this.settingsPanel = new SettingsPanel(this, open => this.setGameplayPaused(open), audio);
    const grid = createShopNavigation(obstacles, plan.width, OPERATIONS.exteriorHeight);
    this.operations = new ShopOperations({ players: this.players, shelves: fixtures.shelves, inventory: this.inventory, economy, day: this.day, checkout: this.checkout, grid, cargo, cleaning, plan, notify: message => this.hud.notify(message) }, saved?.operations);
    this.operationsPanel = new OperationsPanel(this, this.operations, open => this.setGameplayPaused(open), () => this.rebuildShop(), audio);
    this.operationsStatus = this.add.text(24, 130, '', { ...TEXT_STYLE, fontSize: '12px', backgroundColor: '#fff8ed', color: '#243e37', wordWrap: { width: 310 }, padding: { x: 10, y: 7 } }).setDepth(3100); this.cameras.main.ignore(this.operationsStatus);
    const unsubscribeSupplier = this.supplier.onChange(order => this.hud.notify(order.status === 'DELIVERED' ? 'Xe đã tới! Ra ngoài cửa lấy thùng hàng.' : 'Đơn hàng đang được giao...'));
    this.customers = new CustomerManager(this, grid, fixtures.shelves, this.checkout, effects, customer => { this.hud.excludeWorldObject(customer); if (this.threeView) customer.setVisible(false); audio.play('CUSTOMER_ENTER'); }, id => { this.day.recordOutOfStock(id); }, items => storage.addBatch(items), (id, impatient) => this.operations.departure(id, impatient));
    if (saved) this.customers.restoreNextId(saved.nextCustomerId);
    if (WebGL.isWebGL2Available()) {
      this.threeView = new ShopThreeView(this, { players: this.players, shelves: fixtures.shelves, crates: fixtures.crates, inventory: this.inventory, customers: this.customers, checkout: this.checkout, day: this.day, operations: this.operations });
      this.cameras.main.ignore(worldObjects);
      for (const object of worldObjects) if ('setVisible' in object && typeof object.setVisible === 'function') object.setVisible(false);
      effects.setProjector(this.threeView.project);
      this.interactions.setPresentation(this.threeView.promptProject, (id, target) => this.threeView?.select(id, target));
    } else {
      this.shopCamera = new ShopCamera(this.cameras.main, this.players, plan.width, OPERATIONS.exteriorHeight);
      this.operations2D = new Operations2DView(this, this.operations, object => this.hud.excludeWorldObject(object));
      this.hud.notify('Trình duyệt chưa hỗ trợ WebGL 2. Đang dùng hình ảnh 2D.');
    }
    const unsubscribeDay = this.day.onStateChange(state => {
      this.operations.onDayState(state);
      if (state === 'OPEN') this.customers.startSpawning(); else this.customers.stopSpawning();
      if (state === 'CLOSING') this.hud.notify('Cửa hàng đã đóng cửa. Phục vụ nốt khách nhé!');
      if (state === 'SUMMARY' && this.day.summary) { this.setGameplayPaused(true); this.summaryPanel.showSummary(this.day.summary); }
      if (state === 'PREPARATION') { this.summaryPanel.setVisible(false); this.setGameplayPaused(false); }
    });
    const feedback = new ShopFeedback(this.inventory, fixtures.shelves, fixtures.crates, this.cashiers, this.checkout, this.supplier, this.day, effects, audio, this.players);
    this.progress = new ShopProgress({ players: this.players, shelves: fixtures.shelves, inventory: this.inventory, customers: this.customers, economy, supplier: this.supplier, day: this.day, upgrades, operations: this.operations }, saved => this.hud.setSaveFailed(!saved));
    const save = (): void => { this.hud.notify(this.progress?.save() ? 'Đã lưu tiến trình trên trình duyệt này.' : 'Không lưu được. Kiểm tra quyền lưu trữ của trình duyệt.'); };
    const unload = (): void => { this.progress?.save(); };
    const available = (): boolean => !this.isModalOpen() && this.day.state !== 'SUMMARY';
    this.hud.addAction(0, 'Quản lý', () => { if (available()) this.operationsPanel.open(); }, audio);
    this.hud.addAction(1, 'Nâng cấp', () => { if (available()) this.upgradePanel.open(); }, audio);
    this.hud.addAction(2, 'Lưu tiệm', () => { if (available()) save(); }, audio);
    this.hud.addAction(3, 'Cài đặt', () => { if (available()) this.settingsPanel.open(); }, audio);
    window.addEventListener('pagehide', unload);
    this.operations.onDayState(this.day.state);
    if (this.day.canSpawnCustomers) this.customers.startSpawning();
    if (this.day.summary) { this.setGameplayPaused(true); this.summaryPanel.showSummary(this.day.summary); }
    this.progress.save();
    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-ESC', this.returnToMenu, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard?.off('keydown-ESC', this.returnToMenu, this);
      window.removeEventListener('pagehide', unload);
      unsubscribeUpgrades();
      feedback.shutdown(); effects.shutdown();
      this.checkout.shutdown();
      this.supplier.shutdown(); storage.shutdown(); unsubscribeSupplier();
      unsubscribeDay(); this.day.shutdown();
    });
  }
  private returnToMenu(): void {
    if (this.orderPanel?.isOpen) { this.orderPanel.close(); return; }
    if (this.upgradePanel?.isOpen) { this.upgradePanel.close(); return; }
    if (this.settingsPanel?.isOpen) { this.settingsPanel.close(); return; }
    if (this.operationsPanel?.isOpen) { this.operationsPanel.close(); return; }
    if (!this.progress?.save()) {
      this.hud.notify('Chưa về menu vì không lưu được. Kiểm tra quyền lưu trữ rồi thử lại.');
      return;
    }
    this.scene.start('MenuScene');
  }
  private isModalOpen(): boolean { return this.orderPanel?.isOpen || this.upgradePanel?.isOpen || this.settingsPanel?.isOpen || this.operationsPanel?.isOpen; }
  private rebuildShop(): void {
    if (this.day.state !== 'PREPARATION' || !this.progress) return;
    this.progress.save();
    this.scene.restart({ playerCount: this.players.length, resumeState: this.progress.snapshot() });
  }
  private setGameplayPaused(paused: boolean): void {
    for (const player of this.players) { player.controller.setEnabled(!paused); player.setVelocity(0, 0); }
    if (paused) { this.physics.world.pause(); this.tweens.pauseAll(); this.interactions.hide(); }
    else { this.physics.world.resume(); this.tweens.resumeAll(); }
  }
  private startNextDay(expectedDay: number): void {
    if (this.day.state !== 'SUMMARY' || this.day.currentDay !== expectedDay || !this.checkout.prepareNextDay()) return;
    this.day.nextDay(expectedDay); this.hud.update();
    this.progress?.save();
  }
  update(_time: number, delta: number): void {
    if (this.isModalOpen() || this.day.state === 'SUMMARY') return;
    this.threeView?.prepareMovement();
    for (const player of this.players) player.updateMovement(delta);
    this.interactions.setTargets([...this.baseTargets, ...this.operations.interactables()]);
    this.interactions.update(this.players);
    if (this.orderPanel.isOpen) { this.interactions.hide(); return; }
    this.inventory.update(this.players);
    for (const player of this.players) player.controller.endFrame();
    this.day.update(delta);
    this.checkout.update(delta, this.day.gameTimeMs);
    this.supplier.update(delta);
    this.customers.update(delta, this.day.canSpawnCustomers);
    this.operations.update(delta);
    this.operations2D?.update(delta);
    this.operationsStatus.setText(this.operations.status);
    for (const cashier of this.cashiers) cashier.updateCashier(delta);
    this.day.finishClosing({ activeCustomers: this.customers.activeCustomerCount, checkoutProcessing: this.checkout.hasActiveProcessing(), activeDelivery: this.supplier.activeOrder !== null });
    this.hud.update();
    this.shopCamera?.update(delta);
    this.progress?.update(delta);
  }
}
