import Phaser from 'phaser';
import type { Player } from '../entities/Player';
import type { Interactable } from './Interactable';
import { InteractionPrompt } from '../ui/InteractionPrompt';
import { hasClearPath } from '../world/WorldCollision';

export class InteractionSystem {
  private readonly prompts = new Map<Player, InteractionPrompt>();
  constructor(scene: Phaser.Scene, players: Player[], private readonly targets: Interactable[], private readonly obstacles: Phaser.Physics.Arcade.StaticGroup) {
    for (const player of players) this.prompts.set(player, new InteractionPrompt(scene));
  }
  hide(): void { for (const prompt of this.prompts.values()) prompt.hide(); }
  update(players: Player[]): void {
    for (const player of players) {
      let closest: Interactable | undefined;
      let closestDistance = Infinity;
      for (const target of this.targets) {
        const distance = Phaser.Math.Distance.BetweenPoints(player.feetPosition, target.interactionPosition);
        if (distance <= Math.min(player.interactionRange, target.interactionRange) && distance < closestDistance && target.canInteract(player) && hasClearPath(this.obstacles, player.feetPosition, target.interactionPosition)) {
          closest = target;
          closestDistance = distance;
        }
      }
      const prompt = this.prompts.get(player);
      if (closest) prompt?.show(player, closest);
      else prompt?.hide();
      if (player.controller.consume('interact') && closest) closest.interact(player);
    }
  }
}
