import * as THREE from 'three';
import { BulletState, Target, GameEvent } from '../types';
import { EventBus } from './EventBus';

export class Ballistics {
  private bullet: BulletState | null = null;
  private scene: THREE.Scene;
  private eventBus: EventBus;
  private raycaster = new THREE.Raycaster();
  private readonly bulletSpeed = 280;
  private readonly gravity = 9.81;
  private readonly drag = 0.012;
  private readonly wind = new THREE.Vector3(0.3, 0, 0.1);

  // Ring Buffer для трейла
  private readonly MAX_TRAIL = 60;
  private trailBuffer = new Float32Array(this.MAX_TRAIL * 3);
  private trailCursor = 0;
  private trailCount = 0;
  private trailMesh: THREE.Points;
  private trailGeo: THREE.BufferGeometry;

  constructor(scene: THREE.Scene, eventBus: EventBus) {
    this.scene = scene;
    this.eventBus = eventBus;

    this.trailGeo = new THREE.BufferGeometry();
    this.trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailBuffer, 3));
    this.trailMesh = new THREE.Points(this.trailGeo, new THREE.PointsMaterial({
      color: 0xff8844, size: 0.06, transparent: true, opacity: 0.65, depthWrite: false
    }));
    this.trailMesh.frustumCulled = false;
    this.scene.add(this.trailMesh);
    eventBus.on('shoot', (e) => {
      const ev = e as Extract<GameEvent, { type: 'shoot' }>;
      this.shoot(ev.startPos, ev.direction);
    });
  }

  public shoot(startPos: THREE.Vector3, direction: THREE.Vector3): boolean {
    if (this.bullet?.active) return false;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 0.9 })
    );
    mesh.position.copy(startPos); mesh.castShadow = true;
    const light = new THREE.PointLight(0xff6600, 1.5, 12);
    mesh.add(light);
    this.scene.add(mesh);

    this.bullet = {
      mesh, light,
      velocity: direction.clone().normalize().multiplyScalar(this.bulletSpeed),
      prevPosition: startPos.clone(),
      startTime: performance.now(), active: true
    };
    this.trailCount = 0; this.trailCursor = 0;
    this.trailGeo.setDrawRange(0, 0);
    return true;
  }

  public update(dt: number, targets: Target[]): void {
    if (!this.bullet || !this.bullet.active) return;
    const { velocity, mesh, prevPosition } = this.bullet;

    velocity.y -= this.gravity * dt;
    velocity.multiplyScalar(1 - this.drag * dt);
    velocity.addScaledVector(this.wind, dt);

    mesh.position.addScaledVector(velocity, dt);
    this.bullet.prevPosition.copy(mesh.position);
    this.pushTrail(mesh.position);

    // Swept Collision
    const dir = mesh.position.clone().sub(prevPosition).normalize();
    const dist = mesh.position.distanceTo(prevPosition);
    this.raycaster.set(prevPosition, dir, 0, dist);
    const hits = this.raycaster.intersectObjects(targets.map(t => t.mesh), true);
    if (hits.length > 0) {
      this.resolveHit(hits[0], targets);
      return;
    }

    if (mesh.position.y < -0.2 || Math.abs(mesh.position.x) > 120 || mesh.position.z > 160 || (performance.now() - this.bullet.startTime) > 4000) {
      this.cleanup();
    }
  }

  private pushTrail(p: THREE.Vector3): void {
    const i = this.trailCursor * 3;
    this.trailBuffer[i] = p.x; this.trailBuffer[i + 1] = p.y; this.trailBuffer[i + 2] = p.z;
    this.trailCursor = (this.trailCursor + 1) % this.MAX_TRAIL;
    this.trailCount = Math.min(this.trailCount + 1, this.MAX_TRAIL);
    this.trailGeo.attributes.position.needsUpdate = true;
    this.trailGeo.setDrawRange(0, this.trailCount);
  }

  private resolveHit(hit: THREE.Intersection, targets: Target[]): void {
    const target = targets.find(t => t.mesh === hit.object || t.mesh.children.includes(hit.object as any));
    if (target && this.bullet) {
      this.eventBus.emit({ type: 'bullet_hit', target, distance: this.bullet.mesh.position.distanceTo(target.position) });
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.bullet) {
      this.scene.remove(this.bullet.mesh);
      this.bullet.mesh.geometry.dispose();
      (this.bullet.mesh.material as THREE.Material).dispose();
      this.bullet.light.dispose();
      this.bullet.active = false; this.bullet = null;
    }
    this.eventBus.emit({ type: 'bullet_miss' });
  }

  dispose(): void {
    this.cleanup();
    this.trailGeo.dispose();
    this.scene.remove(this.trailMesh);
  }
}
