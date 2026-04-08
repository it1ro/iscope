// src/game/InputController.ts

import * as THREE from 'three';
import { EventBus } from './EventBus';

export class InputController {
  private canvas: HTMLCanvasElement;
  private camera: THREE.PerspectiveCamera;
  private eventBus: EventBus;
  private mouseLocked = false;
  private yaw = Math.PI;
  private pitch = 0.15;
  private baseSensitivity = 0.0022;
  private recoilImpulse = 0;

  private breathAmp = 0.004;
  private breathFreq = 1.8;
  private enableBreathing = false;

  private isScoped = false;
  private hipFov = 75;
  private scopeMagnification = 4;
  private scopeFov = this.hipFov / this.scopeMagnification;
  private fovLerpSpeed = 0.18;

  private keys = {
    w: false, a: false, s: false, d: false
  };
  private moveSpeed = 6.0;      // единая скорость, м/с
  private groundY = -0.15;
  private eyeHeight = 1.65;
  private moveRadius = 260;

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
      if (!this.mouseLocked) return;

      switch (e.code) {
        case 'KeyW': this.keys.w = true; e.preventDefault(); break;
        case 'KeyA': this.keys.a = true; e.preventDefault(); break;
        case 'KeyS': this.keys.s = true; e.preventDefault(); break;
        case 'KeyD': this.keys.d = true; e.preventDefault(); break;
        case 'KeyR':
          this.eventBus.emit({ type: 'reset_game' });
          e.preventDefault();
          break;
        case 'KeyV':
          this.toggleScope();
          e.preventDefault();
          break;
        default: break;
      }
    });

    document.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW': this.keys.w = false; e.preventDefault(); break;
        case 'KeyA': this.keys.a = false; e.preventDefault(); break;
        case 'KeyS': this.keys.s = false; e.preventDefault(); break;
        case 'KeyD': this.keys.d = false; e.preventDefault(); break;
        default: break;
      }
    });
  }

  private toggleScope(): void {
    this.isScoped = !this.isScoped;
  }

  public update(time: number): void {
    if (!this.mouseLocked) return;

    this.updateMovement();

    const sway = this.enableBreathing
      ? Math.sin(time * this.breathFreq) * this.breathAmp
      : 0;

    this.recoilImpulse = THREE.MathUtils.lerp(this.recoilImpulse, 0, 0.15);

    const targetFov = this.isScoped ? this.scopeFov : this.hipFov;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, this.fovLerpSpeed);
    this.camera.updateProjectionMatrix();

    this.camera.rotation.set(this.pitch + sway + this.recoilImpulse, this.yaw, 0);
  }

  private updateMovement(): void {
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);

    forward.applyQuaternion(this.camera.quaternion);
    right.applyQuaternion(this.camera.quaternion);

    forward.y = 0;
    right.y = 0;
    forward.normalize();
    right.normalize();

    let moveX = 0, moveZ = 0;
    if (this.keys.w) { moveX += forward.x; moveZ += forward.z; }
    if (this.keys.s) { moveX -= forward.x; moveZ -= forward.z; }
    if (this.keys.a) { moveX -= right.x; moveZ -= right.z; }
    if (this.keys.d) { moveX += right.x; moveZ += right.z; }

    if (moveX !== 0 || moveZ !== 0) {
      const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX /= len;
      moveZ /= len;

      const delta = 1 / 60;
      const displacement = this.moveSpeed * delta;

      const newPos = this.camera.position.clone();
      newPos.x += moveX * displacement;
      newPos.z += moveZ * displacement;

      const radius = Math.sqrt(newPos.x * newPos.x + newPos.z * newPos.z);
      if (radius > this.moveRadius) {
        const scale = this.moveRadius / radius;
        newPos.x *= scale;
        newPos.z *= scale;
      }

      newPos.y = this.groundY + this.eyeHeight;

      this.camera.position.copy(newPos);
    }
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
