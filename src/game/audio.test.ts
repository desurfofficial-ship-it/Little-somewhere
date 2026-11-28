import test from 'node:test';
import assert from 'node:assert/strict';
import { cozyAudio } from './audio';

test('Pass 9: rain and hearth room-tones start/stop idempotently without an AudioContext', () => {
  // Headless/SSR-safe: no window -> ensureContext() returns null, the loops stay
  // unstarted, and repeated calls never throw or stack state.
  assert.doesNotThrow(() => cozyAudio.playRainAmbience(true));
  assert.doesNotThrow(() => cozyAudio.playRainAmbience(true));
  assert.doesNotThrow(() => cozyAudio.playRainAmbience(false));
  assert.doesNotThrow(() => cozyAudio.playRainAmbience(false));
  assert.doesNotThrow(() => cozyAudio.playHearthAmbience(true));
  assert.doesNotThrow(() => cozyAudio.playHearthAmbience(true));
  assert.doesNotThrow(() => cozyAudio.playHearthAmbience(false));
  assert.doesNotThrow(() => cozyAudio.playHearthAmbience(false));
  // Muting stops both loops immediately and stays safe when they are already off.
  assert.doesNotThrow(() => cozyAudio.setMuted(true));
  assert.equal(cozyAudio.isMuted(), true);
  assert.doesNotThrow(() => {
    cozyAudio.playRainAmbience(true);
    cozyAudio.playHearthAmbience(true);
  });
  assert.doesNotThrow(() => cozyAudio.setMuted(false));
});

// WP-2 (world-environment initiative, audit-1d): outdoor weather ambience.
test('WP-2: outdoor rain voicing flips idempotently and the breeze/winter wind bed is safe', () => {
  // Headless-safe: no window -> ensureContext() returns null; every transition
  // (start, mode flip, stop, mute) must stay throw-free and never stack state.
  assert.doesNotThrow(() => cozyAudio.playRainAmbience(true, false));
  assert.doesNotThrow(() => cozyAudio.playRainAmbience(true, true)); // mode flip
  assert.doesNotThrow(() => cozyAudio.playRainAmbience(true, true)); // idempotent
  assert.doesNotThrow(() => cozyAudio.playRainAmbience(false));
  assert.doesNotThrow(() => cozyAudio.playRainAmbience(false));

  assert.doesNotThrow(() => cozyAudio.playBreezeAmbience(true));
  assert.doesNotThrow(() => cozyAudio.playBreezeAmbience(true));
  assert.doesNotThrow(() => cozyAudio.playBreezeAmbience(true, true)); // winter flip
  assert.doesNotThrow(() => cozyAudio.playBreezeAmbience(false));
  assert.doesNotThrow(() => cozyAudio.playBreezeAmbience(false));

  // Muting must stop the breeze bed too, and stay safe when nothing is playing.
  assert.doesNotThrow(() => cozyAudio.setMuted(true));
  assert.equal(cozyAudio.isMuted(), true);
  assert.doesNotThrow(() => {
    cozyAudio.playRainAmbience(true, true);
    cozyAudio.playBreezeAmbience(true, true);
  });
  assert.doesNotThrow(() => cozyAudio.setMuted(false));
});

// Earshot exercise: procedural page-turn foley for the Linden Book Nook shelf
// browse. One-shot synthesis (no beds, no timers), so the only guarantees to pin
// headlessly are: no throw without an AudioContext, repeat plays stay throw-free
// (no stacked state), and muting keeps it a silent no-op instead of an error.
test('Earshot: page-turn foley is headless-safe, repeat-safe, and mute-safe', () => {
  assert.doesNotThrow(() => cozyAudio.playPageTurn());
  assert.doesNotThrow(() => cozyAudio.playPageTurn());
  assert.doesNotThrow(() => cozyAudio.playPageTurn());
  assert.doesNotThrow(() => cozyAudio.setMuted(true));
  assert.equal(cozyAudio.isMuted(), true);
  assert.doesNotThrow(() => cozyAudio.playPageTurn()); // muted: silent no-op
  assert.doesNotThrow(() => cozyAudio.setMuted(false));
});
