import * as THREE from 'three';

export class SceneManager {
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;

    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a1030);
        this.scene.fog = new THREE.FogExp2(0x0a1030, 0.008);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
        this.camera.position.set(0, 1.65, 0);
        this.camera.rotation.order = 'YXZ';

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        this.setupLights();
        this.setupEnvironment();
        window.addEventListener('resize', () => this.onWindowResize());
    }

    private setupLights(): void {
        const ambientLight = new THREE.AmbientLight(0x404060);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(10, 20, 5);
        dirLight.castShadow = true;
        dirLight.receiveShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        this.scene.add(dirLight);

        const backLight = new THREE.PointLight(0x556688, 0.4);
        backLight.position.set(-5, 5, -10);
        this.scene.add(backLight);

        const rimLight = new THREE.PointLight(0xffaa66, 0.5);
        rimLight.position.set(5, 4, -8);
        this.scene.add(rimLight);
    }

    private setupEnvironment(): void {
        const gridHelper = new THREE.GridHelper(200, 30, 0x88aaff, 0x335588);
        gridHelper.position.y = -0.05;
        gridHelper.material.transparent = true;
        gridHelper.material.opacity = 0.5;
        this.scene.add(gridHelper);

        const groundPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(180, 180),
            new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.8, metalness: 0.1, transparent: true, opacity: 0.4 })
        );
        groundPlane.rotation.x = -Math.PI / 2;
        groundPlane.position.y = -0.1;
        groundPlane.receiveShadow = true;
        this.scene.add(groundPlane);

        const rockMat = new THREE.MeshStandardMaterial({ color: 0x6a6a6a, roughness: 0.9 });
        for (let i = 0; i < 60; i++) {
            const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.3), rockMat);
            const angle = Math.random() * Math.PI * 2;
            const rad = 25 + Math.random() * 55;
            rock.position.x = Math.cos(angle) * rad;
            rock.position.z = Math.sin(angle) * rad;
            rock.position.y = -0.1 + Math.random() * 0.2;
            rock.scale.set(1, Math.random() * 0.6 + 0.4, 1);
            rock.castShadow = true;
            this.scene.add(rock);
        }

        const dustCount = 400;
        const dustGeo = new THREE.BufferGeometry();
        const dustPositions = new Float32Array(dustCount * 3);
        for (let i = 0; i < dustCount; i++) {
            dustPositions[i*3] = (Math.random() - 0.5) * 140;
            dustPositions[i*3+1] = Math.random() * 2.0;
            dustPositions[i*3+2] = (Math.random() - 0.5) * 100 + 30;
        }
        dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
        const dustMat = new THREE.PointsMaterial({ color: 0xaaccff, transparent: true, opacity: 0.2, size: 0.07 });
        const dustSystem = new THREE.Points(dustGeo, dustMat);
        this.scene.add(dustSystem);
    }

    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
