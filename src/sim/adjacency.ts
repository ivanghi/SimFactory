import type { Building, Position, WorldState } from './world';
import { getBuildingDef } from '../data/buildings';
import { EXTRACTOR_ADJACENCY_MAX, EXTRACTOR_ADJACENCY_STEP } from '../data/constants';

export function getAdjacentPositions(position: Position): Position[] {
  return [
    { x: position.x - 1, y: position.y },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y - 1 },
    { x: position.x, y: position.y + 1 }
  ];
}

export function countAdjacentSameTypeExtractors(world: WorldState, building: Building): number {
  const def = getBuildingDef(building.buildingId);
  if (!def || def.category !== 'extractor') {
    return 0;
  }
  const neighbors = getAdjacentPositions({ x: building.x, y: building.y });
  return world.buildings.filter(
    (other) =>
      other !== building &&
      other.buildingId === building.buildingId &&
      neighbors.some((position) => position.x === other.x && position.y === other.y)
  ).length;
}

export function extractorAdjacencyMultiplier(world: WorldState, building: Building): number {
  const count = countAdjacentSameTypeExtractors(world, building);
  return 1 + Math.min(count * EXTRACTOR_ADJACENCY_STEP, EXTRACTOR_ADJACENCY_MAX);
}

export function recomputeAdjacency(world: WorldState): void {
  for (const building of world.buildings) {
    const def = getBuildingDef(building.buildingId);
    building.adjacencyMultiplier =
      def?.category === 'extractor' ? extractorAdjacencyMultiplier(world, building) : 1;
  }
}
