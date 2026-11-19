// Procedural Web Audio API cozy synthesizer (zero external audio files)

class CozyAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  // Hearth crackle room-tone state (Pass 7): one noise bed + scheduled crackle pops.
  private hearthBed: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private hearthPopTimer: number | null = null;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.playHearthAmbience(false);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public playFootstep(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const baseFreq = 140 + (Math.random() - 0.5) * 24;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.055);
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playUiTap(pitch = 1.0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(640 * pitch, now + 0.065);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playDialogueVoice(seed = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [330, 392, 440, 493.88, 523.25];
    const freq = notes[Math.abs(seed) % notes.length] * (0.95 + Math.random() * 0.1);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.08, now + 0.09);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playMemoryChime(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.07;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.06, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  }

  public playGazeboBell(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const partials = [
      { freq: 392.0, amp: 0.12, dur: 2.6 },
      { freq: 784.0, amp: 0.06, dur: 1.9 },
      { freq: 1174.66, amp: 0.035, dur: 1.3 },
      { freq: 587.33, amp: 0.045, dur: 2.1 },
    ];
    for (const p of partials) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(p.amp, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + p.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + p.dur + 0.05);
    }
  }

  /**
   * Soft kettle-steam swell for the hearth preparation moment: filtered noise
   * breathing in and out over ~1.6s with a gentle whistle overtone.
   */
  public playKettleSteam(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 1.7);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.linearRampToValueAtTime(1500, now + 0.9);
    filter.frequency.linearRampToValueAtTime(700, now + 1.65);
    filter.Q.value = 1.4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.5);
    gain.gain.linearRampToValueAtTime(0.03, now + 1.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.65);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 1.7);
    const whistle = ctx.createOscillator();
    const whistleGain = ctx.createGain();
    whistle.type = 'sine';
    whistle.frequency.setValueAtTime(2093, now + 0.85);
    whistleGain.gain.setValueAtTime(0.001, now);
    whistleGain.gain.linearRampToValueAtTime(0.012, now + 1.0);
    whistleGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    whistle.connect(whistleGain);
    whistleGain.connect(ctx.destination);
    whistle.start(now + 0.8);
    whistle.stop(now + 1.55);
  }

  /** Soft wooden arrange tick for vase / keepsake / satchel object handling. */
  public playArrangePop(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.07);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(165, now);
    bodyGain.gain.setValueAtTime(0.03, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    body.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
    body.start(now);
    body.stop(now + 0.13);
  }

  public playWaterSplash(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const droplets = [
      { delay: 0.0, f0: 380, f1: 690, amp: 0.075, dur: 0.14 },
      { delay: 0.09, f0: 490, f1: 860, amp: 0.055, dur: 0.13 },
      { delay: 0.19, f0: 620, f1: 1040, amp: 0.04, dur: 0.14 },
    ];
    for (const d of droplets) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + d.delay;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(d.f0, t);
      osc.frequency.exponentialRampToValueAtTime(d.f1, t + d.dur * 0.75);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(d.amp, t + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + d.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + d.dur + 0.03);
    }
  }

  /** Soft wooden settle for sitting down on benches and cottage stools. */
  public playSitDown(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.11);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.042, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
    // Tiny linen/fabric brush on top
    const brushSize = Math.floor(ctx.sampleRate * 0.08);
    const brushBuf = ctx.createBuffer(1, brushSize, ctx.sampleRate);
    const brushData = brushBuf.getChannelData(0);
    for (let i = 0; i < brushSize; i++) {
      brushData[i] = (Math.random() * 2 - 1) * (1 - i / brushSize);
    }
    const brush = ctx.createBufferSource();
    brush.buffer = brushBuf;
    const brushFilter = ctx.createBiquadFilter();
    brushFilter.type = 'lowpass';
    brushFilter.frequency.value = 900;
    const brushGain = ctx.createGain();
    brushGain.gain.setValueAtTime(0.02, now + 0.03);
    brushGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    brush.connect(brushFilter);
    brushFilter.connect(brushGain);
    brushGain.connect(ctx.destination);
    brush.start(now + 0.03);
  }

  /** Gentle tea-table sip: two tiny filtered breaths with a porcelain tick between them. */
  public playSip(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const breaths = [
      { t: 0.0, amp: 0.022, dur: 0.14 },
      { t: 0.3, amp: 0.016, dur: 0.12 },
    ];
    for (const b of breaths) {
      const size = Math.floor(ctx.sampleRate * b.dur);
      const buf = ctx.createBuffer(1, size, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < size; i++) {
        const env = Math.sin((i / size) * Math.PI);
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(520, now + b.t);
      filter.frequency.linearRampToValueAtTime(380, now + b.t + b.dur);
      filter.Q.value = 0.9;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now + b.t);
      gain.gain.linearRampToValueAtTime(b.amp, now + b.t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + b.t + b.dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(now + b.t);
    }
    // Porcelain tick between breaths
    const tick = ctx.createOscillator();
    const tickGain = ctx.createGain();
    tick.type = 'sine';
    tick.frequency.setValueAtTime(1180, now + 0.18);
    tickGain.gain.setValueAtTime(0.001, now + 0.18);
    tickGain.gain.linearRampToValueAtTime(0.014, now + 0.185);
    tickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    tick.connect(tickGain);
    tickGain.connect(ctx.destination);
    tick.start(now + 0.18);
    tick.stop(now + 0.26);
  }

  /**
   * Soft hearth crackle room-tone (Pass 7): a looped band-passed noise bed at a whisper
   * gain plus randomized low crackle pops. Idempotent — calling start twice keeps one bed.
   * Stops immediately when muted, unstarted, or the hearth is out.
   */
  public playHearthAmbience(start: boolean): void {
    if (!start) {
      if (this.hearthPopTimer !== null && typeof window !== 'undefined') {
        window.clearTimeout(this.hearthPopTimer);
        this.hearthPopTimer = null;
      }
      if (this.hearthBed) {
        try {
          this.hearthBed.source.stop();
        } catch {
          // already stopped
        }
        this.hearthBed = null;
      }
      return;
    }
    if (this.hearthBed || this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Looping noise bed, heavily low-passed, barely audible
    const bedSize = Math.floor(ctx.sampleRate * 2);
    const bedBuf = ctx.createBuffer(1, bedSize, ctx.sampleRate);
    const bedData = bedBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bedSize; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.04) * 0.985;
      bedData[i] = last;
    }
    const src = ctx.createBufferSource();
    src.buffer = bedBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.022, now + 1.2);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    this.hearthBed = { source: src, gain };

    const schedulePop = () => {
      if (!this.hearthBed || this.muted) return;
      const c = this.ensureContext();
      if (!c) return;
      const t = c.currentTime;
      const popSize = Math.floor(c.sampleRate * 0.05);
      const popBuf = c.createBuffer(1, popSize, c.sampleRate);
      const popData = popBuf.getChannelData(0);
      for (let i = 0; i < popSize; i++) {
        popData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / popSize, 2.2);
      }
      const pop = c.createBufferSource();
      pop.buffer = popBuf;
      const popFilter = c.createBiquadFilter();
      popFilter.type = 'bandpass';
      popFilter.frequency.value = 1400 + Math.random() * 1600;
      popFilter.Q.value = 2.2;
      const popGain = c.createGain();
      popGain.gain.value = 0.02 + Math.random() * 0.02;
      pop.connect(popFilter);
      popFilter.connect(popGain);
      popGain.connect(c.destination);
      pop.start(t);
      this.hearthPopTimer = window.setTimeout(schedulePop, 260 + Math.random() * 900);
    };
    this.hearthPopTimer = window.setTimeout(schedulePop, 320 + Math.random() * 500);
  }
}

export const cozyAudio = new CozyAudioEngine();
