export interface CustomerSettings {
  initialDelayMs: number;
  spawnIntervalMinMs: number;
  spawnIntervalMaxMs: number;
  maxActive: number;
  movementSpeed: number;
  desiredQuantity: number;
  browseMinMs: number;
  browseMaxMs: number;
  outOfStockWaitMs: number;
  patienceMs: number;
  gridCellSize: number;
  clearance: number;
  debugStates: boolean;
}

export const CUSTOMERS: Readonly<CustomerSettings> = {
  initialDelayMs: 2000,
  spawnIntervalMinMs: 4000,
  spawnIntervalMaxMs: 8000,
  maxActive: 5,
  movementSpeed: 95,
  desiredQuantity: 1,
  browseMinMs: 500,
  browseMaxMs: 1500,
  outOfStockWaitMs: 1200,
  patienceMs: 45000,
  gridCellSize: 20,
  clearance: 16,
  debugStates: false,
};

