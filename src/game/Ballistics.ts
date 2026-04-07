import * as THREE from 'three';
import { BulletState, Target } from '../types';
import { Effects } from './Effects';

export class Ballistics {
    private bullet: BulletState | null = null;
    private scene: THREE.Scene;
    private effects: Effects;
    private onScoreCallback: () => void;
    private readonly bulletSpeed = 280.0;
    private readonly gravity = 9.81;

    constructor(scene: THREE.Scene, effects: Effects, onScore: () => void) {
        this.scene = scene;
        this.effects = effects;
        this.onScoreCallback = onScore;
    }

    public shoot(startPos: THREE.Vector3, direction: THREE.Vector3): boolean {
        if (this.bullet && this.bullet.active) return false;

        const velocity = direction.clone().normalize().multiplyScalar(this.bulletSpeed);
        const bulletGeometry = new THREE.SphereGeometry(0.08, 16, 16);
        const bulletMaterial = new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0xff4400, emissiveIntensity: 0.7 });
        const bulletMesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
        bulletMesh.position.copy(startPos);
        bulletMesh.castShadow = true;
        this.scene.add(bulletMesh);

        const bulletLight = new THREE.PointLight(0xff6600, 0.8, 8);
        bulletMesh.add(bulletLight);

        this.bullet = {
            mesh: bulletMesh,
            velocity: velocity,
            startTime: performance.now() / 1000,
            active: true
        };
        return true;
    }

    public update(deltaTime: number, targets: Target[]): void {
        if (!this.bullet || !this.bullet.active) return;

        this.bullet.velocity.y -= this.gravity * deltaTime;
        this.bullet.mesh.position.x += this.bullet.velocity.x * deltaTime;
        this.bullet.mesh.position.y += this.bullet.velocity.y * deltaTime;
        this.bullet.mesh.position.z += this.bullet.velocity.z * deltaTime;

        const bulletPos = this.bullet.mesh.position;
        let hitTarget: Target | null = null;
        for (const target of targets) {
            if (bulletPos.distanceTo(target.position) < target.radius) {
                hitTarget = target;
                break;
            }
        }

        const tooFar = Math.abs(bulletPos.x) > 120 || bulletPos.z > 150 || bulletPos.z < -20;
        const belowGround = bulletPos.y < -0.2;
        const tooHigh = bulletPos.y > 25;
        const timeLimit = (performance.now() / 1000) - this.bullet.startTime > 3.5;

        if (hitTarget) {
            this.onScoreCallback();
            this.effects.hitEffect(hitTarget.position);
            this.cleanupBullet();
        } else if (tooFar || belowGround || tooHigh || timeLimit) {
            this.cleanupBullet();
        }
    }

    private cleanupBullet(): void {
        if (this.bullet && this.bullet.mesh) {
            this.scene.remove(this.bullet.mesh);
        }
        this.bullet = null;
    }

    public isActive(): boolean {
        return this.bullet !== null && this.bullet.active;
    }
}
