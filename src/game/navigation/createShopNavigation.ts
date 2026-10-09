import Phaser from 'phaser';
import { WORLD } from '../config/settings';
import { CUSTOMERS } from '../customers/CustomerConfig';
import { NavigationGrid } from './NavigationGrid';

export function createShopNavigation(obstacles: Phaser.Physics.Arcade.StaticGroup, width = WORLD.width, height = WORLD.height): NavigationGrid {
  const bounds = obstacles.getChildren().flatMap(obstacle => {
    if (!(obstacle instanceof Phaser.GameObjects.Rectangle)) return [];
    const rect = obstacle.getBounds();
    return [{ x: rect.x, y: rect.y, width: rect.width, height: rect.height }];
  });
  return new NavigationGrid(width, height, CUSTOMERS.gridCellSize, bounds, CUSTOMERS.clearance);
}
