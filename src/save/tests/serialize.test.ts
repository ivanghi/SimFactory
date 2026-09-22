import { describe, test, expect } from 'vitest';
import { generateMap } from '../../sim/mapgen';
import {
  CURRENT_SAVE_VERSION,
  SaveError,
  deserializeWorld,
  migrations,
  runMigrations,
  serializeWorld
} from '../serialize';
import type { MigrationTable, RawSaveFile, SaveErrorCode } from '../serialize';
import { makeSeededWorld } from '../../test-utils/factories';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function captureError(run: () => unknown): SaveError {
  try {
    run();
  } catch (error) {
    if (error instanceof SaveError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected a SaveError to be thrown');
}

function expectCode(code: SaveErrorCode, run: () => unknown): SaveError {
  const error = captureError(run);
  expect(error.code).toBe(code);
  return error;
}

function validV1(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: CURRENT_SAVE_VERSION,
    seed: 4242,
    buildings: [],
    stockpile: { 'iron-ore': 50 },
    unlocked: { 'iron-miner': true },
    milestoneProgress: {},
    time: 0,
    nextBuildingId: 1,
    power: { supply: 0, demand: 0, efficiency: 1 },
    savedAt: 0,
    speed: 1,
    ...overrides
  };
}

describe('serialize round-trip', () => {
  test('serialize then deserialize yields an equivalent world', () => {
    const world = makeSeededWorld(4242);
    const snapshot = clone(world);
    const text = serializeWorld(world, { savedAt: 1_700_000_000_000, speed: 2 });

    expect(world).toEqual(snapshot);

    const save = deserializeWorld(text);
    expect(save.world).toEqual(snapshot);
    expect(save.meta).toEqual({ savedAt: 1_700_000_000_000, speed: 2 });
  });

  test('map regenerates identically from the stored seed', () => {
    const world = makeSeededWorld(987_654);
    const save = deserializeWorld(serializeWorld(world, { savedAt: 1, speed: 1 }));

    expect(save.world.map.seed).toBe(987_654);
    expect(save.world.map).toEqual(generateMap(987_654));
    expect(save.world.map.tiles).toHaveLength(64);
    expect(save.world.map.tiles[0]).toHaveLength(64);
  });

  test('buildings, stockpile, unlocks, counters, power and clock all survive', () => {
    const world = makeSeededWorld(4242);
    const save = deserializeWorld(serializeWorld(world, { savedAt: 1, speed: 3 }));

    expect(save.world.buildings).toEqual(world.buildings);
    expect(save.world.stockpile).toEqual(world.stockpile);
    expect(save.world.unlocked).toEqual(world.unlocked);
    expect(save.world.milestoneProgress).toEqual(world.milestoneProgress);
    expect(save.world.power).toEqual(world.power);
    expect(save.world.time).toBe(world.time);
    expect(save.world.nextBuildingId).toBe(world.nextBuildingId);
  });

  test('a save without any buildings round-trips', () => {
    const save = deserializeWorld(JSON.stringify(validV1()));
    expect(save.world.buildings).toEqual([]);
    expect(save.world.stockpile).toEqual({ 'iron-ore': 50 });
  });
});

describe('save validation', () => {
  test('unparseable JSON is rejected as invalid-format', () => {
    expectCode('invalid-format', () => deserializeWorld('not json at all'));
    expectCode('invalid-format', () => deserializeWorld('{"version":1,'));
  });

  test('a JSON value that is not an object is rejected', () => {
    expectCode('invalid-format', () => deserializeWorld('[]'));
    expectCode('invalid-format', () => deserializeWorld('42'));
    expectCode('invalid-format', () => deserializeWorld('null'));
  });

  test('a save missing its version field is rejected', () => {
    const withoutVersion = validV1();
    delete withoutVersion.version;
    const error = expectCode('corrupt', () => deserializeWorld(JSON.stringify(withoutVersion)));
    expect(error.message).toMatch(/version/i);
  });

  test('an invalid version field is rejected', () => {
    expectCode('corrupt', () => deserializeWorld(JSON.stringify(validV1({ version: -1 }))));
    expectCode('corrupt', () => deserializeWorld(JSON.stringify(validV1({ version: 1.5 }))));
    expectCode('corrupt', () => deserializeWorld(JSON.stringify(validV1({ version: '1' }))));
  });

  test('a save from a newer version is rejected with a clear message', () => {
    const error = expectCode('unsupported-version', () =>
      deserializeWorld(JSON.stringify(validV1({ version: CURRENT_SAVE_VERSION + 5 })))
    );
    expect(error.message).toMatch(/newer/i);
    expect(error.message).toContain(String(CURRENT_SAVE_VERSION + 5));
  });

  test('missing required fields are rejected', () => {
    const withoutSeed = validV1();
    delete withoutSeed.seed;
    expectCode('corrupt', () => deserializeWorld(JSON.stringify(withoutSeed)));

    const withoutPower = validV1();
    delete withoutPower.power;
    expectCode('corrupt', () => deserializeWorld(JSON.stringify(withoutPower)));

    const withoutSavedAt = validV1();
    delete withoutSavedAt.savedAt;
    expectCode('corrupt', () => deserializeWorld(JSON.stringify(withoutSavedAt)));
  });

  test('wrongly typed fields are rejected', () => {
    expectCode('corrupt', () =>
      deserializeWorld(JSON.stringify(validV1({ buildings: {} })))
    );
    expectCode('corrupt', () =>
      deserializeWorld(JSON.stringify(validV1({ stockpile: { 'iron-ore': '50' } })))
    );
    expectCode('corrupt', () =>
      deserializeWorld(JSON.stringify(validV1({ unlocked: { 'iron-miner': 'yes' } })))
    );
    expectCode('corrupt', () =>
      deserializeWorld(JSON.stringify(validV1({ time: null })))
    );
    expectCode('corrupt', () =>
      deserializeWorld(JSON.stringify(validV1({ nextBuildingId: 0 })))
    );
    expectCode('corrupt', () =>
      deserializeWorld(JSON.stringify(validV1({ speed: 9 })))
    );
  });

  test('a building with an unknown type is rejected', () => {
    const building = {
      id: 'b1',
      buildingId: 'not-a-building',
      x: 10,
      y: 10,
      adjacencyMultiplier: 1,
      progress: 0
    };
    expectCode('corrupt', () =>
      deserializeWorld(JSON.stringify(validV1({ buildings: [building] })))
    );
  });

  test('a building outside the map is rejected', () => {
    const building = {
      id: 'b1',
      buildingId: 'solar-panel',
      x: 999,
      y: 10,
      adjacencyMultiplier: 1,
      progress: 0
    };
    expectCode('corrupt', () =>
      deserializeWorld(JSON.stringify(validV1({ buildings: [building] })))
    );
  });

  test('a building missing fields is rejected', () => {
    expectCode('corrupt', () =>
      deserializeWorld(
        JSON.stringify(validV1({ buildings: [{ id: 'b1', buildingId: 'solar-panel' }] }))
      )
    );
  });
});

describe('version migration', () => {
  test('a legacy unversioned save upgrades to the current version and loads', () => {
    const legacy = {
      map: { tiles: [[{ type: 'grass' }]], seed: 777 },
      buildings: [
        { id: 'b1', buildingId: 'solar-panel', x: 10, y: 10, adjacencyMultiplier: 1, progress: 0 }
      ],
      stockpile: { 'iron-ore': 50, coal: 12 },
      unlocked: { 'iron-miner': true },
      milestoneProgress: { 'produce-iron-ingot': 9 },
      time: 42,
      nextBuildingId: 2,
      power: { supply: 2, demand: 1, efficiency: 1 }
    };

    const save = deserializeWorld(JSON.stringify(legacy));

    expect(save.world.map.seed).toBe(777);
    expect(save.world.map.tiles).toHaveLength(64);
    expect(save.world.buildings).toEqual(legacy.buildings);
    expect(save.world.stockpile).toEqual(legacy.stockpile);
    expect(save.world.time).toBe(42);
    expect(save.world.milestoneProgress['produce-iron-ingot']).toBe(9);
    expect(save.meta).toEqual({ savedAt: 0, speed: 1 });
  });

  test('the loader registers a migration for the legacy version', () => {
    expect(typeof migrations[0]).toBe('function');
  });

  test('a legacy blob with a corrupt map seed is rejected', () => {
    expectCode('corrupt', () => deserializeWorld(JSON.stringify({ map: { tiles: [] } })));
  });

  test('a migration chain applies multiple steps in order', () => {
    const order: number[] = [];
    const table: MigrationTable = {
      1: (save) => {
        order.push(1);
        return { ...save, stepOne: true };
      },
      2: (save) => {
        order.push(2);
        expect(save.stepOne).toBe(true);
        return { ...save, stepTwo: true };
      }
    };

    const result: RawSaveFile = runMigrations({ version: 1, marker: 'start' }, 1, 3, table);

    expect(order).toEqual([1, 2]);
    expect(result).toMatchObject({
      version: 3,
      marker: 'start',
      stepOne: true,
      stepTwo: true
    });
  });

  test('a missing migration step is rejected instead of loading a partial world', () => {
    expectCode('corrupt', () => runMigrations({ version: 1 }, 1, 3, { 1: (save) => save }));
  });

  test('a migration that returns a non-object is rejected', () => {
    expectCode('corrupt', () => runMigrations({}, 0, 1, { 0: () => null }));
  });
});