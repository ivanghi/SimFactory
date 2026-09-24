import type { WorldState } from '../sim/world';
import { ratePerMinute, resetRateSamples, sampleProgress } from '../sim/rates';

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
  sciencePerMinute: number;
}

let state: UIState = {
  world: null,
  selectedBuildingId: null,
  demolishMode: false,
  speed: 1,
  toasts: [],
  settingsOpen: false,
  sciencePerMinute: 0
};

const listeners = new Set<() => void>();
let toastSeq = 1;
let simChanged = false;
let lastUiSync = 0;
let newGameHandler: (() => void) | null = null;

export interface GameCodeHandlers {
  exportCode: () => string;
  importCode: (code: string) => void;
}

let gameCodeHandlers: GameCodeHandlers | null = null;

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

function scienceProduced(world: WorldState): number {
  return world.milestoneProgress['produce-science'] ?? 0;
}

function reseedRateTracker(world: WorldState): void {
  resetRateSamples();
  sampleProgress(world.time, scienceProduced(world));
}

export function setWorld(world: WorldState): void {
  reseedRateTracker(world);
  commit({ world, sciencePerMinute: ratePerMinute() });
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

export function setGameCodeHandlers(handlers: GameCodeHandlers | null): void {
  gameCodeHandlers = handlers;
}

export function exportSaveCode(): string {
  return gameCodeHandlers?.exportCode() ?? '';
}

export function importSaveCode(code: string): void {
  gameCodeHandlers?.importCode(code);
}

export function resetWorld(world: WorldState): void {
  reseedRateTracker(world);
  commit({
    world,
    selectedBuildingId: null,
    demolishMode: false,
    toasts: [],
    speed: 1,
    settingsOpen: false,
    sciencePerMinute: ratePerMinute()
  });
}

export function pushToast(text: string): void {
  const toast: Toast = { id: toastSeq++, text, ts: Date.now() };
  commit({ toasts: [...state.toasts, toast].slice(-20) });
}

export function markSimChanged(): void {
  simChanged = true;
}

const UI_SYNC_INTERVAL_MS = 1000;

function refresh(): void {
  if (state.world) {
    sampleProgress(state.world.time, scienceProduced(state.world));
  }
  state = { ...state, sciencePerMinute: ratePerMinute() };
  emit();
}

export function bumpUi(): void {
  simChanged = false;
  refresh();
}

export function syncUi(now: number): void {
  if (!simChanged) return;
  if (now - lastUiSync < UI_SYNC_INTERVAL_MS) return;
  lastUiSync = now;
  simChanged = false;
  refresh();
}
