// src/game/GrassManager.ts (оптимизированная версия)

import * as THREE from 'three';

export class GrassManager {
  private scene: THREE.Scene;
  private grassMesh: THREE.InstancedMesh | null = null;
  private readonly count = 12000;        // можно увеличить после оптимизации
  private readonly radius = 150;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createGrass();
  }

  private async createGrass(): Promise<void> {
    // Загружаем готовую текстуру травинки (с альфа-каналом)
    const textureLoader = new THREE.TextureLoader();
    const texture = await textureLoader.loadAsync('/assets/images/grass_blade.png');

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.5,
      roughness: 0.9,
      vertexColors: true,            // включаем поддержку вершинных цветов
    });

    // Одиночная плоскость (2 треугольника)
    const geometry = this.createBladeGeometry();
    this.grassMesh = new THREE.InstancedMesh(geometry, material, this.count);
    this.grassMesh.castShadow = false;    // 🔥 отключаем тени от травы
    this.grassMesh.receiveShadow = true;  // но тени от других объектов принимаем

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < this.count; i++) {
      // Распределение с естественной неравномерностью (простой шум)
      const angle = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 1.5) * this.radius; // больше травы ближе к центру
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = -0.1; // чуть выше земли

      // Случайный поворот вокруг Y
      dummy.rotation.y = Math.random() * Math.PI * 2;

      // Небольшой наклон (опционально)
      dummy.rotation.x = (Math.random() - 0.5) * 0.2;
      dummy.rotation.z = (Math.random() - 0.5) * 0.2;

      // Размер: высота 0.5–1.2, ширина 0.3–0.7
      const scale = 0.6 + Math.random() * 0.8;
      dummy.scale.set(scale * (0.6 + Math.random() * 0.4), scale, 1);

      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      this.grassMesh.setMatrixAt(i, dummy.matrix);

      // Вариация цвета (оттенки зелёного)
      const hue = 0.25 + Math.random() * 0.15;          // 90°–144°
      const saturation = 0.6 + Math.random() * 0.3;     // 60–90%
      const lightness = 0.35 + Math.random() * 0.25;    // 35–60%
      color.setHSL(hue, saturation, lightness);
      this.grassMesh.setColorAt(i, color);
    }

    this.grassMesh.instanceMatrix.needsUpdate = true;
    if (this.grassMesh.instanceColor) {
      this.grassMesh.instanceColor.needsUpdate = true;
    }

    this.scene.add(this.grassMesh);
  }

  /**
   * Создаёт геометрию одиночной травинки (плоскость, обращённая вверх)
   */
  private createBladeGeometry(): THREE.BufferGeometry {
    const width = 0.3;
    const height = 1.0;

    const vertices = new Float32Array([
      -width/2, 0, 0,
       width/2, 0, 0,
       width/2, height, 0,
      -width/2, 0, 0,
       width/2, height, 0,
      -width/2, height, 0,
    ]);

    const uvs = new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 0,
      1, 1,
      0, 1,
    ]);

    // Нормали: плоскость смотрит по Z, но после поворота это не важно
    const normals = new Float32Array([
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
    ]);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

    return geometry;
  }

  public dispose(): void {
    if (this.grassMesh) {
      this.scene.remove(this.grassMesh);
      this.grassMesh.geometry.dispose();
      if (Array.isArray(this.grassMesh.material)) {
        this.grassMesh.material.forEach(m => m.dispose());
      } else {
        (this.grassMesh.material as THREE.Material).dispose();
      }
    }
  }
}
