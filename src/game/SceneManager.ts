import * as THREE from 'three';

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private resizeHandler: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1030);
    this.scene.fog = new THREE.FogExp2(0x0a1030, 0.008);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 1.65, 0);
    this.camera.rotation.order = 'YXZ';

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.setupLights();
    this.setupEnvironment();

    this.resizeHandler = () => this.onWindowResize();
    window.addEventListener('resize', this.resizeHandler);
  }

  private setupLights(): void {
    this.scene.add(new THREE.AmbientLight(0x404060, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(10, 20, 5);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    this.scene.add(dir);
    const fill1 = new THREE.PointLight(0x556688, 0.4, 50);
    fill1.position.set(-5, 5, -10);
    this.scene.add(fill1);
    const fill2 = new THREE.PointLight(0xffaa66, 0.5, 40);
    fill2.position.set(5, 4, -8);
    this.scene.add(fill2);
  }

  private setupEnvironment(): void {
    const grid = new THREE.GridHelper(200, 30, 0x88aaff, 0x335588);
    grid.position.y = -0.05;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    this.scene.add(grid);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 180),
      new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.8, metalness: 0.1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6a6a6a, roughness: 0.9 });
    for (let i = 0; i < 40; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.3), rockMat);
      const angle = Math.random() * Math.PI * 2;
      const radius = 25 + Math.random() * 55;
      rock.position.set(Math.cos(angle) * radius, -0.1 + Math.random() * 0.2, Math.sin(angle) * radius);
      rock.scale.set(1, 0.4 + Math.random() * 0.6, 1);
      rock.castShadow = true;
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
  }
}
