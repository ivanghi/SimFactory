import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  AUTOSAVE_INTERVAL_MS,
  SAVE_STORAGE_KEY,
  clearSave,
  hasSave,
  loadGame,
  saveGame,
  startAutosave
} from './storage';
import { SaveError } from './serialize';
import type { GameSave } from './serialize';
import { makeSeededWorld } from '../test-utils/factories';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeSave(): GameSave {
  return { world: makeSeededWorld(2468), meta: { savedAt: 1000, speed: 1 } };
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.stubGlobal('requestIdleCallback', undefined);
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
});

describe('storage', () => {
  test('saves a game and loads an equivalent one', () => {
    const save = makeSave();
    expect(saveGame(save)).toBe(true);
    expect(localStorage.getItem(SAVE_STORAGE_KEY)).not.toBeNull();

    const loaded = loadGame();
    expect(loaded?.world).toEqual(clone(save.world));
    expect(loaded?.meta).toEqual(save.meta);
  });

  test('loads nothing when there is no save', () => {
    expect(loadGame()).toBeNull();
    expect(hasSave()).toBe(false);
  });

  test('rejects a corrupt stored save instead of loading a partial world', () => {
    localStorage.setItem(SAVE_STORAGE_KEY, '{ this is broken');
    expect(() => loadGame()).toThrow(SaveError);
  });

  test('clearSave removes the stored save', () => {
    expect(saveGame(makeSave())).toBe(true);
    expect(hasSave()).toBe(true);
    clearSave();
    expect(hasSave()).toBe(false);
    expect(loadGame()).toBeNull();
  });

  test('saveGame reports failure when the storage write throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(saveGame(makeSave())).toBe(false);
    spy.mockRestore();
  });
});

describe('autosave', () => {
  test('writes every interval and stamps the wall clock', () => {
    const save = makeSave();
    const stop = startAutosave(() => ({ world: save.world, speed: 2 }), { now: () => 5000 });

    vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS);

    const loaded = loadGame();
    expect(loaded?.world).toEqual(clone(save.world));
    expect(loaded?.meta).toEqual({ savedAt: 5000, speed: 2 });
    stop();
  });

  test('writes when the tab becomes hidden and stays quiet while visible', () => {
    const save = makeSave();
    const stop = startAutosave(() => ({ world: save.world, speed: 3 }), { now: () => 777 });

    document.dispatchEvent(new Event('visibilitychange'));
    expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBeNull();

    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(loadGame()?.meta).toEqual({ savedAt: 777, speed: 3 });
    stop();
  });

  test('writes on beforeunload', () => {
    const save = makeSave();
    const stop = startAutosave(() => ({ world: save.world, speed: 0 }), { now: () => 42 });

    window.dispatchEvent(new Event('beforeunload'));

    expect(loadGame()?.meta).toEqual({ savedAt: 42, speed: 0 });
    stop();
  });

  test('stopping autosave detaches the interval and both listeners', () => {
    const save = makeSave();
    const stop = startAutosave(() => ({ world: save.world, speed: 1 }), { now: () => 1 });
    stop();

    vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS * 3);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('beforeunload'));

    expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBeNull();
  });

  test('each write captures the latest world and speed', () => {
    const save = makeSave();
    let speed = 1;
    const stop = startAutosave(() => ({ world: save.world, speed }), { now: () => 9 });

    vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS);
    expect(loadGame()?.meta.speed).toBe(1);

    speed = 3;
    vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS);
    expect(loadGame()?.meta.speed).toBe(3);
    stop();
  });
});