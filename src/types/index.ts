import * as THREE from 'three';

export interface Target {
  id: string;
  mesh: THREE.Group;
  position: THREE.Vector3;
  radius: number;
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
  | { type: 'bullet_hit'; target: Target; distance: number }
  | { type: 'bullet_miss' };
