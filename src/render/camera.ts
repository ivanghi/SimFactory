export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export class CameraController {
  private camera: Camera = {
    x: 0,
    y: 0,
    zoom: 1
  };

  getCamera(): Camera {
    return this.camera;
  }

  setCamera(camera: Camera): void {
    this.camera = camera;
  }
}