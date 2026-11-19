import * as THREE from 'three';

function makeSeededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createMeadowTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const rand = makeSeededRandom(42);

  // Warm sunlit meadow base (calibrated mid-tone green for ACESFilmicToneMapping)
  ctx.fillStyle = '#678E4D';
  ctx.fillRect(0, 0, 512, 512);

  // Soft painterly grass patches
  const tones = ['#5B8242', '#719856', '#608846', '#7AA05C'];
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 10 + rand() * 26;
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tiny clover & meadow daisy speckles
  ctx.globalAlpha = 0.68;
  for (let i = 0; i < 160; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    ctx.fillStyle = rand() > 0.74 ? '#EFE0B3' : '#4C6E36';
    ctx.beginPath();
    ctx.arc(x, y, 1.2 + rand() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 9);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createCobblestoneTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const rand = makeSeededRandom(108);

  // Warm earthy mortar base so stone joints remain legible in bright sunlight
  ctx.fillStyle = '#92816B';
  ctx.fillRect(0, 0, 512, 512);

  const stoneColors = ['#C3B399', '#B9A88E', '#AE9D83', '#CBBCA2', '#A8977D'];
  const rows = 10;
  const cols = 10;
  const cellW = 512 / cols;
  const cellH = 512 / rows;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (cellW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const cx = c * cellW + offset + (rand() - 0.5) * 6;
      const cy = r * cellH + (rand() - 0.5) * 4;
      const w = cellW - 9 + (rand() - 0.5) * 4;
      const h = cellH - 9 + (rand() - 0.5) * 4;

      ctx.fillStyle = stoneColors[Math.floor(rand() * stoneColors.length)];
      ctx.beginPath();
      ctx.roundRect(cx + 4.5, cy + 4.5, w, h, 8);
      ctx.fill();

      // Subtle warm highlight bevel on clay cobblestone
      ctx.strokeStyle = 'rgba(255, 246, 232, 0.28)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createRoofShingleTexture(baseHex: string, highlightHex: string, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const rand = makeSeededRandom(77);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  const rows = 8;
  const cols = 8;
  const w = 256 / cols;
  const h = 256 / rows;

  for (let r = 0; r < rows; r++) {
    const shift = (r % 2) * (w * 0.5);
    for (let c = -1; c <= cols; c++) {
      ctx.fillStyle = rand() > 0.5 ? highlightHex : baseHex;
      ctx.globalAlpha = 0.28 + rand() * 0.25;
      ctx.beginPath();
      ctx.roundRect(c * w + shift + 2, r * h + 2, w - 4, h - 4, 4);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(45, 36, 30, 0.42)');
  grad.addColorStop(0.65, 'rgba(45, 36, 30, 0.16)');
  grad.addColorStop(1, 'rgba(45, 36, 30, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
