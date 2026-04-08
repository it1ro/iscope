// src/game/InputController.ts (обновлён)

import * as THREE from 'three';
import { EventBus } from './EventBus';

export class InputController {
  private canvas: HTMLCanvasElement;
  private camera: THREE.PerspectiveCamera;
  private eventBus: EventBus;
  private mouseLocked = false;
  private yaw = Math.PI;
  private pitch = 0.15;
  private baseSensitivity = 0.0022;   // базовая чувствительность без зума
  private recoilImpulse = 0;
  
  // Параметры дыхания (пока отключены флагом)
  private breathAmp = 0.004;
  private breathFreq = 1.8;

  private enableBreathing = false;

  // scope settings
  private isScoped = false;
  private hipFov = 75;
  private scopeMagnification = 4;
  private scopeFov = this.hipFov / this.scopeMagnification;
  private fovLerpSpeed = 0.18;

  constructor(canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera, eventBus: EventBus) {
    this.canvas = canvas;
    this.camera = camera;
    this.eventBus = eventBus;
    this.hipFov = camera.fov;
    this.scopeFov = this.hipFov / this.scopeMagnification;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.canvas.addEventListener('click', () => this.canvas.requestPointerLock());
    document.addEventListener('pointerlockchange', () => {
      this.mouseLocked = !!document.pointerLockElement;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.mouseLocked) return;
      
      // Вычисляем текущий коэффициент зума
      const zoomFactor = this.hipFov / this.camera.fov;
      const effectiveSensitivity = this.baseSensitivity / zoomFactor;
      
      this.yaw -= e.movementX * effectiveSensitivity;
      this.pitch -= e.movementY * effectiveSensitivity;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2.4, Math.PI / 2.4);
    });

    document.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.mouseLocked) {
        e.preventDefault();
        this.recoilImpulse = 0.04;
        const pos = this.getMuzzlePosition();
        const dir = new THREE.Vector3();
        this.getDirection(dir);
        this.eventBus.emit({ type: 'shoot', startPos: pos, direction: dir });
      }
      if (e.button === 2 && this.mouseLocked) {
        e.preventDefault();
        this.toggleScope();
      }
    });

    document.addEventListener('contextmenu', (e) => {
      if (this.mouseLocked) e.preventDefault();
    });

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR' && this.mouseLocked) {
        this.eventBus.emit({ type: 'reset_game' });
      }
      if (e.code === 'KeyV' && this.mouseLocked) {
        this.toggleScope();
      }
    });
  }

  private toggleScope(): void {
    this.isScoped = !this.isScoped;
  }

  public update(time: number): void {
    if (!this.mouseLocked) return;

    const sway = this.enableBreathing
      ? Math.sin(time * this.breathFreq) * this.breathAmp
      : 0;

    this.recoilImpulse = THREE.MathUtils.lerp(this.recoilImpulse, 0, 0.15);

    const targetFov = this.isScoped ? this.scopeFov : this.hipFov;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, this.fovLerpSpeed);
    this.camera.updateProjectionMatrix();

    this.camera.rotation.set(this.pitch + sway + this.recoilImpulse, this.yaw, 0);
  }

  public getDirection(out: THREE.Vector3): void {
    this.camera.getWorldDirection(out);
  }

  public getPosition(): THREE.Vector3 {
    return this.camera.position.clone();
  }

  public getMuzzlePosition(): THREE.Vector3 {
    const pos = this.camera.position.clone();
    pos.y -= 0.05;
    return pos;
  }

  public isInScope(): boolean {
    return this.isScoped;
  }
}
