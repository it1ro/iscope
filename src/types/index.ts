import * as THREE from 'three';

export interface Target {
  id: string;
  mesh: THREE.Group;
  position: THREE.Vector3;
  radius: number;
  // Список попаданий (точка, нормаль и ссылка на декаль, если создана)
  hits?: Array<{ point: THREE.Vector3; normal: THREE.Vector3; decalMesh?: THREE.Mesh }>;
}

export interface BulletState {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  velocity: THREE.Vector3;
  prevPosition: THREE.Vector3;
  startTime: number;
  active: boolean;
}

export type GameEvent =
  | { type: 'shoot'; startPos: THREE.Vector3; direction: THREE.Vector3 }
  | { type: 'bullet_hit'; target: Target; distance: number; hitPoint: THREE.Vector3; hitNormal: THREE.Vector3; hitObject?: THREE.Object3D }
  | { type: 'bullet_miss' }
  | { type: 'reset_game' };
