export type PlayerId = 1 | 2;
export interface Position { x: number; y: number }
export interface Controls {
  up: string;
  down: string;
  left: string;
  right: string;
  interact: string;
  pickup: string;
  sprint: string;
  interactLabel: string;
}
export interface ShopSceneData { playerCount: 1 | 2 }
