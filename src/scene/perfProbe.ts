import * as THREE from 'three';

/**
 * perfProbe.ts — Visual QA performance instrumentation (Doc 08 Phase 0.2).
 *
 * A lightweight, dependency-free frame-time and GPU-statistics probe. It exists
 * so every visual-identity capture (Doc 09 protocol) carries real measured
 * evidence — average FPS, frame-time behavior, spikes, draw calls, triangle
 * counts, geometry/texture/program counts, and the one-time scene build time —
 * instead of estimates (brief Part 2.3: "Do not report estimated measurements
 * as actual measurements").
 *
 * Discipline rules honored here:
 *  - Dev-only: constructed with `enabled=false` unless `?perf=1` is in the URL;
 *    disabled probes are three integer increments per frame and nothing else.
 *  - Zero per-frame heap allocations: the frame-time ring is a pre-allocated
 *    Float32Array and `summary()` fills a pre-allocated object.
 *  - No new dependencies: renderer.info + performance.now() only.
 *  - Software-WebGL parity: identical aggregation on the `afterDraw` pacing
 *    path (the probe simply reports the frame cadence it observes).
 *
 * When enabled the probe also exposes itself as `window.__LS_PERF__` so the
 * headless capture harness can read deterministic measurements, and renders a
 * small non-interactive monospace overlay (no backdrop-filter — AGENTS.md UI
 * law; never intercepts pointer events; never touches gameplay).
 */

export interface PerfSnapshot {
  /** Frames aggregated since reset (ring capacity cap: 600). */
  frames: number;
  /** Harmonic-mean style FPS = 1000·frames / Σ(frameMs). */
  avgFps: number;
  /** Median frame time in ms. */
  p50Ms: number;
  /** 95th-percentile frame time in ms. */
  p95Ms: number;
  /** Worst frame time in ms since reset. */
  maxMs: number;
  /** Frames slower than 33.4 ms (below 30 FPS). */
  spikesOver33: number;
  /** Frames slower than 16.7 ms (below 60 FPS). */
  spikesOver16: number;
  /** Last GPU sample: draw calls per frame. */
  drawCalls: number;
  /** Last GPU sample: triangles per frame. */
  triangles: number;
  /** Live geometry buffer count (renderer.info.memory). */
  geometries: number;
  /** Live texture count (renderer.info.memory) — texture-memory proxy. */
  textures: number;
  /** Compiled shader program count. */
  programs: number;
  /** One-time scene assembly cost in ms (rigs, materials, textures). */
  sceneBuildMs: number;
}

const RING_SIZE = 600;
const GPU_SAMPLE_INTERVAL = 30;
const OVERLAY_INTERVAL_FRAMES = 60;

const EMPTY_SNAPSHOT: PerfSnapshot = {
  frames: 0,
  avgFps: 0,
  p50Ms: 0,
  p95Ms: 0,
  maxMs: 0,
  spikesOver33: 0,
  spikesOver16: 0,
  drawCalls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  programs: 0,
  sceneBuildMs: 0,
};

export class PerfProbe {
  readonly enabled: boolean;

  private readonly ring = new Float32Array(RING_SIZE);
  private ringCount = 0;
  private ringIndex = 0;
  private frameMsSum = 0;
  private maxMs = 0;
  private spikes33 = 0;
  private spikes16 = 0;
  private framesSinceGpuSample = GPU_SAMPLE_INTERVAL - 1;
  private framesSinceOverlay = 0;
  private sceneBuildMs = 0;

  private snapshot: PerfSnapshot = { ...EMPTY_SNAPSHOT };

  private overlay: HTMLDivElement | null = null;
  private overlayText: Text | null = null;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  /** Record one frame's wall-clock duration in milliseconds. */
  frame(frameMs: number): void {
    if (!this.enabled) return;
    if (this.ringCount < RING_SIZE) {
      this.ring[this.ringIndex] = frameMs;
      this.ringCount++;
      this.frameMsSum += frameMs;
    } else {
      // Ring full: slide (subtract the outgoing sample) — O(1), allocation-free.
      this.frameMsSum -= this.ring[this.ringIndex];
      this.ring[this.ringIndex] = frameMs;
      this.frameMsSum += frameMs;
    }
    this.ringIndex = (this.ringIndex + 1) % RING_SIZE;
    if (frameMs > this.maxMs) this.maxMs = frameMs;
    if (frameMs > 33.4) this.spikes33++;
    if (frameMs > 16.7) this.spikes16++;
  }

  /** Record the one-time scene assembly cost (called once after first render). */
  noteSceneBuild(ms: number): void {
    if (!this.enabled) return;
    this.sceneBuildMs = ms;
  }

  /** Pull renderer.info statistics (call at most every GPU_SAMPLE_INTERVAL frames). */
  sampleGpu(renderer: THREE.WebGLRenderer): void {
    if (!this.enabled) return;
    this.framesSinceGpuSample = 0;
    this.snapshot.drawCalls = renderer.info.render.calls;
    this.snapshot.triangles = renderer.info.render.triangles;
    this.snapshot.geometries = renderer.info.memory.geometries;
    this.snapshot.textures = renderer.info.memory.textures;
    this.snapshot.programs = renderer.info.programs?.length ?? 0;
  }

  /** True on frames where a GPU statistics sample should be taken. */
  shouldSampleGpu(): boolean {
    if (!this.enabled) return false;
    this.framesSinceGpuSample++;
    if (this.framesSinceGpuSample < GPU_SAMPLE_INTERVAL) return false;
    // Reset here so a consumer that drops the sample cannot pin the flag high.
    this.framesSinceGpuSample = 0;
    return true;
  }

  /** True on frames where the overlay text should refresh (1 Hz at 60 FPS). */
  shouldUpdateOverlay(): boolean {
    if (!this.enabled) return false;
    this.framesSinceOverlay++;
    if (this.framesSinceOverlay < OVERLAY_INTERVAL_FRAMES) return false;
    this.framesSinceOverlay = 0;
    return true;
  }

  /**
   * Aggregate the frame-time ring into the measurement snapshot.
   * NOTE: the returned object is the probe's live internal snapshot — read it
   * immediately (the capture harness serializes it to JSON on the spot). Call
   * `reset()` between scenarios to drop stale statistics.
   */
  summary(): PerfSnapshot {
    const s = this.snapshot;
    s.frames = this.ringCount;
    s.maxMs = this.maxMs;
    s.spikesOver33 = this.spikes33;
    s.spikesOver16 = this.spikes16;
    s.sceneBuildMs = this.sceneBuildMs;
    if (this.ringCount === 0) {
      s.avgFps = 0;
      s.p50Ms = 0;
      s.p95Ms = 0;
      return s;
    }
    s.avgFps = this.frameMsSum > 0 ? (this.ringCount * 1000) / this.frameMsSum : 0;
    // Copy + sort the active window (allocation only on explicit summary() —
    // a QA-read API, never called inside tick()).
    const window = Array.from(this.ring.subarray(0, this.ringCount)).sort((a, b) => a - b);
    s.p50Ms = window[Math.min(window.length - 1, Math.floor(window.length * 0.5))];
    s.p95Ms = window[Math.min(window.length - 1, Math.floor(window.length * 0.95))];
    return s;
  }

  /** Drop all accumulated frame statistics (between capture scenarios). */
  reset(): void {
    this.ringCount = 0;
    this.ringIndex = 0;
    this.frameMsSum = 0;
    this.maxMs = 0;
    this.spikes33 = 0;
    this.spikes16 = 0;
    this.framesSinceGpuSample = GPU_SAMPLE_INTERVAL - 1;
    this.framesSinceOverlay = 0;
    this.snapshot = { ...EMPTY_SNAPSHOT, sceneBuildMs: this.sceneBuildMs };
  }

  /**
   * Mount the diagnostic overlay (dev/QA only). Returns null when disabled so
   * callers can unconditionally call this without polluting production DOM.
   */
  mountOverlay(host: HTMLElement | null = document.body): HTMLDivElement | null {
    if (!this.enabled || this.overlay) return this.overlay;
    const el = document.createElement('div');
    el.id = 'ls-perf-probe';
    el.setAttribute('aria-hidden', 'true');
    // Opaque surface (no backdrop-filter over the WebGL canvas — AGENTS.md §2),
    // pointer-transparent, deliberately unstyled beyond monospace legibility.
    el.style.cssText = [
      'position:fixed',
      'top:8px',
      'right:8px',
      'z-index:9999',
      'padding:6px 9px',
      'background:rgba(28,24,20,0.92)',
      'color:#FAF5EC',
      'font:11px/1.5 ui-monospace,Menlo,Consolas,monospace',
      'white-space:pre',
      'border-radius:6px',
      'pointer-events:none',
      'user-select:none',
    ].join(';');
    this.overlayText = document.createTextNode('');
    el.appendChild(this.overlayText);
    (host ?? document.body).appendChild(el);
    this.overlay = el;
    this.refreshOverlay();
    return el;
  }

  /** Refresh overlay text (call on shouldUpdateOverlay() frames only). */
  refreshOverlay(): void {
    if (!this.enabled || !this.overlayText) return;
    const s = this.summary();
    this.overlayText.textContent =
      `fps ${s.avgFps.toFixed(1)}  p50 ${s.p50Ms.toFixed(1)}ms  p95 ${s.p95Ms.toFixed(1)}ms  max ${s.maxMs.toFixed(1)}ms\n` +
      `draws ${s.drawCalls}  tris ${(s.triangles / 1000).toFixed(0)}k  geo ${s.geometries}  tex ${s.textures}  prog ${s.programs}\n` +
      `build ${s.sceneBuildMs.toFixed(0)}ms  spikes>33 ${s.spikesOver33}`;
  }

  disposeOverlay(): void {
    if (this.overlay?.parentElement) {
      this.overlay.parentElement.removeChild(this.overlay);
    }
    this.overlay = null;
    this.overlayText = null;
  }
}

declare global {
  interface Window {
    /** QA hook: the active probe when ?perf=1 (undefined otherwise). */
    __LS_PERF__?: PerfProbe;
  }
}
