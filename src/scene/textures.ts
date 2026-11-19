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
  ctx.fillStyle = '#61884A';
  ctx.fillRect(0, 0, 512, 512);

  // Soft painterly grass patches (deeper mid-tones so the field keeps
  // figure-ground contrast against cream cottages and pale lanes)
  const tones = ['#527B3D', '#6C9450', '#59823F', '#75A057', '#4E7439'];
  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 10 + rand() * 26;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Faint warm dry-grass streaks for painterly depth
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#95A25C';
  for (let i = 0; i < 26; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const w = 30 + rand() * 70;
    ctx.beginPath();
    ctx.ellipse(x, y, w, 8 + rand() * 10, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
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

/**
 * R-05: low-contrast large-scale meadow macro variation, applied as the ground
 * material's `lightMap` over a second UV set (repeat 2x2 vs the detail map's 9x9).
 * Breaks up the visible blotch tiling of the 512px detail texture across the 110m
 * plane by multiplying gentle warm/cool luminance patches (~0.78-1.0) at a scale
 * the detail tile cannot express. Darken-only so the season tint stays in charge.
 */
export function createMeadowMacroTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const rand = makeSeededRandom(77);

  ctx.fillStyle = '#F4F4F4';
  ctx.fillRect(0, 0, 256, 256);

  // Broad soft cool/warm patches at 60-110px radius (tile-scale invisible)
  const patches = ['#DCDFD2', '#E2DCC6', '#D5DAC9', '#E6DFC9', '#D8D8D8'];
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = patches[Math.floor(rand() * patches.length)];
    ctx.globalAlpha = 0.24;
    ctx.beginPath();
    ctx.arc(rand() * 256, rand() * 256, 52 + rand() * 58, 0, Math.PI * 2);
    ctx.fill();
  }

  // Two very broad radial gradients anchor macro composition (dusk-safe subtlety)
  ctx.globalAlpha = 0.18;
  let g = ctx.createRadialGradient(88, 150, 10, 88, 150, 120);
  g.addColorStop(0, '#CDD2C2');
  g.addColorStop(1, 'rgba(205,210,194,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  g = ctx.createRadialGradient(196, 70, 10, 196, 70, 100);
  g.addColorStop(0, '#E8DDBE');
  g.addColorStop(1, 'rgba(232,221,190,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = Math.min(4, maxAnisotropy);
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
  // Softer, longer falloff so grounded contact discs read as gentle ambient
  // occlusion instead of hard grey stains on pale cobblestone.
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(45, 36, 30, 0.34)');
  grad.addColorStop(0.42, 'rgba(45, 36, 30, 0.2)');
  grad.addColorStop(0.78, 'rgba(45, 36, 30, 0.07)');
  grad.addColorStop(1, 'rgba(45, 36, 30, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Fern Hollow Orchard gate sign: hand-lettered cream board with a fern sprig
 * motif, hanging beneath the orchard arch. Seeded so the grain stays stable.
 */
export function createOrchardSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const rand = makeSeededRandom(206);

  // Warm cedar board with visible edge grain
  ctx.fillStyle = '#EAD9BC';
  ctx.fillRect(0, 0, 256, 128);
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#D9C29E' : '#F3E6CC';
    const y = 6 + i * 14 + rand() * 3;
    ctx.fillRect(0, y, 256, 7 + rand() * 4);
  }
  ctx.globalAlpha = 1;
  // Inked border frame
  ctx.strokeStyle = '#8A6B4A';
  ctx.lineWidth = 5;
  ctx.strokeRect(7, 7, 242, 114);
  ctx.lineWidth = 2;
  ctx.strokeRect(15, 15, 226, 98);

  // Title lettering (serif stack; procedural CanvasTexture, no external font)
  ctx.fillStyle = '#3E3026';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 34px Georgia, "Times New Roman", serif';
  ctx.fillText('Fern Hollow', 128, 52);
  ctx.font = '600 27px Georgia, "Times New Roman", serif';
  ctx.fillText('Orchard', 128, 88);

  // Fern sprig flourishes (mirrored fronds on the side margins)
  const drawFrond = (cx: number, cy: number, dir: number) => {
    ctx.strokeStyle = '#5E8062';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 18);
    ctx.quadraticCurveTo(cx + dir * 8, cy + 2, cx + dir * 2, cy - 16);
    ctx.stroke();
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const t = 0.2 + i * 0.16;
      const px = cx + dir * 8 * (1 - t) * t * 2;
      const py = cy + 18 - 34 * t;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - dir * 7, py - 3);
      ctx.moveTo(px, py);
      ctx.lineTo(px + dir * 7, py - 3);
      ctx.stroke();
    }
  };
  drawFrond(38, 64, -1);
  drawFrond(218, 64, 1);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Warm oak plank floor for the Willow Step Cottage interior: hand-laid boards
 * with dark seams, soft grain streaks and occasional knots, so the raised
 * floor reads as crafted carpentry from the isometric camera.
 */
export function createCottageFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const rand = makeSeededRandom(307);

  ctx.fillStyle = '#A97B52';
  ctx.fillRect(0, 0, 512, 512);

  const plankRows = 6;
  const plankH = 512 / plankRows;
  const plankTones = ['#B9855C', '#A97B52', '#B27F55', '#A2744C', '#BC8B60'];

  for (let r = 0; r < plankRows; r++) {
    const y = r * plankH;
    // Per-plank tone variation + gentle vertical shading
    ctx.fillStyle = plankTones[Math.floor(rand() * plankTones.length)];
    ctx.globalAlpha = 0.9;
    ctx.fillRect(0, y, 512, plankH);
    ctx.globalAlpha = 1;

    // Staggered butt joints across the row
    const jointCount = 2 + Math.floor(rand() * 2);
    for (let j = 0; j < jointCount; j++) {
      const jx = ((j + 0.25 + rand() * 0.5) / jointCount) * 512;
      ctx.fillStyle = 'rgba(74, 50, 33, 0.85)';
      ctx.fillRect(jx, y + 1, 2.2, plankH - 2);
    }

    // Horizontal grain streaks
    const streaks = 7;
    for (let s = 0; s < streaks; s++) {
      const gy = y + 4 + rand() * (plankH - 8);
      ctx.strokeStyle = rand() > 0.45 ? 'rgba(120, 82, 52, 0.4)' : 'rgba(210, 165, 118, 0.34)';
      ctx.lineWidth = 1 + rand() * 1.6;
      ctx.beginPath();
      const gx0 = rand() * 512;
      ctx.moveTo(gx0, gy);
      ctx.bezierCurveTo(gx0 + 60, gy + (rand() - 0.5) * 6, gx0 + 140, gy + (rand() - 0.5) * 6, gx0 + 230, gy + (rand() - 0.5) * 4);
      ctx.stroke();
    }

    // Occasional knot
    if (rand() > 0.55) {
      const kx = 60 + rand() * 400;
      const ky = y + plankH * (0.3 + rand() * 0.4);
      ctx.fillStyle = 'rgba(88, 58, 36, 0.6)';
      ctx.beginPath();
      ctx.ellipse(kx, ky, 4.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(70, 46, 28, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(kx, ky, 8, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Dark seam between planks + soft top highlight
    ctx.fillStyle = 'rgba(70, 46, 30, 0.9)';
    ctx.fillRect(0, y + plankH - 2.4, 512, 2.4);
    ctx.fillStyle = 'rgba(255, 226, 190, 0.16)';
    ctx.fillRect(0, y, 512, 1.6);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = maxAnisotropy;
  return tex;
}
