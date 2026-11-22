import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  PortraitDescriptor,
  SubjectDescriptor,
} from '../game/dialogue/assets';
import { UI_PALETTE } from './uiPalette';

/**
 * Procedural portrait / subject painters for the dialogue sheet (Priorities 2–3).
 * Pure canvas rendering of the inert descriptors produced by
 * `src/game/dialogue/assets.ts` — no external assets, no per-frame work
 * (repaints happen only when the descriptor or size actually changes).
 */

const INK = UI_PALETTE.espresso;
const LINEN_BORDER = UI_PALETTE.stoneLine;

function paintRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexWithAlpha(hex: string, alpha: number): string {
  const p = parseInt(hex.slice(1), 16);
  const r = (p >> 16) & 255;
  const g = (p >> 8) & 255;
  const b = p & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Shared 64px (phone) / 80px (sm+) sizing so both slots stay in lockstep. */
export function useDialogueVisualSize(): number {
  const [size, setSize] = useState<number>(64);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const apply = () => setSize(mq.matches ? 80 : 64);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return size;
}

// ---------------------------------------------------------------------------
// Portrait painter
// ---------------------------------------------------------------------------

function paintKnitPattern(
  ctx: CanvasRenderingContext2D,
  size: number,
  pattern: string,
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = hexWithAlpha(color, 0.16);
  ctx.fillStyle = hexWithAlpha(color, 0.14);
  ctx.lineWidth = Math.max(1.5, size * 0.028);
  const rows = 5;
  switch (pattern) {
    case 'stripes': {
      const bandH = size / (rows * 2);
      for (let i = 0; i < rows; i++) {
        ctx.fillRect(0, size * 0.16 + i * bandH * 2.6, size, bandH);
      }
      break;
    }
    case 'dots': {
      const step = size / 4.4;
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          ctx.beginPath();
          ctx.arc(step * (x + (y % 2) * 0.5), size * 0.12 + step * y * 0.92, size * 0.035, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'chevrons': {
      for (let row = 0; row < rows; row++) {
        const y = size * 0.14 + row * (size * 0.16);
        ctx.beginPath();
        for (let x = 0; x <= size; x += size / 8) {
          const zig = row % 2 === 0 ? Math.abs(((x / (size / 8)) % 2) - 1) : 1 - Math.abs(((x / (size / 8)) % 2) - 1);
          if (x === 0) ctx.moveTo(x, y + zig * size * 0.05);
          else ctx.lineTo(x, y + zig * size * 0.05);
        }
        ctx.stroke();
      }
      break;
    }
    case 'braids': {
      for (let i = 0; i < 4; i++) {
        const x0 = size * (0.14 + i * 0.24);
        ctx.beginPath();
        for (let t = 0; t <= 1.001; t += 0.08) {
          const y = size * (0.1 + t * 0.8);
          const x = x0 + Math.sin(t * Math.PI * 3 + i) * size * 0.05;
          if (t === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
    case 'cables': {
      for (let i = 0; i < 3; i++) {
        for (const off of [-0.045, 0.045]) {
          const x0 = size * (0.24 + i * 0.26) + off * size;
          ctx.beginPath();
          for (let t = 0; t <= 1.001; t += 0.1) {
            const y = size * (0.1 + t * 0.8);
            const x = x0 + Math.sin(t * Math.PI * 5 + i * 2) * size * 0.028;
            if (t === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

function paintPortraitMotifBadge(
  ctx: CanvasRenderingContext2D,
  size: number,
  motif: string,
  accent: string,
) {
  if (motif === 'none') return;
  const cx = size * 0.815;
  const cy = size * 0.815;
  const r = size * 0.155;
  ctx.save();
  ctx.fillStyle = UI_PALETTE.linen;
  ctx.strokeStyle = LINEN_BORDER;
  ctx.lineWidth = Math.max(1, size * 0.02);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.translate(cx, cy);
  const u = r * 0.72; // glyph unit
  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;
  ctx.lineWidth = Math.max(1.4, size * 0.026);
  ctx.lineCap = 'round';
  switch (motif) {
    case 'satchel':
      ctx.strokeRect(-u * 0.6, -u * 0.35, u * 1.2, u * 0.8);
      ctx.beginPath();
      ctx.moveTo(-u * 0.55, -u * 0.35);
      ctx.quadraticCurveTo(0, -u * 0.95, u * 0.55, -u * 0.35);
      ctx.stroke();
      break;
    case 'watering_can':
      ctx.beginPath();
      ctx.ellipse(0, u * 0.12, u * 0.62, u * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(u * 0.5, -u * 0.1);
      ctx.lineTo(u * 0.95, -u * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-u * 0.5, -u * 0.28, u * 0.32, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      break;
    case 'violin':
      ctx.beginPath();
      ctx.ellipse(u * 0.1, u * 0.18, u * 0.42, u * 0.56, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(u * 0.28, -u * 0.1);
      ctx.lineTo(u * 0.85, -u * 0.75);
      ctx.stroke();
      break;
    case 'sketchbook':
      ctx.strokeRect(-u * 0.6, -u * 0.55, u * 1.15, u * 1.05);
      ctx.beginPath();
      ctx.moveTo(-u * 0.35, u * 0.25);
      ctx.lineTo(u * 0.3, -u * 0.3);
      ctx.stroke();
      break;
    case 'book':
      ctx.beginPath();
      ctx.moveTo(0, -u * 0.5);
      ctx.quadraticCurveTo(-u * 0.55, -u * 0.6, -u * 0.7, -u * 0.35);
      ctx.lineTo(-u * 0.7, u * 0.4);
      ctx.quadraticCurveTo(-u * 0.5, u * 0.2, 0, u * 0.35);
      ctx.quadraticCurveTo(u * 0.5, u * 0.2, u * 0.7, u * 0.4);
      ctx.lineTo(u * 0.7, -u * 0.35);
      ctx.quadraticCurveTo(u * 0.55, -u * 0.6, 0, -u * 0.5);
      ctx.stroke();
      break;
    case 'loaf': {
      ctx.fillStyle = '#C99A5B';
      ctx.beginPath();
      ctx.ellipse(0, u * 0.1, u * 0.7, u * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8F6A3C';
      ctx.beginPath();
      for (const off of [-0.3, 0, 0.3]) {
        ctx.moveTo(off * u, -u * 0.12);
        ctx.lineTo(off * u + u * 0.08, u * 0.1);
      }
      ctx.stroke();
      break;
    }
    case 'fruit_basket': {
      ctx.strokeStyle = '#8F6A3C';
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(-u * 0.62, -u * 0.15);
      ctx.lineTo(u * 0.62, -u * 0.15);
      ctx.lineTo(u * 0.45, u * 0.5);
      ctx.lineTo(-u * 0.45, u * 0.5);
      ctx.closePath();
      ctx.stroke();
      for (const [fx, fy] of [[-0.25, -0.32], [0.1, -0.42], [0.4, -0.25]] as const) {
        ctx.beginPath();
        ctx.arc(fx * u, fy * u, u * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

function paintPortrait(
  ctx: CanvasRenderingContext2D,
  desc: PortraitDescriptor,
  size: number,
) {
  ctx.clearRect(0, 0, size, size);
  if (desc.kind === 'initial') {
    paintRoundedRect(ctx, 0, 0, size, size, size * 0.3);
    ctx.fillStyle = desc.color;
    ctx.fill();
    ctx.fillStyle = UI_PALETTE.linen;
    ctx.font = `bold ${Math.round(size * 0.44)}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(desc.initial, size / 2, size * 0.54);
    return;
  }

  const S = size;
  // Backdrop wash + knit pattern
  paintRoundedRect(ctx, 0, 0, S, S, S * 0.26);
  ctx.fillStyle = desc.backdrop;
  ctx.fill();
  ctx.save();
  ctx.clip();
  paintKnitPattern(ctx, S, desc.knitPattern, desc.coatColor);
  // Shoulders / coat
  ctx.fillStyle = desc.coatColor;
  ctx.beginPath();
  ctx.ellipse(S * 0.5, S * 1.12, S * 0.42, S * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  // Collar accent band
  ctx.strokeStyle = hexWithAlpha(desc.accentColor, 0.85);
  ctx.lineWidth = Math.max(1.5, S * 0.035);
  ctx.beginPath();
  ctx.ellipse(S * 0.5, S * 0.94, S * 0.24, S * 0.16, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();

  // Head
  const hx = S * 0.5;
  const hy = S * 0.47;
  const hr = S * 0.21;
  ctx.fillStyle = desc.skinColor;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.fill();
  // Ears
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(hx + side * hr * 0.92, hy + hr * 0.08, hr * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hair / headwear per style
  const hair = desc.hairColor;
  switch (desc.hatStyle) {
    case 'none': {
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.arc(hx, hy - hr * 0.18, hr * 1.02, Math.PI * 1.04, Math.PI * 1.96);
      ctx.quadraticCurveTo(hx + hr * 0.7, hy - hr * 0.12, hx + hr * 0.62, hy + hr * 0.22);
      ctx.lineTo(hx + hr * 0.3, hy - hr * 0.1);
      ctx.lineTo(hx - hr * 0.3, hy - hr * 0.1);
      ctx.lineTo(hx - hr * 0.62, hy + hr * 0.22);
      ctx.quadraticCurveTo(hx - hr * 0.7, hy - hr * 0.12, hx - hr * 0.99, hy - hr * 0.18);
      ctx.fill();
      break;
    }
    case 'bun': {
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.arc(hx, hy - hr * 0.14, hr, Math.PI * 0.98, Math.PI * 2.02);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hx, hy - hr * 1.28, hr * 0.42, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'cap': {
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.arc(hx, hy - hr * 0.1, hr, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = desc.accentColor;
      ctx.beginPath();
      ctx.ellipse(hx, hy - hr * 0.42, hr * 1.04, hr * 0.62, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(hx + hr * 0.18, hy - hr * 0.36, hr * 1.08, hr * 0.22, 0.08, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'beret': {
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.arc(hx, hy - hr * 0.14, hr * 1.0, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
      ctx.fillStyle = desc.accentColor;
      ctx.beginPath();
      ctx.ellipse(hx + hr * 0.14, hy - hr * 0.72, hr * 1.12, hr * 0.5, -0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hx + hr * 0.2, hy - hr * 1.22, hr * 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'straw': {
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.arc(hx, hy - hr * 0.16, hr * 0.98, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#DDB26B';
      ctx.beginPath();
      ctx.ellipse(hx, hy - hr * 0.5, hr * 1.5, hr * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(hx, hy - hr * 0.72, hr * 0.8, hr * 0.5, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = desc.accentColor;
      ctx.lineWidth = Math.max(1.2, S * 0.022);
      ctx.beginPath();
      ctx.ellipse(hx, hy - hr * 0.52, hr * 0.82, hr * 0.34, 0, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      break;
    }
    case 'hood': {
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.arc(hx, hy - hr * 0.1, hr, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexWithAlpha(desc.coatColor, 0.95);
      ctx.lineWidth = Math.max(2, S * 0.045);
      ctx.beginPath();
      ctx.arc(hx, hy - hr * 0.05, hr * 1.22, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
      break;
    }
  }

  // Face: eyes + expression
  const eyeY = hy + hr * 0.05;
  const eyeDX = hr * 0.42;
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = Math.max(1.4, S * 0.028);
  ctx.lineCap = 'round';
  if (desc.expression === 'soft') {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(hx + side * eyeDX, eyeY, hr * 0.14, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  } else {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(hx + side * eyeDX, eyeY, Math.max(1.4, S * 0.02), 0, Math.PI * 2);
      ctx.fill();
    }
    if (desc.expression === 'thoughtful') {
      ctx.beginPath();
      ctx.moveTo(hx - eyeDX - hr * 0.14, eyeY - hr * 0.24);
      ctx.lineTo(hx - eyeDX + hr * 0.1, eyeY - hr * 0.3);
      ctx.stroke();
    }
  }
  // Nose + smile
  ctx.beginPath();
  ctx.moveTo(hx, hy + hr * 0.16);
  ctx.lineTo(hx + hr * 0.06, hy + hr * 0.24);
  ctx.stroke();
  const smileR = desc.expression === 'smile' ? hr * 0.3 : hr * 0.2;
  ctx.beginPath();
  ctx.arc(hx, hy + hr * 0.22, smileR, Math.PI * 0.18, Math.PI * 0.82);
  ctx.stroke();
  if (desc.expression === 'smile') {
    ctx.fillStyle = hexWithAlpha(desc.accentColor, 0.22);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(hx + side * hr * 0.62, hy + hr * 0.28, hr * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  paintPortraitMotifBadge(ctx, S, desc.motif, desc.accentColor);

  // Rim
  paintRoundedRect(ctx, 0.5, 0.5, S - 1, S - 1, S * 0.26);
  ctx.strokeStyle = LINEN_BORDER;
  ctx.lineWidth = 1;
  ctx.stroke();
}

export const PortraitCanvas: React.FC<{
  descriptor: PortraitDescriptor;
  size: number;
  className?: string;
}> = ({ descriptor, size, className }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // UI/UX program WP2: callers resolve fresh descriptor objects per render, so
  // depending on identity repainted the canvas on EVERY sheet re-render. The
  // repaint now keys on the descriptor's VALUE — the header comment's contract
  // ("repaints only when the descriptor or size actually changes") is honored.
  const descriptorKey = useMemo(() => JSON.stringify(descriptor), [descriptor]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintPortrait(ctx, descriptor, size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptorKey, size]);
  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className={className}
      aria-hidden="true"
    />
  );
};

// ---------------------------------------------------------------------------
// Subject painter
// ---------------------------------------------------------------------------

function paintSubject(
  ctx: CanvasRenderingContext2D,
  desc: SubjectDescriptor,
  size: number,
) {
  ctx.clearRect(0, 0, size, size);
  const S = size;
  paintRoundedRect(ctx, 0, 0, S, S, S * 0.26);
  ctx.fillStyle = desc.kind === 'procedural' ? desc.backdrop : UI_PALETTE.linenDeep;
  ctx.fill();

  if (desc.kind === 'fallback') {
    // Quiet yarn-ball placeholder
    const cx = S * 0.5;
    const cy = S * 0.52;
    const r = S * 0.2;
    ctx.fillStyle = UI_PALETTE.terracotta;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(45,36,30,0.35)';
    ctx.lineWidth = Math.max(1.4, S * 0.02);
    for (const off of [-0.5, 0, 0.5]) {
      ctx.beginPath();
      ctx.ellipse(cx + off * r * 0.5, cy, r * 0.55, r, off * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    paintRoundedRect(ctx, 0.5, 0.5, S - 1, S - 1, S * 0.26);
    ctx.strokeStyle = LINEN_BORDER;
    ctx.lineWidth = 1;
    ctx.stroke();
    return;
  }

  const wood = desc.wood;
  const primary = desc.primary;
  const accent = desc.accent;
  ctx.save();
  ctx.clip();
  // Ground shadow
  ctx.fillStyle = 'rgba(45,36,30,0.08)';
  ctx.beginPath();
  ctx.ellipse(S * 0.5, S * 0.82, S * 0.32, S * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  const box = (x: number, y: number, w: number, h: number, color: string, radius = 0.03) => {
    paintRoundedRect(ctx, x, y, w, h, S * radius);
    ctx.fillStyle = color;
    ctx.fill();
  };

  switch (desc.subject) {
    case 'oak_table':
      box(S * 0.16, S * 0.42, S * 0.68, S * 0.1, wood);
      box(S * 0.24, S * 0.52, S * 0.05, S * 0.28, hexWithAlpha(wood, 0.8));
      box(S * 0.71, S * 0.52, S * 0.05, S * 0.28, hexWithAlpha(wood, 0.8));
      box(S * 0.44, S * 0.3, S * 0.1, S * 0.12, primary); // vase
      break;
    case 'hearth':
      box(S * 0.2, S * 0.3, S * 0.6, S * 0.5, '#8C7D6F', 0.06);
      ctx.fillStyle = UI_PALETTE.espresso;
      ctx.beginPath();
      ctx.arc(S * 0.5, S * 0.72, S * 0.18, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(S * 0.5, S * 0.68, S * 0.09, S * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = UI_PALETTE.honey;
      ctx.beginPath();
      ctx.ellipse(S * 0.5, S * 0.7, S * 0.05, S * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'flower_vase':
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.moveTo(S * 0.5, S * 0.34);
      ctx.quadraticCurveTo(S * 0.32, S * 0.5, S * 0.42, S * 0.62);
      ctx.lineTo(S * 0.58, S * 0.62);
      ctx.quadraticCurveTo(S * 0.68, S * 0.5, S * 0.5, S * 0.34);
      ctx.fill();
      ctx.fillStyle = accent;
      for (const [fx, fy] of [[0.42, 0.4], [0.56, 0.38], [0.5, 0.32]] as const) {
        ctx.beginPath();
        ctx.arc(S * fx, S * fy, S * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
      box(S * 0.4, S * 0.62, S * 0.2, S * 0.2, '#9E8B78', 0.04);
      break;
    case 'book_shelf':
    case 'seed_shelf':
    case 'notes_shelf':
    case 'brass_shelf':
      box(S * 0.18, S * 0.26, S * 0.64, S * 0.05, wood);
      box(S * 0.18, S * 0.48, S * 0.64, S * 0.05, wood);
      box(S * 0.24, S * 0.31, S * 0.1, S * 0.17, accent);
      box(S * 0.36, S * 0.31, S * 0.08, S * 0.17, primary);
      box(S * 0.5, S * 0.35, S * 0.12, S * 0.13, UI_PALETTE.honey);
      box(S * 0.3, S * 0.53, S * 0.14, S * 0.16, primary);
      box(S * 0.5, S * 0.55, S * 0.1, S * 0.14, accent);
      break;
    case 'writing_desk':
      box(S * 0.18, S * 0.5, S * 0.64, S * 0.08, wood);
      box(S * 0.24, S * 0.58, S * 0.05, S * 0.22, hexWithAlpha(wood, 0.8));
      box(S * 0.71, S * 0.58, S * 0.05, S * 0.22, hexWithAlpha(wood, 0.8));
      box(S * 0.36, S * 0.4, S * 0.22, S * 0.1, UI_PALETTE.linen);
      ctx.strokeStyle = hexWithAlpha(INK, 0.6);
      ctx.lineWidth = Math.max(1, S * 0.015);
      ctx.beginPath();
      ctx.moveTo(S * 0.39, S * 0.45);
      ctx.lineTo(S * 0.55, S * 0.45);
      ctx.stroke();
      break;
    case 'planter_box':
    case 'window_box':
      box(S * 0.2, S * 0.52, S * 0.6, S * 0.18, wood, 0.04);
      ctx.fillStyle = primary;
      for (const fx of [0.32, 0.5, 0.68]) {
        ctx.beginPath();
        ctx.ellipse(S * fx, S * 0.46, S * 0.05, S * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = accent;
      for (const fx of [0.32, 0.5, 0.68]) {
        ctx.beginPath();
        ctx.arc(S * fx, S * 0.35, S * 0.045, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'bed_quilt':
      box(S * 0.14, S * 0.5, S * 0.72, S * 0.22, wood, 0.05);
      box(S * 0.14, S * 0.42, S * 0.72, S * 0.12, primary, 0.05);
      ctx.strokeStyle = hexWithAlpha(UI_PALETTE.linen, 0.7);
      ctx.lineWidth = Math.max(1.4, S * 0.02);
      for (const fx of [0.34, 0.5, 0.66]) {
        ctx.beginPath();
        ctx.moveTo(S * fx, S * 0.44);
        ctx.lineTo(S * fx, S * 0.62);
        ctx.stroke();
      }
      break;
    case 'doorway':
      box(S * 0.26, S * 0.24, S * 0.48, S * 0.58, wood, 0.05);
      box(S * 0.32, S * 0.3, S * 0.36, S * 0.52, hexWithAlpha(wood, 0.55), 0.04);
      ctx.fillStyle = UI_PALETTE.honey;
      ctx.beginPath();
      ctx.arc(S * 0.62, S * 0.56, S * 0.025, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'potting_bench':
    case 'prep_table':
      box(S * 0.16, S * 0.46, S * 0.68, S * 0.09, wood);
      box(S * 0.22, S * 0.55, S * 0.05, S * 0.25, hexWithAlpha(wood, 0.8));
      box(S * 0.73, S * 0.55, S * 0.05, S * 0.25, hexWithAlpha(wood, 0.8));
      box(S * 0.3, S * 0.36, S * 0.14, S * 0.1, primary, 0.05);
      box(S * 0.52, S * 0.38, S * 0.12, S * 0.08, accent, 0.05);
      break;
    case 'watering_can':
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.ellipse(S * 0.52, S * 0.6, S * 0.16, S * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = primary;
      ctx.lineWidth = Math.max(2, S * 0.035);
      ctx.beginPath();
      ctx.moveTo(S * 0.66, S * 0.56);
      ctx.lineTo(S * 0.82, S * 0.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(S * 0.4, S * 0.5, S * 0.09, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      break;
    case 'greenhouse_table':
      box(S * 0.14, S * 0.48, S * 0.72, S * 0.09, wood);
      box(S * 0.2, S * 0.57, S * 0.05, S * 0.23, hexWithAlpha(wood, 0.8));
      box(S * 0.75, S * 0.57, S * 0.05, S * 0.23, hexWithAlpha(wood, 0.8));
      ctx.fillStyle = primary;
      for (const fx of [0.3, 0.46, 0.62]) {
        ctx.beginPath();
        ctx.ellipse(S * fx, S * 0.43, S * 0.05, S * 0.09, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'bakery_oven':
      box(S * 0.2, S * 0.28, S * 0.6, S * 0.52, '#6E6259', 0.05);
      box(S * 0.28, S * 0.4, S * 0.44, S * 0.22, UI_PALETTE.espresso, 0.04);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(S * 0.5, S * 0.62, S * 0.16, S * 0.1, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      break;
    case 'bakery_counter':
    case 'cafe_table':
      box(S * 0.16, S * 0.44, S * 0.68, S * 0.1, wood);
      box(S * 0.22, S * 0.54, S * 0.05, S * 0.26, hexWithAlpha(wood, 0.8));
      box(S * 0.73, S * 0.54, S * 0.05, S * 0.26, hexWithAlpha(wood, 0.8));
      ctx.fillStyle = UI_PALETTE.linen;
      ctx.beginPath();
      ctx.ellipse(S * 0.42, S * 0.4, S * 0.09, S * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(S * 0.58, S * 0.38, S * 0.06, S * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'loaf':
      ctx.fillStyle = '#C99A5B';
      ctx.beginPath();
      ctx.ellipse(S * 0.5, S * 0.56, S * 0.24, S * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8F6A3C';
      ctx.lineWidth = Math.max(1.4, S * 0.02);
      for (const off of [-0.09, 0, 0.09]) {
        ctx.beginPath();
        ctx.moveTo(S * (0.5 + off), S * 0.46);
        ctx.lineTo(S * (0.5 + off + 0.02), S * 0.55);
        ctx.stroke();
      }
      break;
    case 'reading_chair':
      ctx.fillStyle = accent;
      paintRoundedRect(ctx, S * 0.28, S * 0.3, S * 0.44, S * 0.28, S * 0.1);
      ctx.fill();
      paintRoundedRect(ctx, S * 0.24, S * 0.54, S * 0.52, S * 0.2, S * 0.08);
      ctx.fill();
      box(S * 0.28, S * 0.74, S * 0.08, S * 0.08, hexWithAlpha(wood, 0.9));
      box(S * 0.64, S * 0.74, S * 0.08, S * 0.08, hexWithAlpha(wood, 0.9));
      break;
    case 'tea_console':
    case 'teacup': {
      box(S * 0.24, S * 0.52, S * 0.52, S * 0.08, wood);
      ctx.fillStyle = UI_PALETTE.linen;
      ctx.beginPath();
      ctx.arc(S * 0.5, S * 0.44, S * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1.6, S * 0.025);
      ctx.beginPath();
      ctx.arc(S * 0.64, S * 0.44, S * 0.06, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.stroke();
      ctx.strokeStyle = hexWithAlpha('#8C7D6F', 0.5);
      ctx.beginPath();
      ctx.moveTo(S * 0.5, S * 0.24);
      ctx.quadraticCurveTo(S * 0.46, S * 0.3, S * 0.5, S * 0.34);
      ctx.stroke();
      break;
    }
    // BUILD 04 (Doc 03 §9.3): parametric satchel-item scenes — tinted by the
    // recipe's primary/accent tones, same painter, no new systems.
    case 'item_sprig': {
      ctx.strokeStyle = '#7B9F5C';
      ctx.lineWidth = Math.max(1.6, S * 0.03);
      ctx.beginPath();
      ctx.moveTo(S * 0.5, S * 0.82);
      ctx.quadraticCurveTo(S * 0.46, S * 0.6, S * 0.52, S * 0.34);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(S * 0.36, S * 0.66, S * 0.08, S * 0.045, -0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(S * 0.63, S * 0.56, S * 0.08, S * 0.045, 0.7, 0, Math.PI * 2);
      ctx.fill();
      const sprigBlooms: Array<[number, number, number]> = [
        [0.52, 0.3, 0.085],
        [0.38, 0.38, 0.065],
        [0.63, 0.4, 0.06],
      ];
      for (const [bx, by, br] of sprigBlooms) {
        ctx.fillStyle = primary;
        ctx.beginPath();
        ctx.arc(S * bx, S * by, S * br, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hexWithAlpha(UI_PALETTE.honey, 0.9);
        ctx.beginPath();
        ctx.arc(S * bx, S * by, S * br * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'item_seeds': {
      // Kraft seed pouch with a tinted band and scattered seeds.
      box(S * 0.26, S * 0.34, S * 0.48, S * 0.44, '#D9C4A4', 0.06);
      box(S * 0.26, S * 0.46, S * 0.48, S * 0.12, primary, 0.04);
      ctx.strokeStyle = '#B9A382';
      ctx.lineWidth = Math.max(1.3, S * 0.022);
      ctx.beginPath();
      ctx.moveTo(S * 0.26, S * 0.34);
      ctx.lineTo(S * 0.38, S * 0.24);
      ctx.lineTo(S * 0.62, S * 0.24);
      ctx.lineTo(S * 0.74, S * 0.34);
      ctx.stroke();
      ctx.fillStyle = accent;
      for (const [sx, sy] of [
        [0.42, 0.84],
        [0.52, 0.88],
        [0.62, 0.82],
        [0.47, 0.78],
      ] as Array<[number, number]>) {
        ctx.beginPath();
        ctx.ellipse(S * sx, S * sy, S * 0.028, S * 0.02, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'item_honey_jar': {
      ctx.fillStyle = hexWithAlpha(primary, 0.88);
      paintRoundedRect(ctx, S * 0.32, S * 0.4, S * 0.36, S * 0.4, S * 0.08);
      ctx.fill();
      box(S * 0.3, S * 0.3, S * 0.4, S * 0.12, accent, 0.05);
      box(S * 0.3, S * 0.38, S * 0.4, S * 0.05, UI_PALETTE.linen, 0.02);
      ctx.fillStyle = hexWithAlpha(UI_PALETTE.linen, 0.55);
      ctx.beginPath();
      ctx.ellipse(S * 0.41, S * 0.6, S * 0.035, S * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.ellipse(S * 0.5, S * 0.86, S * 0.1, S * 0.02, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'item_tart': {
      ctx.fillStyle = '#D9BC96';
      ctx.beginPath();
      ctx.arc(S * 0.5, S * 0.56, S * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.arc(S * 0.5, S * 0.56, S * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexWithAlpha('#D9BC96', 0.95);
      ctx.lineWidth = Math.max(1.4, S * 0.024);
      for (const off of [-0.1, 0, 0.1]) {
        ctx.beginPath();
        ctx.moveTo(S * (0.5 + off), S * 0.38);
        ctx.lineTo(S * (0.5 - off), S * 0.74);
        ctx.stroke();
      }
      break;
    }
    case 'item_shortbread': {
      box(S * 0.24, S * 0.42, S * 0.4, S * 0.16, primary, 0.05);
      box(S * 0.34, S * 0.52, S * 0.42, S * 0.16, hexWithAlpha(primary, 0.85), 0.05);
      ctx.fillStyle = accent;
      for (const [px, py] of [
        [0.32, 0.47],
        [0.44, 0.47],
        [0.56, 0.49],
        [0.46, 0.58],
        [0.58, 0.58],
        [0.68, 0.58],
      ] as Array<[number, number]>) {
        ctx.beginPath();
        ctx.arc(S * px, S * py, S * 0.016, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'item_river_glass': {
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.ellipse(S * 0.5, S * 0.56, S * 0.26, S * 0.18, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hexWithAlpha(accent, 0.65);
      ctx.beginPath();
      ctx.ellipse(S * 0.42, S * 0.5, S * 0.1, S * 0.035, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexWithAlpha(UI_PALETTE.linen, 0.7);
      ctx.lineWidth = Math.max(1.3, S * 0.02);
      ctx.beginPath();
      ctx.arc(S * 0.5, S * 0.56, S * 0.19, -2.4, -1.2);
      ctx.stroke();
      break;
    }
    case 'item_feather': {
      ctx.strokeStyle = hexWithAlpha(UI_PALETTE.umber, 0.8);
      ctx.lineWidth = Math.max(1.3, S * 0.02);
      ctx.beginPath();
      ctx.moveTo(S * 0.64, S * 0.2);
      ctx.quadraticCurveTo(S * 0.44, S * 0.5, S * 0.36, S * 0.82);
      ctx.stroke();
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.ellipse(S * 0.46, S * 0.46, S * 0.13, S * 0.24, 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexWithAlpha(UI_PALETTE.linen, 0.55);
      for (const off of [-0.06, 0.02, 0.1]) {
        ctx.beginPath();
        ctx.moveTo(S * (0.4 + off), S * (0.34 + off * 1.6));
        ctx.lineTo(S * (0.3 + off), S * (0.44 + off * 1.6));
        ctx.stroke();
      }
      break;
    }
    case 'item_fern': {
      ctx.strokeStyle = primary;
      ctx.lineWidth = Math.max(1.5, S * 0.026);
      ctx.beginPath();
      ctx.moveTo(S * 0.5, S * 0.84);
      ctx.quadraticCurveTo(S * 0.54, S * 0.5, S * 0.48, S * 0.2);
      ctx.stroke();
      ctx.fillStyle = primary;
      for (let i = 0; i < 5; i++) {
        const fy = 0.76 - i * 0.13;
        const fl = 0.1 - i * 0.014;
        ctx.beginPath();
        ctx.ellipse(S * (0.5 - fl), S * fy, S * fl, S * 0.035, -0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = i % 2 === 0 ? primary : hexWithAlpha(accent, 0.9);
        ctx.beginPath();
        ctx.ellipse(S * (0.5 + fl), S * fy, S * fl, S * 0.035, 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = primary;
      }
      break;
    }
    case 'item_cedar_rose': {
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.arc(S * 0.5, S * 0.52, S * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexWithAlpha(accent, 0.85);
      ctx.lineWidth = Math.max(1.6, S * 0.028);
      for (const [rr, a0] of [
        [0.18, 0.4],
        [0.13, 2.2],
        [0.08, 4.1],
        [0.04, 0.9],
      ] as Array<[number, number]>) {
        ctx.beginPath();
        ctx.arc(S * 0.5, S * 0.52, S * rr, a0, a0 + 5.2);
        ctx.stroke();
      }
      break;
    }
    case 'item_zine': {
      ctx.save();
      ctx.translate(S * 0.5, S * 0.54);
      ctx.rotate(-0.12);
      box(-S * 0.22, -S * 0.28, S * 0.44, S * 0.56, primary, 0.05);
      box(-S * 0.22, -S * 0.28, S * 0.06, S * 0.56, hexWithAlpha(UI_PALETTE.umber, 0.35), 0.03);
      ctx.strokeStyle = hexWithAlpha(UI_PALETTE.linen, 0.85);
      ctx.lineWidth = Math.max(1.3, S * 0.02);
      for (const ly of [-0.12, -0.02, 0.08]) {
        ctx.beginPath();
        ctx.moveTo(S * -0.1, S * ly);
        ctx.lineTo(S * 0.14, S * ly);
        ctx.stroke();
      }
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(S * 0.05, S * -0.19, S * 0.045, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'item_bell': {
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.moveTo(S * 0.38, S * 0.62);
      ctx.quadraticCurveTo(S * 0.34, S * 0.36, S * 0.5, S * 0.3);
      ctx.quadraticCurveTo(S * 0.66, S * 0.36, S * 0.62, S * 0.62);
      ctx.closePath();
      ctx.fill();
      box(S * 0.34, S * 0.6, S * 0.32, S * 0.06, hexWithAlpha(primary, 0.8), 0.03);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(S * 0.5, S * 0.72, S * 0.04, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1.4, S * 0.024);
      ctx.beginPath();
      ctx.arc(S * 0.5, S * 0.28, S * 0.05, Math.PI * 0.15, Math.PI * 0.85, true);
      ctx.stroke();
      break;
    }
    case 'item_watercolor_card': {
      ctx.save();
      ctx.translate(S * 0.5, S * 0.54);
      ctx.rotate(0.08);
      box(-S * 0.26, -S * 0.3, S * 0.52, S * 0.6, UI_PALETTE.linen, 0.04);
      ctx.fillStyle = hexWithAlpha(primary, 0.75);
      ctx.beginPath();
      ctx.ellipse(-S * 0.04, -S * 0.04, S * 0.14, S * 0.1, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hexWithAlpha(accent, 0.7);
      ctx.beginPath();
      ctx.ellipse(S * 0.1, S * 0.12, S * 0.07, S * 0.05, -0.4, 0, Math.PI * 2);
      ctx.fill();
      box(S * -0.05, -S * 0.36, S * 0.1, S * 0.09, hexWithAlpha('#D9BC96', 0.9), 0.02);
      ctx.restore();
      break;
    }
    case 'item_wreath': {
      ctx.strokeStyle = primary;
      ctx.lineWidth = Math.max(2.2, S * 0.05);
      ctx.beginPath();
      ctx.arc(S * 0.5, S * 0.52, S * 0.2, 0.4, Math.PI * 2 + 0.2);
      ctx.stroke();
      ctx.fillStyle = accent;
      for (const [wx, wy] of [
        [0.5, 0.28],
        [0.68, 0.42],
        [0.66, 0.66],
        [0.34, 0.7],
      ] as Array<[number, number]>) {
        ctx.beginPath();
        ctx.arc(S * wx, S * wy, S * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'item_music_box': {
      box(S * 0.26, S * 0.46, S * 0.48, S * 0.3, primary, 0.07);
      box(S * 0.26, S * 0.36, S * 0.48, S * 0.12, hexWithAlpha(primary, 0.82), 0.06);
      box(S * 0.42, S * 0.39, S * 0.16, S * 0.05, accent, 0.02);
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1.6, S * 0.03);
      ctx.beginPath();
      ctx.arc(S * 0.4, S * 0.62, S * 0.05, 0.3, Math.PI * 1.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(S * 0.45, S * 0.62);
      ctx.lineTo(S * 0.45, S * 0.5);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(S * 0.44, S * 0.49, S * 0.022, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'workbench':
      box(S * 0.14, S * 0.44, S * 0.72, S * 0.1, wood);
      box(S * 0.2, S * 0.54, S * 0.06, S * 0.26, hexWithAlpha(wood, 0.8));
      box(S * 0.74, S * 0.54, S * 0.06, S * 0.26, hexWithAlpha(wood, 0.8));
      box(S * 0.3, S * 0.32, S * 0.16, S * 0.12, '#B08A3E', 0.04);
      ctx.strokeStyle = '#8C7D6F';
      ctx.lineWidth = Math.max(1.6, S * 0.025);
      ctx.beginPath();
      ctx.moveTo(S * 0.56, S * 0.4);
      ctx.lineTo(S * 0.66, S * 0.32);
      ctx.stroke();
      break;
    case 'kettle_stove':
      box(S * 0.22, S * 0.36, S * 0.56, S * 0.44, '#6E6259', 0.05);
      ctx.fillStyle = '#B08A3E';
      ctx.beginPath();
      ctx.ellipse(S * 0.5, S * 0.3, S * 0.12, S * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#B08A3E';
      ctx.lineWidth = Math.max(1.8, S * 0.03);
      ctx.beginPath();
      ctx.arc(S * 0.64, S * 0.28, S * 0.06, -Math.PI * 0.6, Math.PI * 0.6);
      ctx.stroke();
      ctx.strokeStyle = hexWithAlpha('#8C7D6F', 0.55);
      ctx.beginPath();
      ctx.moveTo(S * 0.48, S * 0.18);
      ctx.quadraticCurveTo(S * 0.44, S * 0.12, S * 0.48, S * 0.07);
      ctx.stroke();
      break;
    case 'fountain':
      ctx.fillStyle = '#B9B3A5';
      ctx.beginPath();
      ctx.ellipse(S * 0.5, S * 0.62, S * 0.26, S * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(S * 0.42, S * 0.4, S * 0.16, S * 0.22);
      ctx.fillStyle = '#7FA7C4';
      ctx.beginPath();
      ctx.ellipse(S * 0.5, S * 0.6, S * 0.2, S * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'noticeboard':
      box(S * 0.2, S * 0.24, S * 0.6, S * 0.5, wood, 0.04);
      box(S * 0.28, S * 0.32, S * 0.16, S * 0.14, UI_PALETTE.linen, 0.02);
      box(S * 0.5, S * 0.36, S * 0.2, S * 0.16, '#EEF3EC', 0.02);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(S * 0.36, S * 0.34, S * 0.015, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(S * 0.6, S * 0.38, S * 0.015, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'hollow_oak':
      ctx.fillStyle = '#8F6A3C';
      ctx.beginPath();
      ctx.moveTo(S * 0.44, S * 0.78);
      ctx.lineTo(S * 0.48, S * 0.4);
      ctx.lineTo(S * 0.56, S * 0.4);
      ctx.lineTo(S * 0.6, S * 0.78);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.ellipse(S * 0.52, S * 0.34, S * 0.22, S * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = UI_PALETTE.espresso;
      ctx.beginPath();
      ctx.ellipse(S * 0.52, S * 0.64, S * 0.07, S * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'mirror_pond':
    case 'driftwood':
      ctx.fillStyle = '#7FA7C4';
      ctx.beginPath();
      ctx.ellipse(S * 0.5, S * 0.62, S * 0.3, S * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8F6A3C';
      ctx.beginPath();
      ctx.ellipse(S * 0.42, S * 0.56, S * 0.14, S * 0.045, -0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'orchard_basket':
      ctx.strokeStyle = '#8F6A3C';
      ctx.lineWidth = Math.max(1.6, S * 0.025);
      ctx.beginPath();
      ctx.moveTo(S * 0.3, S * 0.5);
      ctx.quadraticCurveTo(S * 0.5, S * 0.66, S * 0.7, S * 0.5);
      ctx.stroke();
      ctx.fillStyle = accent;
      for (const [fx, fy] of [[0.4, 0.44], [0.52, 0.4], [0.62, 0.46]] as const) {
        ctx.beginPath();
        ctx.arc(S * fx, S * fy, S * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'bee_skep':
      ctx.fillStyle = '#DDB26B';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(S * 0.5, S * (0.62 - i * 0.09), S * (0.16 - i * 0.035), S * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(S * 0.5, S * 0.36, S * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = UI_PALETTE.espresso;
      ctx.beginPath();
      ctx.ellipse(S * 0.5, S * 0.72, S * 0.05, S * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'gazebo_bell': {
      ctx.strokeStyle = '#B08A3E';
      ctx.lineWidth = Math.max(2, S * 0.04);
      ctx.beginPath();
      ctx.moveTo(S * 0.5, S * 0.24);
      ctx.lineTo(S * 0.5, S * 0.36);
      ctx.stroke();
      ctx.fillStyle = '#B08A3E';
      ctx.beginPath();
      ctx.moveTo(S * 0.38, S * 0.62);
      ctx.quadraticCurveTo(S * 0.5, S * 0.3, S * 0.62, S * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(S * 0.5, S * 0.66, S * 0.03, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'mailbox':
      box(S * 0.3, S * 0.44, S * 0.36, S * 0.2, primary, 0.06);
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.ellipse(S * 0.3, S * 0.54, S * 0.05, S * 0.1, 0, Math.PI * 0.5, Math.PI * 1.5);
      ctx.fill();
      box(S * 0.46, S * 0.64, S * 0.05, S * 0.16, wood);
      ctx.fillStyle = UI_PALETTE.linen;
      ctx.fillRect(S * 0.52, S * 0.48, S * 0.1, S * 0.03);
      break;
    // The Wild Hollows (Build 10)
    case 'stone_well': {
      // mossy stone ring
      ctx.fillStyle = '#8F9487';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(S * (0.5 + Math.cos(a) * 0.16), S * (0.58 + Math.sin(a) * 0.07), S * 0.07, S * 0.035, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#7C8377';
      ctx.beginPath();
      ctx.ellipse(S * 0.5, S * 0.58, S * 0.14, S * 0.055, 0, 0, Math.PI * 2);
      ctx.fill();
      // cedar posts + little roof
      ctx.strokeStyle = wood;
      ctx.lineWidth = Math.max(2, S * 0.028);
      ctx.beginPath();
      ctx.moveTo(S * 0.36, S * 0.56);
      ctx.lineTo(S * 0.36, S * 0.3);
      ctx.moveTo(S * 0.64, S * 0.56);
      ctx.lineTo(S * 0.64, S * 0.3);
      ctx.stroke();
      ctx.fillStyle = '#B5714E';
      ctx.beginPath();
      ctx.moveTo(S * 0.28, S * 0.32);
      ctx.lineTo(S * 0.5, S * 0.2);
      ctx.lineTo(S * 0.72, S * 0.32);
      ctx.closePath();
      ctx.fill();
      // rope + bucket
      ctx.beginPath();
      ctx.moveTo(S * 0.5, S * 0.24);
      ctx.lineTo(S * 0.5, S * 0.42);
      ctx.stroke();
      box(S * 0.45, S * 0.42, S * 0.1, S * 0.07, '#8F6A3C', 0.02);
      break;
    }
    case 'wildflower':
      // three foxglove-bell stems with petal clusters
      for (const [sx, sh] of [[0.36, 0.6], [0.5, 0.72], [0.64, 0.56]] as const) {
        ctx.strokeStyle = UI_PALETTE.sage;
        ctx.lineWidth = Math.max(1.6, S * 0.02);
        ctx.beginPath();
        ctx.moveTo(S * sx, S * 0.78);
        ctx.lineTo(S * sx, S * (0.78 - sh));
        ctx.stroke();
        ctx.fillStyle = accent;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.ellipse(S * (sx + (i % 2 === 0 ? 0.045 : -0.045)), S * (0.78 - sh + 0.08 + i * 0.09), S * 0.04, S * 0.05, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = UI_PALETTE.honey;
        ctx.beginPath();
        ctx.arc(S * sx, S * (0.78 - sh - 0.02), S * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'bee_log': {
      // mossy fallen log with a humming wild hive
      ctx.fillStyle = '#8F6A3C';
      ctx.beginPath();
      ctx.ellipse(S * 0.5, S * 0.64, S * 0.26, S * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#A9814F';
      ctx.beginPath();
      ctx.ellipse(S * 0.72, S * 0.63, S * 0.045, S * 0.075, 0, 0, Math.PI * 2);
      ctx.fill();
      // moss cap
      ctx.fillStyle = '#6F9A5B';
      ctx.beginPath();
      ctx.ellipse(S * 0.46, S * 0.575, S * 0.2, S * 0.045, 0, 0, Math.PI * 2);
      ctx.fill();
      // clover tuft + bee
      ctx.strokeStyle = UI_PALETTE.sage;
      ctx.lineWidth = Math.max(1.4, S * 0.016);
      ctx.beginPath();
      ctx.moveTo(S * 0.3, S * 0.76);
      ctx.lineTo(S * 0.28, S * 0.66);
      ctx.moveTo(S * 0.32, S * 0.76);
      ctx.lineTo(S * 0.34, S * 0.67);
      ctx.stroke();
      ctx.fillStyle = UI_PALETTE.honey;
      ctx.beginPath();
      ctx.ellipse(S * 0.52, S * 0.44, S * 0.045, S * 0.032, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = UI_PALETTE.espresso;
      ctx.beginPath();
      ctx.ellipse(S * 0.545, S * 0.42, S * 0.018, S * 0.014, -0.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();

  paintRoundedRect(ctx, 0.5, 0.5, S - 1, S - 1, S * 0.26);
  ctx.strokeStyle = LINEN_BORDER;
  ctx.lineWidth = 1;
  ctx.stroke();
}

export const SubjectCanvas: React.FC<{
  descriptor: SubjectDescriptor;
  size: number;
  className?: string;
}> = ({ descriptor, size, className }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Same value-keyed repaint contract as PortraitCanvas (UI/UX program WP2).
  const descriptorKey = useMemo(() => JSON.stringify(descriptor), [descriptor]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintSubject(ctx, descriptor, size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptorKey, size]);
  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className={className}
      aria-hidden="true"
    />
  );
};
