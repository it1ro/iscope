import * as THREE from 'three';
import { GameEvent } from '../types';
import { EventBus } from './EventBus';
import { DecalManager } from './DecalManager';

export class Effects {
  private scene: THREE.Scene;
  private particlePool: THREE.Points[] = [];
  private decalManager: DecalManager;
  private eventBus: EventBus;

  constructor(scene: THREE.Scene, eventBus: EventBus) {
    this.scene = scene;
    this.eventBus = eventBus;
    this.decalManager = new DecalManager(scene, '/assets/images/bullet_hole.png');
    this.eventBus.on('bullet_hit', (e: Extract<GameEvent, { type: 'bullet_hit' }>) => {
      this.spawnHitMarker();
      this.spawnImpactParticles(e.hitPoint);
      this.createPermanentMark(e);
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

  /**
   * Создаёт постоянный след (декаль) на цели и сохраняет ссылку в target.hits
   */
  private createPermanentMark(e: Extract<GameEvent, { type: 'bullet_hit' }>): void {
    const { target, hitPoint, hitNormal, hitObject } = e;
    // hitObject может быть undefined; если есть — используем его как mesh
    let mesh: THREE.Mesh | undefined;
    if (hitObject && (hitObject as THREE.Mesh).isMesh) {
      mesh = hitObject as THREE.Mesh;
    } else {
      // fallback: попробуем найти первый Mesh внутри target.mesh
      target.mesh.traverse((obj) => {
        if (!mesh && (obj as THREE.Mesh).isMesh) mesh = obj as THREE.Mesh;
      });
    }
    if (!mesh) return;

    // Создаём декаль и сохраняем ссылку
    const decal = this.decalManager.createDecal(mesh, hitPoint, hitNormal, 0.12);
    target.hits = target.hits || [];
    target.hits.push({ point: hitPoint.clone(), normal: hitNormal.clone(), decalMesh: decal });
  }

  dispose(): void {
    this.decalManager.dispose();
    // очистка пула частиц если нужно
    this.particlePool.forEach(p => {
      if (p.geometry) p.geometry.dispose();
      if (p.material) (p.material as THREE.Material).dispose();
      if (p.parent) p.parent.remove(p);
    });
    this.particlePool = [];
  }
}
