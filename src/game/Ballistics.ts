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

  // Trail
  private readonly MAX_TRAIL = 60;
  private trailBuffer = new Float32Array(this.MAX_TRAIL * 3);
  private trailCount = 0;
  private trailGeo: THREE.BufferGeometry;
  private trailAttr: THREE.BufferAttribute;
  private trailMesh: THREE.Points;

  // Reusable temporaries to avoid allocations
  private tmpDir = new THREE.Vector3();
  private tmpDistVec = new THREE.Vector3();

  // Event handler reference for unsubscribe
  private shootHandler: (e: GameEvent) => void;

  // Cache for target collision meshes to avoid repeated traversal
  private targetMeshCache = new WeakMap<Target, THREE.Object3D[]>();

  constructor(scene: THREE.Scene, eventBus: EventBus) {
    this.scene = scene;
    this.eventBus = eventBus;

    this.trailGeo = new THREE.BufferGeometry();
    this.trailAttr = new THREE.BufferAttribute(this.trailBuffer, 3);
    this.trailAttr.setUsage(THREE.DynamicDrawUsage);
    this.trailGeo.setAttribute('position', this.trailAttr);
    this.trailGeo.setDrawRange(0, 0);

    this.trailMesh = new THREE.Points(
      this.trailGeo,
      new THREE.PointsMaterial({
        color: 0xff8844,
        size: 0.06,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.scene.add(this.trailMesh);

    this.shootHandler = (e: GameEvent) => {
      if ((e as any).type === 'shoot') {
        const ev = e as Extract<GameEvent, { type: 'shoot' }>;
        this.shoot(ev.startPos, ev.direction);
      }
    };
    this.eventBus.on('shoot', this.shootHandler);
  }

  /**
   * Fire a single bullet. Returns false if a bullet is already active.
   */
  public shoot(startPos: THREE.Vector3, direction: THREE.Vector3): boolean {
    if (this.bullet?.active) return false;

    const sphereGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff4400,
      emissiveIntensity: 0.9
    });
    const mesh = new THREE.Mesh(sphereGeo, sphereMat);
    mesh.position.copy(startPos);
    mesh.castShadow = true;

    const light = new THREE.PointLight(0xff6600, 1.5, 12);
    mesh.add(light);
    this.scene.add(mesh);

    this.bullet = {
      mesh,
      light,
      velocity: direction.clone().normalize().multiplyScalar(this.bulletSpeed),
      prevPosition: startPos.clone(),
      startTime: performance.now(),
      active: true
    };

    // reset trail
    this.trailCount = 0;
    this.trailBuffer.fill(0);
    this.trailAttr.needsUpdate = true;
    this.trailGeo.setDrawRange(0, 0);

    return true;
  }

  /**
   * Update physics and collision. dt in seconds.
   */
  public update(dt: number, targets: Target[]): void {
    if (!this.bullet?.active) return;
    const { velocity, mesh, prevPosition } = this.bullet;

    // Physics integration (semi-implicit Euler)
    velocity.y -= this.gravity * dt;
    velocity.multiplyScalar(1 - this.drag * dt);
    velocity.addScaledVector(this.wind, dt);

    // Move bullet
    mesh.position.addScaledVector(velocity, dt);

    // Compute displacement and direction between previous and current position
    this.tmpDistVec.copy(mesh.position).sub(prevPosition);
    const dist = this.tmpDistVec.length();
    if (dist > 1e-6) {
      this.tmpDir.copy(this.tmpDistVec).normalize();
    } else {
      this.tmpDir.set(0, 0, 0);
    }

    // Push trail (ordered)
    this.pushTrail(mesh.position);

    // Prepare target meshes (cached per Target)
    const targetMeshes: THREE.Object3D[] = [];
    for (const t of targets) {
      let cached = this.targetMeshCache.get(t);
      if (!cached) {
        cached = [];
        // If Target exposes collisionMeshes, prefer that
        const anyT = t as any;
        if (Array.isArray(anyT.collisionMeshes) && anyT.collisionMeshes.length > 0) {
          cached.push(...anyT.collisionMeshes);
        } else {
          // traverse once and cache meshes
          t.mesh.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) cached!.push(obj);
          });
        }
        this.targetMeshCache.set(t, cached);
      }
      targetMeshes.push(...cached);
    }

    // Raycast only if moved
    if (dist > 1e-6 && targetMeshes.length > 0) {
      this.raycaster.set(prevPosition, this.tmpDir);
      this.raycaster.near = 0;
      this.raycaster.far = dist;
      const hits = this.raycaster.intersectObjects(targetMeshes, true);
      if (hits.length > 0) {
        const hit = hits[0];
        // Walk up hierarchy to find matching Target
        let obj: THREE.Object3D | null = hit.object;
        let foundTarget: Target | undefined;
        while (obj) {
          foundTarget = targets.find(t => t.mesh === obj);
          if (foundTarget) break;
          obj = obj.parent;
        }

        if (foundTarget) {
          this.eventBus.emit({
            type: 'bullet_hit',
            target: foundTarget,
            distance: mesh.position.distanceTo(foundTarget.position),
            hitPoint: hit.point
          } as any);
        } else {
          // If no target found by exact group match, try to match by parent chain to any target.mesh
          obj = hit.object.parent;
          while (obj) {
            foundTarget = targets.find(t => t.mesh === obj);
            if (foundTarget) break;
            obj = obj.parent;
          }
          if (foundTarget) {
            this.eventBus.emit({
              type: 'bullet_hit',
              target: foundTarget,
              distance: mesh.position.distanceTo(foundTarget.position),
              hitPoint: hit.point
            } as any);
          } else {
            console.warn('Попадание в объект, но цель не найдена');
          }
        }

        this.cleanup();
        return;
      }
    }

    // Update prevPosition after raycast
    prevPosition.copy(mesh.position);

    // Lifetime / bounds checks
    if (
      mesh.position.y < -0.2 ||
      Math.abs(mesh.position.x) > 120 ||
      mesh.position.z > 160 ||
      (performance.now() - this.bullet.startTime) > 4000
    ) {
      this.cleanup();
    }
  }

  /**
   * Push a new point into the trail buffer while keeping points ordered from oldest to newest.
   */
  private pushTrail(p: THREE.Vector3): void {
    if (this.trailCount < this.MAX_TRAIL) {
      const i = this.trailCount * 3;
      this.trailBuffer[i] = p.x;
      this.trailBuffer[i + 1] = p.y;
      this.trailBuffer[i + 2] = p.z;
      this.trailCount++;
    } else {
      // shift left by one point (3 floats) and append new point at the end
      this.trailBuffer.copyWithin(0, 3, this.MAX_TRAIL * 3);
      const i = (this.MAX_TRAIL - 1) * 3;
      this.trailBuffer[i] = p.x;
      this.trailBuffer[i + 1] = p.y;
      this.trailBuffer[i + 2] = p.z;
    }
    this.trailAttr.needsUpdate = true;
    this.trailGeo.setDrawRange(0, this.trailCount);
  }

  /**
   * Clean up the active bullet and emit miss event.
   */
  private cleanup(): void {
    if (!this.bullet) {
      // still emit miss to keep behavior consistent
      this.eventBus.emit({ type: 'bullet_miss' } as any);
      return;
    }

    // Remove mesh from scene
    this.scene.remove(this.bullet.mesh);

    // Dispose geometry if possible
    const geo = this.bullet.mesh.geometry as THREE.BufferGeometry | undefined;
    if (geo && typeof geo.dispose === 'function') {
      geo.dispose();
    }

    // Dispose material(s) safely
    const mat = (this.bullet.mesh.material as any);
    if (Array.isArray(mat)) {
      for (const m of mat) {
        if (m && typeof m.dispose === 'function') m.dispose();
      }
    } else if (mat && typeof mat.dispose === 'function') {
      mat.dispose();
    }

    // Remove light from parent (do not call dispose on lights)
    if (this.bullet.light && this.bullet.light.parent) {
      this.bullet.light.parent.remove(this.bullet.light);
    }

    this.bullet.active = false;
    this.bullet = null;

    this.eventBus.emit({ type: 'bullet_miss' } as any);
  }

  /**
   * Dispose Ballistics instance: remove meshes, free GPU resources, unsubscribe events.
   */
  public dispose(): void {
    // Unsubscribe event
    if (this.shootHandler && typeof (this.eventBus as any).off === 'function') {
      (this.eventBus as any).off('shoot', this.shootHandler);
    }

    // Cleanup active bullet if any
    this.cleanup();

    // Remove and dispose trail
    if (this.trailMesh.parent) this.trailMesh.parent.remove(this.trailMesh);
    if (this.trailGeo && typeof this.trailGeo.dispose === 'function') this.trailGeo.dispose();

    // Clear caches
    this.targetMeshCache = new WeakMap();
  }
}
