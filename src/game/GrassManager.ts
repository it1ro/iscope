import * as THREE from 'three';

export class GrassManager {
  private scene: THREE.Scene;
  private grassMesh: THREE.InstancedMesh | null = null;
  private count = 8000;         // больше травинок
  private radius = 85;          // метров

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createGrass();
  }

  private createGrass(): void {
    // Создаём крестообразную геометрию из двух плоскостей
    const bladeGroup = new THREE.Group();
    
    // Первая плоскость
    const plane1 = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 0.45),
      new THREE.MeshStandardMaterial({ visible: false })
    );
    plane1.rotateY(0);
    plane1.rotateX(-Math.PI / 2);
    plane1.position.y = 0.225;
    bladeGroup.add(plane1);
    
    // Вторая плоскость, повёрнутая на 90°
    const plane2 = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 0.45),
      new THREE.MeshStandardMaterial({ visible: false })
    );
    plane2.rotateY(Math.PI / 2);
    plane2.rotateX(-Math.PI / 2);
    plane2.position.y = 0.225;
    bladeGroup.add(plane2);

    // Создаём текстуру травы с альфа-каналом (градиент к прозрачности вверху)
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    
    // Градиент от тёмно-зелёного к светло-зелёному
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#3a6b2a');
    grad.addColorStop(0.6, '#5c8c3c');
    grad.addColorStop(1, '#8cb06a');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 128);
    
    // Альфа-канал: прозрачность в верхней части
    const imageData = ctx.getImageData(0, 0, 64, 128);
    const data = imageData.data;
    for (let y = 0; y < 128; y++) {
      const alpha = y < 80 ? 255 : Math.max(0, 255 - (y - 80) * 8);
      for (let x = 0; x < 64; x++) {
        const i = (y * 64 + x) * 4;
        data[i + 3] = alpha;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.3,
      roughness: 0.85,
      emissive: new THREE.Color(0x112211),
      emissiveIntensity: 0.1
    });

    // Извлекаем геометрию из группы (объединять не будем, используем Group для инстансинга нельзя,
    // поэтому создадим инстансы двух плоскостей отдельно, но для простоты сделаем инстансинг одной
    // геометрии — просто используем две отдельные InstancedMesh, но для экономии возьмём одну
    // геометрию с крестом через BufferGeometry вручную)
    
    // Более простой путь: сделать инстансинг одной геометрии "креста", объединив вершины
    const crossGeo = this.createCrossGeometry();
    this.grassMesh = new THREE.InstancedMesh(crossGeo, material, this.count);
    this.grassMesh.castShadow = true;
    this.grassMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quat = new THREE.Quaternion();

    for (let i = 0; i < this.count; i++) {
      // Равномерное распределение в круге
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * this.radius;
      pos.x = Math.cos(angle) * r;
      pos.z = Math.sin(angle) * r;
      pos.y = -0.1; // лёгкое заглубление

      // Случайный поворот вокруг Y
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
      
      // Наклон в случайную сторону (до 20 градусов)
      const tiltAxis = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      quat.multiply(new THREE.Quaternion().setFromAxisAngle(tiltAxis, (Math.random() - 0.5) * 0.35));
      
      // Размер: вариация высоты и толщины
      const heightScale = 0.7 + Math.random() * 1.0;
      const widthScale = 0.8 + Math.random() * 0.6;
      scale.set(widthScale, heightScale, widthScale);

      dummy.position.copy(pos);
      dummy.quaternion.copy(quat);
      dummy.scale.copy(scale);
      dummy.updateMatrix();
      this.grassMesh.setMatrixAt(i, dummy.matrix);
    }

    this.grassMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.grassMesh);
  }

  // Создаёт геометрию в форме креста (две плоскости)
  private createCrossGeometry(): THREE.BufferGeometry {
    const w = 0.15;
    const h = 0.45;
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    
    // Первая плоскость (вдоль X)
    this.addPlaneVertices(vertices, normals, uvs, w, h, 0);
    // Вторая плоскость (вдоль Z)
    this.addPlaneVertices(vertices, normals, uvs, w, h, Math.PI / 2);
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    return geo;
  }
  
  private addPlaneVertices(
    v: number[], n: number[], uv: number[],
    width: number, height: number, rotationY: number
  ): void {
    const hw = width / 2;
    const hh = height / 2;
    
    // Вершины в локальной плоскости (центр в (0, hh, 0))
    const pts = [
      [-hw, 0, 0], [ hw, 0, 0], [ hw, height, 0], [-hw, height, 0]
    ];
    
    const rot = new THREE.Matrix4().makeRotationY(rotationY);
    const normal = new THREE.Vector3(0, 0, 1).applyMatrix4(rot);
    
    // Индексы для двух треугольников
    const indices = [0, 1, 2, 0, 2, 3];
    
    indices.forEach(idx => {
      const pt = new THREE.Vector3(pts[idx][0], pts[idx][1], pts[idx][2]);
      pt.applyMatrix4(rot);
      v.push(pt.x, pt.y, pt.z);
      n.push(normal.x, normal.y, normal.z);
      
      // UV: по X и Y
      if (idx === 0) uv.push(0, 0);
      else if (idx === 1) uv.push(1, 0);
      else if (idx === 2) uv.push(1, 1);
      else if (idx === 3) uv.push(0, 1);
    });
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
