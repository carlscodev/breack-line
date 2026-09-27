import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createOperator, type OperatorRig } from './OperatorModel';
import type { WeaponId } from './types';

export class Player {
  readonly root = new THREE.Group();
  readonly rig: OperatorRig;
  mixer: THREE.AnimationMixer;
  angle = 2.54;
  private actions = new Map<string, THREE.AnimationAction>();
  private locomotion: THREE.AnimationAction | null = null;
  private imported: THREE.Object3D | null = null;
  private disposed = false;
  private loadVersion = 0;
  private readonly muzzlePosition = new THREE.Vector3();

  constructor(scene: THREE.Scene, hostile = false) {
    this.rig = createOperator(hostile);
    this.root.add(this.rig.root);
    scene.add(this.root);
    this.mixer = new THREE.AnimationMixer(this.rig.root);
    this.registerAnimations(this.rig.clips);
    this.setLocomotion(false);
  }

  get position(): THREE.Vector3 { return this.root.position; }

  private registerAnimations(clips: THREE.AnimationClip[]): void {
    this.actions.clear();
    for (const clip of clips) {
      const name = /reload/i.test(clip.name) ? 'Reload'
        : /shoot|fire|recoil/i.test(clip.name) ? 'Shooting'
          : /walk|run|strafe/i.test(clip.name) ? 'Walk'
            : /idle|standing|breath/i.test(clip.name) ? 'Idle' : clip.name;
      const action = this.mixer.clipAction(clip);
      if (name === 'Shooting' || name === 'Reload') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = false;
      }
      this.actions.set(name, action);
    }
  }

  setLocomotion(moving: boolean): void {
    const next = this.actions.get(moving ? 'Walk' : 'Idle') ?? this.actions.get('Idle') ?? this.actions.values().next().value;
    if (!next || next === this.locomotion) return;
    next.reset().setEffectiveWeight(1).play();
    if (this.locomotion) this.locomotion.crossFadeTo(next, 0.2, false);
    this.locomotion = next;
  }

  aimAt(target: THREE.Vector3): void {
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    if (dx * dx + dz * dz > 0.09) this.angle = Math.atan2(dx, dz);
  }

  update(dt: number, moving: boolean, movementAngle?: number): void {
    this.setLocomotion(moving);
    this.mixer.update(dt);
    if (this.imported) {
      this.imported.rotation.y = this.angle;
    } else {
      this.rig.upperBody.rotation.y = this.angle;
      const target = moving && movementAngle !== undefined ? movementAngle : this.angle;
      const difference = Math.atan2(Math.sin(target - this.rig.hips.rotation.y), Math.cos(target - this.rig.hips.rotation.y));
      this.rig.hips.rotation.y += difference * Math.min(1, dt * 12);
    }
    this.root.updateMatrixWorld(true);
  }

  shoot(): void {
    const action = this.actions.get('Shooting');
    if (action) action.reset().setEffectiveWeight(1).play();
  }

  setWeapon(weapon: WeaponId): void {
    const carbine = this.rig.root.getObjectByName('carbine');
    const pistol = this.rig.root.getObjectByName('pistol');
    if (carbine) carbine.visible = weapon === 'mk18';
    if (pistol) pistol.visible = weapon === 'p9';
    this.rig.muzzle.position.z = weapon === 'mk18' ? 0.815 : 0.52;
  }

  reload(duration = 1.8): void {
    const action = this.actions.get('Reload');
    if (action) action.reset().setEffectiveTimeScale(action.getClip().duration / duration).setEffectiveWeight(1).fadeIn(0.12).play();
  }

  muzzle(): THREE.Vector3 {
    if (this.imported) {
      return this.muzzlePosition.copy(this.position).add(new THREE.Vector3(Math.sin(this.angle) * 0.8, 1.32, Math.cos(this.angle) * 0.8));
    }
    return this.rig.muzzle.getWorldPosition(this.muzzlePosition);
  }

  async loadModel(url: string): Promise<void> {
    const version = ++this.loadVersion;
    const gltf = await new GLTFLoader().loadAsync(url);
    if (this.disposed || version !== this.loadVersion) {
      this.disposeObject(gltf.scene);
      return;
    }
    const bounds = new THREE.Box3().setFromObject(gltf.scene);
    const size = bounds.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.y) || size.y < 0.01) {
      this.disposeObject(gltf.scene);
      throw new Error('El archivo no contiene un operador 3D v\u00e1lido.');
    }
    const wrapper = new THREE.Group();
    const scale = 1.82 / size.y;
    const center = bounds.getCenter(new THREE.Vector3());
    gltf.scene.scale.setScalar(scale);
    gltf.scene.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    gltf.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true;
    });
    wrapper.add(gltf.scene);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
    if (this.imported) { this.root.remove(this.imported); this.disposeObject(this.imported); }
    this.rig.root.visible = false;
    this.imported = wrapper;
    this.root.add(wrapper);
    this.mixer = new THREE.AnimationMixer(gltf.scene);
    this.registerAnimations(gltf.animations);
    this.locomotion = null;
    this.setLocomotion(false);
  }

  reset(x: number, z: number, angle: number): void {
    this.position.set(x, 0.09, z);
    this.root.rotation.set(0, 0, 0);
    this.root.visible = true;
    this.angle = angle;
    this.mixer.stopAllAction();
    this.locomotion = null;
    this.update(0.01, false);
  }

  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
          material.dispose();
        }
      }
    });
  }

  dispose(): void {
    this.disposed = true;
    this.loadVersion++;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
    this.disposeObject(this.root);
    this.root.removeFromParent();
  }
}