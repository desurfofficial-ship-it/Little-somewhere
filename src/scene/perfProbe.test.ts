import test from 'node:test';
import assert from 'node:assert/strict';
import { PerfProbe } from './perfProbe';

test('disabled probe records nothing and never allocates ring data', () => {
  const probe = new PerfProbe(false);
  for (let i = 0; i < 100; i++) probe.frame(50);
  probe.noteSceneBuild(123);
  const s = probe.summary();
  assert.equal(s.frames, 0, 'disabled probe must not aggregate frames');
  assert.equal(s.avgFps, 0);
  assert.equal(s.sceneBuildMs, 0, 'disabled probe must not record build time');
  assert.equal(probe.mountOverlay(null), null, 'disabled probe must not mount a DOM overlay');
});

test('frame aggregation reports avg fps, percentiles, max and spike counts', () => {
  const probe = new PerfProbe(true);
  // 90 frames at 16.0ms (60fps) + 10 frames at 40ms (25fps spikes)
  for (let i = 0; i < 90; i++) probe.frame(16);
  for (let i = 0; i < 10; i++) probe.frame(40);
  const s = probe.summary();
  assert.equal(s.frames, 100);
  // 100 frames / (90·16 + 10·40 = 1840ms) → 54.3 fps
  assert.ok(Math.abs(s.avgFps - 100000 / 1840) < 0.1, `avgFps ${s.avgFps}`);
  assert.equal(s.p50Ms, 16, 'median frame sits at the 60fps cadence');
  assert.equal(s.p95Ms, 40, 'p95 catches the spike tail');
  assert.equal(s.maxMs, 40);
  assert.equal(s.spikesOver33, 10, 'only the 40ms frames spike over 33.4ms');
  assert.equal(s.spikesOver16, 10, 'the 16ms frames never spike over 16.7ms');
});

test('the ring slides after capacity so long sessions stay a moving window', () => {
  const probe = new PerfProbe(true);
  for (let i = 0; i < 700; i++) probe.frame(10);
  for (let i = 0; i < 50; i++) probe.frame(60);
  const s = probe.summary();
  assert.equal(s.frames, 600, 'ring cap holds at 600 frames');
  // The early 10ms frames slid out: the window tail is now dominated by 60ms frames.
  assert.equal(s.p95Ms, 60, 'p95 reflects the recent 60ms cadence');
  assert.ok(s.maxMs >= 60);
});

test('reset drops frame statistics but keeps the scene build measurement', () => {
  const probe = new PerfProbe(true);
  for (let i = 0; i < 50; i++) probe.frame(30);
  probe.noteSceneBuild(456);
  probe.reset();
  const s = probe.summary();
  assert.equal(s.frames, 0);
  assert.equal(s.spikesOver33, 0);
  assert.equal(s.sceneBuildMs, 456, 'build cost survives scenario resets');
});

test('gpu sampling fires on the first frame and then every interval', () => {
  const probe = new PerfProbe(true);
  assert.equal(probe.shouldSampleGpu(), true, 'first frame always samples so throttled environments still record renderer.info');
  assert.equal(probe.shouldSampleGpu(), false, 'interval restarts after a sample');
  for (let i = 0; i < 28; i++) probe.shouldSampleGpu();
  assert.equal(probe.shouldSampleGpu(), true, 'sample due again at the 30th frame');
});
