import type { WorldState, Building, PlacementError } from '../sim/world';
import { getBuildingDef } from '../data/buildings';
import { TILE_SIZE, CameraController } from './camera';

const GRASS_COLOR = '#4a7';
const ROCK_COLOR = '#777';
const WATER_COLOR = '#258';
const GRID_COLOR = 'rgba(0,0,0,0.08)';
const GHOST_VALID_COLOR = 'rgba(0,255,0,0.35)';
const GHOST_INVALID_COLOR = 'rgba(255,0,0,0.35)';
const GHOST_BORDER_VALID = 'rgba(0,200,0,0.6)';
const GHOST_BORDER_INVALID = 'rgba(200,0,0,0.6)';
const DEMOLISH_HIGHLIGHT = 'rgba(255,0,0,0.25)';
const NODE_COLORS: Record<string, string> = {
  'iron-ore': '#a67c52',
  'copper-ore': '#d4813d',
  coal: '#3a3a3a',
  'crude-oil': '#1a1a1a',
};
const BUILDING_COLORS: Record<string, { fill: string; stroke: string }> = {
  'iron-miner': { fill: '#8B7355', stroke: '#6B5335' },
  'copper-miner': { fill: '#D2691E', stroke: '#B2490E' },
  'coal-miner': { fill: '#555', stroke: '#333' },
  pumpjack: { fill: '#4A6B4A', stroke: '#2A4B2A' },
  'water-pump': { fill: '#4682B4', stroke: '#266294' },
  smelter: { fill: '#C04040', stroke: '#A02020' },
  'copper-smelter': { fill: '#E08030', stroke: '#C06010' },
  refinery: { fill: '#6A6A7A', stroke: '#4A4A5A' },
  'chemical-plant': { fill: '#3A8A3A', stroke: '#1A6A1A' },
  'gear-assembler': { fill: '#7A8A9A', stroke: '#5A6A7A' },
  'circuit-assembler': { fill: '#4A8A6A', stroke: '#2A6A4A' },
  lab: { fill: '#8A4AC0', stroke: '#6A2AA0' },
  'solar-panel': { fill: '#1E90FF', stroke: '#0070DF' },
  'coal-generator': { fill: '#8B3A3A', stroke: '#6B1A1A' },
  warehouse: { fill: '#A0724A', stroke: '#80522A' },
};

function validateGhostPlacement(
  world: WorldState,
  buildingId: string,
  tx: number,
  ty: number
): PlacementError | null {
  const def = getBuildingDef(buildingId);
  if (!def) return 'unknown-building';
  if (!world.unlocked[buildingId]) return 'locked';
  const tiles = world.map.tiles;
  if (ty < 0 || ty >= tiles.length || tx < 0 || tx >= tiles[ty].length) return 'out-of-bounds';
  const tile = tiles[ty][tx];
  if (def.category === 'extractor') {
    if (def.recipeId === 'water') {
      if (tile.type !== 'water') return 'wrong-node';
    } else {
      if (tile.type !== 'grass') return 'not-buildable';
      if (tile.resource?.type !== def.recipeId) return 'wrong-node';
    }
  } else if (tile.type !== 'grass') {
    return 'not-buildable';
  }
  if (world.buildings.some((b) => b.x === tx && b.y === ty)) return 'occupied';
  const affordable = def.cost.every((c) => (world.stockpile[c.resource] ?? 0) >= c.amount);
  if (!affordable) return 'insufficient-resources';
  return null;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: CameraController;

  constructor(canvas: HTMLCanvasElement, camera: CameraController) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.camera = camera;
  }

  resizeToParent(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.camera.setCanvasSize(w, h);
  }

  getCanvasWidth(): number {
    return this.canvas.width / (window.devicePixelRatio || 1);
  }

  getCanvasHeight(): number {
    return this.canvas.height / (window.devicePixelRatio || 1);
  }

  render(
    world: WorldState,
    ghost: { buildingId: string; tx: number; ty: number } | null,
    demolishMode: boolean
  ): void {
    const ctx = this.ctx;
    const zoom = this.camera.camera.zoom;
    const w = this.getCanvasWidth();
    const h = this.getCanvasHeight();

    ctx.clearRect(0, 0, w, h);

    this.drawTerrain(world);

    const range = this.camera.getVisibleTileRange();
    this.forEachVisibleTile((tx, ty) => {
      const tile = world.map.tiles[ty][tx];
      if (tile.resource) {
        this.drawResourceNode(tx, ty, tile.resource.type);
      }
    });

    for (const building of world.buildings) {
      if (
        building.x >= range.startX &&
        building.x <= range.endX &&
        building.y >= range.startY &&
        building.y <= range.endY
      ) {
        this.drawBuilding(building);
      }
    }

    if (ghost) {
      const range2 = this.camera.getVisibleTileRange();
      if (
        ghost.tx >= range2.startX &&
        ghost.tx <= range2.endX &&
        ghost.ty >= range2.startY &&
        ghost.ty <= range2.endY
      ) {
        const err = validateGhostPlacement(world, ghost.buildingId, ghost.tx, ghost.ty);
        const valid = err === null;
        this.drawGhost(ghost.tx, ghost.ty, ghost.buildingId, valid);
      }
    }

    if (demolishMode) {
      const { x: mx, y: my } = this.camera.getMousePosition();
      if (mx >= 0 && my >= 0 && mx < w && my < h) {
        const { tx, ty } = this.camera.screenToTile(mx, my);
        if (tx >= 0 && tx < 64 && ty >= 0 && ty < 64) {
          const hasBuilding = world.buildings.some((b) => b.x === tx && b.y === ty);
          if (hasBuilding) {
            const pos = this.camera.tileToScreen(tx, ty);
            ctx.fillStyle = DEMOLISH_HIGHLIGHT;
            ctx.fillRect(pos.sx, pos.sy, TILE_SIZE * zoom, TILE_SIZE * zoom);
          }
        }
      }
    }
  }

  drawGrid(): void {
    const ctx = this.ctx;
    const range = this.camera.getVisibleTileRange();
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    for (let tx = range.startX; tx <= range.endX; tx++) {
      const pos = this.camera.tileToScreen(tx, 0);
      ctx.beginPath();
      ctx.moveTo(pos.sx, 0);
      ctx.lineTo(pos.sx, this.getCanvasHeight());
      ctx.stroke();
    }
    for (let ty = range.startY; ty <= range.endY; ty++) {
      const pos = this.camera.tileToScreen(0, ty);
      ctx.beginPath();
      ctx.moveTo(0, pos.sy);
      ctx.lineTo(this.getCanvasWidth(), pos.sy);
      ctx.stroke();
    }
  }

  private drawTerrain(world: WorldState): void {
    const ctx = this.ctx;
    const zoom = this.camera.camera.zoom;

    this.forEachVisibleTile((tx, ty) => {
      const tile = world.map.tiles[ty][tx];
      const pos = this.camera.tileToScreen(tx, ty);

      switch (tile.type) {
        case 'grass':
          ctx.fillStyle = GRASS_COLOR;
          break;
        case 'rock':
          ctx.fillStyle = ROCK_COLOR;
          break;
        case 'water':
          ctx.fillStyle = WATER_COLOR;
          break;
      }
      ctx.fillRect(pos.sx, pos.sy, TILE_SIZE * zoom, TILE_SIZE * zoom);
    });

    this.drawGrid();
  }

  private forEachVisibleTile(fn: (tx: number, ty: number) => void): void {
    const range = this.camera.getVisibleTileRange();
    for (let ty = range.startY; ty <= range.endY; ty++) {
      for (let tx = range.startX; tx <= range.endX; tx++) {
        fn(tx, ty);
      }
    }
  }

  private drawResourceNode(tx: number, ty: number, resourceType: string): void {
    const ctx = this.ctx;
    const zoom = this.camera.camera.zoom;
    const pos = this.camera.tileToScreen(tx, ty);
    const cx = pos.sx + (TILE_SIZE * zoom) / 2;
    const cy = pos.sy + (TILE_SIZE * zoom) / 2;
    const r = (TILE_SIZE * zoom * 0.3) / 2;

    ctx.fillStyle = NODE_COLORS[resourceType] ?? '#888';
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;

    if (resourceType === 'crude-oil') {
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.2, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - r * 0.3, cy, r * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy + r * 0.5);
      ctx.lineTo(cx - r, cy + r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  private drawBuilding(building: Building): void {
    const ctx = this.ctx;
    const zoom = this.camera.camera.zoom;
    const def = getBuildingDef(building.buildingId);
    if (!def) return;

    const pos = this.camera.tileToScreen(building.x, building.y);
    const size = TILE_SIZE * zoom;
    const colors = BUILDING_COLORS[building.buildingId] ?? { fill: '#888', stroke: '#666' };

    const pad = size * 0.06;
    ctx.fillStyle = colors.fill;
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 2;
    this.roundRectInset(ctx, pos, size, pad, size * 0.08);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.fillStyle = colors.stroke;

    const icx = pos.sx + size / 2;
    const icy = pos.sy + size / 2;
    const is = size * 0.22;

    switch (building.buildingId) {
      case 'iron-miner':
      case 'copper-miner':
      case 'coal-miner':
        this.drawMinerIcon(ctx, icx, icy, is);
        break;
      case 'pumpjack':
        this.drawPumpjackIcon(ctx, icx, icy, is);
        break;
      case 'water-pump':
        this.drawWaterPumpIcon(ctx, icx, icy, is);
        break;
      case 'smelter':
      case 'copper-smelter':
        this.drawFlameIcon(ctx, icx, icy, is);
        break;
      case 'refinery':
        this.drawRefineryIcon(ctx, icx, icy, is);
        break;
      case 'chemical-plant':
        this.drawChemicalIcon(ctx, icx, icy, is);
        break;
      case 'gear-assembler':
        this.drawGearIcon(ctx, icx, icy, is);
        break;
      case 'circuit-assembler':
        this.drawCircuitIcon(ctx, icx, icy, is);
        break;
      case 'lab':
        this.drawLabIcon(ctx, icx, icy, is);
        break;
      case 'solar-panel':
        this.drawSunIcon(ctx, icx, icy, is);
        break;
      case 'coal-generator':
        this.drawLightningIcon(ctx, icx, icy, is);
        break;
      case 'warehouse':
        this.drawWarehouseIcon(ctx, icx, icy, is);
        break;
    }
  }

  private drawGhost(tx: number, ty: number, buildingId: string, valid: boolean): void {
    const ctx = this.ctx;
    const zoom = this.camera.camera.zoom;
    const pos = this.camera.tileToScreen(tx, ty);
    const size = TILE_SIZE * zoom;

    ctx.fillStyle = valid ? GHOST_VALID_COLOR : GHOST_INVALID_COLOR;
    ctx.strokeStyle = valid ? GHOST_BORDER_VALID : GHOST_BORDER_INVALID;
    ctx.lineWidth = 2;
    this.roundRect(ctx, pos.sx, pos.sy, size, size, size * 0.08);
    ctx.fill();
    ctx.stroke();

    const def = getBuildingDef(buildingId);
    if (!def) return;
    const colors = BUILDING_COLORS[buildingId] ?? { fill: '#888', stroke: '#666' };

    const pad = size * 0.1;
    ctx.fillStyle = colors.stroke;
    ctx.globalAlpha = 0.5;
    this.roundRectInset(ctx, pos, size, pad, size * 0.06);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private roundRectInset(
    ctx: CanvasRenderingContext2D,
    pos: { sx: number; sy: number },
    size: number,
    pad: number,
    radius: number
  ): void {
    const bx = pos.sx + pad;
    const by = pos.sy + pad;
    const bw = size - pad * 2;
    const bh = size - pad * 2;
    this.roundRect(ctx, bx, by, bw, bh, radius);
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private drawMinerIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s * 0.8, cy + s * 0.4);
    ctx.lineTo(cx - s * 0.8, cy + s * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawPumpjackIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.5, cy + s);
    ctx.lineTo(cx - s * 0.5, cy);
    ctx.lineTo(cx, cy - s * 0.3);
    ctx.lineTo(cx, cy + s);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + s * 0.4, cy - s * 0.3, s * 0.2, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawWaterPumpIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.5, cy + s * 0.6);
    ctx.quadraticCurveTo(cx - s * 0.6, cy, cx - s * 0.3, cy - s * 0.2);
    ctx.quadraticCurveTo(cx, cy - s * 0.4, cx, cy);
    ctx.quadraticCurveTo(cx, cy + s * 0.4, cx + s * 0.3, cy + s * 0.2);
    ctx.quadraticCurveTo(cx + s * 0.6, cy, cx + s * 0.5, cy + s * 0.6);
    ctx.stroke();
  }

  private drawFlameIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s, cy + s * 0.3);
    ctx.lineTo(cx + s * 0.3, cy + s * 0.1);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx - s * 0.3, cy + s * 0.1);
    ctx.lineTo(cx - s, cy + s * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawRefineryIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
    const rw = s * 0.5;
    const rh = s * 1.2;
    ctx.strokeRect(cx - rw / 2, cy - rh / 2, rw, rh);
    ctx.beginPath();
    ctx.arc(cx, cy - rh / 2 - s * 0.15, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy + rh / 2 + s * 0.15, s * 0.15, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawChemicalIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.3, cy - s * 0.3);
    ctx.lineTo(cx + s * 0.3, cy + s * 0.3);
    ctx.stroke();
  }

  private drawGearIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.35, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * s * 0.45, cy + Math.sin(ang) * s * 0.45, s * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  private drawCircuitIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
    const cw = s * 0.6;
    const ch = s * 0.6;
    ctx.strokeRect(cx - cw / 2, cy - ch / 2, cw, ch);
    for (let i = 0; i < 4; i++) {
      const px = cx + (i < 2 ? -cw / 2 : cw / 2);
      const py = cy + (i % 2 === 0 ? -ch / 2 : ch / 2);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + (i < 2 ? -s * 0.15 : s * 0.15), py);
      ctx.stroke();
    }
  }

  private drawLabIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.3, cy - s * 0.7);
    ctx.lineTo(cx + s * 0.3, cy - s * 0.7);
    ctx.moveTo(cx - s * 0.2, cy - s * 0.7);
    ctx.lineTo(cx - s * 0.2, cy - s * 0.1);
    ctx.lineTo(cx - s * 0.6, cy + s * 0.6);
    ctx.lineTo(cx + s * 0.6, cy + s * 0.6);
    ctx.lineTo(cx + s * 0.2, cy - s * 0.1);
    ctx.lineTo(cx + s * 0.2, cy - s * 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.4, cy + s * 0.25);
    ctx.lineTo(cx + s * 0.4, cy + s * 0.25);
    ctx.lineTo(cx + s * 0.6, cy + s * 0.6);
    ctx.lineTo(cx - s * 0.6, cy + s * 0.6);
    ctx.closePath();
    ctx.fill();
  }

  private drawSunIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * s * 0.3, cy + Math.sin(ang) * s * 0.3);
      ctx.lineTo(cx + Math.cos(ang) * s * 0.55, cy + Math.sin(ang) * s * 0.55);
      ctx.stroke();
    }
  }

  private drawLightningIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.2, cy - s);
    ctx.lineTo(cx - s * 0.3, cy - s * 0.1);
    ctx.lineTo(cx + s * 0.1, cy - s * 0.1);
    ctx.lineTo(cx - s * 0.2, cy + s);
    ctx.lineTo(cx + s * 0.4, cy + s * 0.1);
    ctx.lineTo(cx, cy + s * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawWarehouseIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
    ctx.strokeRect(cx - s * 0.45, cy - s * 0.45, s * 0.9, s * 0.9);
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.45, cy - s * 0.45);
    ctx.lineTo(cx, cy - s * 0.7);
    ctx.lineTo(cx + s * 0.45, cy - s * 0.45);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.7);
    ctx.lineTo(cx, cy + s * 0.45);
    ctx.stroke();
  }
}