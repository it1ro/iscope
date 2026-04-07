import * as THREE from 'three';
import { Target, GameEvent } from '../types';
import { EventBus } from './EventBus';

export class TargetManager {
  private scene: THREE.Scene;
  private targets: Target[] = [];
  private readonly MAX_TARGETS = 10;
  private distances = [25, 50, 75, 100, 150, 200, 250, 300, 350, 400];
  private groundY = -0.15; // уровень земли

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

    this.distances.forEach(dist => {
      const xOffset = (Math.random() - 0.5) * 6;
      this.targets.push(this.createHumanTarget(dist, xOffset));
    });
  }

  private createHumanTarget(rangeMeters: number, xOffset = 0): Target {
    const group = new THREE.Group();
    
    const width = 0.6;
    const height = 1.75;
    
    // Материал мишени (зелёный, матовый)
    const material = new THREE.MeshStandardMaterial({
      color: 0x4a6b3a,
      roughness: 0.8,
      emissive: new THREE.Color(0x111111),
      side: THREE.DoubleSide
    });
    
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    plane.position.y = height / 2; // центр плоскости по высоте
    plane.castShadow = true;
    plane.receiveShadow = false;
    group.add(plane);
    
    // Контур для видимости
    const edges = new THREE.EdgesGeometry(plane.geometry);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x2a3a1a }));
    line.position.copy(plane.position);
    group.add(line);
    
    // Невидимая коллизия
    const collisionPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    collisionPlane.position.y = height / 2;
    group.add(collisionPlane);
    (group as any).collisionMeshes = [collisionPlane];
    
    // Размещаем группу так, чтобы низ мишени был на уровне земли
    const centerY = this.groundY + height / 2; // -0.15 + 0.875 = 0.725
    group.position.set(xOffset, centerY, rangeMeters);
    
    // Поворачиваем лицом к игроку (0, 1.65, 0), но без вертикального наклона
    const targetLookAt = new THREE.Vector3(0, centerY, 0);
    group.lookAt(targetLookAt);
    
    this.scene.add(group);
    
    return {
      id: `human_${rangeMeters}_${xOffset}`,
      mesh: group,
      position: new THREE.Vector3(xOffset, centerY, rangeMeters),
      radius: Math.max(width, height) / 2,
      hits: []
    };
  }

  private spawnNewTarget(): void {
    const dist = this.distances[Math.floor(Math.random() * this.distances.length)];
    const xOffset = (Math.random() - 0.5) * 6;
    const newTarget = this.createHumanTarget(dist, xOffset);
    this.targets.push(newTarget);
  }

  private destroyTarget(target: Target): void {
    const index = this.targets.findIndex(t => t.id === target.id);
    if (index !== -1) {
      this.targets.splice(index, 1);
      this.disposeGroup(target.mesh);
    }
  }

  private resetAllTargets(): void {
    this.targets.forEach(t => this.disposeGroup(t.mesh));
    this.targets = [];
    this.init();
  }

  public getTargets(): Target[] {
    return this.targets;
  }

  private disposeGroup(group: THREE.Group): void {
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
          } catch {}
        }
      }
    }
    
    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        try { child.geometry.dispose(); } catch {}
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
