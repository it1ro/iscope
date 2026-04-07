import * as THREE from 'three';

export class Effects {
    private scene: THREE.Scene;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    public muzzleFlash(): void {
        const muzzleDiv = document.createElement('div');
        muzzleDiv.className = 'shot-muzzle';
        document.body.appendChild(muzzleDiv);
        setTimeout(() => muzzleDiv.remove(), 100);
    }

    public cameraShake(): void {
        document.body.classList.add('shake-effect');
        setTimeout(() => document.body.classList.remove('shake-effect'), 150);
    }

    public hitEffect(position: THREE.Vector3): void {
        const hitMarker = document.createElement('div');
        hitMarker.className = 'hit-marker';
        document.body.appendChild(hitMarker);
        setTimeout(() => hitMarker.remove(), 220);

        const particleGeo = new THREE.SphereGeometry(0.12, 6, 6);
        const particleMat = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff2200 });
        const particle = new THREE.Mesh(particleGeo, particleMat);
        particle.position.copy(position);
        this.scene.add(particle);
        setTimeout(() => this.scene.remove(particle), 200);
    }
}
