import * as THREE from 'three';
import { GameEvent } from '../types';
import { EventBus } from './EventBus';

export class Effects {
  private scene: THREE.Scene;
  constructor(scene: THREE.Scene, eventBus: EventBus) {
    this.scene = scene;
    eventBus.on('bullet_hit', () => this.spawnHitMarker());
  }

  private spawnHitMarker(): void {
    const el = document.createElement('div'); el.className = 'hit-marker';
    document.body.appendChild(el); setTimeout(() => el.remove(), 250);
  }

  spawnImpactParticles(pos: THREE.Vector3): void {
    const count = 12;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const vels: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      positions[i*3] = pos.x; positions[i*3+1] = pos.y; positions[i*3+2] = pos.z;
      vels.push(new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize().multiplyScalar(3));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffaa44, size: 0.15, transparent: true, opacity: 0.9 });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      if (t > 0.3) { this.scene.remove(pts); geo.dispose(); mat.dispose(); return; }
      const arr = geo.attributes.position.array as Float32Array;
      for(let i=0;i<count;i++) { arr[i*3]+=vels[i].x*0.016; arr[i*3+1]+=vels[i].y*0.016-9.81*t*0.016; arr[i*3+2]+=vels[i].z*0.016; }
      geo.attributes.position.needsUpdate = true; mat.opacity = 1 - t/0.3;
      requestAnimationFrame(tick);
    }; tick();
  }
}
