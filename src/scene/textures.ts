import * as THREE from 'three';

function makeSeededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Bundle of procedural surface maps for one material family ("evident craft"
 * program, Doc 06 §2.1). `map` is a near-white albedo overlay (it MULTIPLIES
 * the material color, so luminance stays in the 0.8–1.0 band and the palette
 * stays in charge of hue); `roughnessMap` is a LINEAR (non-color) data texture
 * whose green channel modulates the material's scalar roughness. All maps are
 * low-frequency by law — albedo never carries photoreal noise (Doc 03 §5.2).
 */
export interface ProceduralMapBundle {
  map?: THREE.CanvasTexture;
  roughnessMap?: THREE.CanvasTexture;
}

function finishColorMap(canvas: HTMLCanvasElement, aniso: number): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(4, aniso);
  return tex;
}

function finishDataMap(canvas: HTMLCanvasElement, aniso: number): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace; // roughness data must stay linear (Doc 06 §6.4)
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(4, aniso);
  return tex;
}

/**
 * Wood grain (light cream-cedar / dark cedar variants): long vertical grain
 * streaks in the albedo overlay plus a directionally-modulated roughness map
 * (grain runs rougher across the stroke — Supercell doctrine, Doc 03 §5.1 T3).
 */
export function createWoodGrainMaps(
  variant: 'light' | 'dark',
  aniso = 4,
): ProceduralMapBundle {
  const size = 256;
  const seed = variant === 'light' ? 911 : 977;
  const rand = makeSeededRandom(seed);

  // --- albedo overlay (near-white; hue lives in the material color) ---
  const albedo = document.createElement('canvas');
  albedo.width = size;
  albedo.height = size;
  const a = albedo.getContext('2d')!;
  a.fillStyle = '#F4F4F4';
  a.fillRect(0, 0, size, size);
  const plankTones =
    variant === 'light'
      ? ['#EFE7D6', '#E7DCC6', '#F2EADC', '#E3D5BC']
      : ['#E6D3BC', '#DCC4A6', '#EEDCC4', '#D2B896'];
  for (let i = 0; i < 26; i++) {
    a.globalAlpha = 0.16 + rand() * 0.1;
    a.fillStyle = plankTones[Math.floor(rand() * plankTones.length)];
    const x = rand() * size;
    const w = 5 + rand() * 16;
    a.fillRect(x, 0, w, size);
  }
  // Long grain lines (wavy vertical strokes)
  a.globalAlpha = 0.14;
  a.strokeStyle = variant === 'light' ? '#D8C6A8' : '#C2A279';
  for (let i = 0; i < 30; i++) {
    a.lineWidth = 0.8 + rand() * 1.4;
    const x = rand() * size;
    a.beginPath();
    a.moveTo(x, 0);
    for (let y = 0; y <= size; y += 32) {
      a.lineTo(x + Math.sin(y * 0.04 + i) * 3.2, y);
    }
    a.stroke();
  }
  // Occasional small knots
  a.globalAlpha = 0.2;
  for (let i = 0; i < 3; i++) {
    const kx = rand() * size;
    const ky = rand() * size;
    const g = a.createRadialGradient(kx, ky, 1, kx, ky, 7 + rand() * 5);
    g.addColorStop(0, variant === 'light' ? '#CBB594' : '#A9835C');
    g.addColorStop(1, 'rgba(203,181,148,0)');
    a.fillStyle = g;
    a.beginPath();
    a.arc(kx, ky, 8, 0, Math.PI * 2);
    a.fill();
  }
  a.globalAlpha = 1;

  // --- roughness map (grain direction modulates ±0.12 around ~0.92) ---
  const rough = document.createElement('canvas');
  rough.width = size;
  rough.height = size;
  const r = rough.getContext('2d')!;
  r.fillStyle = '#E6E6E6';
  r.fillRect(0, 0, size, size);
  for (let i = 0; i < 40; i++) {
    r.globalAlpha = 0.22;
    r.fillStyle = rand() > 0.45 ? '#F6F6F6' : '#C9C9C9';
    r.fillRect(rand() * size, 0, 3 + rand() * 14, size);
  }
  r.globalAlpha = 0.14;
  for (let i = 0; i < 220; i++) {
    r.fillStyle = rand() > 0.5 ? '#FFFFFF' : '#BBBBBB';
    r.fillRect(rand() * size, rand() * size, 1.6, 2 + rand() * 7);
  }
  r.globalAlpha = 1;

  return { map: finishColorMap(albedo, aniso), roughnessMap: finishDataMap(rough, aniso) };
}

/**
 * Plaster tooth (walls, interior plaster): a faint warm stipple in the albedo
 * plus a soft roughness stipple — hand-troweled tooth, never noise dirt (T1).
 */
export function createPlasterToothMaps(aniso = 4): ProceduralMapBundle {
  const size = 256;
  const rand = makeSeededRandom(1035);

  const albedo = document.createElement('canvas');
  albedo.width = size;
  albedo.height = size;
  const a = albedo.getContext('2d')!;
  a.fillStyle = '#F6F4F0';
  a.fillRect(0, 0, size, size);
  // Broad soft trowel sweeps
  for (let i = 0; i < 12; i++) {
    a.globalAlpha = 0.08;
    a.fillStyle = rand() > 0.5 ? '#FFFFFF' : '#E9E2D2';
    const w = 30 + rand() * 60;
    a.beginPath();
    a.ellipse(rand() * size, rand() * size, w, w * 0.4, rand() * Math.PI, 0, Math.PI * 2);
    a.fill();
  }
  // Fine tooth stipple
  a.globalAlpha = 0.1;
  for (let i = 0; i < 700; i++) {
    a.fillStyle = rand() > 0.5 ? '#FFFFFF' : '#E4DCC8';
    a.beginPath();
    a.arc(rand() * size, rand() * size, 0.7 + rand() * 1.4, 0, Math.PI * 2);
    a.fill();
  }
  a.globalAlpha = 1;

  const rough = document.createElement('canvas');
  rough.width = size;
  rough.height = size;
  const r = rough.getContext('2d')!;
  r.fillStyle = '#E2E2E2';
  r.fillRect(0, 0, size, size);
  r.globalAlpha = 0.16;
  for (let i = 0; i < 500; i++) {
    r.fillStyle = rand() > 0.5 ? '#FFFFFF' : '#C4C4C4';
    r.beginPath();
    r.arc(rand() * size, rand() * size, 1 + rand() * 2.2, 0, Math.PI * 2);
    r.fill();
  }
  r.globalAlpha = 1;

  return { map: finishColorMap(albedo, aniso), roughnessMap: finishDataMap(rough, aniso) };
}

/**
 * Stone courses (cobble mortar & brick): mortar reads rougher and the stone
 * faces slightly smoother — the V6 "stones read as stones" carrier (T1).
 */
export function createStoneCourseMaps(kind: 'cobble' | 'brick', aniso = 4): ProceduralMapBundle {
  const size = 256;
  const rand = makeSeededRandom(kind === 'cobble' ? 1471 : 1499);

  const rough = document.createElement('canvas');
  rough.width = size;
  rough.height = size;
  const r = rough.getContext('2d')!;
  // Mortar base = maximum roughness
  r.fillStyle = '#FFFFFF';
  r.fillRect(0, 0, size, size);
  // Stone faces = smoother (greener channel = lower roughness multiplier)
  const rows = kind === 'cobble' ? 5 : 4;
  const cols = kind === 'cobble' ? 5 : 4;
  const cellW = size / cols;
  const cellH = size / rows;
  for (let row = 0; row < rows; row++) {
    const offset = (row % 2) * (cellW * 0.5);
    for (let col = -1; col <= cols; col++) {
      const cx = col * cellW + offset + (rand() - 0.5) * 3;
      const cy = row * cellH + (rand() - 0.5) * 2;
      const w = cellW - (kind === 'cobble' ? 8 : 6);
      const h = cellH - (kind === 'cobble' ? 8 : 5);
      const shade = Math.floor(150 + rand() * 60); // 150..210 → roughness ×0.59..0.82
      r.fillStyle = `rgb(${shade},${shade},${shade})`;
      r.beginPath();
      r.roundRect(cx + 4, cy + 4, w, h, kind === 'cobble' ? 7 : 3);
      r.fill();
      // Per-stone surface variation
      r.globalAlpha = 0.18;
      r.fillStyle = rand() > 0.5 ? '#FFFFFF' : '#8C8C8C';
      for (let k = 0; k < 8; k++) {
        r.beginPath();
        r.arc(cx + 4 + rand() * w, cy + 4 + rand() * h, 1 + rand() * 2.4, 0, Math.PI * 2);
        r.fill();
      }
      r.globalAlpha = 1;
    }
  }

  // Albedo: near-white with a faint face/mortar luminance split (subtle!)
  const albedo = document.createElement('canvas');
  albedo.width = size;
  albedo.height = size;
  const a = albedo.getContext('2d')!;
  a.fillStyle = '#EFECE6';
  a.fillRect(0, 0, size, size);
  for (let row = 0; row < rows; row++) {
    const offset = (row % 2) * (cellW * 0.5);
    for (let col = -1; col <= cols; col++) {
      const cx = col * cellW + offset + (rand() - 0.5) * 3;
      const cy = row * cellH + (rand() - 0.5) * 2;
      const w = cellW - (kind === 'cobble' ? 8 : 6);
      const h = cellH - (kind === 'cobble' ? 8 : 5);
      a.fillStyle = rand() > 0.5 ? '#F7F5F0' : '#E9E5DC';
      a.beginPath();
      a.roundRect(cx + 4, cy + 4, w, h, kind === 'cobble' ? 7 : 3);
      a.fill();
    }
  }

  return { map: finishColorMap(albedo, aniso), roughnessMap: finishDataMap(rough, aniso) };
}

/**
 * Fabric weave (knit/linen/quilt): crosshatch roughness so textiles read as
 * fibre at gameplay distance without any albedo noise (T2).
 */
export function createFabricWeaveTexture(aniso = 4): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = makeSeededRandom(1553);
  ctx.fillStyle = '#E0E0E0';
  ctx.fillRect(0, 0, size, size);
  // Warp/weft threads
  for (let i = 0; i < 32; i++) {
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = i % 2 === 0 ? '#F4F4F4' : '#C2C2C2';
    ctx.fillRect(0, (i / 32) * size, size, size / 64);
    ctx.fillRect((i / 32) * size, 0, size / 64, size);
  }
  // Fibre flecks
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = rand() > 0.5 ? '#FFFFFF' : '#B8B8B8';
    ctx.fillRect(rand() * size, rand() * size, 1.4, 1.4);
  }
  ctx.globalAlpha = 1;
  return finishDataMap(canvas, aniso);
}

/**
 * Fabric albedo + weave bundle (BUILD 02 Workstream E §8.1 — Doc 04 §6.1
 * "fabric albedo weave"): upgrades the roughness-only fabric family with a
 * NEAR-WHITE thread-row albedo overlay so garments/quilts catch light along
 * the weave at gameplay distance. Deliberately quiet — ±3% thread luminance,
 * no fibre speckle noise, hue authority stays with the palette color — so the
 * texture improves perceived quality without ever reading as noise.
 * The roughness channel is byte-identical to `createFabricWeaveTexture`
 * (same seed, same drawing order) so the validated weave roughness is kept.
 */
export function createFabricAlbedoMaps(aniso = 4): ProceduralMapBundle {
  const size = 128;
  const albedo = document.createElement('canvas');
  albedo.width = size;
  albedo.height = size;
  const a = albedo.getContext('2d')!;
  // Near-white base: the material's color does the talking (SRGB map multiplies).
  a.fillStyle = '#FCFBF9';
  a.fillRect(0, 0, size, size);
  // Alternating thread rows — warp lighter, weft a hair deeper (±3%).
  for (let i = 0; i < 16; i++) {
    a.globalAlpha = 0.55;
    a.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#F1EEE8';
    a.fillRect(0, (i / 16) * size, size, size / 32);
    a.fillRect((i / 16) * size, 0, size / 32, size);
  }
  // Sparse long fibre strokes (directional, not speckle) for a spun-yarn read.
  const rand = makeSeededRandom(1663);
  a.globalAlpha = 0.18;
  for (let i = 0; i < 48; i++) {
    const x = rand() * size;
    const yy = rand() * size;
    const len = 4 + rand() * 8;
    a.strokeStyle = rand() > 0.5 ? '#FFFFFF' : '#EDE9E0';
    a.lineWidth = 0.8;
    a.beginPath();
    a.moveTo(x, yy);
    a.lineTo(x + (rand() > 0.5 ? len : -len), yy + (rand() - 0.5) * 1.5);
    a.stroke();
  }
  a.globalAlpha = 1;
  return { map: finishColorMap(albedo, aniso), roughnessMap: createFabricWeaveTexture(aniso) };
}

/**
 * Shared scalar-noise roughness (T1–T3 families without a dedicated map):
 * gentle broad patches so matte surfaces never read as flat plastic.
 */
export function createNoiseRoughnessTexture(aniso = 4): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = makeSeededRandom(1601);
  ctx.fillStyle = '#E8E8E8';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 18; i++) {
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = rand() > 0.5 ? '#FBFBFB' : '#D0D0D0';
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, 10 + rand() * 22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = rand() > 0.5 ? '#FFFFFF' : '#CFCFCF';
    ctx.fillRect(rand() * size, rand() * size, 2, 2);
  }
  ctx.globalAlpha = 1;
  return finishDataMap(canvas, aniso);
}

/**
 * Paper grain (ledgers, almanac, posters): soft fibre luminance overlay.
 */
export function createPaperGrainTexture(aniso = 4): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = makeSeededRandom(1657);
  ctx.fillStyle = '#F7F5F0';
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 130; i++) {
    ctx.fillStyle = rand() > 0.5 ? '#FFFFFF' : '#EAE4D6';
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 4, 1);
  }
  ctx.globalAlpha = 1;
  return finishColorMap(canvas, aniso);
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
  // FLICKER FIX T2 (investigation R6): the diorama's worst ground footprint elongation
  // (~5:1 at glancing angles) needs aniso ≈8; 16 is redundant bandwidth on mobile
  // TBDR GPUs, and raw device max can even be 0 (extension absent) — cap it.
  tex.anisotropy = Math.min(8, maxAnisotropy);
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

  // Warm earthy mortar base so stone joints remain legible in bright sunlight.
  // Build 01: mortar value deepened one step (Doc 03 §2.2) so stones read as
  // stones at gameplay distance in every season.
  ctx.fillStyle = '#84745F';
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
  // FLICKER FIX T2 (investigation R6): aniso 8 covers the plaza's worst-case glancing
  // footprint; uncapped max wastes TBDR bandwidth and can be 0 on some devices.
  tex.anisotropy = Math.min(8, maxAnisotropy);
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

/**
 * Lantern-glass warm gradient (BUILD 02 Doc 05 §3.2 P3): a vertical warm
 * emissive falloff — brightest just below the bulb's mid, easing toward the
 * rim — so plaza lamp glass and festoon bulbs read as a "pool of light" at
 * dusk instead of a uniform glow. Rides the SHARED lantern material as an
 * emissiveMap: the dusk schedule (environmentRenderer) is untouched, zero new
 * materials/meshes/draw calls.
 */
export function createLanternGlowTexture(aniso = 4): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0.0, '#C8A868'); // top rim: dimmest
  grad.addColorStop(0.45, '#EED898'); // mid
  grad.addColorStop(0.78, '#FFF4C8'); // bright pool just below the mid
  grad.addColorStop(1.0, '#E8CC8A'); // base collar
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  // Soft horizontal edge falloff so the glass cylinder's seam stays quiet.
  const side = ctx.createLinearGradient(0, 0, size, 0);
  side.addColorStop(0.0, 'rgba(0,0,0,0.18)');
  side.addColorStop(0.25, 'rgba(0,0,0,0)');
  side.addColorStop(0.75, 'rgba(0,0,0,0)');
  side.addColorStop(1.0, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, size, size);
  return finishColorMap(canvas, aniso);
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
 * Footstep dust poof: a soft irregular warm puff sprite for the pooled player
 * footstep/skid particle system. Slightly lumpy radial falloff reads as kicked-up
 * lane dust rather than a perfect fog circle, matching the storybook diorama look.
 */
export function createFootstepDustTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const rand = makeSeededRandom(311);

  // Three overlapping soft lobes give the puff a hand-drawn silhouette
  const lobes: Array<[number, number, number, number]> = [
    [32, 32, 26, 0.5],
    [24, 30, 16, 0.34],
    [40, 36, 15, 0.3],
  ];
  for (const [cx, cy, r, a] of lobes) {
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
    grad.addColorStop(0, `rgba(226, 208, 178, ${a})`);
    grad.addColorStop(0.55, `rgba(210, 190, 158, ${a * 0.55})`);
    grad.addColorStop(1, 'rgba(198, 178, 146, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }

  // A few tiny bright motes for sparkle in raking light
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = '#EFE3C8';
    ctx.beginPath();
    ctx.arc(14 + rand() * 36, 16 + rand() * 34, 0.9 + rand() * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

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
