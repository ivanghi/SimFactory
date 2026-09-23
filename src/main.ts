import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { generateMap } from './sim/mapgen';
import { createWorld, placeBuilding, demolishBuilding } from './sim/world';
import type { PlacementError, WorldState } from './sim/world';
import { tick } from './sim/tick';
import { updatePower } from './sim/power';
import { evaluateMilestones } from './sim/milestones';
import type { MilestoneUnlockEvent } from './sim/milestones';
import { getBuildingDef } from './data/buildings';
import { MAP_SIZE, TICK_DT } from './data/constants';
import { CameraController } from './render/camera';
import { CanvasRenderer } from './render/canvas';
import { formatOfflineSummary, processOfflineTime } from './sim/offline';
import type { OfflineSummary } from './sim/offline';
import { SaveError } from './save/serialize';
import { clearSave, loadGame, startAutosave } from './save/storage';
import { exportGame, importGame } from './save/exportImport';
import { App } from './ui/app';
import {
  bumpUi,
  getState,
  markSimChanged,
  pushToast,
  resetWorld,
  setGameCodeHandlers,
  setNewGameHandler,
  setSpeed,
  setWorld,
  syncUi
} from './ui/store';
import type { SpeedSetting } from './ui/store';

const MAX_ACCUMULATOR = 0.5;
const CANVAS_ID = 'game-canvas';
const CONTAINER_ID = 'game-container';

const PLACEMENT_MESSAGES: Record<PlacementError, string> = {
  'unknown-building': 'Unknown building',
  locked: 'Not unlocked yet',
  'out-of-bounds': 'Outside the map',
  'not-buildable': 'Cannot build on this terrain',
  'wrong-node': 'Wrong resource node',
  occupied: 'Tile already occupied',
  'insufficient-resources': 'Not enough resources'
};

let world: WorldState;
let camera: CameraController;
let renderer: CanvasRenderer;
let canvas: HTMLCanvasElement;

let ghostState: { buildingId: string; tx: number; ty: number } | null = null;
let lastTime = 0;
let accumulator = 0;

interface CanvasPoint {
  x: number;
  y: number;
  w: number;
  h: number;
}

function getCanvasPos(e: MouseEvent): CanvasPoint {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width, h: rect.height };
}

function isOnMap(tx: number, ty: number): boolean {
  return tx >= 0 && tx < MAP_SIZE && ty >= 0 && ty < MAP_SIZE;
}

function reportUnlocks(events: MilestoneUnlockEvent[]): void {
  for (const event of events) {
    const name = getBuildingDef(event.buildingId)?.name ?? event.buildingId;
    pushToast(`Unlocked: ${name}`);
  }
}

function handleMouseDown(e: MouseEvent): void {
  const { x, y } = getCanvasPos(e);
  camera.handleMouseDown(x, y);
}

function handleMouseMove(e: MouseEvent): void {
  const { x, y, w, h } = getCanvasPos(e);
  const wasDrag = camera.handleMouseMove(x, y);
  if (wasDrag || x < 0 || y < 0 || x >= w || y >= h) return;

  const { selectedBuildingId, demolishMode } = getState();
  if (selectedBuildingId && !demolishMode) {
    const { tx, ty } = camera.screenToTile(x, y);
    ghostState = isOnMap(tx, ty) ? { buildingId: selectedBuildingId, tx, ty } : null;
  }
}

function handleMouseUp(e: MouseEvent): void {
  const { x, y } = getCanvasPos(e);
  const isClick = camera.handleMouseUp(x, y);
  if (!isClick) return;
  if (e.target !== canvas) return;

  const { tx, ty } = camera.screenToTile(x, y);
  if (!isOnMap(tx, ty)) return;

  const { selectedBuildingId, demolishMode } = getState();
  if (demolishMode) {
    const building = world.buildings.find((b) => b.x === tx && b.y === ty);
    if (building) {
      demolishBuilding(world, building.id);
      const name = getBuildingDef(building.buildingId)?.name ?? 'building';
      pushToast(`Demolished ${name} — 50% refunded`);
      bumpUi();
    }
  } else if (selectedBuildingId) {
    const result = placeBuilding(world, selectedBuildingId, tx, ty);
    if (!result.ok && result.error) {
      pushToast(PLACEMENT_MESSAGES[result.error]);
    } else if (result.ok) {
      reportUnlocks(evaluateMilestones(world));
      bumpUi();
    }
  }
}

function handleWheel(e: WheelEvent): void {
  e.preventDefault();
  const { x, y } = getCanvasPos(e);
  const delta = Math.sign(e.deltaY);
  camera.handleWheel(delta, x, y);
}

function handleMouseLeave(): void {
  ghostState = null;
}

function handleResize(): void {
  renderer.resizeToParent();
}

function gameLoop(timestamp: number): void {
  if (lastTime === 0) {
    lastTime = timestamp;
    requestAnimationFrame(gameLoop);
    return;
  }

  let dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  if (dt > MAX_ACCUMULATOR) dt = MAX_ACCUMULATOR;

  let ticked = false;
  const { speed } = getState();
  if (speed > 0) {
    accumulator += dt * speed;
    while (accumulator >= TICK_DT) {
      updatePower(world, TICK_DT);
      tick(world, TICK_DT);
      reportUnlocks(evaluateMilestones(world));
      accumulator -= TICK_DT;
      ticked = true;
    }
    if (ticked) markSimChanged();
  }

  renderer.render(world, ghostState, getState().demolishMode);
  syncUi(timestamp);

  requestAnimationFrame(gameLoop);
}

function setupCanvas(): HTMLCanvasElement {
  const container = document.getElementById(CONTAINER_ID);
  if (!container) {
    throw new Error(`#${CONTAINER_ID} not found`);
  }
  const canvasEl = document.createElement('canvas');
  canvasEl.id = CANVAS_ID;
  canvasEl.style.display = 'block';
  container.appendChild(canvasEl);
  return canvasEl;
}

function mountUI(): void {
  const rootEl = document.getElementById('root');
  if (rootEl) {
    createRoot(rootEl).render(createElement(App));
  }
}

function clampSpeed(speed: number): SpeedSetting {
  if (!Number.isFinite(speed)) {
    return 1;
  }
  return Math.min(3, Math.max(0, Math.round(speed))) as SpeedSetting;
}

interface RestoredGame {
  world: WorldState;
  speed: SpeedSetting;
  offline: OfflineSummary | null;
}

function restoreOrCreate(): RestoredGame {
  try {
    const save = loadGame();
    if (save) {
      const offline = processOfflineTime(save.world, Date.now() - save.meta.savedAt);
      return { world: save.world, speed: clampSpeed(save.meta.speed), offline };
    }
  } catch (error) {
    const message = error instanceof SaveError ? error.message : 'The save could not be read.';
    pushToast(`Save error: ${message}`);
  }
  const seed = Math.floor(Math.random() * 2147483647);
  return { world: createWorld(generateMap(seed)), speed: 1, offline: null };
}

function startNewGame(): void {
  clearSave();
  world = createWorld(generateMap(Math.floor(Math.random() * 2147483647)));
  ghostState = null;
  accumulator = 0;
  camera.centerOnMap();
  resetWorld(world);
  pushToast('New game started');
}

function exportCurrentSave(): string {
  return exportGame({ world, meta: { savedAt: Date.now(), speed: getState().speed } });
}

function importExportedSave(code: string): void {
  const save = importGame(code);
  world = save.world;
  ghostState = null;
  accumulator = 0;
  camera.centerOnMap();
  resetWorld(world);
  setSpeed(clampSpeed(save.meta.speed));
  pushToast('Save imported');
}

function init(): void {
  const restored = restoreOrCreate();
  world = restored.world;

  canvas = setupCanvas();
  camera = new CameraController();
  renderer = new CanvasRenderer(canvas, camera);

  renderer.resizeToParent();
  camera.centerOnMap();

  canvas.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('wheel', handleWheel, { passive: false });
  canvas.addEventListener('mouseleave', handleMouseLeave);

  window.addEventListener('resize', handleResize);

  setWorld(world);
  setSpeed(restored.speed);
  setNewGameHandler(startNewGame);
  setGameCodeHandlers({ exportCode: exportCurrentSave, importCode: importExportedSave });
  mountUI();

  if (restored.offline) {
    const summary = formatOfflineSummary(restored.offline);
    if (summary) {
      pushToast(summary);
    }
  }

  startAutosave(() => ({ world, speed: getState().speed }));

  requestAnimationFrame(gameLoop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
