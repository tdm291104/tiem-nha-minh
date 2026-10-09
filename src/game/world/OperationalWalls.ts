import { SHOP } from './ShopDefinition.ts';
import { OPERATIONS } from '../operations/OperationsConfig.ts';
import type { PlanCheckpoint } from '../operations/StorePlan.ts';
export function operationalWalls(plan: PlanCheckpoint): typeof SHOP.walls {
  const color = SHOP.walls[0]!.color, width = plan.expanded ? OPERATIONS.expandedWidth : 1000;
  // Widen the warehouse passage so NPC clearance fits beside the center refrigerator.
  const walls = SHOP.walls.filter(wall => wall.y !== 928 && wall.y !== 220 && !(plan.expanded && wall.x === 988));
  walls.push({ x: 179, y: 220, width: 310, height: 18, color }, { x: 821, y: 220, width: 310, height: 18, color });
  walls.push({ x: 202, y: 928, width: 404, height: 24, color }, { x: 798, y: 928, width: 404, height: 24, color });
  walls.push({ x: width / 2, y: OPERATIONS.exteriorHeight - 12, width, height: 24, color }, { x: 12, y: 1040, width: 24, height: 200, color }, { x: width - 12, y: 1040, width: 24, height: 200, color });
  if (plan.expanded) walls.push({ x: width - 12, y: 470, width: 24, height: 940, color }, { x: 1100, y: 12, width: 220, height: 24, color }, { x: 1100, y: 928, width: 220, height: 24, color });
  return walls;
}
