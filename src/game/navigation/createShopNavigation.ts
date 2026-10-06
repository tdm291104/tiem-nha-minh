import Phaser from 'phaser';
import { WORLD } from '../config/settings';
import { CUSTOMERS } from '../customers/CustomerConfig';
import { NavigationGrid } from './NavigationGrid';

export function createShopNavigation(obstacles: Phaser.Physics.Arcade.StaticGroup): NavigationGrid {
  const bounds = obstacles.getChildren().flatMap(obstacle => {
    if (!(obstacle instanceof Phaser.GameObjects.Rectangle)) return [];
    const rect = obstacle.getBounds();
    return [{ x: rect.x, y: rect.y, width: rect.width, height: rect.height }];
  });
  return new NavigationGrid(WORLD.width, WORLD.height, CUSTOMERS.gridCellSize, bounds, CUSTOMERS.clearance);
}
