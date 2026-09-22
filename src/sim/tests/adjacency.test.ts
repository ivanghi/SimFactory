import { describe, test, expect } from 'vitest';
import {
  coalGeneratorAdjacencyMultiplier,
  countAdjacentSameTypeExtractors,
  countAdjacentSolarPanels,
  extractorAdjacencyMultiplier,
  getAdjacentPositions,
  getSurroundingPositions,
  isAdjacentToWater,
  recomputeAdjacency,
  solarAdjacencyMultiplier
} from '../adjacency';
import { demolishBuilding } from '../world';
import type { Building, WorldState } from '../world';
import { COAL_GENERATOR_ID, SOLAR_PANEL_ID } from '../../data/constants';
import { makeWorld, placeBuildingOk, setNode, setTerrain, unlockAll } from '../../test-utils/factories';

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

  describe('solar panel adjacency', () => {
    const orthogonal = [
      { x: 29, y: 30 },
      { x: 31, y: 30 },
      { x: 30, y: 29 },
      { x: 30, y: 31 }
    ];
    const diagonal = [
      { x: 29, y: 29 },
      { x: 31, y: 31 },
      { x: 29, y: 31 },
      { x: 31, y: 29 }
    ];

    function solarWorldWithNeighbors(
      neighborSpots: { x: number; y: number }[]
    ): { world: WorldState; center: Building } {
      const world = makeWorld();
      unlockAll(world);
      world.stockpile['iron-ingot'] = 500;
      const center = placeBuildingOk(world, SOLAR_PANEL_ID, 30, 30);
      for (const spot of neighborSpots) {
        placeBuildingOk(world, SOLAR_PANEL_ID, spot.x, spot.y);
      }
      return { world, center };
    }

    test('getSurroundingPositions returns the eight neighbors', () => {
      const positions = getSurroundingPositions({ x: 5, y: 5 });
      expect(positions).toHaveLength(8);
      expect(positions).not.toContainEqual({ x: 5, y: 5 });
      expect(positions).toContainEqual({ x: 4, y: 4 });
      expect(positions).toContainEqual({ x: 6, y: 6 });
    });

    test('no adjacent panels gives no bonus', () => {
      const { world, center } = solarWorldWithNeighbors([]);
      expect(countAdjacentSolarPanels(world, center)).toBe(0);
      expect(solarAdjacencyMultiplier(world, center)).toBe(1);
      expect(center.adjacencyMultiplier).toBe(1);
    });

    test('grows +10% per adjacent panel and counts diagonals', () => {
      const { world, center } = solarWorldWithNeighbors([{ x: 29, y: 29 }]);
      expect(countAdjacentSolarPanels(world, center)).toBe(1);
      expect(solarAdjacencyMultiplier(world, center)).toBeCloseTo(1.1, 10);
      expect(center.adjacencyMultiplier).toBeCloseTo(1.1, 10);
    });

    test('caps at +50% with 5 adjacent panels and never exceeds it', () => {
      const five = solarWorldWithNeighbors([...orthogonal, diagonal[0]]);
      expect(countAdjacentSolarPanels(five.world, five.center)).toBe(5);
      expect(solarAdjacencyMultiplier(five.world, five.center)).toBe(1.5);
      expect(five.center.adjacencyMultiplier).toBe(1.5);

      const eight = solarWorldWithNeighbors([...orthogonal, ...diagonal]);
      expect(countAdjacentSolarPanels(eight.world, eight.center)).toBe(8);
      expect(eight.center.adjacencyMultiplier).toBe(1.5);
    });

    test('solar bonus updates on demolish', () => {
      const world = makeWorld();
      unlockAll(world);
      world.stockpile['iron-ingot'] = 500;
      const center = placeBuildingOk(world, SOLAR_PANEL_ID, 30, 30);
      const neighbor = placeBuildingOk(world, SOLAR_PANEL_ID, 31, 30);
      expect(center.adjacencyMultiplier).toBeCloseTo(1.1, 10);

      demolishBuilding(world, neighbor.id);

      expect(center.adjacencyMultiplier).toBe(1);
    });

    test('non-extractor non-power buildings keep a flat multiplier', () => {
      const world = makeWorld();
      unlockAll(world);
      world.stockpile['iron-ingot'] = 500;
      const warehouse = placeBuildingOk(world, 'warehouse', 30, 30);
      placeBuildingOk(world, 'warehouse', 31, 30);
      expect(warehouse.adjacencyMultiplier).toBe(1);
    });
  });

  describe('coal generator adjacency', () => {
    test('adjacent water tile grants exactly +25%', () => {
      const world = makeWorld();
      unlockAll(world);
      world.stockpile['iron-ingot'] = 500;
      setTerrain(world.map, 31, 30, 'water');
      const gen = placeBuildingOk(world, COAL_GENERATOR_ID, 30, 30);

      expect(isAdjacentToWater(world, gen)).toBe(true);
      expect(coalGeneratorAdjacencyMultiplier(world, gen)).toBe(1.25);
      expect(gen.adjacencyMultiplier).toBe(1.25);
    });

    test('diagonal water does not count', () => {
      const world = makeWorld();
      unlockAll(world);
      world.stockpile['iron-ingot'] = 500;
      setTerrain(world.map, 31, 31, 'water');
      const gen = placeBuildingOk(world, COAL_GENERATOR_ID, 30, 30);

      expect(isAdjacentToWater(world, gen)).toBe(false);
      expect(gen.adjacencyMultiplier).toBe(1);
    });

    test('no adjacent water gives no bonus', () => {
      const world = makeWorld();
      unlockAll(world);
      world.stockpile['iron-ingot'] = 500;
      const gen = placeBuildingOk(world, COAL_GENERATOR_ID, 30, 30);

      expect(gen.adjacencyMultiplier).toBe(1);
    });
  });
});
