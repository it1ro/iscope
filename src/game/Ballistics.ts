// src/game/Ballistics.ts

import * as THREE from 'three';
import { BulletState, Target, GameEvent } from '../types';
import { EventBus } from './EventBus';

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
  private readonly wind = new THREE.Vector3(0, 0, 0); // Ветер отключён для отладки
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

  constructor(scene: THREE.Scene, eventBus: EventBus) {
    this.scene = scene;
    this.eventBus = eventBus;

    this.trailGeo = new THREE.BufferGeometry();
    this.trailAttr = new THREE.BufferAttribute(this.trailBuffer, 3);
    this.trailAttr.setUsage(THREE.DynamicDrawUsage);
    this.trailGeo.setAttribute('position', this.trailAttr);
    this.trailGeo.setDrawRange(0, 0);

    // Улучшенный материал трассера: ярче, крупнее точки, больше непрозрачность
    this.trailMesh = new THREE.Points(
      this.trailGeo,
      new THREE.PointsMaterial({
        color: 0xffcc00,        // ярко-жёлтый
        size: 0.12,             // увеличено с 0.06
        transparent: true,
        opacity: 0.85,          // увеличено с 0.65
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

  public shoot(startPos: THREE.Vector3, direction: THREE.Vector3): boolean {
    if (this.bullet?.active) return false;

    const sphereGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,           // ярко-жёлтый
      emissive: 0xff8800,        // оранжевое свечение
      emissiveIntensity: 1.8     // увеличено с 0.9
    });
    const mesh = new THREE.Mesh(sphereGeo, sphereMat);
    mesh.position.copy(startPos);
    mesh.castShadow = true;

    // Более яркий и дальний источник света
    const light = new THREE.PointLight(0xffaa00, 3.5, 20); // интенсивность 3.5 (было 1.5), дальность 20 (было 12)
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

    this.trailCount = 0;
    this.trailBuffer.fill(0);
    this.trailAttr.needsUpdate = true;
    this.trailGeo.setDrawRange(0, 0);

    return true;
  }

  public update(dt: number, targets: Target[]): void {
    if (!this.bullet?.active) return;
    const { velocity, mesh, prevPosition } = this.bullet;

    // Повышенная точность субстеппинга (480 Hz)
    const maxStep = 1 / 480;
    const substeps = Math.max(1, Math.ceil(dt / maxStep));
    const step = dt / substeps;

    const area = this.getCrossSectionArea();

    for (let s = 0; s < substeps; s++) {
      this.tmpRelVel.copy(velocity).sub(this.wind);
      const relSpeed = this.tmpRelVel.length();

      if (relSpeed > 1e-6) {
        const Cd = this.estimateCdFromBC(relSpeed) ?? this.fallbackCd;
        const dragAccMag = (this.airDensity * Cd * area * relSpeed * relSpeed) / (2 * this.bulletMass);
        this.tmpDrag.copy(this.tmpRelVel).multiplyScalar(-dragAccMag / relSpeed);
        velocity.addScaledVector(this.tmpDrag, step);
      }

      velocity.addScaledVector(this.tmpGrav, step);
      mesh.position.addScaledVector(velocity, step);
    }

    this.tmpDistVec.copy(mesh.position).sub(prevPosition);
    const dist = this.tmpDistVec.length();
    if (dist > 1e-6) {
      this.tmpDir.copy(this.tmpDistVec).normalize();
    } else {
      this.tmpDir.set(0, 0, 0);
    }

    this.pushTrail(mesh.position);

    // Сбор коллизионных мешей только для НЕ поражённых целей
    const targetMeshes: THREE.Object3D[] = [];
    for (const t of targets) {
      if (t.isHit) continue; // пропускаем уже поражённые цели
      const anyT = t as any;
      if (Array.isArray(anyT.collisionMeshes) && anyT.collisionMeshes.length > 0) {
        targetMeshes.push(...anyT.collisionMeshes);
      } else {
        t.mesh.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) targetMeshes.push(obj);
        });
      }
    }

    if (dist > 1e-6 && targetMeshes.length > 0) {
      this.raycaster.set(prevPosition, this.tmpDir);
      this.raycaster.near = 0;
      this.raycaster.far = dist;
      const hits = this.raycaster.intersectObjects(targetMeshes, true);
      
      if (hits.length > 0) {
        // Перебираем все попадания, но берём первое, принадлежащее НЕ поражённой цели
        for (const hit of hits) {
          let obj: THREE.Object3D | null = hit.object;
          let foundTarget: Target | undefined;
          while (obj) {
            foundTarget = (obj.userData as any).target as Target | undefined;
            if (foundTarget) break;
            obj = obj.parent;
          }
          if (!foundTarget) continue;
          if (foundTarget.isHit) continue; // на всякий случай (вдруг что-то просочилось)

          // Вычисляем нормаль
          let hitNormal = new THREE.Vector3();
          if (hit.face) {
            const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
            hitNormal.copy(hit.face.normal).applyMatrix3(normalMatrix).normalize();
          } else {
            hitNormal.copy(this.tmpDir).negate();
          }

          this.eventBus.emit({
            type: 'bullet_hit',
            target: foundTarget,
            distance: mesh.position.distanceTo(foundTarget.position),
            hitPoint: hit.point.clone(),
            hitNormal: hitNormal.clone(),
            hitObject: hit.object
          } as any);

          this.cleanup();
          return;
        }
        // Если все пересечения оказались с поражёнными целями — пуля летит дальше
      }
    }

    prevPosition.copy(mesh.position);

    // Условие удаления пули: упала ниже земли или превышен таймаут (8 секунд)
    if (
      mesh.position.y < -0.2 ||
      (performance.now() - this.bullet.startTime) > 8000
    ) {
      this.cleanup();
    }
  }

  private pushTrail(p: THREE.Vector3): void {
    if (this.trailCount < this.MAX_TRAIL) {
      const i = this.trailCount * 3;
      this.trailBuffer[i] = p.x;
      this.trailBuffer[i + 1] = p.y;
      this.trailBuffer[i + 2] = p.z;
      this.trailCount++;
    } else {
      this.trailBuffer.copyWithin(0, 3, this.MAX_TRAIL * 3);
      const i = (this.MAX_TRAIL - 1) * 3;
      this.trailBuffer[i] = p.x;
      this.trailBuffer[i + 1] = p.y;
      this.trailBuffer[i + 2] = p.z;
    }
    this.trailAttr.needsUpdate = true;
    this.trailGeo.setDrawRange(0, this.trailCount);
  }

  private cleanup(): void {
    if (!this.bullet) {
      this.eventBus.emit({ type: 'bullet_miss' } as any);
      return;
    }

    this.scene.remove(this.bullet.mesh);
    const geo = this.bullet.mesh.geometry as THREE.BufferGeometry | undefined;
    if (geo && typeof geo.dispose === 'function') geo.dispose();
    const mat = this.bullet.mesh.material as any;
    if (Array.isArray(mat)) {
      for (const m of mat) if (m && typeof m.dispose === 'function') m.dispose();
    } else if (mat && typeof mat.dispose === 'function') mat.dispose();
    if (this.bullet.light && this.bullet.light.parent) {
      this.bullet.light.parent.remove(this.bullet.light);
    }

    this.bullet.active = false;
    this.bullet = null;
    this.eventBus.emit({ type: 'bullet_miss' } as any);
  }

  public dispose(): void {
    if (this.shootHandler && typeof (this.eventBus as any).off === 'function') {
      (this.eventBus as any).off('shoot', this.shootHandler);
    }
    this.cleanup();
    if (this.trailMesh.parent) this.trailMesh.parent.remove(this.trailMesh);
    if (this.trailGeo && typeof this.trailGeo.dispose === 'function') this.trailGeo.dispose();
  }

  private getCrossSectionArea(): number {
    const r = this.bulletDiameter / 2;
    return Math.PI * r * r;
  }

  private estimateCdFromBC(speed: number): number | null {
    const bc = this.BC;
    if (!bc || bc <= 0) return null;
    const minBC = 0.2, maxBC = 0.5, minCd = 0.24, maxCd = 0.36;
    const t = Math.min(1, Math.max(0, (bc - minBC) / (maxBC - minBC)));
    return maxCd + (minCd - maxCd) * t;
  }

  /**
   * Симуляция полёта пули без создания мешей.
   * Возвращает вертикальное смещение (drop) в метрах относительно прямой линии выстрела
   * на дистанции rangeMeters. Положительное значение — падение вниз.
   * Учитывается начальное смещение ствола на 5 см ниже линии визирования.
   */
  public getDropAtRange(rangeMeters: number): number {
    const dtStep = 1 / 480;
    const area = this.getCrossSectionArea();
    const pos = new THREE.Vector3(0, -0.05, 0); // ствол ниже камеры на 5 см
    const vel = new THREE.Vector3(0, 0, this.muzzleVelocity);
    let traveled = 0;
    const maxSimTime = 20;
    let t = 0;
    while (traveled < rangeMeters && t < maxSimTime) {
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
      if (pos.y < -100) break;
    }
    return -pos.y;
  }
}
