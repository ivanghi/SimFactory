import { describe, test, expect } from 'vitest';
import { exportGame, importGame } from './exportImport';
import { CURRENT_SAVE_VERSION, SaveError } from './serialize';
import type { GameSave, SaveErrorCode } from './serialize';
import { makeSeededWorld } from '../test-utils/factories';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function expectCode(code: SaveErrorCode, run: () => unknown): SaveError {
  try {
    run();
  } catch (error) {
    if (error instanceof SaveError) {
      expect(error.code).toBe(code);
      return error;
    }
    throw error;
  }
  throw new Error('expected a SaveError to be thrown');
}

function makeSave(): GameSave {
  return { world: makeSeededWorld(1234), meta: { savedAt: 555, speed: 2 } };
}

describe('export / import', () => {
  test('export then import round-trips the world and meta', () => {
    const save = makeSave();
    const text = exportGame(save);

    const restored = importGame(text);

    expect(restored.world).toEqual(clone(save.world));
    expect(restored.meta).toEqual(save.meta);
  });

  test('the export is a plain base64 string', () => {
    const text = exportGame(makeSave());
    expect(text.length).toBeGreaterThan(0);
    expect(text).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(text).not.toContain('{');
  });

  test('invalid base64 is rejected cleanly', () => {
    expectCode('invalid-format', () => importGame('@@@@ not base64 @@@@'));
  });

  test('an empty import string is rejected cleanly', () => {
    expectCode('invalid-format', () => importGame(''));
    expectCode('invalid-format', () => importGame('   '));
  });

  test('valid base64 wrapping an invalid payload is rejected', () => {
    expectCode('invalid-format', () => importGame(btoa('this is not json')));
  });

  test('valid base64 wrapping a corrupt save is rejected', () => {
    expectCode('corrupt', () => importGame(btoa(JSON.stringify({ version: CURRENT_SAVE_VERSION }))));
  });

  test('a save from a newer version is rejected on import', () => {
    const error = expectCode('unsupported-version', () =>
      importGame(btoa(JSON.stringify({ version: CURRENT_SAVE_VERSION + 1 })))
    );
    expect(error.message).toMatch(/newer/i);
  });

  test('a failed import leaves the current world untouched', () => {
    const save = makeSave();
    const snapshot = clone(save);

    expect(() => importGame('@@@@')).toThrow(SaveError);
    expect(() => importGame(btoa('nope'))).toThrow(SaveError);

    expect(save).toEqual(snapshot);
  });

  test('import returns a fresh world rather than reusing the exported one', () => {
    const save = makeSave();
    const restored = importGame(exportGame(save));
    expect(restored.world).not.toBe(save.world);
    expect(restored.world.buildings).not.toBe(save.world.buildings);
  });
});