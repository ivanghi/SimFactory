import { describe, test, expect } from 'vitest';
import { tick } from '../tick';
import { makeWorld, placeBuildingOk } from '../../test-utils/factories';
import type { WorldState } from '../world';
import {
  applyMilestonesSilently,
  evaluateMilestones,
  getMilestoneObjectives
} from '../milestones';

const START_UNLOCKED = [
  'iron-miner',
  'coal-miner',
  'water-pump',
  'smelter',
  'gear-assembler',
  'solar-panel',
  'warehouse'
];

const IRON_THRESHOLD_UNLOCKS = ['copper-miner', 'copper-smelter', 'coal-generator'];
const COAL_GENERATOR_UNLOCKS = ['refinery'];
const FUEL_THRESHOLD_UNLOCKS = ['chemical-plant'];
const GEAR_THRESHOLD_UNLOCKS = ['circuit-assembler'];
const GEAR_THRESHOLD2_UNLOCKS = ['pumpjack'];

const ALL_DERIVED = [
  ...IRON_THRESHOLD_UNLOCKS,
  ...COAL_GENERATOR_UNLOCKS,
  ...FUEL_THRESHOLD_UNLOCKS,
  ...GEAR_THRESHOLD_UNLOCKS,
  ...GEAR_THRESHOLD2_UNLOCKS
];

function ids(world: WorldState): string[] {
  return evaluateMilestones(world).map((event) => event.milestoneId);
}

describe('milestones', () => {
  test('start-unlocked buildings are available before any milestone fires', () => {
    const world = makeStartedWorld();

    for (const id of START_UNLOCKED) {
      expect(world.unlocked[id]).toBe(true);
    }
    for (const id of ALL_DERIVED) {
      expect(world.unlocked[id]).toBe(false);
    }
    expect(evaluateMilestones(world)).toEqual([]);
  });

  test('each trigger unlocks exactly the specified buildings at the threshold', () => {
    expect(unlockedBy(world => (world.milestoneProgress['produce-iron-ingot'] = 50))).toEqual(
      IRON_THRESHOLD_UNLOCKS
    );
    expect(unlockedBy(world => (world.milestoneProgress['place-coal-generator'] = 1))).toEqual(
      COAL_GENERATOR_UNLOCKS
    );
    expect(unlockedBy(world => (world.milestoneProgress['produce-fuel'] = 100))).toEqual(
      FUEL_THRESHOLD_UNLOCKS
    );
    expect(unlockedBy(world => (world.milestoneProgress['produce-gears'] = 50))).toEqual(
      GEAR_THRESHOLD_UNLOCKS
    );
    const world = makeStartedWorld();
    world.milestoneProgress['produce-gears'] = 50;
    evaluateMilestones(world);
    world.milestoneProgress['produce-gears'] = 100;
    expect(ids(world)).toEqual(GEAR_THRESHOLD2_UNLOCKS);
  });

  test('nothing unlocks below threshold and unlocks fire at or above it', () => {
    expectThreshold('produce-iron-ingot', 50, IRON_THRESHOLD_UNLOCKS);
    expectThreshold('place-coal-generator', 1, COAL_GENERATOR_UNLOCKS);
    expectThreshold('produce-fuel', 100, FUEL_THRESHOLD_UNLOCKS);
    expectThreshold('produce-gears', 50, GEAR_THRESHOLD_UNLOCKS, [
      ...GEAR_THRESHOLD_UNLOCKS,
      ...GEAR_THRESHOLD2_UNLOCKS
    ]);
  });

  test('multiple milestones satisfied in one tick all apply in a deterministic order', () => {
    const world = makeStartedWorld();
    world.milestoneProgress['produce-iron-ingot'] = 50;
    world.milestoneProgress['place-coal-generator'] = 1;
    world.milestoneProgress['produce-fuel'] = 100;
    world.milestoneProgress['produce-gears'] = 100;

    expect(ids(world)).toEqual([
      ...IRON_THRESHOLD_UNLOCKS,
      ...COAL_GENERATOR_UNLOCKS,
      ...FUEL_THRESHOLD_UNLOCKS,
      ...GEAR_THRESHOLD_UNLOCKS,
      ...GEAR_THRESHOLD2_UNLOCKS,
    ]);
  });

  test('unlocks are idempotent and never revoked', () => {
    const world = makeStartedWorld();
    world.milestoneProgress['produce-iron-ingot'] = 50;

    expect(ids(world)).toEqual(IRON_THRESHOLD_UNLOCKS);
    expect(evaluateMilestones(world)).toEqual([]);
    for (const id of IRON_THRESHOLD_UNLOCKS) {
      expect(world.unlocked[id]).toBe(true);
    }

    world.milestoneProgress['produce-iron-ingot'] = 0;
    expect(evaluateMilestones(world)).toEqual([]);
    for (const id of IRON_THRESHOLD_UNLOCKS) {
      expect(world.unlocked[id]).toBe(true);
    }
  });

  test('counters accumulate across ticks and unlock at the threshold', () => {
    const world = makeStartedWorld();
    placeBuildingOk(world, 'smelter', 20, 20);
    world.stockpile['iron-ore'] = 200;
    world.stockpile['coal'] = 100;

    for (let i = 0; i < 100; i++) {
      tick(world, 1);
    }
    expect(world.milestoneProgress['produce-iron-ingot']).toBe(10);
    expect(evaluateMilestones(world)).toEqual([]);

    for (let i = 0; i < 400; i++) {
      tick(world, 1);
    }
    expect(world.milestoneProgress['produce-iron-ingot']).toBe(50);
    expect(ids(world)).toEqual(IRON_THRESHOLD_UNLOCKS);
  });

  test('unlock events carry the milestone and trigger metadata', () => {
    const world = makeStartedWorld();
    world.milestoneProgress['place-coal-generator'] = 1;

    const events = evaluateMilestones(world);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('unlock');
    expect(events[0].milestoneId).toBe('refinery');
    expect(events[0].buildingId).toBe('refinery');
    expect(events[0].trigger).toEqual({
      kind: 'place',
      buildingId: 'coal-generator',
      quantity: 1
    });
  });

  test('objectives expose current and target progress for the panel', () => {
    const world = makeStartedWorld();
    world.milestoneProgress['produce-fuel'] = 40;

    const objectives = getMilestoneObjectives(world);
    const fuelGoals = objectives.filter(
      objective => objective.trigger.kind === 'produce' && objective.trigger.resource === 'fuel'
    );

    expect(fuelGoals.map(goal => goal.buildingId)).toEqual(FUEL_THRESHOLD_UNLOCKS);
    for (const goal of fuelGoals) {
      expect(goal.progress).toBe(40);
      expect(goal.target).toBe(100);
      expect(goal.done).toBe(false);
    }

    const startGoals = objectives.filter(objective => objective.trigger.kind === 'start');
    expect(startGoals).toHaveLength(START_UNLOCKED.length);
    for (const goal of startGoals) {
      expect(goal.progress).toBe(goal.target);
      expect(goal.done).toBe(true);
    }

    world.milestoneProgress['produce-fuel'] = 100;
    evaluateMilestones(world);
    for (const goal of getMilestoneObjectives(world).filter(g =>
      FUEL_THRESHOLD_UNLOCKS.includes(g.buildingId)
    )) {
      expect(goal.done).toBe(true);
    }
  });

  test('offline-earned unlocks apply silently without per-milestone notifications', () => {
    const notified: string[] = [];
    const onlineWorld = makeStartedWorld();
    onlineWorld.milestoneProgress['produce-fuel'] = 100;
    evaluateMilestones(onlineWorld, event => notified.push(event.milestoneId));
    expect(notified).toEqual(FUEL_THRESHOLD_UNLOCKS);

    const offlineWorld = makeStartedWorld();
    offlineWorld.milestoneProgress['produce-fuel'] = 100;
    const silentEvents = applyMilestonesSilently(offlineWorld);

    expect(silentEvents.map(event => event.milestoneId)).toEqual(FUEL_THRESHOLD_UNLOCKS);
    expect(notified).toEqual(FUEL_THRESHOLD_UNLOCKS);
    for (const id of FUEL_THRESHOLD_UNLOCKS) {
      expect(offlineWorld.unlocked[id]).toBe(true);
    }
  });
});

function makeStartedWorld(): WorldState {
  return makeWorld();
}

function unlockedBy(mutate: (world: WorldState) => void): string[] {
  const world = makeStartedWorld();
  mutate(world);
  return ids(world);
}

function expectThreshold(
  key: string,
  target: number,
  expected: string[],
  expectedAbove: string[] = expected
): void {
  const below = makeStartedWorld();
  below.milestoneProgress[key] = target - 1;
  expect(evaluateMilestones(below)).toEqual([]);

  const at = makeStartedWorld();
  at.milestoneProgress[key] = target;
  expect(ids(at)).toEqual(expected);

  const above = makeStartedWorld();
  above.milestoneProgress[key] = target + 100;
  expect(ids(above)).toEqual(expectedAbove);
}