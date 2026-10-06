import Phaser from 'phaser';
import type { Position } from '../types/game';

export function hasClearPath(obstacles: Phaser.Physics.Arcade.StaticGroup, from: Position, to: Position): boolean {
  const line = new Phaser.Geom.Line(from.x, from.y, to.x, to.y);
  return !obstacles.getChildren().some(obstacle =>
    obstacle instanceof Phaser.GameObjects.Rectangle && Phaser.Geom.Intersects.LineToRectangle(line, obstacle.getBounds()),
  );
}
