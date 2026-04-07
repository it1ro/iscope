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
    for (let i = 0; i < this.MAX_TARGETS; i++) {
      const { x, z } = this.randomPos();
      this.targets.push(this.createTarget(x, z));
    }
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
      radius: this.RADIUS
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
    for (let i = 0; i < this.MAX_TARGETS; i++) {
      const { x, z } = this.randomPos();
      this.targets.push(this.createTarget(x, z));
    }
  }

  public getTargets(): Target[] {
    return this.targets;
  }

  private disposeGroup(group: THREE.Group): void {
    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material) (child.material as THREE.Material).dispose();
      }
    });
    this.scene.remove(group);
  }

  public dispose(): void {
    this.targets.forEach(t => this.disposeGroup(t.mesh));
    this.targets = [];
  }
}
