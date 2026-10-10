import type { Player } from '../entities/Player';
import type { Shelf } from '../entities/Shelf';
import type { InventorySystem } from '../systems/InventorySystem';
import type { CustomerManager } from '../customers/CustomerManager';
import type { StoreEconomy } from '../economy/StoreEconomy';
import type { SupplierSystem } from '../supplier/SupplierSystem';
import type { DayManager } from '../day/DayManager';
import type { UpgradeSystem } from '../upgrades/UpgradeSystem';
import type { ShopOperations } from '../operations/ShopOperations';
import { type GameSave, browserSaves, economyCheckpoint, recoverUnpaidGoods } from './GameSave.ts';
import { StoreStorage } from '../inventory/StoreStorage.ts';
import { planShelves } from '../operations/StorePlan.ts';

interface ProgressSources {
  players: readonly Player[];
  shelves: readonly Shelf[];
  inventory: InventorySystem;
  customers: CustomerManager;
  economy: StoreEconomy;
  supplier: SupplierSystem;
  day: DayManager;
  upgrades: UpgradeSystem;
  operations?: ShopOperations;
}

export class ShopProgress {
  private elapsedMs = 0;
  private readonly repository = browserSaves();
  private readonly sources: ProgressSources;
  private readonly onSaveResult: (saved: boolean) => void;

  constructor(sources: ProgressSources, onSaveResult: (saved: boolean) => void = () => {}) { this.sources = sources; this.onSaveResult = onSaveResult; }

  snapshot(): GameSave {
    const s = this.sources;
    const customers = s.customers.activeCustomers;
    if (new Set(customers.map(customer => customer.id)).size !== customers.length) throw new RangeError('Duplicate customer recovery');
    const operations = s.operations?.checkpoint;
    const day = s.day.checkpoint;
    const outOfStockIds = new Set(day.outOfStockIds);
    const shelfById = new Map(s.shelves.map(shelf => [shelf.id, shelf]));
    const definitions = operations ? planShelves(operations.plan) : s.shelves;
    let storage: StoreStorage['snapshot'];

    // Recover into the checkpoint only; the live shop keeps its unpaid carts.
    if (operations) {
      const recovered = new StoreStorage(s.inventory.storage.snapshot, s.inventory.storage.batchSnapshot);
      for (const customer of customers) {
        if (!s.economy.hasServed(customer.id)) recovered.addBatch(customer.brain.purchase);
      }
      for (const employee of s.operations?.staff.actors ?? []) {
        if (employee.held) recovered.addBatch([employee.held]);
      }
      storage = recovered.snapshot;
      operations.storageBatches = recovered.batchSnapshot;
      operations.shelfBatches = definitions.map(shelf => ({
        id: shelf.id,
        batches: shelfById.get(shelf.id)?.stock.batchSnapshot ?? [],
      }));
    } else {
      storage = recoverUnpaidGoods(
        s.inventory.storage.snapshot,
        customers.map(customer => ({ id: customer.id, items: customer.brain.purchase })),
        id => s.economy.hasServed(id),
      );
    }
    for (const customer of customers) {
      if (customer.brain.hadUnavailableProduct) outOfStockIds.add(customer.id);
    }

    return {
      version: 1,
      players: s.players.map(player => ({ id: player.id, position: player.position, held: player.currentHeldItem })),
      storage,
      shelves: definitions.map(shelf => ({ id: shelf.id, stock: shelfById.get(shelf.id)?.currentStock ?? 0 })),
      drops: s.inventory.worldItems.map(item => ({ position: item.worldPosition, stack: item.stack })),
      economy: economyCheckpoint(s.economy),
      day: { ...day, outOfStockIds: [...outOfStockIds] },
      supplier: s.supplier.checkpoint,
      nextCustomerId: s.customers.nextCustomerId,
      upgrades: s.upgrades.snapshot,
      ...(operations ? { operations } : {}),
    };
  }

  save(): boolean {
    let saved = false;
    try { saved = this.repository?.write(this.snapshot()) ?? false; }
    catch { /* Snapshot failure must leave the previous save intact. */ }
    this.onSaveResult(saved);
    return saved;
  }

  update(deltaMs: number): void {
    this.elapsedMs += deltaMs;
    if (this.elapsedMs >= 5000) {
      this.elapsedMs = 0;
      this.save();
    }
  }
}
