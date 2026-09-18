import { Map } from './mapgen';
import { recomputeAdjacency } from './adjacency';
import { getBuildingDef } from '../data/buildings';
import { milestones } from '../data/milestones';
import {
  BASE_STORAGE_CAP,
  DEMOLISH_REFUND_RATE,
  STARTING_RESOURCES,
  WAREHOUSE_CAP_BONUS,
  WAREHOUSE_ID
} from '../data/constants';

export interface Position {
  x: number;
  y: number;
}

export interface Building {
  id: string;
  buildingId: string;
  x: number;
  y: number;
  adjacencyMultiplier: number;
  progress: number;
}

export interface PowerState {
  supply: number;
  demand: number;
  efficiency: number;
}

export interface WorldState {
  map: Map;
  buildings: Building[];
  stockpile: Record<string, number>;
  unlocked: Record<string, boolean>;
  milestoneProgress: Record<string, number>;
  time: number;
  nextBuildingId: number;
  power: PowerState;
}

export type PlacementError =
  | 'unknown-building'
  | 'locked'
  | 'out-of-bounds'
  | 'not-buildable'
  | 'wrong-node'
  | 'occupied'
  | 'insufficient-resources';

export interface PlacementResult {
  ok: boolean;
  error?: PlacementError;
  building?: Building;
}

export function createWorld(map: Map): WorldState {
  const unlocked: Record<string, boolean> = {};
  for (const def of milestones) {
    unlocked[def.id] = def.unlockedBy === 'start';
  }
  return {
    map,
    buildings: [],
    stockpile: { ...STARTING_RESOURCES },
    unlocked,
    milestoneProgress: {},
    time: 0,
    nextBuildingId: 1,
    power: { supply: 0, demand: 0, efficiency: 1 }
  };
}

export function getStorageCap(world: WorldState): number {
  const warehouses = world.buildings.filter(
    (building) => building.buildingId === WAREHOUSE_ID
  ).length;
  return BASE_STORAGE_CAP + warehouses * WAREHOUSE_CAP_BONUS;
}

export function addToStockpile(world: WorldState, resource: string, amount: number): number {
  const current = world.stockpile[resource] ?? 0;
  const cap = getStorageCap(world);
  const next = Math.max(current, Math.min(current + amount, cap));
  world.stockpile[resource] = next;
  return next - current;
}

export function placeBuilding(
  world: WorldState,
  buildingId: string,
  x: number,
  y: number
): PlacementResult {
  const def = getBuildingDef(buildingId);
  if (!def) {
    return { ok: false, error: 'unknown-building' };
  }
  if (!world.unlocked[buildingId]) {
    return { ok: false, error: 'locked' };
  }
  const tiles = world.map.tiles;
  if (y < 0 || y >= tiles.length || x < 0 || x >= tiles[y].length) {
    return { ok: false, error: 'out-of-bounds' };
  }
  const tile = tiles[y][x];
  if (def.category === 'extractor') {
    if (def.recipeId === 'water') {
      if (tile.type !== 'water') {
        return { ok: false, error: 'wrong-node' };
      }
    } else {
      if (tile.type !== 'grass') {
        return { ok: false, error: 'not-buildable' };
      }
      if (tile.resource?.type !== def.recipeId) {
        return { ok: false, error: 'wrong-node' };
      }
    }
  } else if (tile.type !== 'grass') {
    return { ok: false, error: 'not-buildable' };
  }
  if (world.buildings.some((building) => building.x === x && building.y === y)) {
    return { ok: false, error: 'occupied' };
  }
  const affordable = def.cost.every(
    (cost) => (world.stockpile[cost.resource] ?? 0) >= cost.amount
  );
  if (!affordable) {
    return { ok: false, error: 'insufficient-resources' };
  }
  for (const cost of def.cost) {
    world.stockpile[cost.resource] = (world.stockpile[cost.resource] ?? 0) - cost.amount;
  }
  const building: Building = {
    id: `b${world.nextBuildingId}`,
    buildingId,
    x,
    y,
    adjacencyMultiplier: 1,
    progress: 0
  };
  world.nextBuildingId += 1;
  world.buildings.push(building);
  const placeKey = `place-${buildingId}`;
  world.milestoneProgress[placeKey] = (world.milestoneProgress[placeKey] ?? 0) + 1;
  recomputeAdjacency(world);
  return { ok: true, building };
}

export function demolishBuilding(world: WorldState, id: string): boolean {
  const index = world.buildings.findIndex((building) => building.id === id);
  if (index === -1) {
    return false;
  }
  const [building] = world.buildings.splice(index, 1);
  const def = getBuildingDef(building.buildingId);
  if (def) {
    for (const cost of def.cost) {
      addToStockpile(world, cost.resource, cost.amount * DEMOLISH_REFUND_RATE);
    }
  }
  recomputeAdjacency(world);
  return true;
}
