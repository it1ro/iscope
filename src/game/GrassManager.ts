// src/game/GrassManager.ts

import * as THREE from 'three';

export class GrassManager {
  private scene: THREE.Scene;
  private grassMesh: THREE.InstancedMesh | null = null;
  private readonly count = 6000;
  private readonly radius = 260;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createGrass();
  }

  private async createGrass(): Promise<void> {
    const textureLoader = new THREE.TextureLoader();
    const texture = await textureLoader.loadAsync('/assets/images/grass_blade.png');

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.5,
      roughness: 0.9,
      vertexColors: true,
    });

    const geometry = this.createBladeGeometry();
    this.grassMesh = new THREE.InstancedMesh(geometry, material, this.count);
    this.grassMesh.castShadow = false;
    this.grassMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < this.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 1.5) * this.radius;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      const y = -0.1 + (Math.random() - 0.5) * 0.04;

      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.rotation.x = (Math.random() - 0.5) * 0.1;
      dummy.rotation.z = (Math.random() - 0.5) * 0.1;

      const heightScale = 0.45 + Math.random() * 0.75;
      const widthScale = 0.4 + Math.random() * 0.5;

      dummy.scale.set(widthScale, heightScale, 1);
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      this.grassMesh.setMatrixAt(i, dummy.matrix);

      // Более светлые оттенки травы
      const hue = 0.24 + Math.random() * 0.18;
      const saturation = 0.5 + Math.random() * 0.45;
      const lightness = 0.45 + Math.random() * 0.35; // было 0.3+0.4
      color.setHSL(hue, saturation, lightness);
      this.grassMesh.setColorAt(i, color);
    }

    this.grassMesh.instanceMatrix.needsUpdate = true;
    if (this.grassMesh.instanceColor) {
      this.grassMesh.instanceColor.needsUpdate = true;
    }

    this.scene.add(this.grassMesh);
  }

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
