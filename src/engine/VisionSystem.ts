import * as THREE from 'three';

export class VisionSystem {
  readonly light = new THREE.SpotLight(0xffebc8, 74, 14, 0.67, 0.58, 1.6);
  readonly range = 12.5;
  readonly halfAngle = 0.6;
  enabled = true;
  private readonly raycaster = new THREE.Raycaster();
  private readonly origin = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly delta = new THREE.Vector3();
  private angle = 0;
  private readonly beam: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly volume: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly volumePositions: Float32Array;
  private readonly volumeUv: Float32Array;
  private readonly positions: Float32Array;
  private readonly uv: Float32Array;
  private readonly segments = 64;

  constructor(scene: THREE.Scene, private readonly occluders: THREE.Object3D[]) {
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048, 2048);
    this.light.shadow.camera.near = 0.15;
    this.light.shadow.camera.far = 16;
    this.light.shadow.bias = -0.0002;
    this.light.shadow.normalBias = 0.018;
    this.light.shadow.radius = 3;
    scene.add(this.light, this.light.target);

    this.positions = new Float32Array(this.segments * 9);
    this.uv = new Float32Array(this.segments * 6);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { beamColor: { value: new THREE.Color(0xffe9bb) }, beamStrength: { value: 0.14 } },
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec2 vUv; uniform vec3 beamColor; uniform float beamStrength;
        void main() {
          float edge = pow(max(0.0, sin(vUv.x * 3.14159265)), 0.75);
          float fade = pow(max(0.0, 1.0 - vUv.y), 1.75);
          gl_FragColor = vec4(beamColor, edge * fade * beamStrength);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.beam = new THREE.Mesh(geometry, material);
    this.beam.frustumCulled = false;
    this.beam.renderOrder = 2;
    scene.add(this.beam);
    this.volumePositions = new Float32Array(this.segments * 9 * 4);
    this.volumeUv = new Float32Array(this.segments * 6 * 4);
    const volumeGeometry = new THREE.BufferGeometry();
    volumeGeometry.setAttribute('position', new THREE.BufferAttribute(this.volumePositions, 3).setUsage(THREE.DynamicDrawUsage));
    volumeGeometry.setAttribute('uv', new THREE.BufferAttribute(this.volumeUv, 2).setUsage(THREE.DynamicDrawUsage));
    const volumeMaterial = material.clone();
    volumeMaterial.uniforms.beamStrength.value = 0.018;
    this.volume = new THREE.Mesh(volumeGeometry, volumeMaterial);
    this.volume.frustumCulled = false;
    this.volume.renderOrder = 3;
    scene.add(this.volume);
  }

  update(position: THREE.Vector3, angle: number): void {
    this.angle = angle;
    this.origin.copy(position).y = 1.33;
    this.direction.set(Math.sin(angle), 0, Math.cos(angle));
    this.light.position.copy(this.origin).addScaledVector(this.direction, 0.46);
    this.light.target.position.copy(this.origin).addScaledVector(this.direction, 7.5);
    this.light.target.position.y = 0.12;
    this.light.target.updateMatrixWorld();
    this.light.visible = this.beam.visible = this.volume.visible = this.enabled;
    if (!this.enabled) return;

    // Each beam edge is clipped against real geometry, preventing light spill through walls.
    const points: { x: number; z: number; distance: number }[] = [];
    const rayOrigin = this.origin.clone();
    rayOrigin.y = 0.72;
    for (let i = 0; i <= this.segments; i++) {
      const rayAngle = angle - this.halfAngle + (i / this.segments) * this.halfAngle * 2;
      this.delta.set(Math.sin(rayAngle), 0, Math.cos(rayAngle));
      this.raycaster.set(rayOrigin, this.delta);
      this.raycaster.far = this.range;
      const hit = this.raycaster.intersectObjects(this.occluders, false)[0];
      const distance = hit ? Math.max(0, hit.distance - 0.025) : this.range;
      points.push({ x: position.x + this.delta.x * distance, z: position.z + this.delta.z * distance, distance });
    }
    for (let i = 0; i < this.segments; i++) {
      const a = points[i];
      const b = points[i + 1];
      this.positions.set([position.x, 0.16, position.z, a.x, 0.145, a.z, b.x, 0.145, b.z], i * 9);
      this.uv.set([(i + 0.5) / this.segments, 0, i / this.segments, a.distance / this.range, (i + 1) / this.segments, b.distance / this.range], i * 6);
      for (let layer = 0; layer < 4; layer++) {
        const index = layer * this.segments + i;
        const ay = 0.145 + layer / 3 * Math.min(1.9, 1.25 + a.distance * 0.05);
        const by = 0.145 + layer / 3 * Math.min(1.9, 1.25 + b.distance * 0.05);
        this.volumePositions.set([position.x, 1.33, position.z, a.x, ay, a.z, b.x, by, b.z], index * 9);
        this.volumeUv.set(this.uv.subarray(i * 6, i * 6 + 6), index * 6);
      }
    }
    this.beam.geometry.attributes.position.needsUpdate = true;
    this.beam.geometry.attributes.uv.needsUpdate = true;
    this.volume.geometry.attributes.position.needsUpdate = true;
    this.volume.geometry.attributes.uv.needsUpdate = true;
  }

  canSee(position: THREE.Vector3): boolean {
    this.delta.copy(position).sub(this.origin);
    this.delta.y = 0;
    const distance = this.delta.length();
    if (distance > this.range || !this.enabled) return false;
    if (distance < 0.6) return this.hasLineOfSight(this.origin, position);
    const targetAngle = Math.atan2(this.delta.x, this.delta.z);
    const difference = Math.atan2(Math.sin(targetAngle - this.angle), Math.cos(targetAngle - this.angle));
    return Math.abs(difference) <= this.halfAngle && this.hasLineOfSight(this.origin, position);
  }

  hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const start = new THREE.Vector3(from.x, 1.28, from.z);
    const end = new THREE.Vector3(to.x, 1.28, to.z);
    this.delta.copy(end).sub(start);
    const distance = this.delta.length();
    if (distance < 0.01) return true;
    this.raycaster.set(start, this.delta.normalize());
    this.raycaster.far = Math.max(0, distance - 0.15);
    return this.raycaster.intersectObjects(this.occluders, false).length === 0;
  }

  dispose(): void {
    this.volume.geometry.dispose();
    this.volume.material.dispose();
    this.volume.removeFromParent();
    this.beam.geometry.dispose();
    this.beam.material.dispose();
    this.beam.removeFromParent();
    this.light.shadow.map?.dispose();
    this.light.removeFromParent();
    this.light.target.removeFromParent();
  }
}