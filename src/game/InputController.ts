import * as THREE from 'three';

export class InputController {
    private camera: THREE.PerspectiveCamera;
    private onShoot: () => void;
    private mouseLocked: boolean = false;
    private yaw: number = -0.2;
    private pitch: number = 0.15;
    private sensitivity: number = 0.0022;

    constructor(camera: THREE.PerspectiveCamera, onShoot: () => void) {
        this.camera = camera;
        this.onShoot = onShoot;
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        const canvas = this.camera.parent?.parent?.querySelector('canvas') || document.querySelector('canvas');
        if (canvas) {
            canvas.addEventListener('click', () => canvas.requestPointerLock());
        }
        document.addEventListener('pointerlockchange', () => this.lockChange());
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0 && this.mouseLocked) {
                e.preventDefault();
                this.onShoot();
            }
        });
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.mouseLocked) document.exitPointerLock();
        });
    }

    private lockChange(): void {
        this.mouseLocked = document.pointerLockElement !== null;
    }

    private onMouseMove(e: MouseEvent): void {
        if (!this.mouseLocked) return;
        this.yaw -= e.movementX * this.sensitivity;
        this.pitch -= e.movementY * this.sensitivity;
        this.pitch = Math.max(-Math.PI / 2.4, Math.min(Math.PI / 2.4, this.pitch));
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.yaw;
        this.camera.rotation.x = this.pitch;
    }
}
