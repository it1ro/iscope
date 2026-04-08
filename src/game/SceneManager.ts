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
  private sunLight: THREE.DirectionalLight;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.scene.fog = new THREE.Fog(0xd4e0d0, 400, 900); // адаптировано под большую карту

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 800);
    this.camera.position.set(0, 1.65, 0);
    this.camera.rotation.order = 'YXZ';

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.8;

    this.loadHDRI('/assets/evening-field.hdr');

    this.setupLights();
    this.setupGroundAndRocks();
    this.grassManager = new GrassManager(this.scene);

    this.resizeHandler = () => this.onWindowResize();
    window.addEventListener('resize', this.resizeHandler);
  }

  private loadHDRI(url: string): void {
    const rgbeLoader = new RGBELoader();
    rgbeLoader.setDataType(THREE.HalfFloatType);

    const pmremGenerator = new PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader(1024);

    rgbeLoader.load(url, (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;

      const envMap = pmremGenerator.fromEquirectangular(texture).texture;

      this.scene.environment = envMap;
      this.scene.background = envMap;
      this.scene.backgroundIntensity = 1.2;
      this.scene.environmentIntensity = 1.5;

      texture.dispose();
      pmremGenerator.dispose();

      console.log('✅ HDR-окружение загружено:', url);
    });
  }

  private setupLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    this.sunLight = new THREE.DirectionalLight(0xfff5e6, 1.1);
    this.sunLight.position.set(30, 40, -30);
    this.sunLight.target.position.set(0, 0, 40);
    this.scene.add(this.sunLight.target);

    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 250;
    this.sunLight.shadow.camera.left = -80;
    this.sunLight.shadow.camera.right = 80;
    this.sunLight.shadow.camera.top = 80;
    this.sunLight.shadow.camera.bottom = -80;
    this.sunLight.shadow.bias = -0.0003;
    this.scene.add(this.sunLight);

    const fillFront = new THREE.PointLight(0xccddff, 0.25, 150);
    fillFront.position.set(0, 5, 35);
    this.scene.add(fillFront);

    const fillFront2 = new THREE.PointLight(0xffeedd, 0.4, 120);
    fillFront2.position.set(8, 5, 30);
    this.scene.add(fillFront2);

    const groundBounce = new THREE.PointLight(0x7a8a6a, 0.2, 60);
    groundBounce.position.set(0, -1, 15);
    this.scene.add(groundBounce);
  }

  private setupGroundAndRocks(): void {
    // Увеличенная плоскость (350x350)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(350, 350),
      new THREE.MeshStandardMaterial({
        color: 0x6a7e5a,
        roughness: 0.95,
        metalness: 0.01,
        emissive: new THREE.Color(0x222200)
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(350, 70, 0xaaccdd, 0x6688aa);
    grid.position.y = -0.1;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.1;
    this.scene.add(grid);

    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x9a8a7a,
      roughness: 0.9,
      emissive: new THREE.Color(0x332200)
    });
    for (let i = 0; i < 45; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.6), rockMat);
      const angle = Math.random() * Math.PI * 2;
      const radius = 30 + Math.random() * 220;
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
  }
}
