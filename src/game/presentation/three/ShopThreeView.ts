import Phaser from 'phaser';
import * as THREE from 'three';
import type { Player } from '../../entities/Player';
import type { Shelf } from '../../entities/Shelf';
import type { StorageCrate } from '../../entities/StorageCrate';
import type { CustomerManager } from '../../customers/CustomerManager';
import type { InventorySystem } from '../../systems/InventorySystem';
import type { CheckoutSystem } from '../../checkout/CheckoutSystem';
import type { DayManager } from '../../day/DayManager';
import type { Interactable } from '../../interactions/Interactable';
import type { PlayerId, Position } from '../../types/game';
import { VIEW } from '../../config/settings';
import { SHOP } from '../../world/ShopDefinition';
import { describeStack, getProduct } from '../../products/ProductCatalog';
import { entranceLabel } from '../PresentationRules';
import { PLAYER_STYLES, customerArchetype } from '../CharacterStyles';
import { THEME, VISUAL_SETTINGS } from '../VisualTheme';
import { ModelFactory } from './ModelFactory';
import { CharacterModel } from './CharacterModel';
import { ShelfModel, createCounter, createCrate, createSupplierDesk } from './FurnitureModels';
import { buildShopEnvironment } from './ShopEnvironment';
import { createProductModel } from './ProductModel';
import { THREE_VIEW, groundTo3D } from './ThreeRules';
import { ShopCamera3D } from './ShopCamera3D';
import { WorldLabels } from './WorldLabels';
import { CameraModeControls } from './CameraModeControls';

interface ShopViewSources {
  readonly players: readonly Player[];
  readonly shelves: readonly Shelf[];
  readonly crates: readonly StorageCrate[];
  readonly inventory: InventorySystem;
  readonly customers: CustomerManager;
  readonly checkout: CheckoutSystem;
  readonly day: DayManager;
}
interface ActorRecord { model: CharacterModel; x: number; y: number }

/** A read-only 3D projection of existing gameplay. All collisions stay on Phaser's ground plane. */
export class ShopThreeView {
  private readonly world = new THREE.Scene();
  private readonly cameraRig = new ShopCamera3D(VIEW.width, VIEW.height);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly factory = new ModelFactory();
  private readonly labels: WorldLabels;
  private readonly cameraControls: CameraModeControls;
  private firstPersonItem: THREE.Group | null = null;
  private firstPersonProduct = '';
  private readonly actors = new Map<string, ActorRecord>();
  private readonly shelfModels = new Map<Shelf, ShelfModel>();
  private readonly crateModels = new Map<StorageCrate, ReturnType<typeof createCrate>>();
  private readonly counterModels = new Map<string, ReturnType<typeof createCounter>>();
  private readonly drops = new Map<number, THREE.Group>();
  private readonly selection = new Map<PlayerId, THREE.Mesh>();
  private stopped = false;
  private contextLost = false;

  constructor(private readonly scene: Phaser.Scene, private readonly sources: ShopViewSources) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    const canvas = this.renderer.domElement; canvas.className = 'shop-three-canvas'; canvas.setAttribute('aria-hidden', 'true');
    scene.game.canvas.parentElement?.prepend(canvas);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, THREE_VIEW.maxPixelRatio));
    this.renderer.setSize(VIEW.width, VIEW.height, false);
    this.renderer.setClearColor(0xc8ece1);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.3;
    const ambient = new THREE.HemisphereLight(0xfffbeb, 0x96c9b3, 2.4); this.world.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff3d5, 3.1); sun.position.set(1, 10, 4); sun.target.position.set(5, 0, 4.7);
    sun.castShadow = true; sun.shadow.mapSize.set(THREE_VIEW.shadowMapSize, THREE_VIEW.shadowMapSize);
    sun.shadow.camera.left = -8; sun.shadow.camera.right = 8; sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
    sun.shadow.camera.near = 0.1; sun.shadow.camera.far = 24; sun.shadow.normalBias = 0.045; sun.shadow.bias = -0.0002;
    this.world.add(sun, sun.target, buildShopEnvironment(this.factory));
    for (const shelf of sources.shelves) {
      const model = new ShelfModel(this.factory, shelf.acceptedProductId); this.place(model.root, shelf);
      this.shelfModels.set(shelf, model);
    }
    for (const crate of sources.crates) { const model = createCrate(this.factory, crate.productId); this.place(model.root, crate); this.crateModels.set(crate, model); }
    for (const definition of SHOP.counters) { const model = createCounter(this.factory, definition.number); this.place(model.root, definition); this.counterModels.set(definition.id, model); }
    this.place(createSupplierDesk(this.factory), SHOP.supplierTerminal);
    this.world.updateMatrixWorld(true);
    this.cameraRig.setBlockers([...this.world.children].filter(object => object instanceof THREE.Group));
    this.world.add(this.cameraRig.perspective);
    for (const player of sources.players) {
      const marker = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.23, 32), new THREE.MeshBasicMaterial({ color: player.id === 1 ? THEME.colors.blue : THEME.colors.orange, transparent: true, opacity: 0.65, depthWrite: false, side: THREE.DoubleSide }));
      marker.rotation.x = -Math.PI / 2; marker.visible = false; this.world.add(marker); this.selection.set(player.id, marker);
    }
    this.labels = new WorldLabels(scene, this.project);
    this.cameraControls = new CameraModeControls(scene, this.cameraRig, sources.players.length, () => {
      for (const player of sources.players) player.controller.movementYaw = this.cameraRig.mode === 'OBLIQUE' ? null : this.cameraRig.yaw;
    });
    this.alignCanvas();
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.alignCanvas, this);
    window.addEventListener('resize', this.alignCanvas);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.onFrame, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.render(0);
  }
  private readonly alignCanvas = (): void => {
    const rect = this.scene.game.canvas.getBoundingClientRect();
    Object.assign(this.renderer.domElement.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  };
  private readonly onContextLost = (event: Event): void => { event.preventDefault(); this.contextLost = true; };
  private readonly onContextRestored = (): void => { this.contextLost = false; };
  private onFrame(_time: number, deltaMs: number): void { this.render(deltaMs); }
  private place(object: THREE.Object3D, position: Position): void {
    const point = groundTo3D(position); object.position.set(point.x, point.y, point.z); this.world.add(object);
  }
  readonly project = this.cameraRig.project;
  prepareMovement(): void {
    for (const player of this.sources.players) if (this.cameraRig.mode === 'THIRD_PERSON' && !player.controller.hasMovementInput) player.controller.movementYaw = this.cameraRig.yaw;
  }
  readonly promptProject = (position: Position, height = 0): Position & { visible: boolean } => this.cameraRig.mode === 'OBLIQUE'
    ? this.project(position, height) : { x: VIEW.width / 2, y: VIEW.height - 162, visible: true };
  select(playerId: PlayerId, target?: Interactable): void {
    const marker = this.selection.get(playerId);
    if (!marker) return;
    marker.visible = !!target;
    if (target) { const point = groundTo3D(target.interactionPosition, 0.029); marker.position.set(point.x, point.y, point.z); }
  }
  private actor(key: string, styleIndex: number, player = false): ActorRecord {
    let record = this.actors.get(key);
    if (!record) {
      const style = player ? PLAYER_STYLES[styleIndex]! : customerArchetype(styleIndex);
      const model = new CharacterModel(this.factory, style); this.world.add(model.root);
      record = { model, x: NaN, y: NaN }; this.actors.set(key, record);
    }
    return record;
  }
  private render(deltaMs: number): void {
    if (this.stopped || this.contextLost) return;
    const sources = this.sources;
    // Phaser's paused physics is also the authoritative presentation pause gate.
    const animationDelta = this.scene.physics.world.isPaused ? 0 : Math.min(deltaMs, 100);
    this.cameraRig.update(animationDelta, sources.players.map(player => player.feetPosition)); this.labels.beginFrame(); this.cameraControls.refresh();
    for (const [shelf, model] of this.shelfModels) {
      model.setStock(shelf.currentStock, shelf.maxStock);
      model.root.scale.setScalar(VISUAL_SETTINGS.reducedMotion ? 1 : shelf.scaleX); model.root.rotation.z = shelf.rotation;
      this.labels.text(shelf.id, shelf, 1.38, `${getProduct(shelf.acceptedProductId).name} · ${shelf.currentStock}/${shelf.maxStock}`);
    }
    for (const [crate, model] of this.crateModels) {
      model.root.scale.setScalar(VISUAL_SETTINGS.reducedMotion ? 1 : crate.scaleX); model.root.rotation.z = crate.rotation;
      const quantity = sources.inventory.storage.getQuantity(crate.productId);
      model.products.forEach((product, i) => { product.visible = i < quantity; });
      this.labels.text(crate.id, crate, 0.67, `${getProduct(crate.productId).name}\nKho: ${quantity}`);
    }
    this.labels.text('supplier', SHOP.supplierTerminal, 0.96, 'ĐẶT HÀNG', THEME.colors.green);
    this.labels.text('entrance', SHOP.customerExit, 0.18, entranceLabel(sources.day.state), THEME.colors.green);
    for (const station of sources.checkout.stations) {
      const model = this.counterModels.get(station.id)!;
      model.screen.material = this.factory.material(station.state === 'PROCESSING' ? THEME.colors.amber : THEME.colors.green);
      model.bar.visible = station.state === 'PROCESSING'; model.bar.scale.x = Math.max(0.001, station.progress);
      model.bar.position.x = -0.3 + 0.3 * station.progress;
      if (station.state !== 'IDLE') this.labels.text(station.id, station.position, 1.2, station.state === 'PROCESSING' ? `P${station.operatingPlayerId} · Đang tính tiền` : 'Khách đang chờ', THEME.colors.green);
    }
    const activeActors = new Set<string>();
    for (const player of sources.players) {
      const key = `player-${player.id}`; activeActors.add(key);
      const record = this.actor(key, player.id - 1, true); const p = player.feetPosition;
      const moving = Math.hypot(p.x - record.x, p.y - record.y) > 0.05;
      this.placeActor(record, p); record.model.setHeld(player.currentHeldItem);
      record.model.update(animationDelta, player.facing, moving, player.controller.sprinting, player.visual.emotion);
      record.model.root.scale.setScalar(VISUAL_SETTINGS.reducedMotion ? 1 : player.visual.figure.scaleX);
      record.model.root.visible = this.cameraRig.mode === 'OBLIQUE' || this.cameraRig.avatarVisible;
      if (this.cameraRig.mode === 'OBLIQUE') this.labels.text(key, p, 0.97, `P${player.id}${player.currentHeldItem ? ` · ${describeStack(player.currentHeldItem)}` : ''}`, player.id === 1 ? THEME.colors.blue : THEME.colors.orange);
      if (sources.players.length === 1) {
        const held = this.cameraRig.mode === 'FIRST_PERSON' ? player.currentHeldItem : null;
        const id = held?.productId ?? '';
        if (id !== this.firstPersonProduct) {
          if (this.firstPersonItem) this.cameraRig.perspective.remove(this.firstPersonItem);
          this.firstPersonProduct = id; this.firstPersonItem = held ? createProductModel(this.factory, held.productId) : null;
          if (this.firstPersonItem) { this.firstPersonItem.position.set(0.19, -0.18, -0.38); this.firstPersonItem.scale.setScalar(0.65); this.cameraRig.perspective.add(this.firstPersonItem); }
        }
      }
    }
    for (const customer of sources.customers.activeCustomers) {
      const key = `customer-${customer.id}`; activeActors.add(key); const brain = customer.brain;
      const record = this.actor(key, customer.id - 1); const p = brain.position;
      const moving = Math.hypot(p.x - record.x, p.y - record.y) > 0.05;
      this.placeActor(record, p);
      const line = brain.purchase[0]; record.model.setHeld(line ?? null);
      record.model.update(animationDelta, customer.visual.facing, moving, false, customer.visual.emotion);
      record.model.root.scale.setScalar(VISUAL_SETTINGS.reducedMotion ? 1 : customer.visual.figure.scaleX);
      const product = brain.targetProductId;
      const message = brain.feedback === 'Hết hàng!' ? 'Ôi, hết hàng rồi!' : brain.feedback === 'Cảm ơn!' ? 'Cảm ơn nhé!' : brain.feedback || (product ? getProduct(product).name : 'Ghé tiệm nha!');
      this.labels.bubble(key, p, 1.08 + (customer.id % 2) * 0.14, message, brain.feedback ? null : product, brain.state === 'OUT_OF_STOCK');
    }
    for (const [key, record] of this.actors) if (!activeActors.has(key)) { this.world.remove(record.model.root); this.actors.delete(key); }
    const activeDrops = new Set<number>();
    for (const item of sources.inventory.worldItems) {
      activeDrops.add(item.itemId); let model = this.drops.get(item.itemId);
      if (!model) { model = createProductModel(this.factory, item.productId); this.place(model, item.worldPosition); this.drops.set(item.itemId, model); }
      this.labels.text(`drop-${item.itemId}`, item.worldPosition, 0.31, `${getProduct(item.productId).name} x${item.quantity}`);
    }
    for (const [id, model] of this.drops) if (!activeDrops.has(id)) { this.world.remove(model); this.drops.delete(id); }
    this.labels.endFrame(); this.renderer.render(this.world, this.cameraRig.camera);
  }
  private placeActor(record: ActorRecord, position: Position): void {
    const point = groundTo3D(position); record.model.root.position.set(point.x, 0.015, point.z); record.x = position.x; record.y = position.y;
  }
  destroy(): void {
    if (this.stopped) return; this.stopped = true;
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.alignCanvas, this); window.removeEventListener('resize', this.alignCanvas);
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.onFrame, this);
    const canvas = this.renderer.domElement; canvas.removeEventListener('webglcontextlost', this.onContextLost); canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.labels.destroy();
    for (const player of this.sources.players) player.controller.movementYaw = null;
    for (const marker of this.selection.values()) { marker.geometry.dispose(); (marker.material as THREE.Material).dispose(); }
    this.world.traverse(object => { if (object instanceof THREE.DirectionalLight) object.shadow.dispose(); if (object instanceof THREE.InstancedMesh) object.dispose(); });
    this.factory.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss(); canvas.remove();
    this.world.clear(); this.actors.clear(); this.drops.clear(); this.selection.clear();
  }
}
