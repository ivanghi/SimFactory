import type { Building, Position, WorldState } from './world';
import { getBuildingDef } from '../data/buildings';
import {
  COAL_GENERATOR_ID,
  COAL_GENERATOR_WATER_BONUS,
  EXTRACTOR_ADJACENCY_MAX,
  EXTRACTOR_ADJACENCY_STEP,
  SOLAR_ADJACENCY_MAX,
  SOLAR_ADJACENCY_STEP,
  SOLAR_PANEL_ID
} from '../data/constants';

export function getAdjacentPositions(position: Position): Position[] {
  return [
    { x: position.x - 1, y: position.y },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y - 1 },
    { x: position.x, y: position.y + 1 }
  ];
}

export function getSurroundingPositions(position: Position): Position[] {
  const positions: Position[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx !== 0 || dy !== 0) {
        positions.push({ x: position.x + dx, y: position.y + dy });
      }
    }
  }
  return positions;
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

export function countAdjacentSolarPanels(world: WorldState, building: Building): number {
  if (building.buildingId !== SOLAR_PANEL_ID) {
    return 0;
  }
  const neighbors = getSurroundingPositions({ x: building.x, y: building.y });
  return world.buildings.filter(
    (other) =>
      other !== building &&
      other.buildingId === SOLAR_PANEL_ID &&
      neighbors.some((position) => position.x === other.x && position.y === other.y)
  ).length;
}

export function solarAdjacencyMultiplier(world: WorldState, building: Building): number {
  const count = countAdjacentSolarPanels(world, building);
  return 1 + Math.min(count * SOLAR_ADJACENCY_STEP, SOLAR_ADJACENCY_MAX);
}

export function isAdjacentToWater(world: WorldState, building: Building): boolean {
  return getAdjacentPositions({ x: building.x, y: building.y }).some(
    (position) => world.map.tiles[position.y]?.[position.x]?.type === 'water'
  );
}

export function coalGeneratorAdjacencyMultiplier(world: WorldState, building: Building): number {
  return isAdjacentToWater(world, building) ? 1 + COAL_GENERATOR_WATER_BONUS : 1;
}

function buildingAdjacencyMultiplier(world: WorldState, building: Building): number {
  const def = getBuildingDef(building.buildingId);
  if (!def) {
    return 1;
  }
  if (def.category === 'extractor') {
    return extractorAdjacencyMultiplier(world, building);
  }
  if (building.buildingId === SOLAR_PANEL_ID) {
    return solarAdjacencyMultiplier(world, building);
  }
  if (building.buildingId === COAL_GENERATOR_ID) {
    return coalGeneratorAdjacencyMultiplier(world, building);
  }
  return 1;
}

export function recomputeAdjacency(world: WorldState): void {
  for (const building of world.buildings) {
    building.adjacencyMultiplier = buildingAdjacencyMultiplier(world, building);
  }
}
