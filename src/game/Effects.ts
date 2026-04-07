import * as THREE from 'three';
import { GameEvent } from '../types';
import { EventBus } from './EventBus';

export class Effects {
  private scene: THREE.Scene;
  private particlePool: THREE.Points[] = [];

  constructor(scene: THREE.Scene, eventBus: EventBus) {
    this.scene = scene;
    eventBus.on('bullet_hit', (e: Extract<GameEvent, { type: 'bullet_hit' }>) => {
      this.spawnHitMarker();
      this.spawnImpactParticles(e.hitPoint);
    });
  }

  private spawnHitMarker(): void {
    const el = document.createElement('div');
    el.className = 'hit-marker';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 250);
  }

  private spawnImpactParticles(pos: THREE.Vector3): void {
    // Используем пул или создаём новую систему
    const count = 16;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      positions[i*3] = pos.x;
      positions[i*3+1] = pos.y;
      positions[i*3+2] = pos.z;
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.5,
        (Math.random() - 0.5) * 2
      ).normalize().multiplyScalar(2 + Math.random() * 3);
      velocities.push(vel);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xff8844,
      size: 0.08,
      transparent: true,
      blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geometry, material);
    this.scene.add(points);

    const startTime = performance.now();
    const animate = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed > 0.4) {
        this.scene.remove(points);
        geometry.dispose();
        material.dispose();
        return;
      }
      const attrs = geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        const v = velocities[i];
        attrs[i*3] += v.x * 0.016;
        attrs[i*3+1] += v.y * 0.016 - 9.81 * elapsed * 0.016;
        attrs[i*3+2] += v.z * 0.016;
      }
      geometry.attributes.position.needsUpdate = true;
      material.opacity = 1 - elapsed / 0.4;
      requestAnimationFrame(animate);
    };
    animate();
  }
}
