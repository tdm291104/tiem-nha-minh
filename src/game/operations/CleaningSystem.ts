import type { Position, PlayerId } from '../types/game.ts';
import { DIRT_POSITIONS, OPERATIONS } from './OperationsConfig.ts';
export type CleaningTool = 'broom' | 'mop';
export interface DirtSpot { readonly id: number; readonly position: Position; readonly kind: 'litter' | 'spill' }
export interface CleaningCheckpoint { spots: readonly DirtSpot[]; nextId: number; visits: number; tools: readonly { playerId: PlayerId; tool: CleaningTool }[] }
interface CleaningJob { actorId: string; spotId: number; elapsedMs: number }
export class CleaningSystem {
  private spots: DirtSpot[] = [];
  private nextId = 1;
  private visits = 0;
  private readonly jobs = new Map<string, CleaningJob>();
  private readonly tools = new Map<PlayerId, CleaningTool>();
  get dirt(): readonly DirtSpot[] { return this.spots; }
  get cleanliness(): number { return Math.max(0, 100 - this.spots.length * 10); }
  tool(playerId: PlayerId): CleaningTool | null { return this.tools.get(playerId) ?? null; }
  cycleTool(playerId: PlayerId): void {
    const tool = this.tool(playerId); this.jobs.delete(`player-${playerId}`);
    if (!tool) this.tools.set(playerId, 'broom'); else if (tool === 'broom') this.tools.set(playerId, 'mop'); else this.tools.delete(playerId);
  }
  recordVisit(): void {
    this.visits++;
    if (this.visits % OPERATIONS.visitsPerDirt !== 0 || this.spots.length >= OPERATIONS.maxDirt) return;
    const position = DIRT_POSITIONS.find(candidate => !this.spots.some(spot => spot.position.x === candidate.x && spot.position.y === candidate.y));
    if (position) this.spots.push(Object.freeze({ id: this.nextId++, position: { ...position }, kind: this.nextId % 3 === 0 ? 'spill' : 'litter' }));
  }
  start(actorId: string, spotId: number, tool: CleaningTool): boolean {
    const spot = this.spots.find(spot => spot.id === spotId);
    if (!spot || this.jobs.has(actorId) || [...this.jobs.values()].some(job => job.spotId === spotId) || tool !== (spot.kind === 'spill' ? 'mop' : 'broom')) return false;
    this.jobs.set(actorId, { actorId, spotId, elapsedMs: 0 }); return true;
  }
  progress(spotId: number): number { const job = [...this.jobs.values()].find(job => job.spotId === spotId); return job ? Math.min(1, job.elapsedMs / OPERATIONS.cleaningMs) : 0; }
  isBusy(actorId: string): boolean { return this.jobs.has(actorId); }
  update(deltaMs: number, positionFor: (actorId: string) => Position | null): void {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Invalid cleaning delta');
    for (const [actorId, job] of this.jobs) {
      const spot = this.spots.find(spot => spot.id === job.spotId), position = positionFor(actorId);
      if (!spot || !position || Math.hypot(position.x - spot.position.x, position.y - spot.position.y) > OPERATIONS.cleaningRange) { this.jobs.delete(actorId); continue; }
      job.elapsedMs += deltaMs;
      if (job.elapsedMs >= OPERATIONS.cleaningMs) { this.spots = this.spots.filter(spot => spot.id !== job.spotId); this.jobs.delete(actorId); }
    }
  }
  get checkpoint(): CleaningCheckpoint { return { spots: this.spots.map(spot => ({ ...spot, position: { ...spot.position } })), visits: this.visits, nextId: this.nextId, tools: [...this.tools].map(([playerId, tool]) => ({ playerId, tool })) }; }
  restore(saved: CleaningCheckpoint): void {
    if (new Set(saved.spots.map(spot => `${spot.position.x},${spot.position.y}`)).size !== saved.spots.length) throw new RangeError('Overlapping dirt spots');
    if (!Number.isSafeInteger(saved.visits) || saved.visits < 0 || !Number.isSafeInteger(saved.nextId) || saved.nextId < 1 || saved.spots.length > OPERATIONS.maxDirt || new Set(saved.spots.map(spot => spot.id)).size !== saved.spots.length) throw new RangeError('Invalid cleaning save');
    for (const spot of saved.spots) if (!Number.isSafeInteger(spot.id) || spot.id <= 0 || spot.id >= saved.nextId || !['litter', 'spill'].includes(spot.kind) || !DIRT_POSITIONS.some(p => p.x === spot.position.x && p.y === spot.position.y)) throw new RangeError('Invalid dirt spot');
    if (new Set(saved.tools.map(tool => tool.playerId)).size !== saved.tools.length || saved.tools.some(tool => (tool.playerId !== 1 && tool.playerId !== 2) || !['broom', 'mop'].includes(tool.tool))) throw new RangeError('Invalid saved tool');
    this.spots = saved.spots.map(spot => Object.freeze({ ...spot, position: { ...spot.position } })); this.nextId = saved.nextId; this.visits = saved.visits; this.tools.clear(); this.jobs.clear();
    for (const tool of saved.tools) this.tools.set(tool.playerId, tool.tool);
  }
}
