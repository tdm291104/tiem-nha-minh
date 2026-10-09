import type { PlayerId, Position } from '../types/game.ts';
import type { SaleTransaction } from './SaleTransaction.ts';
import { CheckoutQueue } from './CheckoutQueue.ts';
import { CHECKOUT } from './CheckoutConfig.ts';

export interface CashierDefinition extends Position {
  readonly id: string;
  readonly number: number;
  readonly width: number;
  readonly height: number;
  readonly interactionPosition: Position;
  readonly queuePositions: readonly Position[];
}
export type CashierState = 'IDLE' | 'HAS_CUSTOMER' | 'PROCESSING';

export class CashierStation {
  readonly id: string;
  readonly position: Position;
  readonly interactionPosition: Position;
  readonly queue: CheckoutQueue;
  private readyCustomerId: number | null = null;
  private job: { sale: SaleTransaction; elapsedMs: number; durationMs: number } | null = null;
  constructor(definition: CashierDefinition, capacity = CHECKOUT.maxQueueLength) {
    this.id = definition.id;
    this.position = Object.freeze({ x: definition.x, y: definition.y });
    this.interactionPosition = Object.freeze({ ...definition.interactionPosition });
    this.queue = new CheckoutQueue(definition.queuePositions, capacity);
  }
  get currentCustomerId(): number | null { return this.queue.front; }
  get state(): CashierState { return this.job ? 'PROCESSING' : this.readyCustomerId !== null && this.readyCustomerId === this.queue.front ? 'HAS_CUSTOMER' : 'IDLE'; }
  get progress(): number { return this.job ? Math.min(1, this.job.elapsedMs / this.job.durationMs) : 0; }
  get operatingPlayerId(): PlayerId | null { return this.job?.sale.playerId ?? null; }
  get operatingEmployeeId(): number | null { return this.job?.sale.employeeId ?? null; }
  markReady(customerId: number): boolean {
    if (this.job || this.queue.front !== customerId) return false;
    this.readyCustomerId = customerId;
    return true;
  }
  start(sale: SaleTransaction, durationMs: number): boolean {
    if (this.state !== 'HAS_CUSTOMER' || sale.customerId !== this.queue.front) return false;
    this.job = { sale, elapsedMs: 0, durationMs };
    return true;
  }
  update(deltaMs: number): SaleTransaction | null {
    if (!this.job) return null;
    this.job.elapsedMs += deltaMs;
    if (this.job.elapsedMs < this.job.durationMs) return null;
    const sale = this.job.sale;
    this.job = null;
    this.readyCustomerId = null;
    return sale;
  }
  remove(customerId: number): void {
    if (this.job?.sale.customerId === customerId) this.job = null;
    if (this.readyCustomerId === customerId) this.readyCustomerId = null;
    this.queue.remove(customerId);
  }
  clear(): void { this.job = null; this.readyCustomerId = null; this.queue.clear(); }
}
