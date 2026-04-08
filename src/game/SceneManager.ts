// src/game/SceneManager.ts

import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { PMREMGenerator } from 'three';
import { GrassManager } from './GrassManager';

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private resizeHandler: () => void;
  private grassManager: GrassManager;
  private sunLight: THREE.DirectionalLight; // оставлен для динамических теней

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = null;
    // Туман, гармонирующий с вечерним HDR
    this.scene.fog = new THREE.Fog(0xaaccbb, 300, 700);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 1.65, 0);
    this.camera.rotation.order = 'YXZ';

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Настройки тонального отображения для HDR
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;   // можно регулировать под яркость конкретной карты

    // Загружаем HDR-окружение (вместо процедурного неба)
    this.loadHDRI('/assets/evening-field.hdr');

    this.setupLights();
    this.setupGroundAndRocks();
    this.grassManager = new GrassManager(this.scene);

    this.resizeHandler = () => this.onWindowResize();
    window.addEventListener('resize', this.resizeHandler);
  }

  /**
   * Загрузка HDR-карты с высоким качеством и настройкой окружения/фона.
   */
  private loadHDRI(url: string): void {
    const rgbeLoader = new RGBELoader();
    rgbeLoader.setDataType(THREE.HalfFloatType);

    const pmremGenerator = new PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader(1024);

    rgbeLoader.load(url, (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.minFilter = THREE.LinearFilter;          // без мипмапов
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;                 // 🔥 отключаем генерацию мипмапов
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        const envMap = pmremGenerator.fromEquirectangular(texture).texture;

        this.scene.environment = envMap;
        this.scene.background = envMap;
        this.scene.backgroundIntensity = 0.9;
        this.scene.environmentIntensity = 1.1;

        texture.dispose();
        pmremGenerator.dispose();

        console.log('✅ HDR-окружение загружено:', url);
    });
}

  private setupLights(): void {
    // Минимальный ambient – HDR уже даёт мягкое заполнение
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.15));

    // Основной направленный свет для теней (интенсивность снижена)
    this.sunLight = new THREE.DirectionalLight(0xfff0e0, 0.9);
    this.sunLight.position.set(20, 30, -20);
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
    const fillFront = new THREE.PointLight(0xccddff, 0.2, 100);
    fillFront.position.set(0, 5, 25);
    this.scene.add(fillFront);

    // Отражённый свет от земли (лёгкий подцвет)
    const groundBounce = new THREE.PointLight(0x6a7a5a, 0.15, 40);
    groundBounce.position.set(0, -1, 10);
    this.scene.add(groundBounce);
  }

  private setupGroundAndRocks(): void {
    // Земля с тёплым натуральным оттенком
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({
        color: 0x5c6e4a,
        roughness: 0.95,
        metalness: 0.01,
        emissive: new THREE.Color(0x111100)
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Лёгкая сетка для ориентира (едва заметная)
    const grid = new THREE.GridHelper(200, 40, 0x88aacc, 0x557799);
    grid.position.y = -0.1;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.12;
    this.scene.add(grid);

    // Камни с естественными вариациями
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
    // HDR-текстуры будут собраны сборщиком мусора, отдельных вызовов не требуется
  }
}
