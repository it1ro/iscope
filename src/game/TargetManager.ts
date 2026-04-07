import * as THREE from 'three';
import { Target, GameEvent } from '../types';
import { EventBus } from './EventBus';

export class TargetManager {
  private scene: THREE.Scene;
  private targets: Target[] = [];
  private readonly RADIUS = 0.55;
  private readonly HEIGHT = 0.6;

  constructor(scene: THREE.Scene, eventBus: EventBus) {
    this.scene = scene;
    this.init();
    eventBus.on('bullet_hit', (e) => {
      const ev = e as Extract<GameEvent, { type: 'bullet_hit' }>;
      this.relocateTarget(ev.target);
    });
  }

  private init(): void {
    this.targets.forEach(t => { this.scene.remove(t.mesh); this.disposeGroup(t.mesh); });
    this.targets = [];
    const presets = [
      { x: -8, z: 28 }, { x: 5, z: 42 }, { x: -12, z: 58 }, { x: 14, z: 72 },
      { x: -5, z: 85 }, { x: 18, z: 35 }, { x: -18, z: 65 }, { x: 0, z: 95 }
    ];
    for (let i = 0; i < 8; i++) {
      const pos = i < presets.length ? presets[i] : this.randomPos();
      this.targets.push(this.createTarget(pos.x, pos.z));
    }
  }

  private createTarget(x: number, z: number): Target {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.3, metalness: 0.1, emissive: 0x220000 });
    group.add(new THREE.Mesh(new THREE.SphereGeometry(this.RADIUS, 24, 24), mat).castShadow = true as any);
    const bull = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.8 }));
    bull.position.z = this.RADIUS * 0.95; group.add(bull);
    group.position.set(x, this.HEIGHT, z); this.scene.add(group);
    return { id: `tgt_${x}_${z}`, mesh: group, position: new THREE.Vector3(x, this.HEIGHT, z), radius: this.RADIUS };
  }

  private randomPos() { return { x: (Math.random() - 0.5) * 50, z: 20 + Math.random() * 70 }; }

  public relocateTarget(target: Target): void {
    const { x, z } = this.randomPos();
    target.mesh.position.set(x, this.HEIGHT, z);
    target.position.set(x, this.HEIGHT, z);
  }

  public getTargets(): Target[] { return this.targets; }
  private disposeGroup(g: THREE.Group): void { g.traverse(c => { if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); } }); }
  dispose(): void { this.targets.forEach(t => { this.scene.remove(t.mesh); this.disposeGroup(t.mesh); }); this.targets = []; }
}
