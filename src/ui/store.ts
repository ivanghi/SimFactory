import type { WorldState } from '../sim/world';

export type SpeedSetting = 0 | 1 | 2 | 3;

export interface Toast {
  id: number;
  text: string;
  ts: number;
}

export interface UIState {
  world: WorldState | null;
  selectedBuildingId: string | null;
  demolishMode: boolean;
  speed: SpeedSetting;
  toasts: Toast[];
  settingsOpen: boolean;
}

let state: UIState = {
  world: null,
  selectedBuildingId: null,
  demolishMode: false,
  speed: 1,
  toasts: [],
  settingsOpen: false
};

const listeners = new Set<() => void>();
let toastSeq = 1;
let simChanged = false;
let lastUiSync = 0;
let newGameHandler: (() => void) | null = null;

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): UIState {
  return state;
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function commit(partial: Partial<UIState>): void {
  state = { ...state, ...partial };
  emit();
}

export function setWorld(world: WorldState): void {
  commit({ world });
}

export function selectBuilding(id: string | null): void {
  const next = state.selectedBuildingId === id ? null : id;
  commit({ selectedBuildingId: next, demolishMode: false });
}

export function toggleDemolish(): void {
  commit({ demolishMode: !state.demolishMode, selectedBuildingId: null });
}

export function setSpeed(speed: SpeedSetting): void {
  commit({ speed });
}

export function toggleSettings(): void {
  commit({ settingsOpen: !state.settingsOpen });
}

export function closeSettings(): void {
  commit({ settingsOpen: false });
}

export function setNewGameHandler(handler: (() => void) | null): void {
  newGameHandler = handler;
}

export function requestNewGame(): void {
  const handler = newGameHandler;
  commit({ settingsOpen: false });
  if (handler) {
    handler();
  }
}

export function resetWorld(world: WorldState): void {
  commit({
    world,
    selectedBuildingId: null,
    demolishMode: false,
    toasts: [],
    speed: 1,
    settingsOpen: false
  });
}

export function pushToast(text: string): void {
  const toast: Toast = { id: toastSeq++, text, ts: Date.now() };
  commit({ toasts: [...state.toasts, toast].slice(-20) });
}

export function markSimChanged(): void {
  simChanged = true;
}

export function bumpUi(): void {
  simChanged = false;
  emit();
}

export function syncUi(now: number): void {
  if (!simChanged) return;
  if (now - lastUiSync < 150) return;
  lastUiSync = now;
  simChanged = false;
  emit();
}
