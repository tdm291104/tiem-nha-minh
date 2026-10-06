import type { Player } from '../entities/Player';
import type { Position } from '../types/game';

export interface Interactable {
  readonly id: string;
  readonly interactionPosition: Position;
  readonly interactionRange: number;
  canInteract(player: Player): boolean;
  promptText(player: Player): string;
  interact(player: Player): void;
}
