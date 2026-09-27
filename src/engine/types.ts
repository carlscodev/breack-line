export type MissionPhase = 'briefing' | 'active' | 'paused' | 'won' | 'lost';
export type WeaponId = 'mk18' | 'p9';

export interface WallDefinition {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

export interface MissionRecord {
  date: string;
  time: number;
  kills: number;
  accuracy: number;
  success: boolean;
}

export interface GameSnapshot {
  phase: MissionPhase;
  health: number;
  ammo: number;
  capacity: number;
  reserve: number;
  reloading: boolean;
  reloadProgress: number;
  kills: number;
  totalEnemies: number;
  elapsed: number;
  shots: number;
  hits: number;
  heading: number;
  playerX: number;
  playerZ: number;
  flashlight: boolean;
  sound: boolean;
  volume: number;
  quality: string;
  weapon: WeaponId;
  fps: number;
  zoom: number;
  notification: string;
  damage: number;
  hitMarker: boolean;
  modelLoading: boolean;
  modelName: string;
  visibleEnemies: { id: number; x: number; z: number }[];
  walls: WallDefinition[];
  records: MissionRecord[];
}

export type GameCommand =
  | { type: 'start' | 'pause' | 'restart' | 'exit' | 'reload' | 'flashlight' | 'sound' | 'recenter' | 'fullscreen' }
  | { type: 'zoom'; value: number }
  | { type: 'volume'; value: number }
  | { type: 'quality'; value: string }
  | { type: 'weapon'; value: WeaponId }
  | { type: 'overlay'; open: boolean }
  | { type: 'model'; file: File }
  | { type: 'move'; x: number; y: number }
  | { type: 'fire'; active: boolean };

export const WEAPONS = {
  mk18: { name: 'MK18 MOD 1', capacity: 30, reserve: 120, damage: 52, interval: 0.14, reload: 1.8 },
  p9: { name: 'P9 SUPPRESSED', capacity: 15, reserve: 75, damage: 72, interval: 0.28, reload: 1.3 },
} as const;

export const WALLS: WallDefinition[] = [
  { x: 0, z: -6.5, w: 20.4, d: 0.28, h: 2.35 },
  { x: -10, z: 0, w: 0.28, d: 13, h: 2.35 },
  { x: 10, z: 0, w: 0.28, d: 13, h: 0.85 },
  { x: -8.6, z: 6.5, w: 2.8, d: 0.28, h: 0.6 },
  { x: 2.6, z: 6.5, w: 14.8, d: 0.28, h: 0.6 },
  { x: -8.4, z: -0.8, w: 3.2, d: 0.24, h: 1.9 },
  { x: -3.65, z: -0.8, w: 3.3, d: 0.24, h: 1.9 },
  { x: -2, z: -4.4, w: 0.24, d: 4.2, h: 1.95 },
  { x: -2, z: 1.75, w: 0.24, d: 3.5, h: 1.85 },
  { x: -2, z: 5.9, w: 0.24, d: 1.2, h: 0.85 },
  { x: 3, z: -4.4, w: 0.24, d: 4.2, h: 1.95 },
  { x: 3, z: -0.55, w: 0.24, d: 0.5, h: 1.85 },
  { x: 3, z: 4.4, w: 0.24, d: 4.2, h: 1.2 },
  { x: 5, z: -0.8, w: 4, d: 0.24, h: 1.85 },
  { x: 9.25, z: -0.8, w: 1.5, d: 0.24, h: 0.85 },
];

export function initialSnapshot(): GameSnapshot {
  let records: MissionRecord[] = [];
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('breach-missions') || '[]');
    if (Array.isArray(saved)) {
      records = saved.filter((record): record is MissionRecord =>
        typeof record === 'object' && record !== null &&
        typeof record.time === 'number' && typeof record.kills === 'number' &&
        typeof record.accuracy === 'number' && typeof record.success === 'boolean' &&
        typeof record.date === 'string',
      ).slice(0, 8);
    }
  } catch { /* Storage is optional in private browsing. */ }
  return {
    phase: 'briefing', health: 100, ammo: 30, capacity: 30, reserve: 120,
    reloading: false, reloadProgress: 0, kills: 0, totalEnemies: 5,
    elapsed: 0, shots: 0, hits: 0, heading: 34, playerX: -5.5, playerZ: 4.9,
    flashlight: true, sound: true, volume: 35, quality: 'high', weapon: 'mk18',
    fps: 60, zoom: 1, notification: '', damage: 0, hitMarker: false,
    modelLoading: false, modelName: 'Operador procedural', visibleEnemies: [], walls: WALLS, records,
  };
}