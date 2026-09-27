import * as THREE from 'three';

let seed = 1049;
export function random(): number {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

function texture(kind: 'concrete' | 'wood' | 'fabric'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(256, 256);
  const base = kind === 'wood' ? [88, 68, 49] : kind === 'fabric' ? [113, 113, 103] : [151, 151, 140];
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const index = (y * 256 + x) * 4;
      let noise = (random() - 0.5) * (kind === 'concrete' ? 15 : 24);
      if (kind === 'wood') noise += Math.sin(x * 0.3 + Math.sin(y * 0.025) * 1.7) * 9;
      if (kind === 'fabric') noise += ((x + y) % 2) * 8;
      for (let c = 0; c < 3; c++) image.data[index + c] = base[c] + noise;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  if (kind === 'wood') {
    ctx.strokeStyle = 'rgba(15, 12, 8, .22)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 256; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

export function createMaterials() {
  const concrete = texture('concrete');
  concrete.repeat.set(3, 3);
  const wood = texture('wood');
  const fabric = texture('fabric');
  fabric.repeat.set(3, 3);
  return {
    concrete: new THREE.MeshStandardMaterial({ color: 0xb6b5a9, map: concrete, roughness: 0.91, bumpMap: concrete, bumpScale: 0.018 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xa9aaa0, map: concrete, roughness: 0.94 }),
    cap: new THREE.MeshStandardMaterial({ color: 0xc2c1b4, roughness: 0.9 }),
    floor: new THREE.MeshStandardMaterial({ color: 0xbabbb0, map: concrete, roughness: 0.8, bumpMap: concrete, bumpScale: 0.012 }),
    walnut: new THREE.MeshStandardMaterial({ color: 0xb2a58c, map: wood, roughness: 0.62 }),
    timberFloor: new THREE.MeshStandardMaterial({ color: 0xa89c86, map: wood, roughness: 0.76 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x343932, roughness: 0.5, metalness: 0.68 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8b8c81, roughness: 0.37, metalness: 0.8 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x373c35, roughness: 0.77 }),
    fabric: new THREE.MeshStandardMaterial({ color: 0x777b6b, map: fabric, roughness: 0.98 }),
    linen: new THREE.MeshStandardMaterial({ color: 0xc5c0aa, map: fabric, roughness: 1 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x202820, roughness: 0.83 }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xa6a18d, roughness: 0.63 }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x3b5036, roughness: 0.91, side: THREE.DoubleSide }),
    paper: new THREE.MeshStandardMaterial({ color: 0xc7c6b5, roughness: 0.96 }),
    light: new THREE.MeshStandardMaterial({ color: 0xffecc9, emissive: 0xffe3ad, emissiveIntensity: 2.2 }),
  };
}

export type LevelMaterials = ReturnType<typeof createMaterials>;

export function contactTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(0,0,0,.5)');
  gradient.addColorStop(0.55, 'rgba(0,0,0,.22)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}