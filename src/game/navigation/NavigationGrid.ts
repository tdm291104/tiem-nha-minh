import type { Position } from '../types/game.ts';

export interface GridCell { column: number; row: number }
export interface ObstacleBounds extends Position { width: number; height: number }

export class NavigationGrid {
  readonly columns: number;
  readonly rows: number;
  readonly cellSize: number;
  readonly width: number;
  readonly height: number;
  private readonly blocked: Uint8Array;

  constructor(width: number, height: number, cellSize: number, obstacles: readonly ObstacleBounds[], clearance = 0) {
    if (![width, height, cellSize].every(value => Number.isFinite(value) && value > 0) || !Number.isFinite(clearance) || clearance < 0) {
      throw new RangeError('Navigation dimensions must be positive and clearance nonnegative');
    }
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.columns = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.blocked = new Uint8Array(this.columns * this.rows);
    for (let row = 0; row < this.rows; row++) {
      for (let column = 0; column < this.columns; column++) {
        const x = column * cellSize, y = row * cellSize;
        // Block whole intersecting cells, including NPC footprint clearance.
        const outside = x < clearance || y < clearance || x + cellSize > width - clearance || y + cellSize > height - clearance;
        const intersects = obstacles.some(rect => x < rect.x + rect.width + clearance && x + cellSize > rect.x - clearance && y < rect.y + rect.height + clearance && y + cellSize > rect.y - clearance);
        if (outside || intersects) this.blocked[row * this.columns + column] = 1;
      }
    }
  }
  toCell(position: Position): GridCell | null {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || position.x < 0 || position.y < 0 || position.x >= this.width || position.y >= this.height) return null;
    return { column: Math.floor(position.x / this.cellSize), row: Math.floor(position.y / this.cellSize) };
  }
  isWalkable(cell: GridCell): boolean {
    return Number.isInteger(cell.column) && Number.isInteger(cell.row) && cell.column >= 0 && cell.row >= 0 && cell.column < this.columns && cell.row < this.rows && this.blocked[cell.row * this.columns + cell.column] === 0;
  }
  center(cell: GridCell): Position {
    return { x: (cell.column + 0.5) * this.cellSize, y: (cell.row + 0.5) * this.cellSize };
  }
  neighbors(cell: GridCell): GridCell[] {
    return [
      { column: cell.column - 1, row: cell.row },
      { column: cell.column + 1, row: cell.row },
      { column: cell.column, row: cell.row - 1 },
      { column: cell.column, row: cell.row + 1 },
    ].filter(candidate => this.isWalkable(candidate));
  }
}
