import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { generateMap } from './sim/mapgen';
import { createWorld, placeBuilding, demolishBuilding } from './sim/world';
import type { PlacementError, WorldState } from './sim/world';
import { tick } from './sim/tick';
import { updatePower } from './sim/power';
import { getBuildingDef } from './data/buildings';
import { TICK_DT } from './data/constants';
import { CameraController } from './render/camera';
import { CanvasRenderer } from './render/canvas';
import { App } from './ui/app';
import {
  bumpUi,
  getState,
  markSimChanged,
  pushToast,
  setSpeed,
  setWorld,
  syncUi
} from './ui/store';

const MAX_ACCUMULATOR = 0.5;
const CANVAS_ID = 'game-canvas';
const CONTAINER_ID = 'game-container';
const MAP_SIZE = 64;

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

export function getWorld(): WorldState {
  return world;
}

export function getCamera(): CameraController {
  return camera;
}

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

function init(): void {
  const seed = Math.floor(Math.random() * 2147483647);
  const map = generateMap(seed);
  world = createWorld(map);

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
  setSpeed(1);
  mountUI();

  requestAnimationFrame(gameLoop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
