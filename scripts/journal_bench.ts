/**
 * systemic-reliability doc 05 — journal lifecycle performance benchmark.
 *
 * Methodology (matching the doc 01 §7 baseline):
 *   - Node version + platform printed below; 3 independent runs;
 *     30 samples per point after 10 warmups; medians reported.
 *   - Real production pipeline only: serializeWorldState / deserializeWorldState
 *     (sanitize + migrate included), real WorldState shape.
 *   - world.memories is populated with n synthetic, uniquely-id'd, valid rows
 *     (deterministic content) so per-row cost is measurable; all other state
 *     is the fresh-world default.
 *
 * Post-fix expectations (JOURNAL_MEMORY_CAP = 96):
 *   - serialize of an over-cap input converges the payload to 96 rows;
 *   - deserialize of an over-cap payload trims to 96 rows with a warning;
 *   - serialize(deserialize(serialize(x))) is byte-stable (fixed point).
 *
 * Usage: npx tsx scripts/journal_bench.ts
 */
import {
  createFreshWorldState,
  deserializeWorldState,
  serializeWorldState,
} from '../src/game/storage';
import type { WorldState } from '../src/game/types';

function worldWithMemories(n: number): WorldState {
  const world = createFreshWorldState();
  const rows = Array.from({ length: n }, (_, i) => ({
    id: `mem_bench_${String(i).padStart(5, '0')}`,
    day: 1 + (i % 30),
    phase: (['morning', 'afternoon', 'golden', 'dusk'] as const)[i % 4],
    title: `Benchmark memory ${i}`,
    summary:
      'A deterministic synthetic journal row used only by the benchmark; ' +
      'shape matches the production JournalMemory record exactly.',
    ...(i % 3 === 0 ? { residentId: 'nora' as const } : {}),
  }));
  // Rows are prepended newest-first in production; order here is deterministic
  // either way — the sanitizer preserves input order and the cap slices
  // newest-first (first 96 rows survive).
  world.memories = rows;
  return world;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function time(fn: () => void, samples: number, warmups: number): number {
  for (let i = 0; i < warmups; i++) fn();
  const t: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t0 = performance.now();
    fn();
    t.push(performance.now() - t0);
  }
  return median(t);
}

interface Point {
  n: number;
  serMed: number;
  deserMed: number;
  payload: number;
  savedPayload: number;
  rep10: number;
  rawStr: number;
}

function runOnce(): Point[] {
  const sizes = [100, 400, 800, 1600, 3200, 6400, 12800];
  const out: Point[] = [];
  for (const n of sizes) {
    const world = worldWithMemories(n);
    const payload = serializeWorldState(world);
    const savedPayload = payload.length;

    const serMed = time(() => serializeWorldState(world), 30, 10);
    const deserMed = time(() => deserializeWorldState(payload), 30, 10);
    const rep10 = time(() => {
      for (let k = 0; k < 10; k++) serializeWorldState(world);
    }, 5, 1);
    const rawStr = time(() => JSON.stringify(world.memories), 30, 10);

    out.push({
      n,
      serMed,
      deserMed,
      payload: Buffer.byteLength(payload),
      savedPayload,
      rep10,
      rawStr,
    });
  }
  return out;
}

function fmtRow(p: Point): string {
  return [
    String(p.n).padStart(6),
    `${p.serMed.toFixed(3).padStart(8)} ms`,
    `${p.deserMed.toFixed(3).padStart(8)} ms`,
    `${(p.payload / 1024).toFixed(1).padStart(8)} KB`,
    `${(p.savedPayload / 1024).toFixed(1).padStart(8)} KB`,
    `${p.rep10.toFixed(2).padStart(8)} ms`,
    `${p.rawStr.toFixed(3).padStart(8)} ms`,
  ].join('  ');
}

console.log('=== journal lifecycle benchmark (post-cap, doc 05) ===');
console.log(`node ${process.version}; ${process.platform}; pid ${process.pid}`);
console.log(
  'columns: rows-in | serialize med | deserialize med | persisted payload | saved payload (post-cap) | 10x repeated save | raw JSON.stringify of rows',
);

const runs: Point[][] = [];
for (let r = 0; r < 3; r++) {
  runs.push(runOnce());
  console.log(`--- run ${r + 1} ---`);
  for (const p of runs[r]) console.log(fmtRow(p));
}

// --- cap behavior checks (run once, deterministic) ---
console.log('=== cap behavior ===');
{
  const world = worldWithMemories(12800);
  const p1 = serializeWorldState(world);
  const parsed = JSON.parse(p1) as { memories: Array<{ id: string }> };
  console.log(
    `serialize input 12,800 rows → persisted memories.length = ${parsed.memories.length} (expect 96); first id ${parsed.memories[0].id}, last id ${parsed.memories[95].id}`,
  );
  const res = deserializeWorldState(p1);
  const warnings = (res as unknown as { warnings?: string[] }).warnings ?? [];
  const memWarn = warnings.filter((w) => w.includes('memories'));
  console.log(
    `deserialize trimmed payload → runtime memories.length = ${res.state.memories.length}; memories warnings: ${JSON.stringify(memWarn)}`,
  );
  const p2 = serializeWorldState(res.state);
  const p3 = serializeWorldState(deserializeWorldState(p2).state);
  console.log(
    `fixed point: p2 === p3 (serialize(load(serialize(x))) byte-stable) = ${p2 === p3}; p2.length = ${p2.length} B`,
  );
  const fresh = createFreshWorldState();
  const freshP1 = serializeWorldState(fresh);
  const freshP2 = serializeWorldState(deserializeWorldState(freshP1).state);
  console.log(`fresh world round-trip byte-stable = ${freshP1 === freshP2} (${freshP1.length} B)`);
}

// --- 96-row steady state (post-cap production profile) ---
console.log('=== 96-row steady state (3 runs, median of medians) ===');
{
  const sers: number[] = [];
  const pay: number[] = [];
  for (let r = 0; r < 3; r++) {
    const w = worldWithMemories(96);
    sers.push(time(() => serializeWorldState(w), 30, 10));
    pay.push(Buffer.byteLength(serializeWorldState(w)));
  }
  console.log(
    `serialize @96 rows: median ${median(sers).toFixed(3)} ms across runs (min ${Math.min(...sers).toFixed(3)}, max ${Math.max(...sers).toFixed(3)}); payload ${(median(pay) / 1024).toFixed(1)} KB`,
  );
}
