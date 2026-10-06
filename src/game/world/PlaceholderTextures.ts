import type Phaser from 'phaser';
import { createChibiTextures } from '../presentation/ChibiTextures';
import { createProductTextures } from '../presentation/ProductTextures';
import { createFurnitureTextures } from '../presentation/FurnitureTextures';

export function createPlaceholderTextures(scene: Phaser.Scene): void {
  createProductTextures(scene);
  createChibiTextures(scene);
  createFurnitureTextures(scene);
}
