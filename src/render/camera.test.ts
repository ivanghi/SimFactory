import { describe, it, expect } from 'vitest';
import { CameraController } from './camera';

function makeCamera(): CameraController {
  const cam = new CameraController();
  cam.setCanvasSize(800, 600);
  return cam;
}

describe('camera drag lifecycle', () => {
  it('pans only while the button is held and stops after mouseup', () => {
    const cam = makeCamera();

    cam.handleMouseDown(400, 300);
    expect(cam.handleMouseMove(402, 301)).toBe(false);
    expect(cam.camera.x).toBe(0);

    cam.handleMouseMove(370, 300);
    expect(cam.camera.x).toBe(30);

    cam.handleMouseUp(100, 100);
    expect(cam.handleMouseMove(700, 550)).toBe(false);
    expect(cam.camera.x).toBe(30);
  });

  it('stale mouseup outside the canvas still clears drag state', () => {
    const cam = makeCamera();
    cam.handleMouseDown(400, 300);
    cam.handleMouseMove(300, 300);
    expect(cam.handleMouseMove(280, 300)).toBe(true);
    cam.handleMouseUp(50, 20);
    expect(cam.handleMouseMove(600, 400)).toBe(false);
  });

  it('hovering without any mousedown never pans', () => {
    const cam = makeCamera();
    expect(cam.handleMouseMove(100, 100)).toBe(false);
    expect(cam.handleMouseMove(700, 550)).toBe(false);
    expect(cam.camera.x).toBe(0);
    expect(cam.camera.y).toBe(0);
  });

  it('a click reports isClick and a drag does not', () => {
    const cam = makeCamera();
    cam.handleMouseDown(400, 300);
    expect(cam.handleMouseUp(401, 300)).toBe(true);

    cam.handleMouseDown(400, 300);
    cam.handleMouseMove(350, 300);
    expect(cam.handleMouseUp(350, 300)).toBe(false);
  });
});
