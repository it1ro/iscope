// src/game/GrassManager.ts (полный файл с изменениями)

import * as THREE from 'three';

export class GrassManager {
  private scene: THREE.Scene;
  private grassMesh: THREE.InstancedMesh | null = null;
  private count = 8000;
  private radius = 150; // 🔁 Увеличен радиус травы до 150 м

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createGrass();
  }

  private createGrass(): void {
    const bladeGroup = new THREE.Group();
    
    const plane1 = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 0.45),
      new THREE.MeshStandardMaterial({ visible: false })
    );
    plane1.rotateY(0);
    plane1.rotateX(-Math.PI / 2);
    plane1.position.y = 0.225;
    bladeGroup.add(plane1);
    
    const plane2 = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 0.45),
      new THREE.MeshStandardMaterial({ visible: false })
    );
    plane2.rotateY(Math.PI / 2);
    plane2.rotateX(-Math.PI / 2);
    plane2.position.y = 0.225;
    bladeGroup.add(plane2);

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#3a6b2a');
    grad.addColorStop(0.6, '#5c8c3c');
    grad.addColorStop(1, '#8cb06a');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 128);
    
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

    const crossGeo = this.createCrossGeometry();
    this.grassMesh = new THREE.InstancedMesh(crossGeo, material, this.count);
    this.grassMesh.castShadow = true;
    this.grassMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quat = new THREE.Quaternion();

    for (let i = 0; i < this.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * this.radius; // теперь до 150 м
      pos.x = Math.cos(angle) * r;
      pos.z = Math.sin(angle) * r;
      pos.y = -0.1;

      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
      
      const tiltAxis = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      quat.multiply(new THREE.Quaternion().setFromAxisAngle(tiltAxis, (Math.random() - 0.5) * 0.35));
      
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

  private createCrossGeometry(): THREE.BufferGeometry {
    const w = 0.15;
    const h = 0.45;
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    
    this.addPlaneVertices(vertices, normals, uvs, w, h, 0);
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
    
    const pts = [
      [-hw, 0, 0], [ hw, 0, 0], [ hw, height, 0], [-hw, height, 0]
    ];
    
    const rot = new THREE.Matrix4().makeRotationY(rotationY);
    const normal = new THREE.Vector3(0, 0, 1).applyMatrix4(rot);
    
    const indices = [0, 1, 2, 0, 2, 3];
    
    indices.forEach(idx => {
      const pt = new THREE.Vector3(pts[idx][0], pts[idx][1], pts[idx][2]);
      pt.applyMatrix4(rot);
      v.push(pt.x, pt.y, pt.z);
      n.push(normal.x, normal.y, normal.z);
      
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
