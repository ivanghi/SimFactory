import { generateMap, Map, Tile } from '../sim/mapgen';
import { createWorld, placeBuilding } from '../sim/world';
import type { Building, WorldState } from '../sim/world';

type NodeResourceType = NonNullable<Tile['resource']>['type'];

function makeTestMap(seed = 1): Map {
  const tiles: Tile[][] = [];
  for (let y = 0; y < 64; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < 64; x++) {
      row.push({ type: 'grass' });
    }
    tiles.push(row);
  }
  return { tiles, seed };
}

export function setNode(
  map: Map,
  x: number,
  y: number,
  type: NodeResourceType,
  richness: number
): void {
  map.tiles[y][x].resource = { type, richness };
}

export function setTerrain(map: Map, x: number, y: number, type: Tile['type']): void {
  map.tiles[y][x].type = type;
  map.tiles[y][x].resource = undefined;
}

export function makeWorld(seed = 1): WorldState {
  return createWorld(makeTestMap(seed));
}

export function unlockAll(world: WorldState): void {
  for (const key of Object.keys(world.unlocked)) {
    world.unlocked[key] = true;
  }
}

export function placeBuildingOk(
  world: WorldState,
  buildingId: string,
  x: number,
  y: number
): Building {
  const result = placeBuilding(world, buildingId, x, y);
  if (!result.ok || !result.building) {
    throw new Error(`placement of ${buildingId} at (${x}, ${y}) failed: ${result.error}`);
  }
  return result.building;
}

export function makeSeededWorld(seed = 4242): WorldState {
  const world = createWorld(generateMap(seed));
  unlockAll(world);
  world.stockpile['iron-ingot'] = 500;
  world.stockpile['coal'] = 37.5;
  world.buildings = [
    { id: 'b1', buildingId: 'iron-miner', x: 32, y: 32, adjacencyMultiplier: 1.2, progress: 0.4 },
    { id: 'b2', buildingId: 'solar-panel', x: 33, y: 32, adjacencyMultiplier: 1.1, progress: 2.5 }
  ];
  world.nextBuildingId = 3;
  world.power = { supply: 2.2, demand: 1, efficiency: 1 };
  world.time = 12.5;
  world.milestoneProgress['produce-iron-ingot'] = 23;
  world.milestoneProgress['place-iron-miner'] = 1;
  return world;
}
