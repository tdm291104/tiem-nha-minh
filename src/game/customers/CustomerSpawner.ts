import { CUSTOMERS } from './CustomerConfig.ts';
import type { CustomerSettings } from './CustomerConfig.ts';

export class CustomerSpawner {
  private remainingMs: number;
  private stopped = false;
  private readonly settings: Readonly<CustomerSettings>;
  private readonly random: () => number;
  constructor(settings: Readonly<CustomerSettings> = CUSTOMERS, random = Math.random) {
    this.settings = settings;
    this.random = random;
    this.remainingMs = settings.initialDelayMs;
  }
  update(deltaMs: number, activeCount: number, allowed = true): boolean {
    if (this.stopped || !allowed) return false;
    this.remainingMs = Math.max(0, this.remainingMs - deltaMs);
    if (this.remainingMs > 0 || activeCount >= this.settings.maxActive) return false;
    this.remainingMs = this.settings.spawnIntervalMinMs + this.random() * (this.settings.spawnIntervalMaxMs - this.settings.spawnIntervalMinMs);
    return true;
  }
  stop(): void { this.stopped = true; }
  start(): boolean {
    if (!this.stopped) return false;
    this.stopped = false; this.remainingMs = this.settings.initialDelayMs; return true;
  }
}
