import * as THREE from 'three';

export class GrassManager {
  private scene: THREE.Scene;
  private grassMesh: THREE.InstancedMesh | null = null;
  private count = 5000;
  private radius = 80; // метров

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createGrass();
  }

  private createGrass(): void {
    // Создаём геометрию одной травинки (плоскость, повёрнутая в двух направлениях)
    const bladeGeom = new THREE.PlaneGeometry(0.12, 0.35);
    // Поворачиваем так, чтобы она была вертикальной
    bladeGeom.rotateX(-Math.PI / 2);
    bladeGeom.translate(0, 0.175, 0);

    // Материал с прозрачностью и текстурой травы (или цветом)
    const texture = new THREE.CanvasTexture(this.generateBladeTexture());
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.5,
      roughness: 0.8,
    });

    this.grassMesh = new THREE.InstancedMesh(bladeGeom, material, this.count);
    this.grassMesh.castShadow = true;
    this.grassMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3(1, 1, 1);
    const quaternion = new THREE.Quaternion();

    for (let i = 0; i < this.count; i++) {
      // Равномерное распределение в круге
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * this.radius;
      position.x = Math.cos(angle) * r;
      position.z = Math.sin(angle) * r;
      position.y = -0.05; // немного утопим в землю

      // Случайный поворот вокруг вертикальной оси
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
      // Небольшой наклон
      quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (Math.random() - 0.5) * 0.3)
      );

      // Разный размер
      const s = 0.7 + Math.random() * 0.8;
      scale.set(s, s * (0.8 + Math.random() * 0.7), s);

      dummy.position.copy(position);
      dummy.quaternion.copy(quaternion);
      dummy.scale.copy(scale);
      dummy.updateMatrix();
      this.grassMesh.setMatrixAt(i, dummy.matrix);
    }

    this.grassMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.grassMesh);
  }

  private generateBladeTexture(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, '#5a8c4a');
    grad.addColorStop(0.7, '#3d6b2e');
    grad.addColorStop(1, '#2c4f1e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 64);
    // Добавим немного шума для реалистичности
    return canvas;
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
