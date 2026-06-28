"use client";

/**
 * ChessSchool Audio Engine (v2)
 * -----------------------------
 * 100% original, procedurally-synthesized sound — no sample files, fully
 * offline, tiny footprint. v2 is markedly warmer than simple beeps:
 *  - each "voice" is two slightly-detuned oscillators (chorus/warmth)
 *  - a per-voice lowpass filter rounds off harshness
 *  - a shared feedback-delay "send" gives a sense of room/space
 *  - layered chords + arpeggios for ceremony cues (graduation/victory)
 * Respects global mute/volume and adaptive intensity.
 */

export type SoundName =
  | "move"
  | "capture"
  | "promotion"
  | "check"
  | "select"
  | "success"
  | "fail"
  | "reward"
  | "streak"
  | "levelup"
  | "unlock"
  | "exam"
  | "graduation"
  | "victory"
  | "ambience"
  | "transition"
  | "notify"
  | "install";

interface Voice {
  freq: number;
  type: OscillatorType;
  dur: number;
  gain: number;
  delay?: number;
  glideTo?: number;
  /** lowpass cutoff in Hz (default 4000) */
  cutoff?: number;
  /** amount sent to the space/delay bus 0..1 */
  space?: number;
}

// note helper (equal temperament, A4 = 440)
const N: Record<string, number> = {
  C3: 130.81, E3: 164.81, G3: 196.0, A3: 220.0,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0, C6: 1046.5, E6: 1318.5,
};

function chord(freqs: number[], opts: Partial<Voice>, stagger = 0): Voice[] {
  return freqs.map((f, i) => ({
    freq: f,
    type: opts.type ?? "sine",
    dur: opts.dur ?? 0.4,
    gain: opts.gain ?? 0.22,
    cutoff: opts.cutoff ?? 3200,
    space: opts.space ?? 0.25,
    delay: (opts.delay ?? 0) + i * stagger,
  }));
}

const RECIPES: Record<SoundName, Voice[]> = {
  select: [{ freq: N.A4!, type: "sine", dur: 0.07, gain: 0.16, cutoff: 2600, space: 0.1 }],
  move: [
    { freq: 196, type: "triangle", dur: 0.11, gain: 0.26, glideTo: 150, cutoff: 1800, space: 0.12 },
    { freq: 98, type: "sine", dur: 0.09, gain: 0.18, cutoff: 1200 },
  ],
  capture: [
    { freq: 150, type: "sawtooth", dur: 0.12, gain: 0.24, glideTo: 70, cutoff: 1400, space: 0.18 },
    { freq: 300, type: "triangle", dur: 0.06, gain: 0.16, cutoff: 2200 },
  ],
  promotion: chord([N.C4!, N.E4!, N.G4!, N.C5!], { type: "triangle", dur: 0.34, gain: 0.18, space: 0.4 }, 0.06),
  check: [
    { freq: N.E5!, type: "sine", dur: 0.12, gain: 0.24, cutoff: 4000, space: 0.3 },
    { freq: N.B4!, type: "sine", dur: 0.14, gain: 0.2, delay: 0.05, space: 0.3 },
  ],
  success: chord([N.C5!, N.E5!, N.G5!], { type: "sine", dur: 0.18, gain: 0.2, space: 0.35 }, 0.07),
  fail: [
    { freq: N.A3!, type: "sawtooth", dur: 0.26, gain: 0.2, glideTo: 110, cutoff: 1300, space: 0.2 },
  ],
  reward: chord([N.E5!, N.A5!, N.C6!], { type: "triangle", dur: 0.24, gain: 0.2, space: 0.45 }, 0.08),
  streak: chord([N.G4!, N.B4!, N.D5!, N.G5!], { type: "sine", dur: 0.2, gain: 0.18, space: 0.4 }, 0.06),
  levelup: chord([N.C5!, N.G5!, N.C6!], { type: "sine", dur: 0.3, gain: 0.2, space: 0.5 }, 0.1),
  unlock: [
    { freq: N.G4!, type: "triangle", dur: 0.12, gain: 0.2, space: 0.3 },
    { freq: N.C5!, type: "triangle", dur: 0.2, gain: 0.22, delay: 0.08, space: 0.4 },
  ],
  exam: chord([N.D4!, N.F4!, N.A4!], { type: "sine", dur: 0.22, gain: 0.18, space: 0.3 }, 0.05),
  // Graduation fanfare: I–IV–V–I style ascending bloom
  graduation: [
    ...chord([N.C4!, N.E4!, N.G4!], { type: "triangle", dur: 0.3, gain: 0.18, space: 0.5 }, 0.04),
    ...chord([N.F4!, N.A4!, N.C5!], { type: "triangle", dur: 0.3, gain: 0.18, delay: 0.22, space: 0.5 }, 0.04),
    ...chord([N.G4!, N.B4!, N.D5!], { type: "triangle", dur: 0.3, gain: 0.18, delay: 0.44, space: 0.5 }, 0.04),
    ...chord([N.C5!, N.E5!, N.G5!, N.C6!], { type: "sine", dur: 0.6, gain: 0.2, delay: 0.66, space: 0.6 }, 0.05),
  ],
  victory: [
    ...chord([N.C5!, N.E5!, N.G5!], { type: "triangle", dur: 0.16, gain: 0.2, space: 0.4 }, 0.05),
    { freq: N.C6!, type: "sine", dur: 0.5, gain: 0.22, delay: 0.2, space: 0.6 },
  ],
  ambience: chord([N.C3!, N.G3!, N.C4!, N.E4!], { type: "sine", dur: 1.6, gain: 0.06, cutoff: 1400, space: 0.7 }),
  transition: [{ freq: N.A4!, type: "sine", dur: 0.08, gain: 0.12, glideTo: N.E5!, cutoff: 3000, space: 0.2 }],
  notify: [
    { freq: N.A5!, type: "sine", dur: 0.08, gain: 0.18, space: 0.25 },
    { freq: N.C6!, type: "sine", dur: 0.1, gain: 0.18, delay: 0.05, space: 0.25 },
  ],
  install: chord([N.C5!, N.E5!, N.G5!, N.C6!], { type: "sine", dur: 0.3, gain: 0.2, space: 0.55 }, 0.09),
};

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private spaceBus: AudioNode | null = null;
  private enabled = true;
  private volume = 0.7;
  private intensity = 1;

  private ensure(): boolean {
    if (typeof window === "undefined") return false;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);

      // Simple feedback-delay "space" send for a warmer, less dry character.
      const delay = this.ctx.createDelay(0.5);
      delay.delayTime.value = 0.11;
      const feedback = this.ctx.createGain();
      feedback.gain.value = 0.22;
      const wet = this.ctx.createGain();
      wet.gain.value = 0.5;
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(this.master);
      this.spaceBus = delay;
    }
    return true;
  }

  unlock(): void {
    if (!this.ensure() || !this.ctx) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  configure(opts: { enabled?: boolean; volume?: number; intensity?: number }): void {
    if (opts.enabled !== undefined) this.enabled = opts.enabled;
    if (opts.volume !== undefined) this.volume = opts.volume;
    if (opts.intensity !== undefined) this.intensity = opts.intensity;
  }

  play(name: SoundName): void {
    if (!this.enabled || !this.ensure() || !this.ctx || !this.master || !this.spaceBus) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    const now = this.ctx.currentTime;
    for (const v of RECIPES[name]) {
      this.voice(v, now);
    }
  }

  private voice(v: Voice, now: number): void {
    if (!this.ctx || !this.master || !this.spaceBus) return;
    const start = now + (v.delay ?? 0);
    const peak = v.gain * this.volume * this.intensity;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, start + v.dur);

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(v.cutoff ?? 4000, start);

    env.connect(filter);
    filter.connect(this.master);
    if (v.space && v.space > 0) {
      const send = this.ctx.createGain();
      send.gain.value = v.space;
      filter.connect(send);
      send.connect(this.spaceBus);
    }

    // Two detuned oscillators = a fuller, less synthetic tone.
    for (const detune of [-6, 6]) {
      const osc = this.ctx.createOscillator();
      osc.type = v.type;
      osc.frequency.setValueAtTime(v.freq, start);
      osc.detune.setValueAtTime(detune, start);
      if (v.glideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, v.glideTo), start + v.dur);
      }
      osc.connect(env);
      osc.start(start);
      osc.stop(start + v.dur + 0.03);
    }
  }
}

export const audio = new AudioEngine();
