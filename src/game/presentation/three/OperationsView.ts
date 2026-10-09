import * as THREE from 'three';
import type { ShopOperations } from '../../operations/ShopOperations';
import { DELIVERY_DOCK, STOCK_RECEIVING, TOOL_RACK } from '../../operations/OperationsConfig';
import { THEME } from '../VisualTheme';
import { customerArchetype } from '../CharacterStyles';
import { facingFromMovement, type Facing } from '../PresentationRules';
import { groundTo3D, facingYaw } from './ThreeRules';
import type { ModelFactory } from './ModelFactory';
import { CharacterModel } from './CharacterModel';
import type { WorldLabels } from './WorldLabels';
import { getProduct } from '../../products/ProductCatalog';
interface WorkerModel { model: CharacterModel; x: number; y: number; facing: Facing }
export class OperationsView {
  private readonly dirt = new Map<number, THREE.Group>();
  private readonly workers = new Map<number, WorkerModel>();
  private readonly tools = new Map<number, THREE.Group>();
  private readonly boxes: THREE.Mesh[] = [];
  private readonly root = new THREE.Group();
  constructor(private readonly f: ModelFactory, world: THREE.Scene, private readonly operations: ShopOperations) {
    this.root.userData.cameraObstacle = false; world.add(this.root); const staticRoot = new THREE.Group(); world.add(staticRoot); const c = THEME.colors;
    f.box(staticRoot, 7, 0.45, 10.5, 1.9, 0.8, 0.85, c.greenSoft);
    f.box(staticRoot, 7.9, 0.37, 10.5, 0.4, 0.65, 0.83, c.blue);
    f.box(staticRoot, 7.92, 0.56, 10.09, 0.25, 0.26, 0.015, c.glass);
    for (const x of [6.3, 7.85]) for (const z of [10.12, 10.88]) { const wheel = f.cylinder(staticRoot, x, 0.15, z, 0.15, 0.09, c.trousers); wheel.rotation.x = Math.PI / 2; }
    f.sign(staticRoot, 'GIAO HÀNG', 6.8, 0.55, 10.94, 1.2, 0.25, c.green);
    for (let i = 0; i < 6; i++) this.boxes.push(f.box(staticRoot, 5.65 + (i % 2) * 0.29, 0.15 + Math.floor(i / 2) * 0.25, 10.52, 0.25, 0.25, 0.26, c.wood));
    for (const [position, color] of [[STOCK_RECEIVING, c.amber], [TOOL_RACK, c.blue]] as const) { const p = groundTo3D(position); f.box(this.root, p.x, 0.02, p.z, 0.6, 0.03, 0.45, color); }
    const rack = groundTo3D(TOOL_RACK); f.box(this.root, rack.x, 0.3, rack.z, 0.045, 0.6, 0.045, c.wood); f.box(this.root, rack.x, 0.08, rack.z, 0.3, 0.1, 0.09, c.amber);
  }
  update(deltaMs: number, labels: WorldLabels): void {
    const o = this.operations, c = o.context;
    const cargo = c.cargo.checkpoint.remaining.filter(line => line.quantity > 0);
    const quantity = cargo.reduce((sum, line) => sum + line.quantity, 0);
    this.boxes.forEach((box, i) => { box.visible = i < Math.ceil(quantity / 5); });
    labels.text('delivery-dock', DELIVERY_DOCK, 0.55, cargo.length ? `XE GIAO HÀNG\n${getProduct(cargo[0]!.productId).name} · Còn ${quantity} món` : 'ĐIỂM GIAO HÀNG');
    labels.text('receiving', STOCK_RECEIVING, 0.1, 'NHẬN HÀNG · Mở thùng', THEME.colors.woodDark);
    labels.text('tool-rack', TOOL_RACK, 0.75, 'CHỔI / CÂY LAU');
    const active = new Set<number>();
    for (const spot of c.cleaning.dirt) {
      active.add(spot.id); let model = this.dirt.get(spot.id);
      if (!model) {
        model = new THREE.Group(); const p = groundTo3D(spot.position); model.position.set(p.x, 0.02, p.z); this.root.add(model); this.dirt.set(spot.id, model);
        if (spot.kind === 'spill') this.f.sphere(model, 0, 0, 0, 0.52, 0.015, 0.32, THEME.colors.blueSoft);
        else for (let i = 0; i < 3; i++) { const piece = this.f.box(model, (i - 1) * 0.12, 0.01, (i % 2) * 0.09, 0.1, 0.01, 0.06, i % 2 ? THEME.colors.paper : THEME.colors.labelRed); piece.rotation.y = i; }
      }
      const progress = c.cleaning.progress(spot.id);
      if (progress > 0) labels.text(`clean-${spot.id}`, spot.position, 0.12, `Đang dọn ${Math.round(progress * 100)}%`);
    }
    for (const [id, model] of this.dirt) if (!active.has(id)) { this.root.remove(model); this.dirt.delete(id); }
    for (const worker of o.staff.actors) {
      let record = this.workers.get(worker.record.id);
      if (!record) { const style = { ...customerArchetype(worker.record.id), apron: true }; const model = new CharacterModel(this.f, style); this.root.add(model.root); record = { model, x: worker.navigation.position.x, y: worker.navigation.position.y, facing: 'DOWN' }; this.workers.set(worker.record.id, record); }
      const p = worker.navigation.position, dx = p.x - record.x, dy = p.y - record.y; record.facing = facingFromMovement(dx, dy, record.facing); const point = groundTo3D(p);
      record.model.root.position.set(point.x, 0.015, point.z); record.model.setHeld(worker.held); record.model.update(deltaMs, record.facing, Math.hypot(dx, dy) > 0.01, false, 'FOCUSED'); record.x = p.x; record.y = p.y;
      labels.text(`employee-${worker.record.id}`, p, 1, `${worker.record.name} · ${worker.task}`, THEME.colors.green);
    }
    for (const player of c.players) {
      const tool = c.cleaning.tool(player.id); let model = this.tools.get(player.id);
      if (!tool) { if (model) model.visible = false; continue; }
      if (!model) { model = new THREE.Group(); this.f.box(model, 0, 0.35, 0, 0.02, 0.7, 0.02, THEME.colors.woodDark); this.f.box(model, 0, 0.045, 0, 0.21, 0.07, 0.09, THEME.colors.amber); this.root.add(model); this.tools.set(player.id, model); }
      const p = groundTo3D(player.feetPosition); model.visible = true; model.position.set(p.x + 0.18, 0.02, p.z + 0.14); model.rotation.y = facingYaw(player.facing);
      labels.text(`tool-${player.id}`, player.feetPosition, 1.16, tool === 'broom' ? 'Chổi' : 'Cây lau', THEME.colors.blue);
    }
  }
}
