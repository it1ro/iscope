// src/game/TargetManager.ts

import * as THREE from 'three';
import { Target, GameEvent } from '../types';
import { EventBus } from './EventBus';

export class TargetManager {
  private scene: THREE.Scene;
  private targets: Target[] = [];
  private groundY = -0.15;
  private removalTimeouts = new Map<string, number>(); // target.id -> timeoutId

  private distances = [
    25, 40, 60, 80, 100, 120, 150, 180, 200, 230, 260, 290, 320, 350, 380, 400
  ];

  constructor(scene: THREE.Scene, eventBus: EventBus) {
    this.scene = scene;
    this.init();

    eventBus.on('bullet_hit', (e: Extract<GameEvent, { type: 'bullet_hit' }>) => {
      this.handleHit(e.target);
    });

    eventBus.on('reset_game', () => this.resetAllTargets());
  }

  private init(): void {
    this.targets.forEach(t => this.disposeGroup(t.mesh));
    this.targets = [];
    // Очистка всех таймеров
    this.removalTimeouts.forEach((id) => clearTimeout(id));
    this.removalTimeouts.clear();

    this.distances.forEach(dist => {
      const xOffset = (Math.random() - 0.5) * 50;
      const zOffset = (Math.random() - 0.5) * 16;
      this.targets.push(this.createHumanTarget(dist + zOffset, xOffset));
    });
  }

  private createHumanTarget(rangeMeters: number, xOffset = 0): Target {
    const group = new THREE.Group();

    // --- Материалы ---
    // Тёмно-зелёный материал (основной)
    const darkGreenMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d5a27,        // тёмно-зелёный
      roughness: 0.7,
      emissive: new THREE.Color(0x112200)
    });

    // Материал для контура (проволочный каркас)
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x3a3a2a });

    // --- Голова (сфера) ---
    const headGeo = new THREE.SphereGeometry(0.18, 16, 12);
    const headMesh = new THREE.Mesh(headGeo, darkGreenMaterial.clone()); // клон для независимого изменения цвета
    headMesh.position.y = 1.55;
    headMesh.castShadow = true;
    headMesh.receiveShadow = false;
    group.add(headMesh);

    // Контур головы
    const headEdges = new THREE.EdgesGeometry(headGeo);
    const headLine = new THREE.LineSegments(headEdges, lineMaterial);
    headLine.position.copy(headMesh.position);
    group.add(headLine);

    // --- Торс (прямоугольный бокс) ---
    const torsoWidth = 0.55;
    const torsoHeight = 1.0;
    const torsoDepth = 0.2;
    const torsoGeo = new THREE.BoxGeometry(torsoWidth, torsoHeight, torsoDepth);
    const torsoMesh = new THREE.Mesh(torsoGeo, darkGreenMaterial.clone());
    torsoMesh.position.y = 0.5 + torsoHeight/2; // центр на высоте 1.0 м
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = false;
    group.add(torsoMesh);

    // Контур торса
    const torsoEdges = new THREE.EdgesGeometry(torsoGeo);
    const torsoLine = new THREE.LineSegments(torsoEdges, lineMaterial);
    torsoLine.position.copy(torsoMesh.position);
    group.add(torsoLine);

    // --- Коллизионные меши (невидимые) ---
    const collisionMeshes: THREE.Mesh[] = [];

    const headCollision = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ visible: false }));
    headCollision.position.copy(headMesh.position);
    group.add(headCollision);
    collisionMeshes.push(headCollision);

    const torsoCollision = new THREE.Mesh(torsoGeo, new THREE.MeshBasicMaterial({ visible: false }));
    torsoCollision.position.copy(torsoMesh.position);
    group.add(torsoCollision);
    collisionMeshes.push(torsoCollision);

    (group as any).collisionMeshes = collisionMeshes;

    // Позиционирование всей группы
    const centerY = this.groundY + 0.5; // основание торса примерно на уровне земли
    group.position.set(xOffset, centerY, rangeMeters);

    // Поворот лицом к игроку (начало координат)
    const targetLookAt = new THREE.Vector3(0, centerY, 0);
    group.lookAt(targetLookAt);

    this.scene.add(group);

    const target: Target = {
      id: `human_${rangeMeters.toFixed(1)}_${xOffset.toFixed(1)}_${Date.now() + Math.random()}`,
      mesh: group,
      position: new THREE.Vector3(xOffset, centerY, rangeMeters),
      radius: 1.0, // примерный bounding sphere
      hits: [],
      isHit: false,
      planeMaterial: undefined, // больше не используется, но оставим для совместимости
    };

    // Сохраняем ссылки на материалы для смены цвета при попадании
    (group.userData as any).materials = [headMesh.material, torsoMesh.material];
    group.userData.target = target;
    collisionMeshes.forEach(cm => cm.userData.target = target);

    return target;
  }

  private handleHit(target: Target): void {
    if (target.isHit) return;
    target.isHit = true;

    // Меняем цвет всех материалов на красный
    const materials = (target.mesh.userData as any).materials as THREE.MeshStandardMaterial[];
    if (materials) {
      materials.forEach(mat => {
        mat.color.setHex(0xff0000); // красный
        mat.emissive?.setHex(0x330000);
      });
    }

    // Запускаем таймер на удаление
    const timeoutId = window.setTimeout(() => {
      this.removeTarget(target);
    }, 5000);
    this.removalTimeouts.set(target.id, timeoutId);
  }

  private removeTarget(target: Target): void {
    // Удаляем таймер из мапы
    this.removalTimeouts.delete(target.id);
    
    // Удаляем мишень из сцены и списка
    const index = this.targets.findIndex(t => t.id === target.id);
    if (index !== -1) {
      this.targets.splice(index, 1);
      this.disposeGroup(target.mesh);
    }

    // Если целей не осталось - перезапускаем игру
    if (this.targets.length === 0) {
      this.resetAllTargets();
    }
  }

  private resetAllTargets(): void {
    // Очищаем все активные таймеры удаления
    this.removalTimeouts.forEach((id) => clearTimeout(id));
    this.removalTimeouts.clear();
    
    this.targets.forEach(t => this.disposeGroup(t.mesh));
    this.targets = [];
    this.init();
  }

  public getTargets(): Target[] {
    return this.targets;
  }

  private disposeGroup(group: THREE.Group): void {
    const target = (group.userData as any).target as Target | undefined;
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
    this.removalTimeouts.forEach((id) => clearTimeout(id));
    this.removalTimeouts.clear();
    this.targets.forEach(t => this.disposeGroup(t.mesh));
    this.targets = [];
  }
}
