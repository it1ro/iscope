import * as THREE from 'three';
import { Target, GameEvent } from '../types';
import { EventBus } from './EventBus';

export class TargetManager {
  private scene: THREE.Scene;
  private targets: Target[] = [];
  private readonly MAX_TARGETS = 10; // больше целей для дальних дистанций
  private texture: THREE.Texture | null = null;

  // Дистанции для мишеней (метры)
  private distances = [25, 50, 75, 100, 150, 200, 250, 300, 350, 400];

  constructor(scene: THREE.Scene, eventBus: EventBus) {
    this.scene = scene;
    this.loadTexture();
    this.init();

    eventBus.on('bullet_hit', (e: Extract<GameEvent, { type: 'bullet_hit' }>) => {
      this.destroyTarget(e.target);
      this.spawnNewTarget();
    });
    eventBus.on('reset_game', () => this.resetAllTargets());
  }

  private loadTexture(): void {
    // Создаём процедурную текстуру силуэта, если нет внешнего файла
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    
    // Фон прозрачный
    ctx.clearRect(0, 0, 128, 256);
    
    // Рисуем контур человека (простой силуэт)
    ctx.fillStyle = '#4a4a5a';
    ctx.beginPath();
    // Голова
    ctx.arc(64, 30, 18, 0, Math.PI * 2);
    ctx.fill();
    // Тело
    ctx.fillRect(44, 48, 40, 90);
    // Плечи
    ctx.beginPath();
    ctx.ellipse(64, 48, 32, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ноги
    ctx.fillRect(48, 138, 12, 70);
    ctx.fillRect(68, 138, 12, 70);
    
    this.texture = new THREE.CanvasTexture(canvas);
  }

  private init(): void {
    this.targets.forEach(t => this.disposeGroup(t.mesh));
    this.targets = [];

    // Создаём по одной мишени на каждой дистанции
    this.distances.forEach(dist => {
      // Случайное боковое смещение в пределах ±3 метра
      const xOffset = (Math.random() - 0.5) * 6;
      this.targets.push(this.createHumanTarget(dist, xOffset));
    });
  }

  private createHumanTarget(rangeMeters: number, xOffset = 0): Target {
    const group = new THREE.Group();
    
    // Размеры мишени (стандартный рост ~1.75 м, ширина плеч ~0.6 м)
    const width = 0.6;
    const height = 1.75;
    
    const material = new THREE.MeshStandardMaterial({
      map: this.texture,
      transparent: true,
      side: THREE.DoubleSide,
      color: 0xcccccc,
      roughness: 0.7,
      emissive: new THREE.Color(0x222222)
    });
    
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    plane.position.y = height / 2; // центр по высоте
    plane.castShadow = true;
    plane.receiveShadow = false;
    group.add(plane);
    
    // Добавляем невидимую коллизию (такой же меш, но не рендерится) для более точного рейкаста
    const collisionPlane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), 
      new THREE.MeshBasicMaterial({ visible: false }));
    collisionPlane.position.y = height / 2;
    group.add(collisionPlane);
    (group as any).collisionMeshes = [collisionPlane];
    
    group.position.set(xOffset, 0, rangeMeters);
    // Поворачиваем лицом к началу координат (где игрок)
    group.lookAt(new THREE.Vector3(0, height/2, 0));
    
    this.scene.add(group);
    
    return {
      id: `human_${rangeMeters}_${xOffset}`,
      mesh: group,
      position: new THREE.Vector3(xOffset, height/2, rangeMeters),
      radius: Math.max(width, height) / 2,
      hits: []
    };
  }

  private spawnNewTarget(): void {
    // Выбираем случайную дистанцию и создаём новую мишень
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
    // Удаление декалей (как было ранее)
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
    if (this.texture) this.texture.dispose();
  }
}
