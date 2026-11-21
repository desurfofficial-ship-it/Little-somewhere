# 10 — Determinism and Performance Review

All numbers from the independent specialists' probe runs (Node v24 / tsx 4, hrtime.bigint, medians of ≥3 repetitions after ≥500-call warmups). Exact probe commands preserved in the operation log.

## 1. Determinism

| Check | Result |
|---|---|
| 2×12 000-tick identical-seed runs (player pinned at Marigold Lane center, clockRate 2.2) | checkpoint arrays **byte-identical**; final `serializeWorldState` byte-identical (27,325 B) |
| 500-tick script interleaving ticks + offer/accept/enter/+2h reconcile/window-end crossing | byte-identical JSON, sha256 equal; different seed → different hash |
| BD10-08: 2000-tick double run | stable JSON hash + `computeWorldSaveRevision` identical |
| Round-trip fixed point | s2===s1 && s3===s2 at minutes 360, 432.5, 495, 689.9, 690, 959.9, 960, 1109.5, 1110, 1289, 1290 + soaked 36 KB world |
| Wall-clock leakage | 0 `Date.now` / `performance.now` / `new Date` in src/game; `Math.random` only in audio.ts (not in tick graph) |
| Migration determinism | same v7 payload → byte-identical v11 output |

## 2. Restored tick block cost (within-instance marginal, causal)

| Scenario | ns/call (median) | % of 16.7 ms frame |
|---|---|---|
| Spawn (no zone; 4 distance checks) | 146 | 0.00087% |
| Zone center pre-grant (full grant path) | 165 | 0.00099% |
| Zone center post-grant (idempotent steady state) | 78 | 0.00047% |

Strict predicate per-call: 59–77 ns (runs only when an invite is active). **Three orders of magnitude below any frame-budget concern.**

## 3. Dialogue selection cost (registry 83 → 85 topics)

| Measurement | Marginal (causal) |
|---|---|
| `buildResidentDialogue('mina')` | +68 ns per call (+1.37%) |
| `buildResidentDialogue('rowan')` | +119 ns per call (+2.34%) |
| Full-registry condition sweep | +171 ns per sweep (~222 ns/topic) |

Dialogue selection runs on dialogue-open, not per frame. **Methodology note for future A/B claims:** a control experiment with two byte-identical trees produced ±1.6–3.5 µs phantom whole-tick deltas (second module instance ~50% slower in steady state) — cross-module-graph A/B is unusable below ~5 µs; use within-instance marginals.

## 4. Memory and long-run stability (20 000–60 000 ticks)

- heapUsed flat (~17.0 → 17.8 MB over 20 k ticks; slopes indistinguishable from GC jitter, candidate not systematically higher vs base).
- Discovery run: grants exactly once (memories 1→2), zero further growth; serialized world +267 B one-off.
- Bounded counters after long runs: `invitations.history ≤ 12` (FIFO enforced on tick + sanitize paths), `worldEvents ≤ 40`, `activityHistory ≤ 8/resident`, `npcMemories ≤ 14/resident`; JSON plateaus ~36 KB at t=60k; `minuteOfDay` clamps at 1290; zero NaN/Infinity (deep-walked).
- Journal growth is action-driven, not tick-driven: +1 row per discovery; the tick loop appends nothing (doc 12 F-SAVE-3 quantifies the pre-existing uncapped-memories surface).

## 5. Save latency vs journal length (pre-existing D-08, quantified for the register)

| memory rows | serialize median | payload |
|---|---|---|
| 50 | 207.8 µs | 33.9 KB |
| 200 | 384.4 µs | 84.8 KB |
| 800 | 1,126.5 µs (6.7% of a frame) | 289 KB |
| 1600 | 2,109.4 µs | — |

Curve ≈ 150–200 µs fixed whole-world sanitize + ~1.2 µs/memory-row, linear. Pre-existing (storage.ts byte-identical between base and candidate); recommended follow-up: cap/trim journal rows on the autosave path.

## 6. Build output

| Artifact | base `eb95d77` | candidate | Δ |
|---|---|---|---|
| dist total | 1,740,289 B | 1,745,585 B | **+5,296 B (+0.30%)** |
| main JS (minified) | 1,702,414 B | 1,707,710 B | +5,296 B (+0.31%) |
| main JS gzip | 466,901 B | 468,837 B | +1,936 B |
| CSS | 36,483 B (hash unchanged) | 36,483 B | 0 |

Build time ~0.8 s both; exit 0; pre-existing chunk-size warning only.
