import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export interface OperatorRig {
  root: THREE.Group;
  upperBody: THREE.Bone;
  hips: THREE.Bone;
  muzzle: THREE.Object3D;
  clips: THREE.AnimationClip[];
}

export function createOperator(hostile = false): OperatorRig {
  const root = new THREE.Group();
  const uniform = new THREE.MeshStandardMaterial({ color: hostile ? 0x646058 : 0x646d56, roughness: 0.95 });
  const plate = new THREE.MeshStandardMaterial({ color: hostile ? 0x393a35 : 0x3b4437, roughness: 0.84 });
  const webbing = new THREE.MeshStandardMaterial({ color: hostile ? 0x736953 : 0x737760, roughness: 0.95 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x252b26, roughness: 0.85 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x2a302e, roughness: 0.42, metalness: 0.75 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x927864, roughness: 0.86 });
  const lens = new THREE.MeshStandardMaterial({ color: 0x202923, roughness: 0.19, metalness: 0.65 });
  const patch = new THREE.MeshStandardMaterial({ color: hostile ? 0x8d6550 : 0xb2aa82, roughness: 0.9 });

  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  const box = (parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material, radius = 0.025) =>
    mesh(new RoundedBoxGeometry(w, h, d, 2, radius), mat, parent, x, y, z);
  const limb = (parent: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, radius: number, mat: THREE.Material) => {
    const delta = to.clone().sub(from);
    const object = mesh(new THREE.CapsuleGeometry(radius, Math.max(0.01, delta.length() - radius * 2), 5, 10), mat, parent, 0, 0, 0);
    object.position.copy(from).add(to).multiplyScalar(0.5);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return object;
  };

  const hips = new THREE.Bone();
  hips.name = 'hips';
  hips.position.y = 0.91;
  root.add(hips);
  box(hips, 0, 0.025, 0, 0.43, 0.24, 0.26, uniform, 0.055);
  box(hips, 0, 0.095, 0, 0.45, 0.075, 0.285, rubber, 0.015);
  box(hips, 0, 0.10, 0.155, 0.075, 0.045, 0.024, steel, 0.008);
  for (const side of [-1, 1]) {
    box(hips, side * 0.21, 0.03, -0.08, 0.09, 0.16, 0.14, webbing);
    const thigh = new THREE.Bone();
    thigh.name = side === -1 ? 'leftThigh' : 'rightThigh';
    thigh.position.set(side * 0.125, -0.06, 0);
    hips.add(thigh);
    limb(thigh, new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * 0.02, -0.39, 0.025), 0.105, uniform);
    box(thigh, side * 0.08, -0.19, 0.015, 0.07, 0.2, 0.15, webbing, 0.02);
    const calf = new THREE.Bone();
    calf.name = side === -1 ? 'leftCalf' : 'rightCalf';
    calf.position.set(side * 0.02, -0.39, 0.025);
    thigh.add(calf);
    limb(calf, new THREE.Vector3(0, 0.0, 0), new THREE.Vector3(0, -0.33, -0.025), 0.081, uniform);
    box(calf, 0, -0.02, 0.074, 0.145, 0.155, 0.075, rubber, 0.04);
    box(calf, 0, -0.32, 0.045, 0.18, 0.19, 0.31, rubber, 0.045);
    box(calf, 0, -0.403, 0.06, 0.19, 0.038, 0.33, rubber, 0.009);
  }

  const upperBody = new THREE.Bone();
  upperBody.name = 'upperBody';
  upperBody.position.y = 1.19;
  root.add(upperBody);
  const torso = mesh(new THREE.CapsuleGeometry(0.235, 0.25, 6, 14), uniform, upperBody, 0, 0.01, 0);
  torso.scale.set(1, 1, 0.65);
  box(upperBody, 0, 0.035, 0.06, 0.46, 0.44, 0.29, plate, 0.065);
  box(upperBody, 0, 0.06, 0.205, 0.33, 0.3, 0.044, webbing, 0.015);
  for (let row = 0; row < 3; row++) {
    box(upperBody, 0, 0.08 - row * 0.058, 0.234, 0.33, 0.013, 0.01, plate, 0.004);
  }
  for (const x of [-0.12, 0, 0.12]) box(upperBody, x, -0.125, 0.235, 0.10, 0.16, 0.084, plate, 0.015);
  for (const x of [-0.17, 0.17]) box(upperBody, x, 0.22, 0.005, 0.079, 0.08, 0.32, webbing, 0.02);
  box(upperBody, 0, 0.175, 0.235, 0.16, 0.061, 0.008, patch, 0.003);
  box(upperBody, 0, 0.025, -0.19, 0.31, 0.4, 0.18, plate, 0.045);
  box(upperBody, -0.24, 0.13, -0.12, 0.08, 0.19, 0.07, rubber);
  mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.23, 6), rubber, upperBody, -0.24, 0.31, -0.12);
  mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.15, 12), skin, upperBody, 0, 0.33, 0.0);
  const head = mesh(new THREE.SphereGeometry(1, 20, 14), skin, upperBody, 0, 0.48, 0.015);
  head.scale.set(0.153, 0.195, 0.16);
  const balaclava = mesh(new THREE.SphereGeometry(1, 16, 12), rubber, upperBody, 0, 0.44, 0.005);
  balaclava.scale.set(0.155, 0.105, 0.164);
  const helmet = mesh(new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), plate, upperBody, 0, 0.53, 0);
  helmet.scale.set(0.192, 0.178, 0.204);
  box(upperBody, 0, 0.495, 0.168, 0.275, 0.075, 0.045, rubber, 0.02);
  box(upperBody, 0, 0.496, 0.193, 0.235, 0.043, 0.012, lens, 0.014);
  box(upperBody, 0, 0.632, 0.15, 0.078, 0.065, 0.045, steel, 0.008);
  box(upperBody, 0, 0.696, -0.016, 0.06, 0.014, 0.09, patch, 0.005);
  for (const side of [-1, 1]) {
    box(upperBody, side * 0.172, 0.475, -0.016, 0.065, 0.115, 0.09, rubber, 0.025);
    box(upperBody, side * 0.184, 0.567, -0.01, 0.016, 0.03, 0.13, steel, 0.004);
  }
  limb(upperBody, new THREE.Vector3(0.19, 0.45, 0.01), new THREE.Vector3(0.11, 0.39, 0.195), 0.012, rubber);

  const leftArm = new THREE.Bone(); leftArm.name = 'leftArm'; upperBody.add(leftArm);
  const rightArm = new THREE.Bone(); rightArm.name = 'rightArm'; upperBody.add(rightArm);
  limb(leftArm, new THREE.Vector3(-0.24, 0.16, 0), new THREE.Vector3(-0.34, -0.10, 0.18), 0.089, uniform);
  limb(leftArm, new THREE.Vector3(-0.34, -0.10, 0.18), new THREE.Vector3(-0.025, 0.045, 0.55), 0.071, uniform);
  limb(rightArm, new THREE.Vector3(0.24, 0.16, 0), new THREE.Vector3(0.35, -0.10, 0.10), 0.089, uniform);
  limb(rightArm, new THREE.Vector3(0.35, -0.10, 0.10), new THREE.Vector3(0.055, 0.045, 0.34), 0.074, uniform);
  box(leftArm, -0.015, 0.07, 0.55, 0.10, 0.105, 0.125, rubber, 0.03);
  box(rightArm, 0.045, 0.065, 0.34, 0.105, 0.12, 0.12, rubber, 0.028);
  box(rightArm, 0.284, 0.12, 0.032, 0.022, 0.12, 0.12, patch, 0.015);

  const rifle = new THREE.Group(); rifle.name = 'rifle';
  rifle.position.set(0.03, 0.135, 0.19);
  upperBody.add(rifle);
  box(rifle, 0, 0, 0.1, 0.075, 0.12, 0.29, steel, 0.009);
  box(rifle, 0, -0.008, -0.105, 0.065, 0.13, 0.21, rubber, 0.016);
  box(rifle, 0, 0.015, 0.335, 0.065, 0.088, 0.24, steel, 0.007);
  const magazine = box(rifle, 0, -0.13, 0.13, 0.061, 0.19, 0.1, steel, 0.012);
  magazine.rotation.x = -0.16;
  box(rifle, 0, -0.098, 0.02, 0.055, 0.13, 0.065, rubber, 0.01).rotation.x = 0.3;
  for (let i = 0; i < 11; i++) box(rifle, 0, 0.069, 0.06 + i * 0.029, 0.08, 0.016, 0.014, rubber, 0.002);
  const barrel = mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.25, 12), steel, rifle, 0, 0.009, 0.545);
  barrel.rotation.x = Math.PI / 2;
  const suppressor = mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.18, 16), rubber, rifle, 0, 0.009, 0.72);
  suppressor.rotation.x = Math.PI / 2;
  box(rifle, 0, 0.115, 0.17, 0.085, 0.08, 0.12, rubber, 0.017);
  box(rifle, 0, 0.115, 0.232, 0.058, 0.045, 0.006, lens, 0.008);
  const flashlight = mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.12, 12), rubber, rifle, 0.07, 0, 0.37);
  flashlight.rotation.x = Math.PI / 2;
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.009, 0.815); rifle.add(muzzle);
  const carbine = new THREE.Group(); carbine.name = 'carbine';
  for (const child of [...rifle.children]) if (child !== muzzle) carbine.add(child);
  rifle.add(carbine);
  const pistol = new THREE.Group(); pistol.name = 'pistol'; pistol.visible = false;
  rifle.add(pistol);
  box(pistol, 0, -0.015, 0.23, 0.082, 0.095, 0.27, steel, 0.012);
  box(pistol, 0, -0.07, 0.21, 0.077, 0.035, 0.2, rubber, 0.01);
  box(pistol, 0, -0.14, 0.14, 0.072, 0.16, 0.095, rubber, 0.015).rotation.x = 0.25;
  const pistolSuppressor = mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.17, 12), rubber, pistol, 0, -0.012, 0.43);
  pistolSuppressor.rotation.x = Math.PI / 2;
  box(pistol, 0, 0.04, 0.31, 0.026, 0.018, 0.015, steel, 0.003);

  const idle = new THREE.AnimationClip('Idle', 2.4, [
    new THREE.NumberKeyframeTrack('upperBody.position[y]', [0, 1.2, 2.4], [1.19, 1.202, 1.19]),
    new THREE.NumberKeyframeTrack('leftThigh.rotation[x]', [0, 2.4], [-0.07, -0.07]),
    new THREE.NumberKeyframeTrack('rightThigh.rotation[x]', [0, 2.4], [0.07, 0.07]),
    new THREE.NumberKeyframeTrack('leftCalf.rotation[x]', [0, 2.4], [0.12, 0.12]),
    new THREE.NumberKeyframeTrack('rightCalf.rotation[x]', [0, 2.4], [0.12, 0.12]),
  ]);
  const walk = new THREE.AnimationClip('Walk', 0.8, [
    new THREE.NumberKeyframeTrack('leftThigh.rotation[x]', [0, 0.2, 0.4, 0.6, 0.8], [-0.36, 0, 0.36, 0, -0.36]),
    new THREE.NumberKeyframeTrack('rightThigh.rotation[x]', [0, 0.2, 0.4, 0.6, 0.8], [0.36, 0, -0.36, 0, 0.36]),
    new THREE.NumberKeyframeTrack('leftCalf.rotation[x]', [0, 0.2, 0.4, 0.6, 0.8], [0.12, 0.5, 0.12, 0.08, 0.12]),
    new THREE.NumberKeyframeTrack('rightCalf.rotation[x]', [0, 0.2, 0.4, 0.6, 0.8], [0.12, 0.08, 0.12, 0.5, 0.12]),
    new THREE.NumberKeyframeTrack('upperBody.position[y]', [0, 0.2, 0.4, 0.6, 0.8], [1.19, 1.21, 1.19, 1.21, 1.19]),
  ]);
  const shooting = new THREE.AnimationClip('Shooting', 0.13, [
    new THREE.NumberKeyframeTrack('rifle.position[z]', [0, 0.03, 0.13], [0.19, 0.145, 0.19]),
    new THREE.NumberKeyframeTrack('rifle.rotation[x]', [0, 0.035, 0.13], [0, -0.045, 0]),
  ]);
  const reload = new THREE.AnimationClip('Reload', 1.8, [
    new THREE.NumberKeyframeTrack('leftArm.rotation[x]', [0, 0.3, 0.8, 1.3, 1.8], [0, 0.55, 0.7, 0.4, 0]),
    new THREE.NumberKeyframeTrack('leftArm.rotation[z]', [0, 0.3, 0.8, 1.3, 1.8], [0, -0.22, -0.12, -0.05, 0]),
    new THREE.NumberKeyframeTrack('rifle.rotation[z]', [0, 0.3, 1.3, 1.8], [0, 0.25, 0.25, 0]),
    new THREE.NumberKeyframeTrack('rifle.rotation[x]', [0, 0.3, 1.3, 1.8], [0, 0.15, 0.15, 0]),
  ]);
  return { root, upperBody, hips, muzzle, clips: [idle, walk, shooting, reload] };
}