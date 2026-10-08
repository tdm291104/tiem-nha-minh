import Phaser from 'phaser';
import { createPlaceholderTextures } from '../world/PlaceholderTextures';
import { createMenuArt } from '../presentation/three/MenuArt';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }
  create(): void {
    createPlaceholderTextures(this);
    createMenuArt(this);
    this.scene.start('MenuScene');
  }
}
