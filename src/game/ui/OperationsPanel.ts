import Phaser from 'phaser';
import { UI, UI_TEXT } from './UiTheme';
import { customerArchetype } from '../presentation/CharacterStyles';
import { drawUiIcon } from './UiIcons';
import { panelButton, modalPaper, type PanelButton } from './PanelPrimitives';
import type { ShopOperations } from '../operations/ShopOperations';
import { OPERATIONS } from '../operations/OperationsConfig';
import { DECORATIONS, planShelves } from '../operations/StorePlan';
import type { EmployeeRole } from '../employees/EmployeeSystem';
import type { PlayerId } from '../types/game';
import { getProduct } from '../products/ProductCatalog';
import { formatVnd } from '../economy/Money';
import type { AudioManager } from '../audio/AudioManager';
const ROLES: readonly EmployeeRole[] = ['stock', 'clean', 'cashier'];
const ROLE_NAMES: Record<EmployeeRole, string> = { stock: 'Xếp kệ', clean: 'Dọn dẹp', cashier: 'Tính tiền' };
const DECOR_NAMES = { plants: 'Chậu cây', sign: 'Biển hiệu', seating: 'Ghế nghỉ', cooler: 'Tủ lạnh kho' };
export class OperationsPanel extends Phaser.GameObjects.Container {
  private tab: 'staff' | 'layout' | 'decor' = 'staff';
  private readonly tabs = new Map<'staff' | 'layout' | 'decor', PanelButton>();
  private readonly content: Phaser.GameObjects.Container;
  private readonly message: Phaser.GameObjects.Text;
  private firstShelf = 0;
  private secondShelf = 1;
  private playerId: PlayerId = 1;
  constructor(scene: Phaser.Scene, private readonly operations: ShopOperations, private readonly modal: (open: boolean) => void, private readonly planChanged: () => void, private readonly audio: AudioManager) {
    super(scene, 0, 0); scene.add.existing(this); this.setVisible(false).setDepth(4250); scene.cameras.main.ignore(this);
    const paper = modalPaper(scene, this, 130, 75, 840, 650);
    paper.fillStyle(UI.colors.mint).fillRoundedRect(150, 95, 800, 90, 12);
    this.text(this, 170, 109, 'Sổ quản lý tiệm', 29).setFontStyle('bold');
    this.text(this, 170, 152, 'Sắp xếp việc nhà trước giờ mở cửa.', 15);
    const tabItems = [['staff', 'Nhân viên'], ['layout', 'Sắp xếp'], ['decor', 'Trang trí']] as const;
    for (const [index, [id, title]] of tabItems.entries()) this.tabs.set(id, panelButton(scene, this, 290 + index * 260, 218, title, () => { this.tab = id; this.refresh(); }, audio, true, { width: 240, height: 40 }));
    this.content = scene.add.container(0, 0); this.add(this.content);
    this.message = this.text(this, 165, 615, '', 14).setWordWrapWidth(760);
    panelButton(scene, this, 550, 679, 'Đóng sổ', () => this.close(), audio, true);
    if (operations.context.players.length > 1) panelButton(scene, this, 870, 130, 'P1 / P2', () => { this.playerId = this.playerId === 1 ? 2 : 1; this.refresh(); }, audio, true);
  }
  get isOpen(): boolean { return this.visible; }
  open(): void { if (this.visible) return; this.message.setText(''); this.refresh(); this.setVisible(true); this.modal(true); }
  close(): void { if (!this.visible) return; this.setVisible(false); this.modal(false); }
  private result(success: boolean, successText: string): void { this.message.setColor(success ? '#287f68' : '#a83e2d').setText(success ? successText : 'Không thực hiện được: kiểm tra giờ chuẩn bị, tiền, giới hạn hoặc vị trí người chơi.'); this.audio.play(success ? 'SALE_COMPLETE' : 'ERROR'); this.refresh(); }
  private refresh(): void {
    for (const [id, button] of this.tabs) button.setSelected(id === this.tab);
    this.content.removeAll(true); const o = this.operations, c = o.context;
    this.text(this.content, 165, 264, `P${this.playerId} mua cho tiệm · Tiền chung: ${formatVnd(c.economy.money)}`, 15);
    if (this.tab === 'staff') {
      this.text(this.content, 165, 300, `Thuê: ${formatVnd(OPERATIONS.employeeHireCost)} · Lương ${formatVnd(OPERATIONS.employeeWage)} / ngày / người`, 17);
      ROLES.forEach((role, index) => { const button = panelButton(this.scene, this.content, 280 + index * 270, 354, `Thuê · ${ROLE_NAMES[role]}`, () => this.result(o.staff.hire(role, c.day.gameTimeMs), 'Đã thuê nhân viên.'), this.audio, false, { width: 230 }); button.setEnabled(c.day.state === 'PREPARATION' && o.staff.actors.length < OPERATIONS.maxEmployees); });
      o.staff.actors.forEach((worker, index) => {
        const y = 419 + index * 55;
        const portrait = this.scene.add.image(183, y, `${customerArchetype(worker.record.id).key}-head-DOWN-NEUTRAL`).setDisplaySize(36, 36); this.content.add(portrait);
        this.text(this.content, 215, y - 11, `${worker.record.name} · ${ROLE_NAMES[worker.record.role]} · ${worker.record.paidDay === c.day.currentDay ? 'Đã trả lương' : 'Chưa trả lương'}`, 16);
        panelButton(this.scene, this.content, 840, y, 'Đổi việc', () => this.result(o.staff.assign(worker.record.id, ROLES[(ROLES.indexOf(worker.record.role) + 1) % ROLES.length]!), 'Đã đổi nhiệm vụ.'), this.audio, true);
      });
      if (o.staff.actors.length === 0) this.text(this.content, 165, 435, 'Chưa có nhân viên. Bạn vẫn có thể tự vận hành toàn bộ tiệm.', 16);
    } else if (this.tab === 'layout') {
      const shelves = planShelves(c.plan.checkpoint);
      this.firstShelf %= shelves.length; this.secondShelf %= shelves.length;
      this.text(this.content, 165, 305, 'Đổi vị trí hai kệ trong các ô an toàn. Hàng trên kệ được giữ nguyên.', 16);
      for (const [index, selected] of [this.firstShelf, this.secondShelf].entries()) {
        const shelf = shelves[selected]!, y = 365 + index * 60;
        this.text(this.content, 180, y - 10, `${index + 1}. ${getProduct(shelf.productId).name} · ${shelf.id}`, 19);
        panelButton(this.scene, this.content, 825, y, 'Chọn kệ', () => { if (index === 0) this.firstShelf++; else this.secondShelf++; this.refresh(); }, this.audio, true);
      }
      panelButton(this.scene, this.content, 400, 505, 'Đổi vị trí', () => { const success = c.plan.swap(shelves[this.firstShelf]!.id, shelves[this.secondShelf]!.id, c.players.map(p => p.feetPosition)); if (success) this.planChanged(); else this.result(false, ''); }, this.audio);
      panelButton(this.scene, this.content, 740, 505, `Mở rộng · ${formatVnd(OPERATIONS.expansionCost)}`, () => { if (c.plan.expand(this.playerId, c.day.gameTimeMs)) this.planChanged(); else this.result(false, ''); }, this.audio);
      this.text(this.content, 165, 555, c.plan.checkpoint.expanded ? 'Đã có gian bên phải và 3 kệ mới.' : 'Mở gian bên phải, thêm 3 kệ trống. Không tặng thêm hàng.', 16);
    } else {
      DECORATIONS.forEach((kind, index) => {
        const owned = c.plan.checkpoint.decorations.includes(kind), y = 330 + index * 60;
        const icon = this.scene.add.graphics(); drawUiIcon(icon, 190, y, kind); this.content.add(icon);
        this.text(this.content, 230, y - 9, `${DECOR_NAMES[kind]}${kind === 'cooler' ? ' · Sữa trong kho giữ được lâu hơn' : ''}`, 17);
        panelButton(this.scene, this.content, 815, y, owned ? 'Đã mua' : formatVnd(OPERATIONS.decorationCost), () => { if (c.plan.decorate(kind, this.playerId, c.day.gameTimeMs)) this.planChanged(); else this.result(false, ''); }, this.audio, owned);
      });
    }
  }
  private text(parent: Phaser.GameObjects.Container, x: number, y: number, value: string, size: number): Phaser.GameObjects.Text { const text = this.scene.add.text(x, y, value, { ...UI_TEXT, fontSize: `${size}px` }); parent.add(text); return text; }
}
