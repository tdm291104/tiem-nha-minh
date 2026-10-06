import Phaser from 'phaser';
import { CAMERA, VIEW, WORLD } from '../config/settings';
import type { Player } from '../entities/Player';

export class ShopCamera {
  constructor(private readonly camera: Phaser.Cameras.Scene2D.Camera, private readonly players: Player[]) {
    camera.setBounds(-45, -45, WORLD.width + 90, WORLD.height + 90);
    const first = players[0];
    if (!first) throw new Error('A shop needs at least one player');
    camera.centerOn(first.x, first.y);
    camera.setZoom(players.length === 1 ? CAMERA.singleZoom : CAMERA.maxZoom);
    if (players.length === 1) camera.startFollow(first, false, CAMERA.smoothing, CAMERA.smoothing);
  }
  update(delta: number): void {
    if (this.players.length === 1) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const player of this.players) {
      minX = Math.min(minX, player.x); maxX = Math.max(maxX, player.x);
      minY = Math.min(minY, player.y); maxY = Math.max(maxY, player.y);
    }
    const zoom = Phaser.Math.Clamp(Math.min(VIEW.width / (maxX - minX + CAMERA.padding), (VIEW.height - 160) / (maxY - minY + CAMERA.padding)), CAMERA.minZoom, CAMERA.maxZoom);
    const blend = 1 - Math.pow(1 - CAMERA.smoothing, delta / (1000 / 60));
    this.camera.setZoom(Phaser.Math.Linear(this.camera.zoom, zoom, blend));
    this.camera.centerOn(Phaser.Math.Linear(this.camera.midPoint.x, (minX + maxX) / 2, blend), Phaser.Math.Linear(this.camera.midPoint.y, (minY + maxY) / 2, blend));
  }
}
