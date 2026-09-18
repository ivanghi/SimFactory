import { describe, test, expect } from 'vitest';
import {
  countAdjacentSameTypeExtractors,
  extractorAdjacencyMultiplier,
  getAdjacentPositions,
  recomputeAdjacency
} from './adjacency';
import { demolishBuilding } from './world';
import type { Building, WorldState } from './world';
import { makeWorld, placeBuildingOk, setNode, unlockAll } from '../test-utils/factories';

function worldWithNeighbors(sameTypeCount: number): { world: WorldState; center: Building } {
  const world = makeWorld();
  unlockAll(world);
  world.stockpile['iron-ore'] = 200;
  world.stockpile['copper-ore'] = 200;
  setNode(world.map, 10, 10, 'iron-ore', 1);
  const center = placeBuildingOk(world, 'iron-miner', 10, 10);
  const spots = [
    { x: 9, y: 10 },
    { x: 11, y: 10 },
    { x: 10, y: 9 },
    { x: 10, y: 11 }
  ];
  spots.forEach((spot, index) => {
    const sameType = index < sameTypeCount;
    setNode(world.map, spot.x, spot.y, sameType ? 'iron-ore' : 'copper-ore', 1);
    placeBuildingOk(world, sameType ? 'iron-miner' : 'copper-miner', spot.x, spot.y);
  });
  return { world, center };
}

describe('adjacency', () => {
  test('getAdjacentPositions returns the four orthogonal neighbors', () => {
    expect(getAdjacentPositions({ x: 5, y: 5 })).toEqual([
      { x: 4, y: 5 },
      { x: 6, y: 5 },
      { x: 5, y: 4 },
      { x: 5, y: 6 }
    ]);
  });

  test('extractor multiplier grows 10% per same-type neighbor and is stored on the building', () => {
    const cases: [number, number][] = [
      [0, 1],
      [1, 1.1],
      [2, 1.2],
      [3, 1.3]
    ];
    for (const [count, expected] of cases) {
      const { world, center } = worldWithNeighbors(count);
      expect(extractorAdjacencyMultiplier(world, center)).toBe(expected);
      expect(center.adjacencyMultiplier).toBe(expected);
    }
  });

  test('extractor adjacency caps at +30% with 4+ same-type neighbors', () => {
    const { world, center } = worldWithNeighbors(4);

    expect(countAdjacentSameTypeExtractors(world, center)).toBe(4);
    expect(extractorAdjacencyMultiplier(world, center)).toBe(1.3);
    expect(center.adjacencyMultiplier).toBe(1.3);
  });

  test('diagonal same-type extractors do not count', () => {
    const world = makeWorld();
    unlockAll(world);
    world.stockpile['iron-ore'] = 200;
    setNode(world.map, 10, 10, 'iron-ore', 1);
    setNode(world.map, 11, 11, 'iron-ore', 1);
    const center = placeBuildingOk(world, 'iron-miner', 10, 10);
    placeBuildingOk(world, 'iron-miner', 11, 11);

    expect(extractorAdjacencyMultiplier(world, center)).toBe(1);
  });

  test('non-extractors get no adjacency multiplier', () => {
    const world = makeWorld();
    unlockAll(world);
    world.stockpile['iron-ore'] = 200;
    const first = placeBuildingOk(world, 'smelter', 10, 10);
    placeBuildingOk(world, 'smelter', 11, 10);
    placeBuildingOk(world, 'smelter', 10, 11);

    recomputeAdjacency(world);

    expect(first.adjacencyMultiplier).toBe(1);
  });

  test('multipliers update on demolish', () => {
    const world = makeWorld();
    unlockAll(world);
    world.stockpile['iron-ore'] = 200;
    setNode(world.map, 10, 10, 'iron-ore', 1);
    setNode(world.map, 11, 10, 'iron-ore', 1);
    const a = placeBuildingOk(world, 'iron-miner', 10, 10);
    const b = placeBuildingOk(world, 'iron-miner', 11, 10);

    expect(a.adjacencyMultiplier).toBe(1.1);
    expect(b.adjacencyMultiplier).toBe(1.1);

    demolishBuilding(world, b.id);

    expect(a.adjacencyMultiplier).toBe(1);
    expect(world.buildings).toHaveLength(1);
  });
});
