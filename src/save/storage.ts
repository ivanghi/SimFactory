import { deserializeWorld, serializeWorld } from './serialize';
import type { GameSave } from './serialize';
import type { WorldState } from '../sim/world';

export const SAVE_STORAGE_KEY = 'factory-game-save';
export const AUTOSAVE_INTERVAL_MS = 10_000;

export interface SaveSnapshot {
  world: WorldState;
  speed: number;
}

export interface AutosaveOptions {
  intervalMs?: number;
  now?: () => number;
}

type IdleScheduler = (callback: () => void) => void;

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function saveGame(save: GameSave): boolean {
  const storage = getStorage();
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(SAVE_STORAGE_KEY, serializeWorld(save.world, save.meta));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): GameSave | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }
  const raw = storage.getItem(SAVE_STORAGE_KEY);
  if (raw === null) {
    return null;
  }
  return deserializeWorld(raw);
}

export function hasSave(): boolean {
  const storage = getStorage();
  return storage !== null && storage.getItem(SAVE_STORAGE_KEY) !== null;
}

export function clearSave(): void {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(SAVE_STORAGE_KEY);
  }
}

function scheduleIdle(callback: () => void): void {
  const requestIdle = (globalThis as { requestIdleCallback?: IdleScheduler }).requestIdleCallback;
  if (typeof requestIdle === 'function') {
    requestIdle(callback);
  } else {
    callback();
  }
}

export function startAutosave(
  snapshot: () => SaveSnapshot,
  options: AutosaveOptions = {}
): () => void {
  const intervalMs = options.intervalMs ?? AUTOSAVE_INTERVAL_MS;
  const now = options.now ?? (() => Date.now());

  const write = (): void => {
    const { world, speed } = snapshot();
    saveGame({ world, meta: { savedAt: now(), speed } });
  };

  const writeDeferred = (): void => scheduleIdle(write);

  const interval = setInterval(writeDeferred, intervalMs);

  const onVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.hidden) {
      writeDeferred();
    }
  };
  const onBeforeUnload = (): void => write();

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', onBeforeUnload);
  }

  return () => {
    clearInterval(interval);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', onBeforeUnload);
    }
  };
}