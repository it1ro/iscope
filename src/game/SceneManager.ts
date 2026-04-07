// src/game/SceneManager.ts
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
    // Фон будет заменён небом, поэтому ставим null или запасной цвет
    this.scene.background = null;
    this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.005); // лёгкий туман под цвет неба

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
  this.scene.add(new THREE.AmbientLight(0x404060, 0.4));

  // Солнце за спиной игрока (светит в сторону положительной Z)
  this.sunLight = new THREE.DirectionalLight(0xfff5d1, 1.8);
  this.sunLight.position.set(0, 35, -40);      // за камерой (0,0,0)
  this.sunLight.target.position.set(0, 0, 40); // цель впереди
  this.scene.add(this.sunLight.target);
  
  this.sunLight.castShadow = true;
  this.sunLight.shadow.mapSize.set(2048, 2048);
  this.sunLight.shadow.camera.near = 1;
  this.sunLight.shadow.camera.far = 120;
  this.sunLight.shadow.camera.left = -40;
  this.sunLight.shadow.camera.right = 40;
  this.sunLight.shadow.camera.top = 40;
  this.sunLight.shadow.camera.bottom = -40;
  this.sunLight.shadow.bias = -0.0005;
  this.scene.add(this.sunLight);

  // заполняющий свет спереди, чтобы лица мишеней не были совсем чёрными
  const fillFront = new THREE.PointLight(0xccddff, 0.35, 80);
  fillFront.position.set(0, 8, 20);
  this.scene.add(fillFront);
  
  // мягкий боковой свет
  const fillSide = new THREE.PointLight(0xffaa88, 0.25, 60);
  fillSide.position.set(-15, 6, -10);
  this.scene.add(fillSide);
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
  
  // Позиция солнца в сферических координатах (сзади и сверху)
  // Y = 0.2 (немного над горизонтом), Z отрицательное для света сзади
  uniforms['sunPosition'].value.set(-0.1, 0.25, -0.85).normalize();

  // Синхронизируем направленный свет
  this.sunLight.position.copy(uniforms['sunPosition'].value.clone().multiplyScalar(100));
  this.sunLight.position.y = Math.max(15, this.sunLight.position.y);
}

  private setupGroundAndRocks(): void {
    // Базовая плоскость земли (под травой, чтобы не было просветов)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 180),
      new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.9, metalness: 0.05 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Сетка для ориентира (опционально)
    const grid = new THREE.GridHelper(200, 30, 0x88aaff, 0x446688);
    grid.position.y = -0.1;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.25;
    this.scene.add(grid);

    // Камни
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a7a7a, roughness: 0.85 });
    for (let i = 0; i < 30; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.4), rockMat);
      const angle = Math.random() * Math.PI * 2;
      const radius = 20 + Math.random() * 60;
      rock.position.set(Math.cos(angle) * radius, -0.1 + Math.random() * 0.2, Math.sin(angle) * radius);
      rock.scale.set(1, 0.4 + Math.random() * 0.8, 1);
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

    // Очистка травы
    this.grassManager?.dispose();

    // Очистка сцены
    this.scene.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      }
    });

    // Небо не требует явной очистки, но можно удалить его материал
    if (this.sky?.material) {
      (this.sky.material as THREE.Material).dispose();
    }
  }
}
