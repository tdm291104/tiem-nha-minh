import type { Facing } from '../PresentationRules.ts';
import type { Position } from '../../types/game.ts';
export { stockDensity as visiblePackages } from '../VisualCatalog.ts';

export const THREE_VIEW = {
  unitsPerPixel: 0.01,
  characterHeight: 0.76,
  cameraOffsetX: 5,
  cameraHeight: 6,
  cameraDistance: 10,
  singleSpan: 8.7,
  cameraSpan: 10.5,
  maxSpan: 12.2,
  smoothingMs: 240,
  maxPixelRatio: 2,
  shadowMapSize: 1024,
  perspectiveFov: 65,
  eyeHeight: 0.65,
  thirdPersonDistance: 2.2,
  thirdPersonTargetHeight: 0.48,
  lookSensitivity: 0.004,
  minPitch: -0.65,
  maxPitch: 0.75,
  manualLookHoldMs: 750,
} as const;

export type CameraMode = 'OBLIQUE' | 'FIRST_PERSON' | 'THIRD_PERSON';
export const CAMERA_MODES: readonly CameraMode[] = ['OBLIQUE', 'FIRST_PERSON', 'THIRD_PERSON'];
export const CAMERA_MODE_LABELS: Readonly<Record<CameraMode, string>> = { OBLIQUE: 'Góc xiên', FIRST_PERSON: 'Thứ nhất', THIRD_PERSON: 'Thứ ba' };
export function cameraRelativeMovement(x: number, y: number, yaw: number): Position {
  return { x: -x * Math.cos(yaw) - y * Math.sin(yaw), y: x * Math.sin(yaw) - y * Math.cos(yaw) };
}
export function followMovementYaw(yaw: number, deltaX: number, deltaZ: number, deltaMs: number): number {
  if (Math.hypot(deltaX, deltaZ) < 0.0001) return yaw;
  const desired = Math.atan2(deltaX, deltaZ);
  const difference = Math.atan2(Math.sin(desired - yaw), Math.cos(desired - yaw));
  return yaw + difference * cameraBlend(deltaMs);
}

/** The existing navigation plane maps to X/Z; height never affects gameplay. */
export function groundTo3D(position: Position, height = 0): { x: number; y: number; z: number } {
  return { x: position.x * THREE_VIEW.unitsPerPixel, y: height, z: position.y * THREE_VIEW.unitsPerPixel };
}
export function facingYaw(facing: Facing): number {
  return { DOWN: 0, UP: Math.PI, LEFT: -Math.PI / 2, RIGHT: Math.PI / 2 }[facing];
}
export function cameraBlend(deltaMs: number): number {
  return 1 - Math.exp(-Math.max(0, deltaMs) / THREE_VIEW.smoothingMs);
}
