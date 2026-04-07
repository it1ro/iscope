import * as THREE from 'three';
import { Target, GameEvent } from '../types';
import { EventBus } from './EventBus';

export class TargetManager {
  private scene: THREE.Scene;
  private targets: Target[] = [];
  private readonly RADIUS = 0.55;
  private readonly HEIGHT = 0.6;
  private readonly MAX_TARGETS = 8; // постоянное количество целей

  constructor(scene: THREE.Scene, eventBus: EventBus) {
    this.scene = scene;
    this.init();

    eventBus.on('bullet_hit', (e: Extract<GameEvent, { type: 'bullet_hit' }>) => {
      this.destroyTarget(e.target);
      this.spawnNewTarget();
    });
    eventBus.on('reset_game', () => this.resetAllTargets());
  }

  private init(): void {
    this.targets.forEach(t => this.disposeGroup(t.mesh));
    this.targets = [];

    // создаём несколько целей + одну ростовую на 100м
    // сначала обычные
    for (let i = 0; i < this.MAX_TARGETS - 1; i++) {
      const { x, z } = this.randomPos();
      this.targets.push(this.createTarget(x, z));
    }
    // затем ростовая мишень на 100 м по центру (x=0)
    this.targets.push(this.createHumanTargetAt(100, 0));
  }

  private createTarget(x: number, z: number): Target {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.3, metalness: 0.1, emissive: 0x220000 });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(this.RADIUS, 24, 24), mat);
    sphere.castShadow = true;
    group.add(sphere);
    const bull = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.8 })
    );
    bull.position.z = this.RADIUS * 0.95;
    group.add(bull);
    group.position.set(x, this.HEIGHT, z);
    this.scene.add(group);
    return {
      id: `tgt_${x}_${z}`,
      mesh: group,
      position: new THREE.Vector3(x, this.HEIGHT, z),
      radius: this.RADIUS,
      hits: []
    };
  }

  /**
   * Создать ростовую мишень (силуэт человека) на заданной дистанции (в метрах).
   * width и height в метрах (по умолчанию 0.5 x 1.7)
   */
  private createHumanTargetAt(rangeMeters: number, x = 0, width = 0.5, height = 1.7): Target {
    const group = new THREE.Group();

    // Загрузка текстуры силуэта (ожидается assets/target_human.png)
    const loader = new THREE.TextureLoader();
    const tex = loader.load('/assets/target_human.png');

    // Материал с прозрачностью (чтобы силуэт был виден)
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      depthWrite: true
    });

    // Плоскость: ширина x высота (метры)
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
    // Плоскость ориентирована лицом к камере (по -Z), центр по высоте
    plane.position.set(0, height / 2, 0);
    plane.castShadow = true;
    plane.receiveShadow = false;
    group.add(plane);

    // Позиционируем группу в мире: x, ground y=0, z=rangeMeters
    group.position.set(x, 0, rangeMeters);
    // Повернуть так, чтобы лицевая сторона смотрела на камеру (если камера в 0,0,0 и смотрит +Z)
    group.lookAt(new THREE.Vector3(0, plane.position.y, 0));

    this.scene.add(group);

    return {
      id: `human_${rangeMeters}_${x}`,
      mesh: group,
      position: new THREE.Vector3(x, height / 2, rangeMeters),
      radius: Math.max(width, height) / 2,
      hits: []
    };
  }

  private randomPos(): { x: number; z: number } {
    return { x: (Math.random() - 0.5) * 50, z: 20 + Math.random() * 70 };
  }

  /** Уничтожить цель (удалить из сцены и массива) */
  private destroyTarget(target: Target): void {
    const index = this.targets.findIndex(t => t.id === target.id);
    if (index !== -1) {
      this.targets.splice(index, 1);
      this.disposeGroup(target.mesh);
    }
  }

  /** Создать новую цель в случайном месте и добавить в массив */
  private spawnNewTarget(): void {
    const { x, z } = this.randomPos();
    const newTarget = this.createTarget(x, z);
    this.targets.push(newTarget);
  }

  /** Полный сброс всех целей (например, по клавише R) */
  private resetAllTargets(): void {
    this.targets.forEach(t => this.disposeGroup(t.mesh));
    this.targets = [];
    for (let i = 0; i < this.MAX_TARGETS - 1; i++) {
      const { x, z } = this.randomPos();
      this.targets.push(this.createTarget(x, z));
    }
    this.targets.push(this.createHumanTargetAt(100, 0));
  }

  public getTargets(): Target[] {
    return this.targets;
  }

  private disposeGroup(group: THREE.Group): void {
    // Найдём соответствующий Target, чтобы удалить декали, если они есть
    const target = this.targets.find(t => t.mesh === group);
    if (target?.hits) {
      for (const h of target.hits) {
        if (h.decalMesh) {
          try {
            if (h.decalMesh.geometry) h.decalMesh.geometry.dispose();
            if (h.decalMesh.material) {
              const mat = h.decalMesh.material as any;
              if (Array.isArray(mat)) mat.forEach((m: THREE.Material) => m.dispose());
              else mat.dispose();
            }
            if (h.decalMesh.parent) h.decalMesh.parent.remove(h.decalMesh);
          } catch (err) {
            // ignore disposal errors
          }
        }
      }
    }

    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        try {
          child.geometry.dispose();
        } catch {}
        if (child.material) {
          try {
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
            else (child.material as THREE.Material).dispose();
          } catch {}
        }
      }
    });
    this.scene.remove(group);
  }

  public dispose(): void {
    this.targets.forEach(t => this.disposeGroup(t.mesh));
    this.targets = [];
  }
}
