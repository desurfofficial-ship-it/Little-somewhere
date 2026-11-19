// Procedural Web Audio API cozy synthesizer (zero external audio files)

class CozyAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

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
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public playFootstep(intensity: 'walk' | 'run' | 'sprint' = 'walk'): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    // Tiered character: walk is a soft padded step, run adds body, sprint lands
    // crisply with a touch more snap so speed is audible as well as visible.
    const baseFreq =
      intensity === 'sprint' ? 165 : intensity === 'run' ? 150 : 140;
    const dropTo = intensity === 'sprint' ? 62 : intensity === 'run' ? 66 : 70;
    const vol = intensity === 'sprint' ? 0.05 : intensity === 'run' ? 0.042 : 0.035;
    const dur = intensity === 'sprint' ? 0.05 : 0.055;
    osc.frequency.setValueAtTime(baseFreq + (Math.random() - 0.5) * 24, now);
    osc.frequency.exponentialRampToValueAtTime(dropTo, now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.005);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  }

  public playWaveHello(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Bright two-note "hello!" flourish — a little greeting curtsy in the air.
    const notes = [
      { delay: 0.0, freq: 587.33, amp: 0.05, dur: 0.16 },
      { delay: 0.11, freq: 783.99, amp: 0.042, dur: 0.22 },
    ];
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + n.delay;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, t);
      osc.frequency.exponentialRampToValueAtTime(n.freq * 1.03, t + n.dur * 0.6);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(n.amp, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + n.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + n.dur + 0.03);
    }
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
}

export const cozyAudio = new CozyAudioEngine();
