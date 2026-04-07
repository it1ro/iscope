// src/main.ts
import { SceneManager } from './game/SceneManager';
import { InputController } from './game/InputController';
import { Ballistics } from './game/Ballistics';
import { TargetManager } from './game/TargetManager';
import { Effects } from './game/Effects';
import { UIManager } from './game/UIManager';
import { EventBus } from './game/EventBus';
import { Reticle } from './game/Reticle';
import { AudioManager } from './game/AudioManager';
import * as THREE from 'three';

class Game {
  private sceneMgr: SceneManager;
  private input: InputController;
  private ballistics: Ballistics;
  private targetMgr: TargetManager;
  private effects: Effects;
  private ui: UIManager;
  private audioMgr: AudioManager;
  private eventBus = new EventBus();
  private lastTime = performance.now();
  private rafId: number | null = null;
  private raycaster = new THREE.Raycaster();
  private reticle: Reticle | null = null;

  private onPointerLockChange: () => void;

  constructor() {
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    document.body.appendChild(canvas);

    this.sceneMgr = new SceneManager(canvas);
    this.audioMgr = new AudioManager(this.eventBus);
    this.input = new InputController(canvas, this.sceneMgr.camera, this.eventBus);
    this.targetMgr = new TargetManager(this.sceneMgr.scene, this.eventBus);
    this.ballistics = new Ballistics(this.sceneMgr.scene, this.eventBus);
    this.effects = new Effects(this.sceneMgr.scene, this.eventBus);
    this.ui = new UIManager(this.eventBus);

    this.reticle = new Reticle(this.sceneMgr.camera, this.ballistics);

    // Запускаем фоновый звук при захвате курсора
    this.onPointerLockChange = () => {
      if (document.pointerLockElement === canvas) {
        this.audioMgr.startBackground();
      }
    };
    document.addEventListener('pointerlockchange', this.onPointerLockChange);

    this.loop();
  }

  private loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    this.input.update(now / 1000);
    this.ballistics.update(dt, this.targetMgr.getTargets());

    this.reticle?.updateMarks();

    const center = new THREE.Vector2(0, 0);
    this.raycaster.setFromCamera(center, this.sceneMgr.camera);
    const intersects = this.raycaster.intersectObjects(
      this.targetMgr.getTargets().map(t => t.mesh),
      true
    );
    let distance: number | null = null;
    if (intersects.length > 0) {
      distance = this.sceneMgr.camera.position.distanceTo(intersects[0].point);
    }
    this.ui.updateRangefinder(distance);

    this.sceneMgr.renderer.render(this.sceneMgr.scene, this.sceneMgr.camera);
  };

  dispose(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.ballistics.dispose();
    this.targetMgr.dispose();
    this.sceneMgr.dispose();
    this.eventBus.dispose();
    this.reticle?.dispose();
    this.audioMgr.dispose();
  }
}

new Game();
