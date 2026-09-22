export const TILE_SIZE = 48;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const DRAG_THRESHOLD = 3;

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export class CameraController {
  camera: CameraState;
  private canvasWidth = 0;
  private canvasHeight = 0;
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private cameraStartX = 0;
  private cameraStartY = 0;
  private mouseX = 0;
  private mouseY = 0;
  private mouseDownScreenX = 0;
  private mouseDownScreenY = 0;
  private mouseDownTime = 0;

  constructor() {
    this.camera = { x: 0, y: 0, zoom: 1 };
  }

  setCanvasSize(w: number, h: number): void {
    this.canvasWidth = w;
    this.canvasHeight = h;
    this.clamp();
  }

  centerOnMap(): void {
    const mapPx = 64 * TILE_SIZE;
    this.camera.x = Math.max(0, (mapPx - this.canvasWidth / this.camera.zoom) / 2);
    this.camera.y = Math.max(0, (mapPx - this.canvasHeight / this.camera.zoom) / 2);
    this.clamp();
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: sx / this.camera.zoom + this.camera.x,
      y: sy / this.camera.zoom + this.camera.y,
    };
  }

  screenToTile(sx: number, sy: number): { tx: number; ty: number } {
    const w = this.screenToWorld(sx, sy);
    return { tx: Math.floor(w.x / TILE_SIZE), ty: Math.floor(w.y / TILE_SIZE) };
  }

  worldToScreen(wx: number, wy: number): { sx: number; sy: number } {
    return {
      sx: (wx - this.camera.x) * this.camera.zoom,
      sy: (wy - this.camera.y) * this.camera.zoom,
    };
  }

  tileToScreen(tx: number, ty: number): { sx: number; sy: number } {
    return this.worldToScreen(tx * TILE_SIZE, ty * TILE_SIZE);
  }

  private mouseIsDown = false;

  handleMouseDown(sx: number, sy: number): void {
    this.mouseIsDown = true;
    this.dragging = false;
    this.mouseDownScreenX = sx;
    this.mouseDownScreenY = sy;
    this.mouseDownTime = Date.now();
    this.dragStartX = sx;
    this.dragStartY = sy;
    this.cameraStartX = this.camera.x;
    this.cameraStartY = this.camera.y;
  }

  handleMouseMove(sx: number, sy: number): boolean {
    this.mouseX = sx;
    this.mouseY = sy;
    if (!this.mouseIsDown) {
      return false;
    }
    if (!this.dragging) {
      const dx = sx - this.mouseDownScreenX;
      const dy = sy - this.mouseDownScreenY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        this.dragging = true;
      }
    }
    if (this.dragging) {
      this.camera.x = this.cameraStartX - (sx - this.dragStartX) / this.camera.zoom;
      this.camera.y = this.cameraStartY - (sy - this.dragStartY) / this.camera.zoom;
      this.clamp();
      return true;
    }
    return false;
  }

  handleMouseUp(sx: number, sy: number): boolean {
    const dx = sx - this.mouseDownScreenX;
    const dy = sy - this.mouseDownScreenY;
    const elapsed = Date.now() - this.mouseDownTime;
    const isClick =
      this.mouseIsDown &&
      !this.dragging &&
      Math.abs(dx) <= DRAG_THRESHOLD &&
      Math.abs(dy) <= DRAG_THRESHOLD &&
      elapsed < 300;
    this.dragging = false;
    this.mouseIsDown = false;
    return isClick;
  }

  handleWheel(delta: number, sx: number, sy: number): void {
    const world = this.screenToWorld(sx, sy);
    const oldZoom = this.camera.zoom;
    this.camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * (1 - delta * 0.1)));
    this.camera.x = world.x - sx / this.camera.zoom;
    this.camera.y = world.y - sy / this.camera.zoom;
    this.clamp();
  }

  getMousePosition(): { x: number; y: number } {
    return { x: this.mouseX, y: this.mouseY };
  }

  getVisibleTileRange(): { startX: number; startY: number; endX: number; endY: number } {
    const tl = this.screenToWorld(0, 0);
    const br = this.screenToWorld(this.canvasWidth, this.canvasHeight);
    return {
      startX: Math.max(0, Math.floor(tl.x / TILE_SIZE)),
      startY: Math.max(0, Math.floor(tl.y / TILE_SIZE)),
      endX: Math.min(63, Math.ceil(br.x / TILE_SIZE)),
      endY: Math.min(63, Math.ceil(br.y / TILE_SIZE)),
    };
  }

  private clamp(): void {
    const mapPx = 64 * TILE_SIZE;
    const vw = this.canvasWidth / this.camera.zoom;
    const vh = this.canvasHeight / this.camera.zoom;
    if (vw >= mapPx) {
      this.camera.x = (mapPx - vw) / 2;
    } else {
      this.camera.x = Math.max(0, Math.min(this.camera.x, mapPx - vw));
    }
    if (vh >= mapPx) {
      this.camera.y = (mapPx - vh) / 2;
    } else {
      this.camera.y = Math.max(0, Math.min(this.camera.y, mapPx - vh));
    }
  }
}