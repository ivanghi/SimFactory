import { describe, test, expect } from 'vitest';
import {
  OFFLINE_CAP_MS,
  OFFLINE_STEP_SECONDS,
  computeOfflineElapsedMs,
  formatOfflineSummary,
  processOfflineTime
} from '../offline';
import type { OfflineSummary } from '../offline';
import { updatePower } from '../power';
import { tick } from '../tick';
import { applyMilestonesSilently } from '../milestones';
import { makeWorld, placeBuildingOk, setNode, setTerrain, unlockAll } from '../../test-utils/factories';
import type { WorldState } from '../world';

const EIGHT_HOURS = 8 * 60 * 60 * 1000;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function runSharedSteps(world: WorldState, seconds: number, stepSeconds = OFFLINE_STEP_SECONDS): void {
  const steps = Math.floor(seconds / stepSeconds);
  for (let i = 0; i < steps; i++) {
    updatePower(world, stepSeconds);
    tick(world, stepSeconds);
    applyMilestonesSilently(world);
  }
}

function makePoweredExtractorWorld(seed = 11): WorldState {
  const world = makeWorld(seed);
  setNode(world.map, 10, 10, 'iron-ore', 1);
  world.stockpile['iron-ingot'] = 500;
  placeBuildingOk(world, 'solar-panel', 20, 20);
  placeBuildingOk(world, 'iron-miner', 10, 10);
  world.stockpile['iron-ore'] = 0;
  return world;
}

function makeFactoryWorld(seed = 21): WorldState {
  const world = makeWorld(seed);
  unlockAll(world);
  world.stockpile['iron-ingot'] = 500;
  setNode(world.map, 10, 10, 'iron-ore', 1.5);
  setNode(world.map, 12, 10, 'coal', 1.5);
  setTerrain(world.map, 14, 14, 'water');
  placeBuildingOk(world, 'iron-miner', 10, 10);
  placeBuildingOk(world, 'coal-miner', 12, 10);
  placeBuildingOk(world, 'water-pump', 14, 14);
  placeBuildingOk(world, 'smelter', 20, 20);
  placeBuildingOk(world, 'coal-generator', 22, 22);
  placeBuildingOk(world, 'solar-panel', 24, 24);
  world.stockpile['iron-ore'] = 200;
  world.stockpile['coal'] = 300;
  return world;
}

describe('elapsed time', () => {
  test('clamps a much longer absence to the 8h cap', () => {
    expect(computeOfflineElapsedMs(100 * 60 * 60 * 1000, 0)).toBe(EIGHT_HOURS);
  });

  test('a negative elapsed time clamps to zero', () => {
    expect(computeOfflineElapsedMs(0, 100 * 60 * 60 * 1000)).toBe(0);
    expect(computeOfflineElapsedMs(1000, 2000)).toBe(0);
  });

  test('non-finite inputs do not produce a corrupt elapsed time', () => {
    expect(computeOfflineElapsedMs(Number.NaN, 0)).toBe(0);
    expect(computeOfflineElapsedMs(0, Number.NaN)).toBe(0);
    expect(computeOfflineElapsedMs(Number.POSITIVE_INFINITY, 0)).toBe(EIGHT_HOURS);
  });

  test('a full 8h absence is simulated as 480 coarse steps without clamping', () => {
    const summary = processOfflineTime(makeWorld(), EIGHT_HOURS);
    expect(summary.elapsedMs).toBe(EIGHT_HOURS);
    expect(summary.capped).toBe(false);
    expect(summary.steps).toBe(480);
  });

  test('a long absence beyond the cap is clamped and reported as capped', () => {
    const summary = processOfflineTime(makeWorld(), 100 * 60 * 60 * 1000);
    expect(summary.elapsedMs).toBe(EIGHT_HOURS);
    expect(summary.capped).toBe(true);
    expect(summary.steps).toBe(480);
  });
});

describe('catch-up simulation', () => {
  test('zero elapsed time leaves the world untouched', () => {
    const world = makeFactoryWorld();
    const snapshot = clone(world);

    const summary = processOfflineTime(world, 0);

    expect(world).toEqual(snapshot);
    expect(summary.elapsedMs).toBe(0);
    expect(summary.steps).toBe(0);
    expect(summary.resourceDeltas).toEqual({});
    expect(summary.unlocked).toEqual([]);
  });

  test('negative elapsed time changes nothing', () => {
    const world = makeFactoryWorld();
    const snapshot = clone(world);

    const summary = processOfflineTime(world, -30_000);

    expect(world).toEqual(snapshot);
    expect(summary.elapsedMs).toBe(0);
  });

  test('gains are bounded by the storage cap', () => {
    const world = makePoweredExtractorWorld();
    processOfflineTime(world, EIGHT_HOURS);
    expect(world.stockpile['iron-ore']).toBe(500);
  });

  test('8h of catch-up completes within a reasonable time budget', () => {
    const world = makeFactoryWorld();
    const started = performance.now();

    const summary = processOfflineTime(world, EIGHT_HOURS);

    const duration = performance.now() - started;
    expect(summary.steps).toBe(480);
    expect(duration).toBeLessThan(1000);
  });

  test('catch-up is deterministic for the same world and elapsed time', () => {
    const first = makeFactoryWorld();
    const second = makeFactoryWorld();

    processOfflineTime(first, 2 * 60 * 60 * 1000);
    processOfflineTime(second, 2 * 60 * 60 * 1000);

    expect(first).toEqual(second);
  });
});

describe('parity with the online simulation', () => {
  test('extractor gains match the online tick loop over the same elapsed time', () => {
    const offlineWorld = makePoweredExtractorWorld();
    const onlineWorld = makePoweredExtractorWorld();

    const summary = processOfflineTime(offlineWorld, 60_000);

    for (let i = 0; i < 600; i++) {
      updatePower(onlineWorld, 0.1);
      tick(onlineWorld, 0.1);
      applyMilestonesSilently(onlineWorld);
    }

    expect(summary.steps).toBe(1);
    expect(offlineWorld.stockpile['iron-ore']).toBeCloseTo(onlineWorld.stockpile['iron-ore'] ?? 0, 6);
    expect(offlineWorld.milestoneProgress['produce-iron-ore']).toBeCloseTo(
      onlineWorld.milestoneProgress['produce-iron-ore'] ?? 0,
      6
    );
    expect(offlineWorld.time).toBeCloseTo(onlineWorld.time, 6);
    expect(offlineWorld.power.supply).toBeCloseTo(onlineWorld.power.supply, 6);
    expect(offlineWorld.power.efficiency).toBeCloseTo(onlineWorld.power.efficiency, 6);
  });

  test('catch-up reuses the shared tick sequence rather than a separate formula', () => {
    const offlineWorld = makeFactoryWorld();
    const manualWorld = makeFactoryWorld();
    const seconds = 3600;

    const summary = processOfflineTime(offlineWorld, seconds * 1000);
    runSharedSteps(manualWorld, seconds);

    expect(summary.steps).toBe(seconds / OFFLINE_STEP_SECONDS);
    expect(offlineWorld).toEqual(manualWorld);
  });

  test('a starved processor produces nothing offline, same as online', () => {
    const world = makeWorld(41);
    unlockAll(world);
    world.stockpile['iron-ingot'] = 500;
    placeBuildingOk(world, 'solar-panel', 20, 20);
    placeBuildingOk(world, 'smelter', 21, 20);
    world.stockpile['iron-ingot'] = 500;
    world.stockpile['iron-ore'] = 0;
    world.stockpile['coal'] = 0;

    processOfflineTime(world, EIGHT_HOURS);

    expect(world.stockpile['iron-ingot']).toBe(500);
    expect(world.stockpile['iron-ore']).toBe(0);
    expect(world.stockpile['coal']).toBe(0);
  });
});

describe('offline milestones and summary', () => {
  test('milestones reached offline apply silently and are reported in the summary', () => {
    const world = makePoweredExtractorWorld(31);
    world.milestoneProgress['produce-iron-ingot'] = 50;
    world.stockpile['iron-ore'] = 499;

    const summary = processOfflineTime(world, 60_000);

    expect(summary.unlocked).toContain('copper-miner');
    expect(summary.unlocked).toContain('copper-smelter');
    expect(summary.unlocked).toContain('coal-generator');
    expect(world.unlocked['copper-miner']).toBe(true);
    expect(world.unlocked['coal-generator']).toBe(true);
  });

  test('formats gains and unlocks into a single summary line', () => {
    const summary: OfflineSummary = {
      elapsedMs: 3_600_000,
      capped: false,
      steps: 60,
      resourceDeltas: { 'iron-ore': 120, coal: -5, water: 2.5 },
      unlocked: ['copper-miner']
    };

    expect(formatOfflineSummary(summary)).toBe(
      'While you were away: +120 Iron Ore, +2.5 Water, unlocked Copper Miner'
    );
  });

  test('lists every offline unlock by display name', () => {
    const summary: OfflineSummary = {
      elapsedMs: 60_000,
      capped: false,
      steps: 1,
      resourceDeltas: { fuel: 10 },
      unlocked: ['chemical-plant', 'pumpjack']
    };

    expect(formatOfflineSummary(summary)).toBe(
      'While you were away: +10 Fuel, unlocked Chemical Plant, Pumpjack'
    );
  });

  test('returns null when nothing meaningful changed', () => {
    expect(
      formatOfflineSummary({
        elapsedMs: 3_600_000,
        capped: false,
        steps: 60,
        resourceDeltas: {},
        unlocked: []
      })
    ).toBeNull();

    expect(
      formatOfflineSummary({
        elapsedMs: 60_000,
        capped: false,
        steps: 1,
        resourceDeltas: { coal: -5 },
        unlocked: []
      })
    ).toBeNull();
  });

  test('the 8h cap does not depend on the wall clock', () => {
    expect(OFFLINE_CAP_MS).toBe(EIGHT_HOURS);
    expect(computeOfflineElapsedMs(OFFLINE_CAP_MS + 1, 0)).toBe(OFFLINE_CAP_MS);
  });
});