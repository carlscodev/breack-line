import * as THREE from 'three';
import { World } from './World';
import { Player } from './Player';
import { VisionSystem } from './VisionSystem';
import { Effects } from './Effects';
import { AudioSystem } from './AudioSystem';
import { initialSnapshot, WEAPONS, type GameCommand, type GameSnapshot, type MissionRecord } from './types';

interface Enemy {
  id: number;
  actor: Player;
  spawn: THREE.Vector3;
  health: number;
  alert: number;
  cooldown: number;
  fall: number;
  direction: number;
}

export class Game {
  readonly world: World;
  readonly player: Player;
  readonly vision: VisionSystem;
  private readonly effects: Effects;
  private readonly audio = new AudioSystem();
  private readonly state = initialSnapshot();
  private readonly enemies: Enemy[] = [];
  private readonly keys = new Set<string>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly aim = new THREE.Vector3();
  private readonly movement = new THREE.Vector3();
  private readonly touchMove = new THREE.Vector2();
  private readonly listeners: (() => void)[] = [];
  private pointer = { x: 0, y: 0, active: false };
  private firing = false;
  private triggerLatch = false;
  private focusAim = false;
  private overlayOpen = false;
  private resumeAfterOverlay = false;
  private cooldown = 0;
  private reloadTime = 0;
  private notificationTime = 0;
  private hitTime = 0;
  private damageTime = 0;
  private footstepTime = 0;
  private frame = 0;
  private lastTime = 0;
  private publishTime = 0;
  private fpsTime = 0;
  private fpsFrames = 0;
  private disposed = false;

  constructor(container: HTMLElement, private readonly onChange: (state: GameSnapshot) => void) {
    this.world = new World(container);
    this.player = new Player(this.world.scene);
    this.player.reset(-5.5, 4.9, 2.54);
    this.vision = new VisionSystem(this.world.scene, this.world.level.solids);
    this.effects = new Effects(this.world.scene);
    const spawns = [new THREE.Vector3(-4.0, 0.09, 0.5), new THREE.Vector3(-3.2, 0.09, -3.8), new THREE.Vector3(0.4, 0.09, -2.9), new THREE.Vector3(4.05, 0.09, -3.6), new THREE.Vector3(7.8, 0.09, 2.7)];
    spawns.forEach((spawn, id) => {
      const actor = new Player(this.world.scene, true);
      actor.reset(spawn.x, spawn.z, Math.PI * (0.2 + id * 0.37));
      actor.root.traverse((object) => { object.userData.enemyId = id; });
      this.enemies.push({ id, actor, spawn, health: 100, alert: 0, cooldown: 1.5 + id * 0.25, fall: 0, direction: 1 });
    });
    this.bindInput();
    this.vision.update(this.player.position, this.player.angle);
    this.updateVisibility();
    this.world.render();
    this.publish();
    this.frame = requestAnimationFrame(this.tick);
  }

  private listen<K extends keyof WindowEventMap>(target: Window | HTMLElement, type: K, callback: (event: WindowEventMap[K]) => void, options?: AddEventListenerOptions): void {
    const handler = callback as EventListener;
    target.addEventListener(type, handler, options);
    this.listeners.push(() => target.removeEventListener(type, handler, options));
  }

  private bindInput(): void {
    const canvas = this.world.renderer.domElement;
    this.listen(window, 'keydown', (event) => {
      const target = event.target as HTMLElement;
      if (target.matches('input, select, textarea') || this.overlayOpen || event.ctrlKey || event.metaKey || event.altKey) return;
      if (target.closest('button') && ['Enter', 'Space'].includes(event.code)) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
      if (event.repeat) return;
      if (event.code === 'Enter' && this.state.phase === 'briefing') this.command({ type: 'start' });
      if (event.code === 'Space' || event.code === 'Escape') this.command({ type: 'pause' });
      if (event.code === 'KeyR') this.command({ type: 'reload' });
      if (event.code === 'KeyF') this.command({ type: 'flashlight' });
      if (event.code === 'KeyM') this.command({ type: 'sound' });
    });
    this.listen(window, 'keyup', (event) => { this.keys.delete(event.code); });
    this.listen(window, 'blur', () => {
      this.clearInput();
      if (this.state.phase === 'active') { this.state.phase = 'paused'; this.publish(); }
    });
    this.listen(canvas, 'pointermove', (event: PointerEvent) => {
      this.pointer = { x: event.clientX, y: event.clientY, active: true };
    });
    this.listen(canvas, 'pointerdown', (event: PointerEvent) => {
      if (this.overlayOpen) return;
      this.audio.unlock();
      canvas.focus({ preventScroll: true });
      this.pointer = { x: event.clientX, y: event.clientY, active: true };
      if (event.button === 0) { this.firing = this.state.phase === 'active'; this.triggerLatch = false; }
      if (event.button === 2) this.focusAim = true;
      if (event.pointerType === 'touch') { event.preventDefault(); canvas.setPointerCapture(event.pointerId); }
    });
    this.listen(window, 'pointerup', () => { this.firing = false; this.focusAim = false; this.triggerLatch = false; });
    this.listen(window, 'pointercancel', () => { this.firing = false; this.focusAim = false; this.triggerLatch = false; });
    this.listen(canvas, 'contextmenu', (event: MouseEvent) => event.preventDefault());
    this.listen(canvas, 'wheel', (event: WheelEvent) => {
      event.preventDefault();
      this.command({ type: 'zoom', value: event.deltaY > 0 ? -0.075 : 0.075 });
    }, { passive: false });
  }

  command(command: GameCommand): void {
    if (this.disposed) return;
    switch (command.type) {
      case 'start':
        if (this.state.phase === 'briefing') {
          this.audio.unlock(); this.state.phase = 'active'; this.notify('Entrando. Cada esquina cuenta.');
          this.clearInput();
        }
        break;
      case 'pause':
        if (this.overlayOpen) break;
        if (this.state.phase === 'active') this.state.phase = 'paused';
        else if (this.state.phase === 'paused') this.state.phase = 'active';
        this.clearInput();
        break;
      case 'restart': this.reset(true); break;
      case 'exit': this.reset(false); break;
      case 'reload': this.reload(); break;
      case 'flashlight':
        this.state.flashlight = !this.state.flashlight;
        this.vision.enabled = this.state.flashlight;
        break;
      case 'sound':
        this.audio.unlock(); this.state.sound = !this.state.sound; this.audio.enabled = this.state.sound;
        break;
      case 'volume': this.state.volume = command.value; this.audio.volume = command.value / 100; break;
      case 'quality': this.state.quality = command.value; this.world.setQuality(command.value); break;
      case 'zoom': this.state.zoom = this.world.setZoom(command.value); break;
      case 'recenter': this.world.recenter(); this.state.zoom = 1; break;
      case 'fullscreen':
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => this.notify('No se pudo cerrar la pantalla completa.'));
        else if (document.documentElement.requestFullscreen) void document.documentElement.requestFullscreen().catch(() => this.notify('El navegador no permite pantalla completa.'));
        else this.notify('Pantalla completa no disponible en este navegador.');
        break;
      case 'weapon':
        if (this.state.phase === 'briefing') {
          this.state.weapon = command.value;
          const weapon = WEAPONS[command.value];
          this.state.ammo = this.state.capacity = weapon.capacity;
          this.state.reserve = weapon.reserve;
          this.player.setWeapon(command.value);
        }
        break;
      case 'overlay':
        if (command.open && !this.overlayOpen) {
          this.resumeAfterOverlay = this.state.phase === 'active';
          if (this.resumeAfterOverlay) this.state.phase = 'paused';
        }
        if (!command.open && this.overlayOpen && this.resumeAfterOverlay && this.state.phase === 'paused') this.state.phase = 'active';
        this.overlayOpen = command.open;
        this.clearInput();
        break;
      case 'model': void this.loadModel(command.file); break;
      case 'move': this.touchMove.set(command.x, command.y); break;
      case 'fire':
        this.audio.unlock();
        if (!this.firing || !command.active) this.triggerLatch = false;
        this.firing = command.active && this.state.phase === 'active';
        break;
    }
    this.publish();
  }

  private clearInput(): void {
    this.keys.clear(); this.firing = false; this.triggerLatch = false; this.focusAim = false; this.touchMove.set(0, 0);
  }

  private async loadModel(file: File): Promise<void> {
    if (this.state.phase !== 'briefing') { this.notify('Importa tu operador antes de iniciar la operaci\u00f3n.'); return; }
    if (!file.name.toLowerCase().endsWith('.glb') || file.size > 30 * 1024 * 1024) {
      this.notify('Selecciona un archivo .glb de menos de 30 MB.'); return;
    }
    const url = URL.createObjectURL(file);
    this.state.modelLoading = true;
    this.publish();
    try {
      await this.player.loadModel(url);
      if (!this.disposed) { this.state.modelName = file.name; this.notify('Operador importado. Listo para desplegar.'); }
    } catch (error) {
      if (!this.disposed) this.notify(error instanceof Error ? error.message : 'No se pudo importar el modelo.');
    } finally {
      URL.revokeObjectURL(url);
      this.state.modelLoading = false;
      if (!this.disposed) this.publish();
    }
  }

  private reset(active: boolean): void {
    const retained = {
      sound: this.state.sound, volume: this.state.volume, quality: this.state.quality,
      weapon: this.state.weapon, records: this.state.records, modelName: this.state.modelName,
    };
    Object.assign(this.state, initialSnapshot(), retained);
    const weapon = WEAPONS[this.state.weapon];
    this.state.capacity = this.state.ammo = weapon.capacity;
    this.state.reserve = weapon.reserve;
    this.state.phase = active ? 'active' : 'briefing';
    this.player.reset(-5.5, 4.9, 2.54);
    this.player.setWeapon(this.state.weapon);
    this.vision.enabled = true;
    this.cooldown = this.reloadTime = this.hitTime = this.damageTime = this.notificationTime = 0;
    this.pointer.active = false;
    this.overlayOpen = this.resumeAfterOverlay = false;
    this.clearInput();
    this.effects.clear();
    this.world.recenter();
    for (const enemy of this.enemies) {
      enemy.health = 100; enemy.alert = 0; enemy.cooldown = 1.5 + enemy.id * 0.25; enemy.fall = 0;
      enemy.actor.reset(enemy.spawn.x, enemy.spawn.z, Math.PI * (0.2 + enemy.id * 0.37));
    }
    if (active) this.audio.unlock();
    this.vision.update(this.player.position, this.player.angle);
    this.updateVisibility();
    this.publish();
  }

  private reload(): void {
    if (this.state.phase !== 'active' || this.state.reloading || this.state.ammo === this.state.capacity) return;
    if (this.state.reserve === 0) { this.notify('Sin cargadores de reserva.'); return; }
    this.state.reloading = true;
    this.reloadTime = WEAPONS[this.state.weapon].reload;
    this.player.reload(this.reloadTime);
    this.audio.play('reload');
  }

  private shoot(): void {
    if (this.cooldown > 0 || this.state.reloading || this.state.phase !== 'active') return;
    if (this.state.weapon === 'p9' && this.triggerLatch) return;
    if (this.state.ammo <= 0) { this.reload(); return; }
    const weapon = WEAPONS[this.state.weapon];
    this.cooldown = weapon.interval;
    this.triggerLatch = true;
    this.state.ammo--; this.state.shots++;
    const start = this.player.muzzle().clone();
    const angle = this.player.angle + (Math.random() - 0.5) * (this.focusAim ? 0.005 : 0.016);
    const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const chamber = this.player.position.clone(); chamber.y = start.y;
    this.raycaster.set(chamber, direction); this.raycaster.far = 25;
    const targets: THREE.Object3D[] = [...this.world.level.solids, ...this.enemies.filter((enemy) => enemy.health > 0).map((enemy) => enemy.actor.root)];
    const hit = this.raycaster.intersectObjects(targets, true)[0];
    const end = hit ? hit.point : start.clone().addScaledVector(direction, 22);
    if (hit && hit.distance < chamber.distanceTo(start)) start.copy(chamber);
    this.effects.shot(start, end);
    this.player.shoot(); this.audio.play('shot'); this.world.recoil();
    if (hit) {
      const id: unknown = hit.object.userData.enemyId;
      if (typeof id === 'number') {
        const enemy = this.enemies[id];
        enemy.health -= weapon.damage;
        enemy.alert = 1.4;
        this.state.hits++;
        this.hitTime = 0.15;
        this.effects.impact(hit.point, true);
        if (enemy.health <= 0) {
          this.state.kills++;
          if (this.state.kills === this.state.totalEnemies) this.notify('Sector despejado. Dir\u00edgete al punto de extracci\u00f3n.');
        }
      } else this.effects.impact(hit.point);
    }
    for (const enemy of this.enemies) {
      if (enemy.health > 0 && enemy.actor.position.distanceTo(this.player.position) < 5 && this.vision.hasLineOfSight(enemy.actor.position, this.player.position)) enemy.alert = Math.max(enemy.alert, 0.5);
    }
  }

  private updateEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      if (enemy.health <= 0) {
        enemy.fall = Math.min(1, enemy.fall + dt * 3.8);
        enemy.actor.root.rotation.z = enemy.fall * 1.48;
        enemy.actor.position.y = 0.17;
        continue;
      }
      const distance = enemy.actor.position.distanceTo(this.player.position);
      const lineOfSight = distance < 10 && this.vision.hasLineOfSight(enemy.actor.position, this.player.position);
      const toPlayer = Math.atan2(this.player.position.x - enemy.actor.position.x, this.player.position.z - enemy.actor.position.z);
      const facing = Math.abs(Math.atan2(Math.sin(toPlayer - enemy.actor.angle), Math.cos(toPlayer - enemy.actor.angle))) < 1.05;
      if (lineOfSight && (facing || distance < 3.2 || enemy.alert > 0.5)) enemy.alert = Math.min(2, enemy.alert + dt);
      else enemy.alert = Math.max(0, enemy.alert - dt * 0.2);
      let moving = false;
      if (enemy.alert > 0.7 && lineOfSight) {
        enemy.actor.aimAt(this.player.position);
        enemy.cooldown -= dt;
        if (enemy.cooldown <= 0 && enemy.alert > 1.15) {
          enemy.cooldown = 1.45 + Math.random() * 0.5;
          const start = enemy.actor.muzzle().clone();
          const end = this.player.position.clone(); end.y = 1.25;
          this.effects.shot(start, end, true); enemy.actor.shoot(); this.audio.play('enemy');
          if (Math.random() > (this.keys.has('ShiftLeft') ? 0.4 : 0.15)) {
            this.state.health = Math.max(0, this.state.health - 13);
            this.damageTime = 0.36;
            this.audio.play('hit'); this.world.recoil(0.11);
            if (this.state.health === 0) { this.finish(false); break; }
          }
        }
      } else {
        const limit = 0.65;
        if (Math.abs(enemy.actor.position.z - enemy.spawn.z) > limit) enemy.direction *= -1;
        const dz = dt * 0.32 * enemy.direction;
        moving = this.world.level.move(enemy.actor.position, 0, dz, 0.24);
        if (!moving) enemy.direction *= -1;
        enemy.actor.angle += Math.sin(this.state.elapsed * 0.5 + enemy.id) * dt * 0.15;
      }
      enemy.actor.update(dt, moving, enemy.direction > 0 ? 0 : Math.PI);
    }
  }

  private updateVisibility(): void {
    const visible: GameSnapshot['visibleEnemies'] = [];
    for (const enemy of this.enemies) {
      enemy.actor.root.visible = this.vision.canSee(enemy.actor.position);
      if (enemy.actor.root.visible && enemy.health > 0) visible.push({ id: enemy.id, x: enemy.actor.position.x, z: enemy.actor.position.z });
    }
    this.state.visibleEnemies = visible;
  }

  private finish(success: boolean): void {
    if (this.state.phase !== 'active') return;
    this.state.phase = success ? 'won' : 'lost';
    this.clearInput();
    this.audio.play(success ? 'complete' : 'hit');
    const record: MissionRecord = {
      date: new Date().toISOString(), time: this.state.elapsed, kills: this.state.kills,
      accuracy: this.state.shots > 0 ? Math.round(this.state.hits / this.state.shots * 100) : 0,
      success,
    };
    this.state.records = [record, ...this.state.records].slice(0, 8);
    try { localStorage.setItem('breach-missions', JSON.stringify(this.state.records)); } catch { /* The session remains playable without storage. */ }
    this.publish();
  }

  private notify(message: string): void {
    this.state.notification = message;
    this.notificationTime = 4;
  }

  private tick = (now: number): void => {
    if (this.disposed) return;
    const realDt = this.lastTime ? Math.max((now - this.lastTime) / 1000, 0.001) : 1 / 60;
    const dt = Math.min(realDt, 0.045);
    this.lastTime = now;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hitTime = Math.max(0, this.hitTime - dt);
    this.damageTime = Math.max(0, this.damageTime - dt);
    this.notificationTime = Math.max(0, this.notificationTime - dt);
    if (this.notificationTime === 0) this.state.notification = '';
    const active = this.state.phase === 'active';
    let moving = false;
    if (active) {
      this.state.elapsed += dt;
      let x = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) + this.touchMove.x;
      let y = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - this.touchMove.y;
      const length = Math.hypot(x, y);
      if (length > 1) { x /= length; y /= length; }
      this.movement.copy(this.world.screenRight).multiplyScalar(x).addScaledVector(this.world.screenForward, y);
      const speed = this.focusAim ? 1.7 : this.keys.has('ShiftLeft') ? 4.15 : 2.75;
      moving = this.world.level.move(this.player.position, this.movement.x * speed * dt, this.movement.z * speed * dt);
      if (this.state.reloading) {
        this.reloadTime -= dt;
        this.state.reloadProgress = 1 - this.reloadTime / WEAPONS[this.state.weapon].reload;
        if (this.reloadTime <= 0) {
          const count = Math.min(this.state.capacity - this.state.ammo, this.state.reserve);
          this.state.ammo += count; this.state.reserve -= count;
          this.state.reloading = false; this.state.reloadProgress = 0;
          this.audio.play('reload');
        }
      }
      this.footstepTime -= dt;
      if (moving && this.footstepTime <= 0) { this.audio.play('step'); this.footstepTime = 0.34; }
    }
    this.world.update(dt, this.player.position, active || this.state.phase === 'paused');
    if (this.pointer.active && !this.overlayOpen && (active || this.state.phase === 'briefing')) {
      const aimTargets = this.enemies.filter((enemy) => enemy.health > 0 && enemy.actor.root.visible).map((enemy) => enemy.actor.root);
      if (this.world.pointerToWorld(this.pointer.x, this.pointer.y, this.aim, aimTargets)) this.player.aimAt(this.aim);
    }
    this.player.update(active || this.state.phase === 'briefing' ? dt : 0, moving, moving ? Math.atan2(this.movement.x, this.movement.z) : undefined);
    this.vision.update(this.player.position, this.player.angle);
    if (active) {
      if (this.firing) this.shoot();
      this.updateEnemies(dt);
      if (this.state.kills === this.state.totalEnemies && this.player.position.distanceTo(new THREE.Vector3(0.45, 0.09, 5.1)) < 1.0) this.finish(true);
    }
    this.updateVisibility();
    if (this.state.kills === this.state.totalEnemies) {
      this.world.level.extraction.scale.setScalar(1 + Math.sin(now * 0.004) * 0.055);
    } else this.world.level.extraction.scale.setScalar(1);
    this.effects.update(dt);
    this.world.render();
    this.publishTime += dt; this.fpsTime += realDt; this.fpsFrames++;
    if (this.fpsTime >= 1) { this.state.fps = Math.round(this.fpsFrames / this.fpsTime); this.fpsTime = this.fpsFrames = 0; }
    if (this.publishTime > 0.08) { this.publish(); this.publishTime = 0; }
    this.frame = requestAnimationFrame(this.tick);
  };

  private publish(): void {
    this.state.playerX = this.player.position.x;
    this.state.playerZ = this.player.position.z;
    this.state.heading = ((180 - this.player.angle * 180 / Math.PI) % 360 + 360) % 360;
    this.state.hitMarker = this.hitTime > 0;
    this.state.damage = this.damageTime;
    this.onChange({ ...this.state, visibleEnemies: [...this.state.visibleEnemies] });
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    for (const remove of this.listeners) remove();
    this.player.dispose();
    for (const enemy of this.enemies) enemy.actor.dispose();
    this.vision.dispose(); this.effects.dispose(); this.audio.dispose(); this.world.dispose();
  }
}