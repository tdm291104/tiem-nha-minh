import type { Position } from '../types/game.ts';
import type { GridCell, NavigationGrid } from './NavigationGrid.ts';

export function findPath(grid: NavigationGrid, from: Position, to: Position): Position[] | null {
  const start = grid.toCell(from), goal = grid.toCell(to);
  if (!start || !goal || !grid.isWalkable(start) || !grid.isWalkable(goal)) return null;
  const key = (cell: GridCell): number => cell.row * grid.columns + cell.column;
  const cell = (id: number): GridCell => ({ column: id % grid.columns, row: Math.floor(id / grid.columns) });
  const heuristic = (candidate: GridCell): number => Math.abs(candidate.column - goal.column) + Math.abs(candidate.row - goal.row);
  const startKey = key(start), goalKey = key(goal);
  if (startKey === goalKey) return [{ ...from }, { ...to }];
  const open = new Set([startKey]);
  const parents = new Map<number, number>();
  const cost = new Map([[startKey, 0]]);
  const score = new Map([[startKey, heuristic(start)]]);

  while (open.size > 0) {
    let current = -1, bestScore = Infinity;
    for (const id of open) {
      const candidateScore = score.get(id) ?? Infinity;
      if (candidateScore < bestScore) { current = id; bestScore = candidateScore; }
    }
    if (current === goalKey) {
      const route: Position[] = [];
      let cursor: number | undefined = current;
      while (cursor !== undefined) {
        route.push(grid.center(cell(cursor)));
        cursor = parents.get(cursor);
      }
      return [{ ...from }, ...route.reverse(), { ...to }];
    }
    open.delete(current);
    for (const neighbor of grid.neighbors(cell(current))) {
      const id = key(neighbor), nextCost = (cost.get(current) ?? Infinity) + 1;
      if (nextCost >= (cost.get(id) ?? Infinity)) continue;
      parents.set(id, current);
      cost.set(id, nextCost);
      score.set(id, nextCost + heuristic(neighbor));
      open.add(id);
    }
  }
  return null;
}
