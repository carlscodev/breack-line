import * as THREE from 'three';

interface Tracer { line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>; age: number }
interface Impact { mesh: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>; velocities: THREE.Vector3[]; age: number }

export class Effects {
  private readonly tracers: Tracer[] = [];
  private readonly impacts: Impact[] = [];
  private readonly flash = new THREE.PointLight(0xffdeb0, 0, 4.5, 2);
  private readonly flare: THREE.Sprite;
  private flashTime = 0;

  constructor(private readonly scene: THREE.Scene) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, '#fffbea');
    gradient.addColorStop(0.13, '#ffe4a3');
    gradient.addColorStop(0.38, 'rgba(255,184,80,.5)');
    gradient.addColorStop(1, 'rgba(255,184,80,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    this.flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.flare.scale.setScalar(0.48);
    this.flare.visible = false;
    scene.add(this.flash, this.flare);
  }

  shot(from: THREE.Vector3, to: THREE.Vector3, hostile = false): void {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]), new THREE.LineBasicMaterial({
      color: hostile ? 0xbca37b : 0xffedbb, transparent: true, opacity: 0.88,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.scene.add(line);
    this.tracers.push({ line, age: 0 });
    this.flash.position.copy(from);
    this.flash.intensity = hostile ? 11 : 23;
    this.flare.position.copy(from);
    this.flare.visible = true;
    this.flashTime = 0.036;
  }

  impact(point: THREE.Vector3, body = false): void {
    const positions = new Float32Array(8 * 3);
    const velocities: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) {
      positions.set([point.x, point.y, point.z], i * 3);
      velocities.push(new THREE.Vector3((Math.random() - 0.5) * 3.5, Math.random() * 2, (Math.random() - 0.5) * 3.5));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mesh = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: body ? 0x938878 : 0xe1c899, size: body ? 0.048 : 0.028,
      transparent: true, opacity: 0.85, depthWrite: false,
    }));
    this.scene.add(mesh);
    this.impacts.push({ mesh, velocities, age: 0 });
  }

  update(dt: number): void {
    this.flashTime = Math.max(0, this.flashTime - dt);
    if (this.flashTime === 0) { this.flash.intensity = 0; this.flare.visible = false; }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tracer = this.tracers[i];
      tracer.age += dt;
      tracer.line.material.opacity = Math.max(0, 1 - tracer.age / 0.08);
      if (tracer.age > 0.08) {
        tracer.line.removeFromParent(); tracer.line.geometry.dispose(); tracer.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const impact = this.impacts[i];
      impact.age += dt;
      const positions = impact.mesh.geometry.attributes.position;
      impact.velocities.forEach((velocity, index) => {
        velocity.y -= dt * 6;
        positions.setXYZ(index, positions.getX(index) + velocity.x * dt, positions.getY(index) + velocity.y * dt, positions.getZ(index) + velocity.z * dt);
      });
      positions.needsUpdate = true;
      impact.mesh.material.opacity = Math.max(0, 0.85 - impact.age * 2.5);
      if (impact.age > 0.34) {
        impact.mesh.removeFromParent(); impact.mesh.geometry.dispose(); impact.mesh.material.dispose();
        this.impacts.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (const { line } of this.tracers) { line.removeFromParent(); line.geometry.dispose(); line.material.dispose(); }
    for (const { mesh } of this.impacts) { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose(); }
    this.tracers.length = this.impacts.length = 0;
    this.flash.intensity = 0;
    this.flare.visible = false;
  }

  dispose(): void {
    this.clear();
    this.flare.material.map?.dispose(); this.flare.material.dispose();
    this.flare.removeFromParent(); this.flash.removeFromParent();
  }
}