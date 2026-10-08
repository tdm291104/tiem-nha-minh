import * as THREE from 'three';
import type { Position } from '../../types/game.ts';
import { THREE_VIEW, cameraBlend, groundTo3D, followMovementYaw } from './ThreeRules.ts';
import type { CameraMode } from './ThreeRules.ts';

export class ShopCamera3D {
  private readonly overhead = new THREE.OrthographicCamera();
  readonly perspective: THREE.PerspectiveCamera;
  private currentMode: CameraMode = 'OBLIQUE';
  yaw = Math.PI;
  private pitch = 0.12;
  private readonly target = new THREE.Vector3();
  private readonly sight = new THREE.Vector3();
  private readonly ray = new THREE.Raycaster();
  private blockers: readonly THREE.Object3D[] = [];
  private lastAnchor: Position = { x: 500, y: 750 };
  private manualLookRemainingMs = 0;
  avatarVisible = true;
  private readonly focus = new THREE.Vector3(5, 0.4, 4.7);
  private readonly projected = new THREE.Vector3();
  private span: number = THREE_VIEW.cameraSpan;
  private readonly width: number;
  private readonly height: number;
  constructor(width: number, height: number) {
    this.width = width; this.height = height;
    this.perspective = new THREE.PerspectiveCamera(THREE_VIEW.perspectiveFov, width / height, 0.025, 50);
    this.camera.near = 0.1; this.camera.far = 50;
    this.refresh();
  }
  get camera(): THREE.OrthographicCamera | THREE.PerspectiveCamera { return this.currentMode === 'OBLIQUE' ? this.overhead : this.perspective; }
  get mode(): CameraMode { return this.currentMode; }
  setBlockers(blockers: readonly THREE.Object3D[]): void { this.blockers = blockers; }
  setMode(mode: CameraMode, playerCount: number): boolean {
    if (mode !== 'OBLIQUE' && playerCount !== 1 || mode === this.currentMode) return false;
    this.currentMode = mode; this.pitch = mode === 'THIRD_PERSON' ? 0.25 : 0.12;
    this.manualLookRemainingMs = 0;
    if (mode === 'OBLIQUE') { this.avatarVisible = true; this.refresh(); } else this.refreshPerspective(this.lastAnchor);
    return true;
  }
  look(deltaX: number, deltaY: number): void {
    if (this.mode === 'OBLIQUE' || !Number.isFinite(deltaX + deltaY)) return;
    this.manualLookRemainingMs = THREE_VIEW.manualLookHoldMs;
    this.yaw -= deltaX * THREE_VIEW.lookSensitivity;
    this.yaw = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw));
    this.pitch = Math.max(THREE_VIEW.minPitch, Math.min(THREE_VIEW.maxPitch, this.pitch + deltaY * THREE_VIEW.lookSensitivity));
  }
  update(deltaMs: number, players: readonly Position[]): void {
    if (players.length === 0) return;
    if (deltaMs > 0) {
      this.manualLookRemainingMs = Math.max(0, this.manualLookRemainingMs - deltaMs);
      if (this.mode === 'THIRD_PERSON' && this.manualLookRemainingMs === 0) {
        this.yaw = followMovementYaw(this.yaw, players[0]!.x - this.lastAnchor.x, players[0]!.y - this.lastAnchor.y, deltaMs);
      }
      this.lastAnchor = { ...players[0]! };
      if (this.mode !== 'OBLIQUE') { this.refreshPerspective(this.lastAnchor); return; }
    } else if (this.mode !== 'OBLIQUE') return;
    const blend = cameraBlend(deltaMs);
    const centerX = players.reduce((sum, player) => sum + player.x, 0) / players.length;
    const centerZ = players.reduce((sum, player) => sum + player.y, 0) / players.length;
    // Follow gently without letting the room or co-op players leave the frame.
    const follow = players.length === 1 ? 0.6 : 0.18;
    this.focus.x += ((5 + (centerX / 100 - 5) * follow) - this.focus.x) * blend;
    this.focus.z += ((4.7 + (centerZ / 100 - 4.7) * follow) - this.focus.z) * blend;
    const xs = players.map(player => player.x); const ys = players.map(player => player.y);
    const spread = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 100;
    const desiredSpan = players.length === 1 ? THREE_VIEW.singleSpan : Math.min(THREE_VIEW.maxSpan, THREE_VIEW.cameraSpan + Math.max(0, spread - 4) * 0.3);
    this.span += (desiredSpan - this.span) * blend;
    this.refresh();
  }
  private refresh(): void {
    const camera = this.overhead;
    const width = this.span * this.width / this.height;
    camera.left = -width / 2; camera.right = width / 2; camera.top = this.span / 2; camera.bottom = -this.span / 2;
    camera.position.set(this.focus.x + THREE_VIEW.cameraOffsetX, this.focus.y + THREE_VIEW.cameraHeight, this.focus.z + THREE_VIEW.cameraDistance);
    camera.lookAt(this.focus); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  private refreshPerspective(anchor: Position): void {
    const ground = groundTo3D(anchor);
    this.target.set(ground.x, this.mode === 'FIRST_PERSON' ? THREE_VIEW.eyeHeight : THREE_VIEW.thirdPersonTargetHeight, ground.z);
    this.sight.set(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    const camera = this.perspective;
    this.avatarVisible = this.mode !== 'FIRST_PERSON';
    if (this.mode === 'FIRST_PERSON') {
      camera.position.copy(this.target); camera.lookAt(this.target.clone().add(this.sight));
    } else {
      this.ray.set(this.target, this.sight.clone().negate()); this.ray.far = THREE_VIEW.thirdPersonDistance;
      const hit = this.ray.intersectObjects([...this.blockers], true).find(candidate => candidate.object instanceof THREE.Mesh && candidate.object.visible && (!(candidate.object.material instanceof THREE.Material) || !candidate.object.material.transparent));
      const distance = hit ? Math.max(0.08, hit.distance - 0.08) : THREE_VIEW.thirdPersonDistance;
      camera.position.copy(this.target).addScaledVector(this.sight, -distance);
      // A tight wall changes the camera perch, never makes a third-person avatar vanish.
      if (distance < 0.65) { camera.position.copy(this.target).addScaledVector(this.sight, -0.06); camera.position.y = this.target.y + 0.95; }
      this.avatarVisible = true;
      camera.lookAt(this.target);
    }
    camera.updateMatrixWorld();
  }
  readonly project = (position: Position, height = 0): Position & { visible: boolean } => {
    const point = groundTo3D(position, height);
    this.projected.set(point.x, point.y, point.z).project(this.camera);
    const visible = this.projected.z >= -1 && this.projected.z <= 1 && Math.abs(this.projected.x) <= 1 && Math.abs(this.projected.y) <= 1;
    return { x: (this.projected.x + 1) * this.width / 2, y: (1 - this.projected.y) * this.height / 2, visible };
  };
}
