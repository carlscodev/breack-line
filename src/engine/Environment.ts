import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createMaterials, contactTexture, random, type LevelMaterials } from './Materials';
import { WALLS } from './types';

export interface Collider { minX: number; maxX: number; minZ: number; maxZ: number }

export class Environment {
  readonly group = new THREE.Group();
  readonly solids: THREE.Object3D[] = [];
  readonly colliders: Collider[] = [];
  readonly materials: LevelMaterials = createMaterials();
  readonly extraction = new THREE.Group();
  private readonly contactMap = contactTexture();

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.buildStructure();
    this.buildLivingRoom();
    this.buildOffice();
    this.buildBedroom();
    this.buildKitchen();
    this.buildDetails();
    this.group.updateMatrixWorld(true);
    this.batchStaticGeometry();
  }

  private batchStaticGeometry(): void {
    const batches = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[]; cast: boolean; receive: boolean }>();
    const originals: THREE.Mesh[] = [];
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material) || object.parent === this.extraction) return;
      const key = `${object.material.uuid}-${object.castShadow}-${object.receiveShadow}`;
      if (!batches.has(key)) batches.set(key, { material: object.material, geometries: [], cast: object.castShadow, receive: object.receiveShadow });
      let geometry = object.geometry.clone();
      if (geometry.index) geometry = geometry.toNonIndexed();
      geometry.applyMatrix4(object.matrixWorld);
      batches.get(key)!.geometries.push(geometry);
      originals.push(object);
    });
    // Keep the original, world-transformed collision meshes for raycasting only.
    for (const mesh of originals) mesh.removeFromParent();
    for (const batch of batches.values()) {
      const geometry = mergeGeometries(batch.geometries, false);
      if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, batch.material);
      mesh.castShadow = batch.cast; mesh.receiveShadow = batch.receive;
      this.group.add(mesh);
      for (const part of batch.geometries) part.dispose();
    }
  }

  private box(x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, radius = 0): THREE.Mesh {
    const geometry = radius > 0
      ? new RoundedBoxGeometry(w, h, d, 2, radius)
      : new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  private solid(mesh: THREE.Mesh, x: number, z: number, w: number, d: number): void {
    this.solids.push(mesh);
    this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }

  private contact(x: number, z: number, w: number, d: number, y?: number): void {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({
      map: this.contactMap, transparent: true, depthWrite: false, opacity: 0.65,
    }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y ?? (z < -0.8 && (x < -2 || x > 3) ? 0.119 : 0.075), z);
    this.group.add(mesh);
  }

  private buildStructure(): void {
    const m = this.materials;
    this.box(0, -0.27, 0, 20.55, 0.52, 13.55, m.dark, 0.05);
    this.box(0, -0.035, 0, 20.3, 0.16, 13.3, m.concrete);
    for (let x = -9.5; x < 10; x += 1) {
      for (let z = -6; z < 6.5; z += 1) {
        this.box(x, 0.052, z, 0.985, 0.024, 0.985, m.floor).castShadow = false;
      }
    }
    this.box(-6, 0.085, -3.65, 7.8, 0.035, 5.45, m.timberFloor);
    this.box(6.5, 0.087, -3.65, 6.8, 0.04, 5.45, m.timberFloor);
    // Thin joints keep the flooring at architectural scale, rather than a game-board grid.
    for (let x = -9.85; x < -2; x += 0.36) {
      this.box(x, 0.11, -3.65, 0.014, 0.005, 5.45, m.dark).castShadow = false;
    }
    for (let x = 3.15; x < 9.9; x += 0.36) {
      this.box(x, 0.113, -3.65, 0.012, 0.005, 5.45, m.dark).castShadow = false;
    }
    for (const wall of WALLS) {
      const mesh = this.box(wall.x, wall.h / 2 + 0.06, wall.z, wall.w, wall.h, wall.d, m.wall);
      this.solid(mesh, wall.x, wall.z, wall.w, wall.d);
      if (wall.h < 2.3) {
        // Camera-facing walls are cut away visually, not for ballistics or visibility.
        const occluder = new THREE.Mesh(new THREE.BoxGeometry(wall.w, 2.35, wall.d), m.wall);
        occluder.position.set(wall.x, 1.235, wall.z);
        occluder.updateMatrixWorld(true);
        this.solids[this.solids.length - 1] = occluder;
      }
      this.box(wall.x, wall.h + 0.07, wall.z, wall.w + 0.035, 0.055, wall.d + 0.035, m.cap);
      this.box(wall.x, 0.13, wall.z, wall.w + 0.026, 0.14, wall.d + 0.025, m.dark);
    }
    // Open door leaves and flush steel thresholds make the circulation legible.
    this.door(-6.78, -0.8, 0);
    this.door(-2, -2.27, Math.PI / 2);
    this.door(3, -2.26, 0);
    this.door(7.05, -0.8, 0);
    this.door(-2, 3.55, Math.PI / 2);
    this.box(-5.95, 0.075, 6.45, 2.3, 0.06, 0.42, m.steel);
    for (let i = 0; i < 3; i++) {
      this.box(-5.95, -0.08 - i * 0.09, 6.8 + i * 0.26, 2.35, 0.12, 0.33, m.concrete);
    }
    this.contact(0, 0, 23, 16, -0.525);
  }

  private door(x: number, z: number, rotation: number): void {
    const door = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.85, 0.08), this.materials.walnut);
    panel.position.set(0.62, 0.99, 0);
    panel.castShadow = panel.receiveShadow = true;
    door.add(panel);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.08), this.materials.steel);
    handle.position.set(1.06, 0.99, 0.08);
    door.add(handle);
    door.position.set(x, 0, z);
    door.rotation.y = rotation + 1.32;
    this.group.add(door);
    door.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(panel);
    this.solids.push(panel);
    this.colliders.push({ minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z });
  }

  private buildLivingRoom(): void {
    const m = this.materials;
    this.box(-6.25, 0.083, 2.6, 5.8, 0.03, 4.0, m.fabric);
    this.contact(-8.25, 2.2, 2.2, 4.0, 0.105);
    const sofa = this.box(-8.55, 0.43, 2.1, 1.28, 0.58, 3.5, m.leather, 0.1);
    this.solid(sofa, -8.55, 2.1, 1.5, 3.7);
    this.box(-9.06, 0.83, 2.1, 0.24, 0.9, 3.5, m.leather, 0.075);
    for (const z of [0.47, 3.73]) this.box(-8.48, 0.69, z, 1.35, 0.65, 0.24, m.leather, 0.07);
    for (let i = 0; i < 3; i++) {
      this.box(-8.43, 0.78, 0.98 + i * 1.08, 0.94, 0.17, 1.0, m.fabric, 0.07);
      const cushion = this.box(-8.78, 1.02, 0.98 + i * 1.08, 0.2, 0.56, 0.94, m.fabric, 0.06);
      cushion.rotation.z = -0.13;
    }
    this.contact(-5.85, 2.15, 3.1, 2.0, 0.107);
    const table = this.box(-5.85, 0.52, 2.15, 2.5, 0.15, 1.2, m.walnut, 0.035);
    this.solid(table, -5.85, 2.15, 2.5, 1.2);
    for (const x of [-6.8, -4.9]) this.box(x, 0.3, 2.15, 0.075, 0.47, 1.0, m.metal);
    this.box(-6.0, 0.63, 2.1, 0.63, 0.065, 0.44, m.paper).rotation.y = -0.16;
    this.box(-5.85, 0.67, 2.12, 0.57, 0.035, 0.4, m.dark).rotation.y = 0.12;
    this.vessel(-5.12, 0.6, 2.1, 0.11, 0.14);
    this.chair(-4.3, 4.05, -0.35, true);
    const console = this.box(-4.4, 0.42, 5.87, 3.1, 0.7, 0.65, m.walnut, 0.035);
    this.solid(console, -4.4, 5.87, 3.1, 0.65);
    this.box(-4.4, 0.78, 5.87, 3.18, 0.05, 0.7, m.dark);
    this.plant(-9.0, 5.45, 1.4);
    this.plant(-3.1, 0.08, 1.0);
    this.floorLamp(-8.85, 4.7);
  }

  private buildOffice(): void {
    const m = this.materials;
    this.contact(-6.1, -3.8, 5.6, 3.3, 0.12);
    const table = this.box(-6.1, 0.88, -3.8, 4.6, 0.16, 1.7, m.walnut, 0.06);
    this.solid(table, -6.1, -3.8, 4.6, 1.7);
    for (const x of [-7.6, -4.6]) this.box(x, 0.48, -3.8, 0.1, 0.82, 1.3, m.metal);
    for (const x of [-7.65, -6.15, -4.65]) {
      this.chair(x, -5.2, 0);
      this.chair(x, -2.4, Math.PI);
    }
    this.laptop(-5.35, 0.99, -3.85, 0);
    this.box(-7.25, 1.0, -3.8, 0.65, 0.04, 0.5, m.paper).rotation.y = 0.12;
    this.vessel(-6.6, 0.96, -4.0, 0.09, 0.15);
    const cabinet = this.box(-5.5, 0.51, -6.0, 4.7, 0.8, 0.5, m.walnut, 0.02);
    this.solid(cabinet, -5.5, -6.0, 4.7, 0.5);
    for (let x = -7.6; x < -3.1; x += 0.72) {
      this.box(x, 0.63, -5.73, 0.6, 0.025, 0.03, m.metal);
    }
    this.plant(-9.1, -5.55, 1.55);
    this.box(-6.0, 1.5, -6.31, 2.3, 0.92, 0.045, m.metal);
    this.box(-6.0, 1.5, -6.276, 2.17, 0.8, 0.02, m.linen);
    for (let i = 0; i < 7; i++) {
      this.box(-6.9 + i * 0.29, 1.45 + Math.sin(i) * 0.1, -6.257, 0.035, 0.32 + random() * 0.28, 0.014, m.walnut).rotation.z = -0.23;
    }
  }

  private buildBedroom(): void {
    const m = this.materials;
    this.box(6.75, 0.13, -3.65, 4.6, 0.035, 4.3, m.fabric);
    this.contact(6.7, -3.8, 4.4, 4.6, 0.155);
    const base = this.box(6.7, 0.35, -3.95, 3.25, 0.48, 3.65, m.walnut, 0.05);
    this.solid(base, 6.7, -3.95, 3.25, 3.65);
    this.box(6.7, 0.9, -5.76, 3.45, 1.25, 0.18, m.fabric, 0.035);
    this.box(6.7, 0.68, -3.92, 3.16, 0.31, 3.53, m.linen, 0.12);
    this.box(6.7, 0.89, -3.24, 3.18, 0.17, 2.25, m.fabric, 0.065);
    this.box(6.7, 1.0, -2.65, 3.2, 0.07, 0.61, m.leather, 0.02);
    for (const x of [5.92, 7.48]) {
      this.box(x, 0.93, -5.0, 1.26, 0.24, 0.64, m.linen, 0.12).rotation.y = x < 6.7 ? -0.045 : 0.045;
    }
    for (const x of [4.5, 8.9]) {
      const nightstand = this.box(x, 0.46, -5.35, 0.76, 0.65, 0.75, m.walnut, 0.025);
      this.solid(nightstand, x, -5.35, 0.76, 0.75);
      this.vessel(x, 0.8, -5.35, 0.15, 0.25);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.28, 20), m.linen);
      shade.position.set(x, 1.21, -5.35);
      this.group.add(shade);
      const glow = new THREE.PointLight(0xffd9a0, 2.5, 3, 2);
      glow.position.set(x, 1.25, -5.35);
      this.group.add(glow);
    }
    this.plant(9.15, -1.65, 1.2);
    this.box(9.7, 1.15, -3.9, 0.32, 1.9, 3.4, m.walnut);
    for (const z of [-4.8, -3.8, -2.8]) this.box(9.515, 1.0, z, 0.028, 0.3, 0.028, m.steel);
  }

  private buildKitchen(): void {
    const m = this.materials;
    const cabinets = this.box(9.32, 0.54, 2.9, 1.08, 0.95, 5.2, m.walnut, 0.025);
    this.solid(cabinets, 9.32, 2.9, 1.08, 5.2);
    this.box(9.28, 1.045, 2.9, 1.2, 0.1, 5.25, m.concrete, 0.02);
    for (let z = 0.5; z < 5.5; z += 0.75) this.box(8.757, 0.77, z, 0.022, 0.025, 0.42, m.steel);
    this.box(9.23, 1.105, 1.15, 0.77, 0.02, 0.72, m.steel);
    this.box(9.23, 1.118, 1.15, 0.58, 0.018, 0.51, m.dark);
    this.box(9.55, 1.32, 1.15, 0.035, 0.43, 0.035, m.steel);
    this.box(9.42, 1.52, 1.15, 0.28, 0.035, 0.035, m.steel);
    this.box(9.25, 1.104, 3.55, 0.84, 0.025, 1.12, m.dark);
    for (const z of [3.28, 3.84]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 24), m.steel);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(9.25, 1.13, z);
      this.group.add(ring);
    }
    this.contact(6.1, 3.05, 2.6, 4.4);
    const island = this.box(6.1, 0.61, 3.0, 1.4, 1.08, 3.3, m.walnut, 0.035);
    this.solid(island, 6.1, 3.0, 1.6, 3.5);
    this.box(6.0, 1.2, 3, 1.8, 0.14, 3.5, m.concrete, 0.035);
    this.vessel(6.1, 1.29, 2.05, 0.2, 0.34);
    this.box(6.04, 1.3, 3.4, 0.62, 0.04, 0.85, m.walnut, 0.03);
    for (const z of [2.2, 3.65]) {
      const stool = this.box(4.7, 0.76, z, 0.51, 0.11, 0.51, m.leather, 0.08);
      this.solid(stool, 4.7, z, 0.55, 0.55);
      for (const x of [4.51, 4.89]) this.box(x, 0.41, z, 0.035, 0.7, 0.035, m.metal);
    }
    this.plant(9.25, 5.8, 0.9);
  }

  private buildDetails(): void {
    const m = this.materials;
    const console = this.box(0.5, 0.62, -5.78, 2.4, 1.08, 0.63, m.dark, 0.035);
    this.solid(console, 0.5, -5.78, 2.4, 0.63);
    this.laptop(0.6, 1.18, -5.65, 0);
    this.plant(1.96, -5.7, 1.15);
    // Contemporary wall-wash luminaires, with a restrained neutral-warm palette.
    for (const x of [-8.7, -2.7, 2.1, 9.1]) {
      this.box(x, 1.65, -6.32, 0.09, 0.48, 0.075, m.dark);
      this.box(x, 1.65, -6.263, 0.028, 0.32, 0.016, m.light);
      const light = new THREE.PointLight(0xffe4bd, 5, 3.6, 2);
      light.position.set(x, 1.6, -6.0);
      this.group.add(light);
    }
    this.extraction.position.set(0.45, 0.092, 5.1);
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.65, 0.008, 1.65));
    const frame = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xdcb878, transparent: true, opacity: 0.4 }));
    this.extraction.add(frame);
    const arrow = new THREE.Shape();
    arrow.moveTo(-0.25, 0.0); arrow.lineTo(0, 0.24); arrow.lineTo(0.25, 0); arrow.lineTo(0.25, 0.1); arrow.lineTo(0, 0.34); arrow.lineTo(-0.25, 0.1);
    for (let i = 0; i < 2; i++) {
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(arrow), new THREE.MeshBasicMaterial({ color: 0xc1aa7f, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.z = -0.1 + i * 0.4;
      this.extraction.add(mesh);
    }
    this.group.add(this.extraction);
  }

  private chair(x: number, z: number, angle: number, lounge = false): void {
    const m = this.materials;
    const root = new THREE.Group();
    const add = (w: number, h: number, d: number, px: number, py: number, pz: number, mat: THREE.Material, radius = 0.035) => {
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, radius), mat);
      mesh.position.set(px, py, pz);
      mesh.castShadow = mesh.receiveShadow = true;
      root.add(mesh);
      return mesh;
    };
    const size = lounge ? 0.9 : 0.65;
    add(size, 0.16, size, 0, 0.56, 0, m.leather);
    add(size, lounge ? 0.58 : 0.49, 0.12, 0, 0.85, -size / 2 + 0.04, m.leather);
    for (const side of [-1, 1]) {
      add(0.055, 0.5, 0.055, side * size * 0.4, 0.29, -size * 0.36, m.metal, 0.008);
      add(0.055, 0.5, 0.055, side * size * 0.4, 0.29, size * 0.36, m.metal, 0.008);
      if (lounge) add(0.13, 0.26, size, side * size * 0.47, 0.75, 0, m.leather);
    }
    root.position.set(x, 0, z);
    root.rotation.y = angle;
    this.group.add(root);
    this.contact(x, z, size * 1.7, size * 1.7);
  }

  private laptop(x: number, y: number, z: number, angle: number): void {
    const root = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.63, 0.035, 0.43), this.materials.metal);
    root.add(base);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.63, 0.4, 0.025), this.materials.dark);
    lid.position.set(0, 0.2, -0.21);
    lid.rotation.x = -0.13;
    root.add(lid);
    const display = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.31), new THREE.MeshStandardMaterial({ color: 0x5e6a60, emissive: 0x6f7b6b, emissiveIntensity: 0.12 }));
    display.position.set(0, 0.21, -0.188);
    display.rotation.x = -0.13;
    root.add(display);
    root.position.set(x, y, z);
    root.rotation.y = angle;
    this.group.add(root);
  }

  private vessel(x: number, y: number, z: number, radius: number, height: number): void {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.85, radius, height, 20), this.materials.ceramic);
    mesh.position.set(x, y + height / 2, z);
    mesh.castShadow = true;
    this.group.add(mesh);
  }

  private plant(x: number, z: number, height: number): void {
    const m = this.materials;
    this.vessel(x, 0.07, z, 0.25 * height, 0.35 * height);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.208 * height, 0.208 * height, 0.025, 16), m.dark);
    soil.position.set(x, 0.42 * height, z);
    this.group.add(soil);
    for (let i = 0; i < 14; i++) {
      const angle = i * 2.399;
      const length = height * (0.46 + random() * 0.4);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, length, 5), m.foliage);
      stem.position.set(x + Math.sin(angle) * height * 0.1, height * 0.39 + length * 0.4, z + Math.cos(angle) * height * 0.1);
      stem.rotation.z = Math.sin(angle) * 0.4;
      stem.rotation.x = Math.cos(angle) * 0.4;
      this.group.add(stem);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), m.foliage);
      leaf.scale.set(0.10 * height, 0.30 * height, 0.033 * height);
      leaf.position.set(x + Math.sin(angle) * height * 0.26, height * 0.48 + length * 0.56, z + Math.cos(angle) * height * 0.26);
      leaf.rotation.set(Math.cos(angle) * 0.65, angle, Math.sin(angle) * 0.7);
      leaf.castShadow = true;
      this.group.add(leaf);
    }
    this.contact(x, z, height, height);
  }

  private floorLamp(x: number, z: number): void {
    const m = this.materials;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.75, 12), m.metal);
    pole.position.set(x, 0.95, z);
    this.group.add(pole);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 0.38, 24, 1, true), m.linen);
    shade.position.set(x, 1.84, z);
    shade.castShadow = true;
    this.group.add(shade);
    const light = new THREE.PointLight(0xffddb0, 8, 5.5, 2);
    light.position.set(x, 1.65, z);
    this.group.add(light);
  }

  canOccupy(x: number, z: number, radius = 0.29): boolean {
    if (x < -9.65 || x > 9.6 || z < -6.15 || z > 6.12) return false;
    return !this.colliders.some((box) => {
      const dx = x - Math.max(box.minX, Math.min(x, box.maxX));
      const dz = z - Math.max(box.minZ, Math.min(z, box.maxZ));
      return dx * dx + dz * dz < radius * radius;
    });
  }

  move(position: THREE.Vector3, dx: number, dz: number, radius = 0.29): boolean {
    let moved = false;
    if (this.canOccupy(position.x + dx, position.z, radius)) { position.x += dx; moved = Math.abs(dx) > 0.00001; }
    if (this.canOccupy(position.x, position.z + dz, radius)) { position.z += dz; moved = moved || Math.abs(dz) > 0.00001; }
    return moved;
  }
}