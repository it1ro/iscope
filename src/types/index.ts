import * as THREE from 'three';

export interface Target {
    mesh: THREE.Group;
    radius: number;
    position: THREE.Vector3;
}

export interface BulletState {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    startTime: number;
    active: boolean;
}
