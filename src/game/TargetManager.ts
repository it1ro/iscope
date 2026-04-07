import * as THREE from 'three';
import { Target } from '../types';

export class TargetManager {
    private targets: Target[] = [];
    private scene: THREE.Scene;
    private readonly targetRadius = 0.55;
    private readonly targetHeight = 0.6;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.initTargets();
    }

    private createTargetAt(x: number, z: number): Target {
        const group = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.3, metalness: 0.1, emissive: 0x220000 });
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(this.targetRadius, 32, 32), bodyMat);
        sphere.castShadow = true;
        group.add(sphere);

        const bullseyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.8 });
        const bullseye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 24), bullseyeMat);
        bullseye.position.z = this.targetRadius * 0.95;
        group.add(bullseye);

        const ringMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4 });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(this.targetRadius - 0.07, 0.05, 24, 60), ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.z = this.targetRadius * 0.93;
        group.add(ring);

        group.position.set(x, this.targetHeight, z);
        this.scene.add(group);
        return { mesh: group, radius: this.targetRadius, position: new THREE.Vector3(x, this.targetHeight, z) };
    }

    private randomTargetPosition(): { x: number, z: number } {
        const x = (Math.random() - 0.5) * 50;
        const z = 20 + Math.random() * 70;
        return { x, z };
    }

    private initTargets(): void {
        this.targets.forEach(t => this.scene.remove(t.mesh));
        this.targets = [];
        const positions = [
            { x: -8, z: 28 }, { x: 5, z: 42 }, { x: -12, z: 58 }, { x: 14, z: 72 },
            { x: -5, z: 85 }, { x: 18, z: 35 }, { x: -18, z: 65 }, { x: 0, z: 95 }
        ];
        for (let i = 0; i < 8; i++) {
            const pos = i < positions.length ? positions[i] : this.randomTargetPosition();
            const target = this.createTargetAt(pos.x, pos.z);
            this.targets.push(target);
        }
    }

    public relocateTarget(target: Target): void {
        const newPos = this.randomTargetPosition();
        target.mesh.position.set(newPos.x, this.targetHeight, newPos.z);
        target.position.set(newPos.x, this.targetHeight, newPos.z);
    }

    public getTargets(): Target[] {
        return this.targets;
    }

    public reset(): void {
        this.initTargets();
    }
}
