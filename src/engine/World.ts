import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Environment } from './Environment';
import { random } from './Materials';

export class World {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-15, 15, 10, -10, 0.1, 100);
  readonly renderer: THREE.WebGLRenderer;
  readonly level: Environment;
  readonly screenRight = new THREE.Vector3(0.8, 0, -0.6);
  readonly screenForward = new THREE.Vector3(-0.6, 0, -0.8);
  private readonly offset = new THREE.Vector3(15, 22, 20);
  private readonly focus = new THREE.Vector3(0, 0.2, 0);
  private readonly desiredFocus = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private readonly aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.18);
  private readonly resizeObserver: ResizeObserver;
  private readonly environmentMap: THREE.WebGLRenderTarget;
  private readonly dust: THREE.Points;
  private readonly dustOrigin: Float32Array;
  private aspect = 1;
  private elapsed = 0;
  private zoom = 1;
  private targetZoom = 1;
  private shake = 0;
  private highQuality = true;

  constructor(readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.domElement.setAttribute('aria-label', 'Escenario t\u00e1ctico 3D. Usa WASD para moverte y el rat\u00f3n para apuntar.');
    this.renderer.domElement.tabIndex = 0;
    container.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(0x171b18);
    this.scene.fog = new THREE.FogExp2(0x171b18, 0.0085);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environmentMap = pmrem.fromScene(room, 0.06);
    this.scene.environment = this.environmentMap.texture;
    this.scene.environmentIntensity = 0.14;
    room.dispose();
    pmrem.dispose();
    this.scene.add(new THREE.AmbientLight(0xd8ddce, 0.12));
    this.scene.add(new THREE.HemisphereLight(0xe1e3d7, 0x333b2d, 0.67));

    const key = new THREE.DirectionalLight(0xffeed3, 2.35);
    key.position.set(-7, 16, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -17, right: 17, top: 15, bottom: -15, near: 0.5, far: 50 });
    key.shadow.bias = -0.00015;
    key.shadow.normalBias = 0.025;
    key.shadow.radius = 3;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xa8b5a8, 0.55);
    fill.position.set(8, 8, -10);
    this.scene.add(fill);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.ShadowMaterial({ color: 0x030803, opacity: 0.32 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.56;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.level = new Environment(this.scene);

    const positions = new Float32Array(90 * 3);
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = (random() - 0.5) * 22;
      positions[i + 1] = random() * 3 + 0.2;
      positions[i + 2] = (random() - 0.5) * 15;
    }
    this.dustOrigin = positions.slice();
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0xe7dbc0, size: 0.025, transparent: true, opacity: 0.24, depthWrite: false }));
    this.scene.add(this.dust);
    this.camera.position.copy(this.focus).add(this.offset);
    this.camera.lookAt(this.focus);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.aspect = width / height;
    this.renderer.setSize(width, height);
    this.updateProjection();
  }

  private updateProjection(): void {
    const fit = this.aspect < 1.3 ? 1.3 / this.aspect : 1;
    const intro = Math.max(0, 1 - this.elapsed / 1.7) * 0.65;
    const height = (18.8 + intro) * fit / this.zoom;
    this.camera.left = -height * this.aspect / 2;
    this.camera.right = height * this.aspect / 2;
    this.camera.top = height / 2;
    this.camera.bottom = -height / 2;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, player: THREE.Vector3, active: boolean): void {
    this.elapsed += dt;
    this.zoom = THREE.MathUtils.lerp(this.zoom, this.targetZoom, 1 - Math.exp(-dt * 5));
    const follow = 0.22 + Math.max(0, this.zoom - 1) * 0.55;
    this.desiredFocus.set(active ? player.x * follow : 0, 0.22, active ? player.z * follow : 0);
    this.focus.lerp(this.desiredFocus, 1 - Math.exp(-dt * 2.5));
    this.camera.position.copy(this.focus).add(this.offset);
    if (this.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.z += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-dt * 22);
    }
    this.camera.lookAt(this.focus);
    this.camera.updateMatrixWorld();
    this.updateProjection();
    const positions = this.dust.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      positions.setY(i, this.dustOrigin[i * 3 + 1] + Math.sin(this.elapsed * 0.22 + i) * 0.16);
    }
    positions.needsUpdate = true;
  }

  pointerToWorld(clientX: number, clientY: number, target: THREE.Vector3, actors: THREE.Object3D[] = []): boolean {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(pointer, this.camera);
    const actorHit = this.raycaster.intersectObjects(actors, true)[0];
    if (actorHit) { target.copy(actorHit.point); return true; }
    return this.raycaster.ray.intersectPlane(this.aimPlane, target) !== null;
  }

  setZoom(delta: number): number {
    this.targetZoom = THREE.MathUtils.clamp(this.targetZoom + delta, 0.78, 1.65);
    return this.targetZoom;
  }

  recenter(): void { this.targetZoom = 1; }
  recoil(amount = 0.055): void { this.shake = amount; }

  setQuality(value: string): void {
    this.highQuality = value === 'high';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.highQuality ? 1.6 : 1));
    this.renderer.shadowMap.enabled = true;
    this.dust.visible = this.highQuality;
    this.renderer.toneMappingExposure = this.highQuality ? 1.18 : 1.2;
    this.resize();
  }

  render(): void { this.renderer.render(this.scene, this.camera); }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
          material.dispose();
        }
      }
      if (object instanceof THREE.Light && 'shadow' in object) {
        (object as THREE.DirectionalLight).shadow?.map?.dispose();
      }
    });
    this.environmentMap.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}