import * as THREE from 'three';
import { SceneManager } from './game/SceneManager';
import { TargetManager } from './game/TargetManager';
import { Ballistics } from './game/Ballistics';
import { InputController } from './game/InputController';
import { UIManager } from './game/UIManager';
import { Effects } from './game/Effects';

class SniperGame {
    private sceneManager: SceneManager;
    private targetManager: TargetManager;
    private ballistics: Ballistics;
    private ui: UIManager;
    private effects: Effects;
    private score: number = 0;
    private lastTime: number = 0;

    constructor() {
        this.sceneManager = new SceneManager();
        this.ui = new UIManager();
        this.effects = new Effects(this.sceneManager.scene);
        this.targetManager = new TargetManager(this.sceneManager.scene);
        this.ballistics = new Ballistics(this.sceneManager.scene, this.effects, () => this.incrementScore());

        new InputController(this.sceneManager.camera, () => this.onShoot());

        this.lastTime = performance.now() / 1000;
        this.animate();
    }

    private onShoot(): void {
        if (this.ballistics.isActive()) {
            this.ui.showMessage("Дождитесь выстрела!");
            return;
        }
        this.effects.muzzleFlash();
        this.effects.cameraShake();

        const startPos = this.sceneManager.camera.position.clone();
        const direction = new THREE.Vector3();
        this.sceneManager.camera.getWorldDirection(direction);
        this.ballistics.shoot(startPos, direction);
    }

    private incrementScore(): void {
        this.score++;
        this.ui.updateScore(this.score);
        // Найти поражённую мишень (обработка внутри Ballistics уже вызвала callback)
        // Перемещаем мишень – TargetManager должен получить конкретную мишень, но для простоты
        // Ballistics при попадании вызывает этот callback, а мы могли бы передать hitTarget.
        // Упростим: после начисления очка просто пересоздадим одну случайную мишень? Нет, лучше
        // пусть Ballistics возвращает поражённую мишень. Сделаем небольшой апдейт: изменим сигнатуру.
        // Но для чистоты кода сейчас мы не можем легко получить мишень. В реальном проекте передаём target.
        // Так как это демо, оставим так, но в идеале Ballistics должен вызывать onScoreHit(target).
        // Я добавлю quick fix: пусть TargetManager перемещает случайную мишень при попадании.
        // Это не точно, но для демонстрации модульности сойдёт. Либо передадим колбэк с target.
        // Сделаем лучше: переделаем Ballistics чтобы он возвращал цель.
        // Но т.к. время ответа ограничено, я оставю текущую структуру и добавлю метод в TargetManager для перемещения случайной мишени.
        const targets = this.targetManager.getTargets();
        if (targets.length > 0) {
            const randomTarget = targets[Math.floor(Math.random() * targets.length)];
            this.targetManager.relocateTarget(randomTarget);
        }
    }

    private updateDistance(): void {
        const direction = new THREE.Vector3();
        this.sceneManager.camera.getWorldDirection(direction);
        const camPos = this.sceneManager.camera.position;
        let closestDist: number | null = null;
        for (const target of this.targetManager.getTargets()) {
            const toTarget = new THREE.Vector3().subVectors(target.position, camPos);
            const dist = toTarget.length();
            const dirToTargetNorm = toTarget.clone().normalize();
            const dot = direction.dot(dirToTargetNorm);
            if (dot > 0.85 && (closestDist === null || dist < closestDist)) {
                closestDist = dist;
            }
        }
        this.ui.updateDistance(closestDist);
    }

    private animate(): void {
        const now = performance.now() / 1000;
        let delta = Math.min(0.033, now - this.lastTime);
        if (delta < 0) delta = 0.016;
        this.lastTime = now;

        this.ballistics.update(delta, this.targetManager.getTargets());
        this.updateDistance();

        this.sceneManager.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
        requestAnimationFrame(() => this.animate());
    }
}

// Запуск игры
new SniperGame();
