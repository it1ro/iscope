import * as THREE from 'three';
import { EventBus } from './EventBus';

export class InputController {
  private canvas: HTMLCanvasElement;
  private camera: THREE.PerspectiveCamera;
  private eventBus: EventBus;
  private mouseLocked = false;
  private yaw = 0;
  private pitch = 0.15;
  private sensitivity = 0.0022;
  private recoilImpulse = 0;
  private zoomLevel = 1;
  private breathAmp = 0.004;
  private breathFreq = 1.8;

  constructor(canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera, eventBus: EventBus) {
    this.canvas = canvas;
    this.camera = camera;
    this.eventBus = eventBus;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.canvas.addEventListener('click', () => this.canvas.requestPointerLock());
    document.addEventListener('pointerlockchange', () => {
      this.mouseLocked = !!document.pointerLockElement;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.mouseLocked) return;
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch -= e.movementY * this.sensitivity;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2.4, Math.PI / 2.4);
    });

    document.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.mouseLocked) {
        e.preventDefault();
        this.recoilImpulse = 0.04;
        const pos = this.getPosition();
        const dir = new THREE.Vector3();
        this.getDirection(dir);
        this.eventBus.emit({ type: 'shoot', startPos: pos, direction: dir });
      }
    });

    document.addEventListener('wheel', (e) => {
      if (!this.mouseLocked) return;
      this.zoomLevel = THREE.MathUtils.clamp(this.zoomLevel - e.deltaY * 0.001, 1, 3);
      this.camera.fov = THREE.MathUtils.lerp(75, 15, (this.zoomLevel - 1) / 2);
      this.camera.updateProjectionMatrix();
    });

    // Сброс игры по клавише R
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR' && this.mouseLocked) {
        this.eventBus.emit({ type: 'reset_game' });
      }
    });
  }

  public update(time: number): void {
    if (!this.mouseLocked) return;
    const sway = Math.sin(time * this.breathFreq) * this.breathAmp;
    this.recoilImpulse = THREE.MathUtils.lerp(this.recoilImpulse, 0, 0.15);
    this.camera.rotation.set(this.pitch + sway + this.recoilImpulse, this.yaw, 0);
  }

  public getDirection(out: THREE.Vector3): void {
    this.camera.getWorldDirection(out);
  }

  public getPosition(): THREE.Vector3 {
    return this.camera.position.clone();
  }
}
