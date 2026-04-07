import { SceneManager } from './game/SceneManager';
import { InputController } from './game/InputController';
import { Ballistics } from './game/Ballistics';
import { TargetManager } from './game/TargetManager';
import { Effects } from './game/Effects';
import { UIManager } from './game/UIManager';
import { EventBus } from './game/EventBus';

class Game {
  private sceneMgr: SceneManager;
  private input: InputController;
  private ballistics: Ballistics;
  private targetMgr: TargetManager;
  private effects: Effects;
  private ui: UIManager;
  private eventBus = new EventBus();
  private lastTime = performance.now();
  private rafId: number | null = null;

  constructor() {
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%'; canvas.style.height = '100%';
    document.body.appendChild(canvas);

    this.sceneMgr = new SceneManager(canvas);
    this.input = new InputController(canvas, this.sceneMgr.camera, this.eventBus);
    this.targetMgr = new TargetManager(this.sceneMgr.scene, this.eventBus);
    this.ballistics = new Ballistics(this.sceneMgr.scene, this.eventBus);
    this.effects = new Effects(this.sceneMgr.scene, this.eventBus);
    this.ui = new UIManager(this.eventBus);

    this.loop();
  }

  private loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    this.input.update(now / 1000);
    this.ballistics.update(dt, this.targetMgr.getTargets());
    this.sceneMgr.renderer.render(this.sceneMgr.scene, this.sceneMgr.camera);
  };

  dispose(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.ballistics.dispose();
    this.targetMgr.dispose();
    this.sceneMgr.dispose();
    this.eventBus.dispose();
  }
}

new Game();
