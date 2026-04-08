// src/game/SceneManager.ts (полный файл с изменениями)

import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky';
import { GrassManager } from './GrassManager';

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private resizeHandler: () => void;
  private grassManager: GrassManager;
  private sky: Sky;
  private sunLight: THREE.DirectionalLight;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = null;
    // 🔁 Заменён экспоненциальный туман на линейный (видимость 300–600 м)
    this.scene.fog = new THREE.Fog(0x87CEEB, 300, 600);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 1.65, 0);
    this.camera.rotation.order = 'YXZ';

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.setupLights();
    this.setupSky();
    this.setupGroundAndRocks();
    this.grassManager = new GrassManager(this.scene);

    this.resizeHandler = () => this.onWindowResize();
    window.addEventListener('resize', this.resizeHandler);
  }

  private setupLights(): void {
  // Тёплое ambient освещение
  this.scene.add(new THREE.AmbientLight(0xfff5e6, 0.7));

  // Солнце – основной направленный свет
  this.sunLight = new THREE.DirectionalLight(0xfff0e0, 2.2);
  this.sunLight.position.set(60, 35, -70); // будет перезаписано в setupSky
  this.sunLight.target.position.set(0, 0, 30);
  this.scene.add(this.sunLight.target);
  
  this.sunLight.castShadow = true;
  this.sunLight.shadow.mapSize.set(2048, 2048);
  this.sunLight.shadow.camera.near = 1;
  this.sunLight.shadow.camera.far = 150;
  this.sunLight.shadow.camera.left = -50;
  this.sunLight.shadow.camera.right = 50;
  this.sunLight.shadow.camera.top = 50;
  this.sunLight.shadow.camera.bottom = -50;
  this.sunLight.shadow.bias = -0.0003;
  this.scene.add(this.sunLight);

  // Мягкий заполняющий свет спереди
  const fillFront = new THREE.PointLight(0xccddff, 0.3, 100);
  fillFront.position.set(0, 5, 25);
  this.scene.add(fillFront);

  // Отражённый свет от земли (снизу)
  const groundBounce = new THREE.PointLight(0x6a7a5a, 0.2, 40);
  groundBounce.position.set(0, -1, 10);
  this.scene.add(groundBounce);
}

  private setupSky(): void {
    this.sky = new Sky();
    this.sky.scale.setScalar(450);
    this.scene.add(this.sky);

    const uniforms = this.sky.material.uniforms;
    uniforms['turbidity'].value = 6;
    uniforms['rayleigh'].value = 1.8;
    uniforms['mieCoefficient'].value = 0.005;
    uniforms['mieDirectionalG'].value = 0.7;
    
    uniforms['sunPosition'].value.set(-0.1, 0.25, -0.85).normalize();

    this.sunLight.position.copy(uniforms['sunPosition'].value.clone().multiplyScalar(100));
    this.sunLight.position.y = Math.max(15, this.sunLight.position.y);
  }

  private setupGroundAndRocks(): void {
  // Основная земля – тёплый натуральный цвет
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ 
      color: 0x5c6e4a,       // оливково-коричневый
      roughness: 0.95, 
      metalness: 0.01,
      emissive: new THREE.Color(0x111100) // лёгкое тепло от земли
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.15;
  ground.receiveShadow = true;
  this.scene.add(ground);

  // Опционально: лёгкая сетка для ощущения масштаба (очень прозрачная)
  const grid = new THREE.GridHelper(200, 40, 0x88aacc, 0x557799);
  grid.position.y = -0.1;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.15;
  this.scene.add(grid);

  // Камни – немного теплее и разнообразнее
  const rockMat = new THREE.MeshStandardMaterial({ 
    color: 0x9a8a7a, 
    roughness: 0.9,
    emissive: new THREE.Color(0x221100)
  });
  for (let i = 0; i < 30; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.5), rockMat);
    const angle = Math.random() * Math.PI * 2;
    const radius = 20 + Math.random() * 130;
    rock.position.set(Math.cos(angle) * radius, -0.1 + Math.random() * 0.3, Math.sin(angle) * radius);
    rock.scale.set(1, 0.5 + Math.random() * 0.9, 1);
    rock.castShadow = true;
    rock.receiveShadow = true;
    this.scene.add(rock);
  }
}

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public dispose(): void {
    this.renderer.dispose();
    window.removeEventListener('resize', this.resizeHandler);
    this.grassManager?.dispose();
    this.scene.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      }
    });
    if (this.sky?.material) {
      (this.sky.material as THREE.Material).dispose();
    }
  }
}
