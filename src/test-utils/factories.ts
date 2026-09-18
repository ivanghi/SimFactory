import { Map, Tile } from '../sim/mapgen';
import { createWorld, placeBuilding } from '../sim/world';
import type { Building, WorldState } from '../sim/world';

type NodeResourceType = NonNullable<Tile['resource']>['type'];

export function makeTestMap(seed = 1): Map {
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
