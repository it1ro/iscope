import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry';

/**
 * DecalManager
 * Создаёт "постоянные" следы попаданий (декали) на мешах.
 * Требует three/examples/jsm/geometries/DecalGeometry в сборке.
 */
export class DecalManager {
  private scene: THREE.Scene;
  private decalTexture: THREE.Texture;
  private baseMaterial: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene, decalTextureUrl = '/assets/bullet_hole.png') {
    this.scene = scene;
    this.decalTexture = new THREE.TextureLoader().load(decalTextureUrl);
    this.baseMaterial = new THREE.MeshStandardMaterial({
      map: this.decalTexture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4
    });
  }

  /**
   * Создать декаль на конкретном меше.
   * @param targetMesh - меш, на который наносится декаль (hit.object)
   * @param point - world-space позиция попадания
   * @param normal - world-space нормаль поверхности в точке попадания
   * @param size - диаметр декали в метрах
   */
  public createDecal(targetMesh: THREE.Mesh, point: THREE.Vector3, normal: THREE.Vector3, size = 0.12): THREE.Mesh {
    // ориентация: создаём quaternion, который направляет локальную +Z в сторону нормали
    const up = new THREE.Vector3(0, 0, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(up, normal.clone().normalize());
    const euler = new THREE.Euler().setFromQuaternion(q);

    // DecalGeometry принимает position, orientation (Euler) и size (Vector3)
    const decalGeom = new DecalGeometry(targetMesh, point, euler, new THREE.Vector3(size, size, size));
    const mat = this.baseMaterial.clone();
    const decalMesh = new THREE.Mesh(decalGeom, mat);
    decalMesh.renderOrder = 999;
    this.scene.add(decalMesh);
    return decalMesh;
  }

  public removeDecal(mesh: THREE.Mesh): void {
    if (!mesh) return;
    try {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const mat = mesh.material as any;
        if (Array.isArray(mat)) mat.forEach((m: THREE.Material) => m.dispose());
        else mat.dispose();
      }
      if (mesh.parent) mesh.parent.remove(mesh);
    } catch (err) {
      // ignore
    }
  }

  public dispose(): void {
    // базовый материал и текстура
    try {
      if (this.baseMaterial.map) this.baseMaterial.map.dispose();
      this.baseMaterial.dispose();
    } catch {}
  }
}
