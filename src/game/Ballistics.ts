import * as THREE from 'three';
import { BulletState, Target, GameEvent } from '../types';
import { EventBus } from './EventBus';

/**
 * Ballistics
 * Реалистичная модель полёта пули с субстеппингом, учётом сопротивления воздуха и ветра.
 * Параметры по умолчанию подобраны под SVD / 7.62x54R (примерные средние значения).
 */
export class Ballistics {
  private bullet: BulletState | null = null;
  private scene: THREE.Scene;
  private eventBus: EventBus;
  private raycaster = new THREE.Raycaster();

  // --- Weapon / bullet physical params (SVD / 7.62x54R typical)
  private readonly muzzleVelocity = 830; // m/s
  private readonly bulletMass = 0.0096; // kg (9.6 g)
  private readonly bulletDiameter = 0.00762; // m (7.62 mm)
  private readonly BC = 0.34; // G1 ballistic coefficient (approx)
  private readonly airDensity = 1.225; // kg/m^3 (sea level, 15°C)
  private readonly gravity = 9.81; // m/s^2
  private readonly wind = new THREE.Vector3(0.3, 0, 0.1); // m/s (wind velocity vector)
  private readonly fallbackCd = 0.295;

  // Trail
  private readonly MAX_TRAIL = 120;
  private trailBuffer = new Float32Array(this.MAX_TRAIL * 3);
  private trailCount = 0;
  private trailGeo: THREE.BufferGeometry;
  private trailAttr: THREE.BufferAttribute;
  private trailMesh: THREE.Points;

  // Reusable temporaries
  private tmpDir = new THREE.Vector3();
  private tmpDistVec = new THREE.Vector3();
  private tmpRelVel = new THREE.Vector3();
  private tmpDrag = new THREE.Vector3();
  private tmpGrav = new THREE.Vector3(0, -this.gravity, 0);

  private shootHandler: (e: GameEvent) => void;
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
   * startPos and direction are in scene units (assumed meters).
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
      velocity: direction.clone().normalize().multiplyScalar(this.muzzleVelocity),
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
   * Uses substepping to keep simulation stable at high muzzle velocities.
   */
  public update(dt: number, targets: Target[]): void {
    if (!this.bullet?.active) return;
    const { velocity, mesh, prevPosition } = this.bullet;

    // Substepping: aim for ~240-300 Hz internal updates for accuracy
    const maxStep = 1 / 240; // ~0.004166...
    const substeps = Math.max(1, Math.ceil(dt / maxStep));
    const step = dt / substeps;

    const area = this.getCrossSectionArea();

    for (let s = 0; s < substeps; s++) {
      // Relative velocity to wind (wind is a velocity vector)
      this.tmpRelVel.copy(velocity).sub(this.wind);
      const relSpeed = this.tmpRelVel.length();

      if (relSpeed > 1e-6) {
        // Estimate drag coefficient (Cd). For more accuracy, replace with BC->Cd mapping or table.
        const Cd = this.estimateCdFromBC(relSpeed) ?? this.fallbackCd;

        // Drag acceleration magnitude: (rho * Cd * A * v^2) / (2 * m)
        const dragAccMag = (this.airDensity * Cd * area * relSpeed * relSpeed) / (2 * this.bulletMass);

        // Drag vector: opposite to relative velocity
        this.tmpDrag.copy(this.tmpRelVel).multiplyScalar(-dragAccMag / relSpeed);

        // Integrate accelerations: gravity + drag
        velocity.addScaledVector(this.tmpDrag, step);
      }

      // gravity
      velocity.addScaledVector(this.tmpGrav, step);

      // integrate position
      mesh.position.addScaledVector(velocity, step);
    }

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
        const anyT = t as any;
        if (Array.isArray(anyT.collisionMeshes) && anyT.collisionMeshes.length > 0) {
          cached.push(...anyT.collisionMeshes);
        } else {
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
        // Compute world-space normal if available
        let hitNormal = new THREE.Vector3();
        if (hit.face) {
          const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
          hitNormal.copy(hit.face.normal).applyMatrix3(normalMatrix).normalize();
        } else {
          hitNormal.copy(this.tmpDir).negate();
        }

        // Walk up hierarchy to find matching Target
        let obj: THREE.Object3D | null = hit.object;
        let foundTarget: Target | undefined;
        while (obj) {
          foundTarget = targets.find(t => t.mesh === obj);
          if (foundTarget) break;
          obj = obj.parent;
        }

        if (!foundTarget) {
          obj = hit.object.parent;
          while (obj) {
            foundTarget = targets.find(t => t.mesh === obj);
            if (foundTarget) break;
            obj = obj.parent;
          }
        }

        if (foundTarget) {
          // Emit extended event with hitNormal and hitObject
          this.eventBus.emit({
            type: 'bullet_hit',
            target: foundTarget,
            distance: mesh.position.distanceTo(foundTarget.position),
            hitPoint: hit.point.clone(),
            hitNormal: hitNormal.clone(),
            hitObject: hit.object
          } as any);
        } else {
          console.warn('Попадание в объект, но цель не найдена');
        }

        this.cleanup();
        return;
      }
    }

    // Update prevPosition after raycast
    prevPosition.copy(mesh.position);

    // Lifetime / bounds checks (safety)
    if (
      mesh.position.y < -0.2 ||
      Math.abs(mesh.position.x) > 120 ||
      mesh.position.z > 160 ||
      (performance.now() - this.bullet.startTime) > 8000 // увеличил таймаут для дальних выстрелов
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
      this.eventBus.emit({ type: 'bullet_miss' } as any);
      return;
    }

    // Remove mesh from scene
    this.scene.remove(this.bullet.mesh);

    // Dispose geometry if possible
    const geo = this.bullet.mesh.geometry as THREE.BufferGeometry | undefined;
    if (geo && typeof geo.dispose === 'function') geo.dispose();

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

  // ----------------- Helpers -----------------

  private getCrossSectionArea(): number {
    const r = this.bulletDiameter / 2;
    return Math.PI * r * r;
  }

  private estimateCdFromBC(speed: number): number | null {
    const bc = this.BC;
    if (!bc || bc <= 0) return null;
    const minBC = 0.2;
    const maxBC = 0.5;
    const minCd = 0.24;
    const maxCd = 0.36;
    const t = Math.min(1, Math.max(0, (bc - minBC) / (maxBC - minBC)));
    const cd = maxCd + (minCd - maxCd) * t;
    return cd;
  }

  /**
   * Симуляция полёта пули без создания мешей.
   * Возвращает вертикальное смещение (drop) в метрах относительно прямой линии выстрела
   * на дистанции rangeMeters. Положительное значение — падение вниз (обычно отрицательное y).
   */
  public getDropAtRange(rangeMeters: number): number {
    // simulate from origin along +Z, initial velocity along +Z
    const dtStep = 1 / 240;
    const area = this.getCrossSectionArea();
    const pos = new THREE.Vector3(0, 0, 0);
    const vel = new THREE.Vector3(0, 0, this.muzzleVelocity);
    let traveled = 0;
    const maxSimTime = 20; // safety
    let t = 0;
    while (traveled < rangeMeters && t < maxSimTime) {
      // substep integration
      this.tmpRelVel.copy(vel).sub(this.wind);
      const relSpeed = this.tmpRelVel.length();
      if (relSpeed > 1e-6) {
        const Cd = this.estimateCdFromBC(relSpeed) ?? this.fallbackCd;
        const dragAccMag = (this.airDensity * Cd * area * relSpeed * relSpeed) / (2 * this.bulletMass);
        this.tmpDrag.copy(this.tmpRelVel).multiplyScalar(-dragAccMag / relSpeed);
        vel.addScaledVector(this.tmpDrag, dtStep);
      }
      vel.addScaledVector(this.tmpGrav, dtStep);
      pos.addScaledVector(vel, dtStep);
      traveled = pos.z;
      t += dtStep;
      // safety break if bullet goes underground
      if (pos.y < -100) break;
    }
    // drop relative to straight line (initial y=0)
    return -pos.y;
  }
}
