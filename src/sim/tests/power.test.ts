import { describe, test, expect } from 'vitest';
import { computeEfficiency, updatePower } from '../power';
import { tick } from '../tick';
import { demolishBuilding } from '../world';
import { COAL_GENERATOR_ID, SOLAR_PANEL_ID, TICK_DT } from '../../data/constants';
import type { Building, WorldState } from '../world';
import { makeWorld, placeBuildingOk, setNode, setTerrain, unlockAll } from '../../test-utils/factories';

function funded(world: WorldState): WorldState {
  world.stockpile['iron-ingot'] = 500;
  return world;
}

function updatePowerTimes(world: WorldState, ticks: number, dt = TICK_DT): void {
  for (let i = 0; i < ticks; i++) {
    updatePower(world, dt);
  }
}

function buildingAt(world: WorldState, x: number, y: number): Building {
  const building = world.buildings.find((b) => b.x === x && b.y === y);
  if (!building) {
    throw new Error(`no building at (${x}, ${y})`);
  }
  return building;
}

describe('power', () => {
  test('solar panel base output is 2 MW constant', () => {
    const world = makeWorld();
    unlockAll(world);
    funded(world);
    placeBuildingOk(world, SOLAR_PANEL_ID, 10, 10);

    updatePowerTimes(world, 3);

    expect(world.power.supply).toBeCloseTo(2, 10);
    expect(world.stockpile['coal']).toBe(50);
  });

  test('supply sums correctly across mixed generator types', () => {
    const world = makeWorld();
    unlockAll(world);
    funded(world);
    world.stockpile['coal'] = 20;
    placeBuildingOk(world, SOLAR_PANEL_ID, 10, 10);
    placeBuildingOk(world, SOLAR_PANEL_ID, 11, 10);
    setTerrain(world.map, 31, 30, 'water');
    placeBuildingOk(world, COAL_GENERATOR_ID, 30, 30);

    updatePowerTimes(world, 1);

    expect(world.power.supply).toBeCloseTo(2 * 1.1 + 2 * 1.1 + 6 * 1.25, 6);
  });

  test('brownout: efficiency equals supply / demand when demand exceeds supply', () => {
    const world = makeWorld();
    unlockAll(world);
    funded(world);
    placeBuildingOk(world, SOLAR_PANEL_ID, 10, 10);
    placeBuildingOk(world, 'smelter', 20, 20);
    placeBuildingOk(world, 'smelter', 21, 20);

    updatePower(world, TICK_DT);

    expect(world.power.supply).toBeCloseTo(2, 10);
    expect(world.power.demand).toBe(4);
    expect(world.power.efficiency).toBeCloseTo(0.5, 10);
  });

  test('efficiency is exactly 1.0 when supply meets or exceeds demand', () => {
    const balanced = makeWorld();
    unlockAll(balanced);
    funded(balanced);
    placeBuildingOk(balanced, SOLAR_PANEL_ID, 10, 10);
    placeBuildingOk(balanced, 'smelter', 20, 20);
    updatePower(balanced, TICK_DT);
    expect(balanced.power.efficiency).toBe(1);

    const surplus = makeWorld();
    unlockAll(surplus);
    funded(surplus);
    placeBuildingOk(surplus, SOLAR_PANEL_ID, 10, 10);
    placeBuildingOk(surplus, COAL_GENERATOR_ID, 30, 30);
    surplus.stockpile['iron-ingot'] = 100;
    placeBuildingOk(surplus, 'smelter', 40, 40);
    updatePower(surplus, TICK_DT);
    expect(surplus.power.supply).toBeGreaterThan(surplus.power.demand);
    expect(surplus.power.efficiency).toBe(1);
  });

  test('efficiency is 1.0 when demand is 0 (no division by zero)', () => {
    expect(computeEfficiency(0, 0)).toBe(1);
    expect(computeEfficiency(3.5, 0)).toBe(1);

    const world = makeWorld();
    unlockAll(world);
    funded(world);
    placeBuildingOk(world, SOLAR_PANEL_ID, 10, 10);

    updatePower(world, TICK_DT);

    expect(world.power.demand).toBe(0);
    expect(world.power.efficiency).toBe(1);
  });

  test('demand sums power draw across extractors and processors only', () => {
    const world = makeWorld();
    unlockAll(world);
    funded(world);
    setNode(world.map, 10, 10, 'iron-ore', 1);
    placeBuildingOk(world, 'iron-miner', 10, 10);
    placeBuildingOk(world, 'smelter', 20, 20);
    placeBuildingOk(world, 'warehouse', 25, 25);
    placeBuildingOk(world, SOLAR_PANEL_ID, 30, 30);

    updatePower(world, TICK_DT);

    expect(world.power.demand).toBe(3);
  });

  test('coal generator output drops to 0 with an empty coal stockpile', () => {
    const world = makeWorld();
    unlockAll(world);
    funded(world);
    world.stockpile['coal'] = 0;
    placeBuildingOk(world, COAL_GENERATOR_ID, 10, 10);

    updatePowerTimes(world, 20);

    expect(world.power.supply).toBe(0);
    expect(world.stockpile['coal']).toBe(0);
    expect(buildingAt(world, 10, 10).progress).toBe(0);
  });

  test('coal generator consumes 1 coal per 4s at the fixed tick rate', () => {
    const world = makeWorld();
    unlockAll(world);
    funded(world);
    world.stockpile['coal'] = 60;
    placeBuildingOk(world, COAL_GENERATOR_ID, 10, 10);

    updatePowerTimes(world, 40);
    expect(world.stockpile['coal']).toBe(59);
    expect(world.power.supply).toBeCloseTo(6, 10);

    updatePowerTimes(world, 40);
    expect(world.stockpile['coal']).toBe(58);

    updatePowerTimes(world, 80);
    expect(world.stockpile['coal']).toBe(56);

    updatePowerTimes(world, 1600);
    expect(world.stockpile['coal']).toBe(16);

    expect(world.buildings.some((b) => b.progress < 0)).toBe(false);
    expect(Object.values(world.stockpile).every((amount) => amount >= 0)).toBe(true);
  });

  test('coal generator burns at most the available coal and never goes negative', () => {
    const world = makeWorld();
    unlockAll(world);
    funded(world);
    world.stockpile['coal'] = 2;
    placeBuildingOk(world, COAL_GENERATOR_ID, 10, 10);

    updatePowerTimes(world, 400);

    expect(world.stockpile['coal']).toBe(0);
    expect(world.power.supply).toBe(0);
  });

  test('two coal generators cannot burn the same unit of coal', () => {
    const world = makeWorld();
    unlockAll(world);
    funded(world);
    world.stockpile['coal'] = 1;
    placeBuildingOk(world, COAL_GENERATOR_ID, 10, 10);
    placeBuildingOk(world, COAL_GENERATOR_ID, 12, 10);

    updatePower(world, TICK_DT);

    expect(world.stockpile['coal']).toBe(0);
    expect(world.buildings.filter((b) => b.progress > 0)).toHaveLength(1);
  });

  test('coal generator water adjacency grants exactly +25% output', () => {
    const world = makeWorld();
    unlockAll(world);
    funded(world);
    world.stockpile['coal'] = 10;
    setTerrain(world.map, 11, 10, 'water');
    placeBuildingOk(world, COAL_GENERATOR_ID, 10, 10);

    expect(buildingAt(world, 10, 10).adjacencyMultiplier).toBe(1.25);

    updatePower(world, TICK_DT);

    expect(world.power.supply).toBeCloseTo(7.5, 10);
  });

  test('solar adjacency bonus caps at +50%', () => {
    const world = makeWorld();
    unlockAll(world);
    funded(world);
    world.stockpile['iron-ingot'] = 500;
    placeBuildingOk(world, SOLAR_PANEL_ID, 20, 20);
    const spots = [
      { x: 19, y: 20 },
      { x: 21, y: 20 },
      { x: 20, y: 19 },
      { x: 20, y: 21 },
      { x: 19, y: 19 }
    ];
    for (const spot of spots) {
      placeBuildingOk(world, SOLAR_PANEL_ID, spot.x, spot.y);
    }

    expect(buildingAt(world, 20, 20).adjacencyMultiplier).toBe(1.5);

    world.stockpile['iron-ingot'] = 500;
    placeBuildingOk(world, SOLAR_PANEL_ID, 19, 21);
    placeBuildingOk(world, SOLAR_PANEL_ID, 21, 19);
    placeBuildingOk(world, SOLAR_PANEL_ID, 21, 21);
    expect(buildingAt(world, 20, 20).adjacencyMultiplier).toBe(1.5);
  });

  test('brownout is recoverable: demolishing a browned-out consumer restores efficiency', () => {
    const world = makeWorld();
    unlockAll(world);
    funded(world);
    placeBuildingOk(world, SOLAR_PANEL_ID, 10, 10);
    const dyingSmelter = placeBuildingOk(world, 'smelter', 20, 20);
    placeBuildingOk(world, 'smelter', 21, 20);
    updatePower(world, TICK_DT);
    expect(world.power.efficiency).toBeCloseTo(0.5, 10);

    expect(demolishBuilding(world, dyingSmelter.id)).toBe(true);
    updatePower(world, TICK_DT);

    expect(world.power.supply).toBeCloseTo(2, 10);
    expect(world.power.demand).toBe(2);
    expect(world.power.efficiency).toBe(1);
  });

  test('throttle propagates into extractor and processor rates', () => {
    const world = makeWorld();
    unlockAll(world);
    funded(world);
    setNode(world.map, 10, 10, 'iron-ore', 1);
    placeBuildingOk(world, 'iron-miner', 10, 10);
    placeBuildingOk(world, 'smelter', 20, 20);
    placeBuildingOk(world, SOLAR_PANEL_ID, 30, 30);
    world.stockpile['iron-ingot'] = 0;
    world.stockpile['iron-ore'] = 2;
    world.stockpile['coal'] = 1;

    for (let i = 0; i < 100; i++) {
      updatePower(world, TICK_DT);
      tick(world, TICK_DT);
    }

    expect(world.power.efficiency).toBeCloseTo(2 / 3, 10);
    const smelter = buildingAt(world, 20, 20);
    expect(smelter.progress).toBeCloseTo(10 * (2 / 3), 6);
    expect(world.stockpile['iron-ingot'] ?? 0).toBe(0);
    expect(world.stockpile['iron-ore']).toBeCloseTo(2 + 10 * (2 / 3), 6);
  });

  test('a total brownout halts all consumers', () => {
    const world = makeWorld();
    unlockAll(world);
    funded(world);
    setNode(world.map, 10, 10, 'iron-ore', 1);
    placeBuildingOk(world, 'iron-miner', 10, 10);
    placeBuildingOk(world, 'smelter', 20, 20);
    world.stockpile['iron-ingot'] = 0;
    world.stockpile['iron-ore'] = 2;
    world.stockpile['coal'] = 1;

    for (let i = 0; i < 100; i++) {
      updatePower(world, TICK_DT);
      tick(world, TICK_DT);
    }

    expect(world.power.supply).toBe(0);
    expect(world.power.efficiency).toBe(0);
    expect(buildingAt(world, 20, 20).progress).toBe(0);
    expect(world.stockpile['iron-ore']).toBe(2);
    expect(world.stockpile['iron-ingot'] ?? 0).toBe(0);
  });

  test('supply, demand and efficiency are exposed on the world state for the HUD', () => {
    const world = makeWorld();
    expect(world.power).toEqual({ supply: 0, demand: 0, efficiency: 1 });
    unlockAll(world);
    funded(world);
    placeBuildingOk(world, 'smelter', 20, 20);
    updatePower(world, TICK_DT);
    expect(Object.keys(world.power).sort()).toEqual(['demand', 'efficiency', 'supply']);
  });
});
