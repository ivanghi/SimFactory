import { describe, test, expect } from 'vitest';
import { tick } from '../tick';
import { demolishBuilding, getStorageCap, placeBuilding } from '../world';
import type { WorldState } from '../world';
import { MAP_SIZE } from '../../data/constants';
import { makeWorld, placeBuildingOk, setNode, setTerrain, unlockAll } from '../../test-utils/factories';

function runTicks(world: WorldState, count: number, dt = 0.1): void {
  for (let i = 0; i < count; i++) {
    tick(world, dt);
  }
}

function extractedWithRichness(richness: number): number {
  const world = makeWorld();
  unlockAll(world);
  setNode(world.map, 10, 10, 'iron-ore', richness);
  placeBuildingOk(world, 'iron-miner', 10, 10);
  world.stockpile['iron-ore'] = 0;
  runTicks(world, 100);
  return world.stockpile['iron-ore'] ?? 0;
}

describe('tick', () => {
  test('recipe conversion consumes exact inputs and produces exact outputs', () => {
    const world = makeWorld();
    unlockAll(world);
    placeBuildingOk(world, 'smelter', 20, 20);
    world.stockpile['iron-ore'] = 2;
    world.stockpile['coal'] = 1;
    world.stockpile['iron-ingot'] = 0;

    runTicks(world, 300);

    expect(world.stockpile['iron-ore']).toBe(0);
    expect(world.stockpile['coal']).toBe(0);
    expect(world.stockpile['iron-ingot']).toBe(1);
    expect(world.milestoneProgress['produce-iron-ingot']).toBe(1);
  });

  test('processor halts when an input is short and consumes nothing', () => {
    const world = makeWorld();
    unlockAll(world);
    placeBuildingOk(world, 'smelter', 20, 20);
    world.stockpile['iron-ore'] = 1;
    world.stockpile['coal'] = 5;
    world.stockpile['iron-ingot'] = 0;

    runTicks(world, 300);

    expect(world.stockpile['iron-ore']).toBe(1);
    expect(world.stockpile['coal']).toBe(5);
    expect(world.stockpile['iron-ingot'] ?? 0).toBe(0);
  });

  test('extraction rate is proportional to node richness', () => {
    const high = extractedWithRichness(1.5);
    const low = extractedWithRichness(0.75);

    expect(high).toBeCloseTo(15, 6);
    expect(low).toBeCloseTo(7.5, 6);
    expect(high / low).toBeCloseTo(2, 6);
  });

  test('adjacent same-type extractors produce 10% more', () => {
    const world = makeWorld();
    unlockAll(world);
    setNode(world.map, 10, 10, 'iron-ore', 1);
    setNode(world.map, 11, 10, 'iron-ore', 1);
    placeBuildingOk(world, 'iron-miner', 10, 10);
    placeBuildingOk(world, 'iron-miner', 11, 10);
    world.stockpile['iron-ore'] = 0;

    runTicks(world, 100);

    expect(world.stockpile['iron-ore']).toBeCloseTo(22, 6);
  });

  test('water pump extracts at base rate on water tiles', () => {
    const world = makeWorld();
    unlockAll(world);
    setTerrain(world.map, 15, 15, 'water');
    placeBuildingOk(world, 'water-pump', 15, 15);
    world.stockpile['water'] = 0;

    runTicks(world, 100);

    expect(world.stockpile['water']).toBeCloseTo(10, 6);
  });

  test('storage cap clamps extraction and discards overflow', () => {
    const world = makeWorld();
    unlockAll(world);
    setNode(world.map, 10, 10, 'iron-ore', 2);
    placeBuildingOk(world, 'iron-miner', 10, 10);
    world.stockpile['iron-ore'] = 499;

    runTicks(world, 10);
    expect(world.stockpile['iron-ore']).toBe(500);

    runTicks(world, 200);
    expect(world.stockpile['iron-ore']).toBe(500);
    expect(world.milestoneProgress['produce-iron-ore'] ?? 0).toBeCloseTo(42, 6);
  });

  test('storage cap clamps processor output and discards overflow', () => {
    const world = makeWorld();
    unlockAll(world);
    placeBuildingOk(world, 'smelter', 20, 20);
    world.stockpile['iron-ore'] = 2;
    world.stockpile['coal'] = 1;
    world.stockpile['iron-ingot'] = 500;

    runTicks(world, 300);

    expect(world.stockpile['iron-ingot']).toBe(500);
    expect(world.stockpile['iron-ore']).toBe(0);
    expect(world.stockpile['coal']).toBe(0);
  });

  test('warehouses raise the storage cap of every resource by 250', () => {
    const world = makeWorld();
    world.stockpile['iron-ingot'] = 100;

    expect(getStorageCap(world)).toBe(500);
    placeBuildingOk(world, 'warehouse', 5, 5);
    expect(getStorageCap(world)).toBe(750);
    placeBuildingOk(world, 'warehouse', 6, 5);
    expect(getStorageCap(world)).toBe(1000);

    setTerrain(world.map, 15, 15, 'water');
    placeBuildingOk(world, 'water-pump', 15, 15);
    world.stockpile['water'] = 999.7;
    runTicks(world, 10);
    expect(world.stockpile['water']).toBe(1000);
  });

  test('demolish refunds 50% of build cost', () => {
    const world = makeWorld();
    setNode(world.map, 10, 10, 'iron-ore', 1);
    const miner = placeBuildingOk(world, 'iron-miner', 10, 10);

    expect(world.stockpile['iron-ore']).toBe(40);

    expect(demolishBuilding(world, miner.id)).toBe(true);
    expect(world.stockpile['iron-ore']).toBe(45);
    expect(world.buildings).toHaveLength(0);
    expect(demolishBuilding(world, miner.id)).toBe(false);
  });

  test('placement rejects invalid tiles and conditions', () => {
    const world = makeWorld();
    setTerrain(world.map, 8, 8, 'rock');
    setTerrain(world.map, 9, 9, 'water');
    setNode(world.map, 10, 10, 'coal', 1);
    setNode(world.map, 12, 12, 'iron-ore', 1);

    expect(placeBuilding(world, 'nope', 1, 1).error).toBe('unknown-building');
    expect(placeBuilding(world, 'refinery', 13, 13).error).toBe('locked');
    expect(placeBuilding(world, 'smelter', MAP_SIZE, MAP_SIZE).error).toBe('out-of-bounds');
    expect(placeBuilding(world, 'smelter', -1, 0).error).toBe('out-of-bounds');
    expect(placeBuilding(world, 'smelter', 8, 8).error).toBe('not-buildable');
    expect(placeBuilding(world, 'smelter', 9, 9).error).toBe('not-buildable');
    expect(placeBuilding(world, 'iron-miner', 10, 10).error).toBe('wrong-node');
    expect(placeBuilding(world, 'iron-miner', 11, 11).error).toBe('wrong-node');
    expect(placeBuilding(world, 'iron-miner', 9, 9).error).toBe('not-buildable');
    expect(placeBuilding(world, 'water-pump', 14, 14).error).toBe('wrong-node');

    expect(placeBuilding(world, 'water-pump', 9, 9).ok).toBe(true);
    placeBuildingOk(world, 'smelter', 13, 13);
    expect(placeBuilding(world, 'smelter', 13, 13).error).toBe('occupied');

    world.stockpile['iron-ore'] = 5;
    expect(placeBuilding(world, 'iron-miner', 12, 12).error).toBe('insufficient-resources');
  });

  test('tick determinism: identical worlds and tick sequences yield identical states', () => {
    const runScenario = (): WorldState => {
      const world = makeWorld(7);
      unlockAll(world);
      setNode(world.map, 10, 10, 'iron-ore', 1.3);
      setNode(world.map, 11, 10, 'iron-ore', 0.9);
      setNode(world.map, 12, 10, 'coal', 1.2);
      setTerrain(world.map, 14, 14, 'water');
      world.stockpile['iron-ore'] = 300;
      world.stockpile['copper-ore'] = 300;
      world.stockpile['coal'] = 300;
      world.stockpile['iron-ingot'] = 100;
      world.stockpile['copper-ingot'] = 100;
      placeBuildingOk(world, 'iron-miner', 10, 10);
      placeBuildingOk(world, 'iron-miner', 11, 10);
      placeBuildingOk(world, 'coal-miner', 12, 10);
      placeBuildingOk(world, 'water-pump', 14, 14);
      placeBuildingOk(world, 'smelter', 20, 20);
      placeBuildingOk(world, 'warehouse', 21, 21);
      placeBuildingOk(world, 'gear-assembler', 22, 22);

      for (let i = 0; i < 1000; i++) {
        tick(world, 0.1);
        if (i === 300) {
          placeBuildingOk(world, 'smelter', 25, 25);
        }
        if (i === 600) {
          demolishBuilding(world, world.buildings[0].id);
        }
      }
      return world;
    };

    expect(JSON.stringify(runScenario())).toBe(JSON.stringify(runScenario()));
  });
});
