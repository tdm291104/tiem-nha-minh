import Phaser from 'phaser';
import type { ShopOperations } from '../operations/ShopOperations';
import { DELIVERY_DOCK, STOCK_RECEIVING, TOOL_RACK } from '../operations/OperationsConfig';
import { TEXT_STYLE } from '../config/settings';
import { THEME } from './VisualTheme';
import { CharacterView } from './CharacterView';
import { customerArchetype } from './CharacterStyles';
import { groundDepth } from './VisualCatalog';
export class Operations2DView {
  readonly root: Phaser.GameObjects.Container;
  private readonly dirt: Phaser.GameObjects.Graphics;
  private readonly workers = new Map<number, { view: CharacterView; label: Phaser.GameObjects.Text; x: number; y: number }>();
  constructor(private readonly scene: Phaser.Scene, private readonly operations: ShopOperations, private readonly exclude: (object: Phaser.GameObjects.GameObject) => void) {
    this.root = scene.add.container(0, 0).setDepth(2);
    const graphics = scene.add.graphics().fillStyle(THEME.colors.greenSoft).fillRoundedRect(605, 1005, 190, 86, 12).fillStyle(THEME.colors.blue).fillRoundedRect(765, 1020, 42, 70, 5);
    this.dirt = scene.add.graphics(); this.root.add([graphics, this.dirt]);
    const decorations = operations.context.plan.checkpoint.decorations;
    if (decorations.includes('plants')) for (const x of [50, 950]) graphics.fillStyle(THEME.colors.orange).fillRoundedRect(x - 12, 690, 24, 20, 4).fillStyle(THEME.colors.green).fillEllipse(x, 680, 32, 40);
    if (decorations.includes('seating')) for (const x of [100, 150]) graphics.fillStyle(THEME.colors.labelRed).fillRoundedRect(x - 13, 1057, 26, 26, 4);
    if (decorations.includes('cooler')) graphics.fillStyle(THEME.colors.paper).fillRoundedRect(35, 30, 40, 60, 4).lineStyle(2, THEME.colors.blue).strokeRoundedRect(39, 34, 32, 52, 3);
    if (decorations.includes('sign')) this.root.add(scene.add.text(500, 28, 'HÀNG NGON · GIÁ HIỀN', { ...TEXT_STYLE, fontSize: '16px', backgroundColor: '#fff7df' }).setOrigin(0.5));
    for (const [position, label] of [[DELIVERY_DOCK, 'XE GIAO HÀNG'], [STOCK_RECEIVING, 'NHẬN HÀNG'], [TOOL_RACK, 'CHỔI / CÂY LAU']] as const) this.root.add(scene.add.text(position.x, position.y - 18, label, { ...TEXT_STYLE, fontSize: '13px', backgroundColor: '#fff7df' }).setOrigin(0.5));
    exclude(this.root);
  }
  update(deltaMs: number): void {
    this.dirt.clear();
    for (const spot of this.operations.context.cleaning.dirt) {
      this.dirt.fillStyle(spot.kind === 'spill' ? THEME.colors.blue : THEME.colors.woodDark, 0.55).fillEllipse(spot.position.x, spot.position.y, 40, 23);
      this.dirt.lineStyle(3, THEME.colors.green).lineBetween(spot.position.x - 20, spot.position.y + 15, spot.position.x - 20 + 40 * this.operations.context.cleaning.progress(spot.id), spot.position.y + 15);
    }
    for (const worker of this.operations.staff.actors) {
      let record = this.workers.get(worker.record.id);
      if (!record) { const view = new CharacterView(this.scene, { ...customerArchetype(worker.record.id), apron: true }), label = this.scene.add.text(0, 0, '', { ...TEXT_STYLE, fontSize: '12px', backgroundColor: '#fff7df' }).setOrigin(0.5); record = { view, label, x: worker.navigation.position.x, y: worker.navigation.position.y }; this.workers.set(worker.record.id, record); this.exclude(view); this.exclude(label); }
      const p = worker.navigation.position; record.view.setPosition(p.x, p.y).setDepth(groundDepth(p.y)); record.view.updateVisual(deltaMs, p.x - record.x, p.y - record.y); record.label.setPosition(p.x, p.y - 90).setText(`${worker.record.name} · ${worker.task}`).setDepth(groundDepth(p.y) + 1); record.x = p.x; record.y = p.y;
    }
  }
}
