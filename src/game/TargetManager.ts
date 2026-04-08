// src/game/TargetManager.ts

import * as THREE from 'three';
import { Target, GameEvent } from '../types';
import { EventBus } from './EventBus';

export class TargetManager {
  private scene: THREE.Scene;
  private targets: Target[] = [];
  private groundY = -0.15;

  // Расширенный набор дистанций до 650 м
  private distances = [
    25, 40, 60, 80, 100, 120, 150, 180, 200, 230, 260, 290, 320, 350, 380, 400
  ];

  constructor(scene: THREE.Scene, eventBus: EventBus) {
    this.scene = scene;
    this.init();

    eventBus.on('bullet_hit', (e: Extract<GameEvent, { type: 'bullet_hit' }>) => {
      this.destroyTarget(e.target);
      if (this.targets.length === 0) {
        this.resetAllTargets();
      }
    });
    eventBus.on('reset_game', () => this.resetAllTargets());
  }

  private init(): void {
    this.targets.forEach(t => this.disposeGroup(t.mesh));
    this.targets = [];

    // Создаём цель на каждую дистанцию с большим случайным боковым смещением
    this.distances.forEach(dist => {
      // Случайное смещение по X от -10 до +10 метров
      const xOffset = (Math.random() - 0.5) * 20;
      // Небольшое дополнительное смещение по Z, чтобы цели не стояли строго на одной линии
      const zOffset = (Math.random() - 0.5) * 5;
      this.targets.push(this.createHumanTarget(dist + zOffset, xOffset));
    });
  }

  private createHumanTarget(rangeMeters: number, xOffset = 0): Target {
    const group = new THREE.Group();
    
    const width = 0.6;
    const height = 1.75;
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x4a6b3a,
      roughness: 0.8,
      emissive: new THREE.Color(0x111111),
      side: THREE.DoubleSide
    });
    
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    plane.position.y = height / 2;
    plane.castShadow = true;
    plane.receiveShadow = false;
    group.add(plane);
    
    const edges = new THREE.EdgesGeometry(plane.geometry);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x2a3a1a }));
    line.position.copy(plane.position);
    group.add(line);
    
    const collisionPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    collisionPlane.position.y = height / 2;
    group.add(collisionPlane);
    (group as any).collisionMeshes = [collisionPlane];
    
    const centerY = this.groundY + height / 2;
    group.position.set(xOffset, centerY, rangeMeters);
    
    // Поворот к игроку
    const targetLookAt = new THREE.Vector3(0, centerY, 0);
    group.lookAt(targetLookAt);
    
    this.scene.add(group);
    
    return {
      id: `human_${rangeMeters.toFixed(1)}_${xOffset.toFixed(1)}_${Date.now() + Math.random()}`,
      mesh: group,
      position: new THREE.Vector3(xOffset, centerY, rangeMeters),
      radius: Math.max(width, height) / 2,
      hits: []
    };
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
