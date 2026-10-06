import type { Controls, PlayerId } from '../types/game';
import { THEME_TEXT } from '../presentation/VisualTheme.ts';

export const VIEW = { width: 1100, height: 800 };
export const WORLD = { width: 1000, height: 940, wall: 24 };
export const PLAYER = { speed: 190, sprintMultiplier: 1.55, interactionRange: 90, bodyWidth: 28, bodyHeight: 24 };
export const CAMERA = { singleZoom: 1.04, minZoom: 0.56, maxZoom: 0.94, padding: 230, smoothing: 0.08 };
export const INVENTORY = { pickupRange: 65, interactionRange: 80, shelfCapacity: 20 };
export const CONTROLS: Record<PlayerId, Controls> = {
  1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', interact: 'KeyE', pickup: 'KeyF', sprint: 'ShiftLeft', interactLabel: 'E' },
  2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', interact: 'Enter', pickup: 'Slash', sprint: 'ShiftRight', interactLabel: 'Enter' },
};
export const TEXT_STYLE = THEME_TEXT;
