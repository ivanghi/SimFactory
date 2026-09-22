import { describe, test, expect } from 'vitest';
import { generateMap } from './mapgen';
import { createWorld, getStorageCap, placeBuilding } from './world';
import type { BuildingDef } from '../data/buildings';
import type { WorldState } from './world';
import { getBuildingDef } from '../data/buildings';
import { updatePower } from './power';
import { tick } from './tick';
import { evaluateMilestones } from './milestones';
import { TICK_DT } from '../data/constants';

const ARC_SEED = 20240922;
const TICKS_PER_DECISION = 10;
const MAX_SIM_SECONDS = 4 * 60 * 60;

const PRIORITY = [
  'iron-miner',
  'coal-miner',
  'smelter',
  'coal-generator',
  'copper-miner',
  'copper-smelter',
  'refinery',
  'pumpjack',
  'water-pump',
  'chemical-plant',
  'gear-assembler',
  'circuit-assembler',
  'warehouse'
];

interface Stage {
  milestone: string;
  atSeconds: number;
}

interface ArcReport {
  seed: number;
  simSeconds: number;
  stages: Stage[];
  milestonesReached: string[];
  buildings: Record<string, number>;
  stockpile: Record<string, number>;
  power: { supply: number; demand: number; efficiency: number };
  minEfficiency: number;
  brownoutSeconds: number;
  counters: Record<string, number>;
}

function countOf(world: WorldState, buildingId: string): number {
  return world.buildings.filter(building => building.buildingId === buildingId).length;
}

function isOccupied(world: WorldState, x: number, y: number): boolean {
  return world.buildings.some(building => building.x === x && building.y === y);
}

function findPlacement(world: WorldState, def: BuildingDef): { x: number; y: number } | null {
  const tiles = world.map.tiles;
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      const tile = tiles[y][x];
      let valid: boolean;
      if (def.category === 'extractor') {
        if (def.recipeId === 'water') {
          valid = tile.type === 'water';
        } else {
          valid = tile.type === 'grass' && tile.resource?.type === def.recipeId;
        }
      } else {
        valid = tile.type === 'grass' && !tile.resource;
      }
      if (valid && !isOccupied(world, x, y)) {
        return { x, y };
      }
    }
  }
  return null;
}

function affordable(world: WorldState, def: BuildingDef): boolean {
  return def.cost.every(cost => (world.stockpile[cost.resource] ?? 0) >= cost.amount);
}

function buildable(world: WorldState, buildingId: string): boolean {
  const def = getBuildingDef(buildingId);
  if (!def || !world.unlocked[buildingId] || !affordable(world, def)) {
    return false;
  }
  return findPlacement(world, def) !== null;
}

function targets(world: WorldState): Record<string, number> {
  const smelters = countOf(world, 'smelter');
  const coalGenerators = countOf(world, 'coal-generator');
  const ironDone = (world.milestoneProgress['produce-iron-ingot'] ?? 0) >= 50;
  const chemicalDone = !!world.unlocked['chemical-plant'];
  const activeProcessors =
    smelters +
    countOf(world, 'copper-smelter') +
    countOf(world, 'refinery') +
    countOf(world, 'chemical-plant');
  const cap = getStorageCap(world);
  const nearCap = Object.values(world.stockpile).some(amount => amount >= cap - 1);
  const warehouses = countOf(world, 'warehouse');
  return {
    'iron-miner': smelters >= 2 ? 3 : 1,
    'coal-miner': Math.min(3, 1 + Math.floor(coalGenerators / 2) + (activeProcessors >= 4 ? 1 : 0)),
    smelter: ironDone ? 6 : 3,
    'coal-generator': ironDone ? 2 : 0,
    warehouse: nearCap && warehouses < 6 ? warehouses + 1 : warehouses,
    'copper-miner': ironDone ? 1 : 0,
    'copper-smelter': ironDone ? 1 : 0,
    refinery: world.unlocked['refinery'] ? 3 : 0,
    pumpjack: world.unlocked['pumpjack'] ? 2 : 0,
    'water-pump': chemicalDone || world.unlocked['chemical-plant'] ? 1 : 0,
    'chemical-plant': chemicalDone ? 1 : 0,
    'gear-assembler': chemicalDone ? 2 : 1,
    'circuit-assembler': world.unlocked['circuit-assembler'] ? 1 : 0
  };
}

function chooseBuild(world: WorldState): string | null {
  const { supply, demand } = world.power;
  if (supply < demand) {
    if (buildable(world, 'solar-panel')) return 'solar-panel';
    if (buildable(world, 'coal-generator')) return 'coal-generator';
    return null;
  }

  const desired = targets(world);
  for (const buildingId of PRIORITY) {
    if ((desired[buildingId] ?? 0) <= countOf(world, buildingId)) continue;
    if (buildable(world, buildingId)) return buildingId;
  }

  if (supply <= demand && buildable(world, 'solar-panel')) {
    return 'solar-panel';
  }
  return null;
}

function tryBuild(world: WorldState, buildingId: string): boolean {
  const def = getBuildingDef(buildingId);
  if (!def) return false;
  const spot = findPlacement(world, def);
  if (!spot) return false;
  return placeBuilding(world, buildingId, spot.x, spot.y).ok;
}

function runArc(seed: number): ArcReport {
  const world = createWorld(generateMap(seed));
  const reachedAt = new Map<string, number>();
  let simSeconds = 0;
  let minEfficiency = 1;
  let brownoutSeconds = 0;

  const finished = (): boolean =>
    !!world.unlocked['circuit-assembler'] &&
    (world.milestoneProgress['produce-circuits'] ?? 0) >= 5;

  while (simSeconds < MAX_SIM_SECONDS && !finished()) {
    for (let i = 0; i < TICKS_PER_DECISION; i++) {
      updatePower(world, TICK_DT);
      tick(world, TICK_DT);
    }
    simSeconds += TICKS_PER_DECISION * TICK_DT;

    minEfficiency = Math.min(minEfficiency, world.power.efficiency);
    if (world.power.efficiency < 1) {
      brownoutSeconds += 1;
    }

    for (const event of evaluateMilestones(world)) {
      reachedAt.set(event.milestoneId, simSeconds);
    }

    const choice = chooseBuild(world);
    if (choice) {
      tryBuild(world, choice);
    }
  }

  const buildings: Record<string, number> = {};
  for (const building of world.buildings) {
    buildings[building.buildingId] = (buildings[building.buildingId] ?? 0) + 1;
  }

  return {
    seed,
    simSeconds,
    stages: [...reachedAt.entries()].map(([milestone, atSeconds]) => ({ milestone, atSeconds })),
    milestonesReached: Object.keys(world.unlocked).filter(id => world.unlocked[id]),
    buildings,
    stockpile: { ...world.stockpile },
    power: { ...world.power },
    minEfficiency,
    brownoutSeconds,
    counters: { ...world.milestoneProgress }
  };
}

function stageTime(report: ArcReport, milestone: string): number | null {
  return report.stages.find(stage => stage.milestone === milestone)?.atSeconds ?? null;
}

describe('full arc playthrough', () => {
  test('a fresh seed completes the whole unlock chain to steady-state circuits', () => {
    const report = runArc(ARC_SEED);
    console.log(`BALANCE_ARC ${JSON.stringify(report)}`);

    expect(report.milestonesReached).toContain('copper-miner');
    expect(report.milestonesReached).toContain('coal-generator');
    expect(report.milestonesReached).toContain('refinery');
    expect(report.milestonesReached).toContain('pumpjack');
    expect(report.milestonesReached).toContain('chemical-plant');
    expect(report.milestonesReached).toContain('circuit-assembler');
    expect(report.counters['produce-circuits'] ?? 0).toBeGreaterThanOrEqual(5);

    const iron = stageTime(report, 'copper-miner');
    const refinery = stageTime(report, 'refinery');
    const fuel = stageTime(report, 'chemical-plant');
    const circuits = stageTime(report, 'circuit-assembler');
    expect(iron).not.toBeNull();
    expect(refinery).not.toBeNull();
    expect(fuel).not.toBeNull();
    expect(circuits).not.toBeNull();

    expect(iron ?? Infinity).toBeLessThanOrEqual(8 * 60);
    expect(refinery ?? Infinity).toBeLessThanOrEqual(15 * 60);
    expect(fuel ?? Infinity).toBeLessThanOrEqual(30 * 60);
    expect(circuits ?? Infinity).toBeLessThanOrEqual(45 * 60);
    expect(report.simSeconds).toBeLessThan(MAX_SIM_SECONDS);

    expect(report.power.efficiency).toBeGreaterThan(0.5);
    expect(report.buildings['warehouse'] ?? 0).toBeGreaterThan(0);
    expect(report.brownoutSeconds).toBeGreaterThan(0);
    expect(report.minEfficiency).toBeLessThan(1);
  });

  test('the arc is deterministic for the same seed and data', () => {
    const first = runArc(ARC_SEED);
    const second = runArc(ARC_SEED);
    expect(second).toEqual(first);
  });

  test('several fresh seeds all complete the arc', () => {
    for (const seed of [1, 7, 12345, 20240922]) {
      const report = runArc(seed);
      expect(report.milestonesReached, `seed ${seed} unlocks`).toContain('circuit-assembler');
      expect(report.counters['produce-circuits'] ?? 0, `seed ${seed} circuits`).toBeGreaterThanOrEqual(5);
      expect(report.simSeconds, `seed ${seed} duration`).toBeLessThan(MAX_SIM_SECONDS);
    }
  });
});