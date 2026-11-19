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
