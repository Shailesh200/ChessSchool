#!/usr/bin/env node
// Synthesises the UI sound cues as 16-bit mono WAV files. Original, no samples.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets/sound");
const RATE = 44100;

// Seeded so regenerating gives byte-identical files.
let seed = 7;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

/** A short wooden room: a few quiet early reflections. */
function room(buf, taps = [[0.019, 0.22], [0.031, 0.14], [0.047, 0.08]]) {
  const out = Float32Array.from(buf);
  for (const [delay, gain] of taps) {
    const d = Math.floor(delay * RATE);
    for (let i = d; i < out.length; i++) out[i] += buf[i - d] * gain;
  }
  return out;
}

function render(seconds, voices, opts = {}) {
  const n = Math.ceil(seconds * RATE);
  const buf = new Float32Array(n);
  for (const v of voices) {
    const start = Math.floor((v.at ?? 0) * RATE);
    const len = Math.floor(v.dur * RATE);
    let phase = 0;
    for (let i = 0; i < len && start + i < n; i++) {
      const t = i / RATE;
      const f = v.glide ? v.freq * Math.pow(v.glide, t / v.dur) : v.freq;
      phase += (2 * Math.PI * f) / RATE;
      const attack = Math.min(1, t / (v.attack ?? 0.005));
      const env = attack * Math.exp(-t * (v.decay ?? 8));
      let s = Math.sin(phase);
      if (v.wave === "triangle") s = (2 / Math.PI) * Math.asin(Math.sin(phase));
      if (v.bell) s = 0.7 * Math.sin(phase) + 0.2 * Math.sin(phase * 2.01) + 0.1 * Math.sin(phase * 3.98);
      if (v.noise) s = noise();
      buf[start + i] += s * env * (v.gain ?? 0.5);
    }
  }
  const mixed = opts.room ? room(buf) : buf;
  let peak = 0;
  for (const s of mixed) peak = Math.max(peak, Math.abs(s));
  const norm = peak > 0 ? 0.5 / peak : 1;
  const fadeOut = Math.floor(0.01 * RATE);
  for (let i = 0; i < fadeOut; i++) mixed[n - 1 - i] *= i / fadeOut;
  return mixed.map((s) => s * norm);
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.max(-1, Math.min(1, s)) * 32767, i * 2));
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** One wooden knock: pitch scales the whole piece; gain scales its weight. */
function knock(at, pitch = 1, gain = 0.9) {
  return [
    { freq: 294 * pitch, glide: 0.7, at, dur: 0.08, decay: 32, gain: gain * 0.55 },
    { freq: 588 * pitch, glide: 0.82, at, dur: 0.07, decay: 28, wave: "triangle", gain: gain * 0.28 },
    { freq: 880 * pitch, at: at + 0.015, dur: 0.16, decay: 12, bell: true, gain: gain * 0.18 },
    { noise: true, at, dur: 0.008, decay: 320, gain: gain * 0.12 },
  ];
}

const CUES = {
  tap: render(0.08, [{ freq: 1568, dur: 0.08, decay: 28, wave: "triangle", gain: 0.22 }, { freq: 2093, at: 0.02, dur: 0.06, decay: 22, bell: true, gain: 0.12 }]),
  success: render(0.6, [
    { freq: 1046.5, dur: 0.5, decay: 7, bell: true },
    { freq: 1318.5, at: 0.09, dur: 0.5, decay: 6, bell: true },
  ]),
  stamp: render(0.55, [
    { freq: 150, glide: 0.5, dur: 0.16, decay: 22, gain: 0.9 },
    { freq: 1568, at: 0.08, dur: 0.45, decay: 7, bell: true, gain: 0.4 },
  ]),
  "gentle-no": render(0.36, [
    { freq: 440, dur: 0.16, decay: 10, wave: "triangle", gain: 0.4 },
    { freq: 370, at: 0.13, dur: 0.22, decay: 9, wave: "triangle", gain: 0.4 },
  ]),
  "level-up": render(0.9, [
    { freq: 523.3, dur: 0.4, decay: 7, bell: true },
    { freq: 659.3, at: 0.1, dur: 0.4, decay: 7, bell: true },
    { freq: 784, at: 0.2, dur: 0.45, decay: 6, bell: true },
    { freq: 1046.5, at: 0.3, dur: 0.6, decay: 5, bell: true },
  ]),
  // Chess moves: a wooden piece set down on a board — a low body, a hollow mid mode,
  // a short click, and a little room. Captures land heavier with a second knock.
  move: render(0.16, knock(0), { room: true }),
  capture: render(0.24, [
    ...knock(0, 0.86, 1),
    { freq: 520, glide: 0.62, at: 0.012, dur: 0.08, decay: 50, wave: "triangle", gain: 0.42 },
    ...knock(0.045, 1.12, 0.55),
  ].flat(), { room: true }),
  check: render(0.5, [
    ...knock(0),
    { freq: 987.8, at: 0.05, dur: 0.4, decay: 9, bell: true, gain: 0.34 },
    { freq: 1318.5, at: 0.09, dur: 0.36, decay: 10, bell: true, gain: 0.2 },
  ].flat(), { room: true }),
  mate: render(1.3, [
    ...knock(0, 0.8, 1.1),
    { freq: 392, at: 0.08, dur: 1.1, decay: 3.2, bell: true, gain: 0.32 },
    { freq: 493.9, at: 0.2, dur: 1.0, decay: 3.4, bell: true, gain: 0.28 },
    { freq: 587.3, at: 0.32, dur: 0.95, decay: 3.6, bell: true, gain: 0.26 },
    { freq: 784, at: 0.46, dur: 0.85, decay: 3.8, bell: true, gain: 0.24 },
    { freq: 98, glide: 0.9, at: 0.08, dur: 0.9, decay: 4, gain: 0.4 },
  ].flat(), { room: true }),
  castle: render(0.3, [...knock(0, 1.04), ...knock(0.12, 0.92)].flat(), { room: true }),
  promote: render(0.7, [
    ...knock(0),
    { freq: 784, at: 0.06, dur: 0.35, decay: 9, bell: true, gain: 0.3 },
    { freq: 987.8, at: 0.12, dur: 0.35, decay: 9, bell: true, gain: 0.3 },
    { freq: 1174.7, at: 0.18, dur: 0.4, decay: 8, bell: true, gain: 0.3 },
    { freq: 1568, at: 0.24, dur: 0.45, decay: 7, bell: true, gain: 0.26 },
  ].flat(), { room: true }),
  "low-time": render(0.32, [
    { freq: 880, dur: 0.07, decay: 45, wave: "triangle", gain: 0.5 },
    { freq: 880, at: 0.16, dur: 0.07, decay: 45, wave: "triangle", gain: 0.5 },
  ]),
};

mkdirSync(OUT, { recursive: true });
for (const [name, samples] of Object.entries(CUES)) writeFileSync(join(OUT, `${name}.wav`), wav(samples));
console.log(`sounds: ${Object.keys(CUES).length} cues`);
