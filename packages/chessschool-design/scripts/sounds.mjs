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

function render(seconds, voices) {
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
  let peak = 0;
  for (const s of buf) peak = Math.max(peak, Math.abs(s));
  const norm = peak > 0 ? 0.5 / peak : 1;
  const fadeOut = Math.floor(0.01 * RATE);
  for (let i = 0; i < fadeOut; i++) buf[n - 1 - i] *= i / fadeOut;
  return buf.map((s) => s * norm);
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

const CUES = {
  tap: render(0.06, [{ freq: 1180, dur: 0.06, decay: 60, gain: 0.35 }]),
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
  // Chess moves: a soft wooden knock (low body + a short click of noise).
  move: render(0.12, [
    { freq: 210, glide: 0.6, dur: 0.1, decay: 40, gain: 0.9 },
    { noise: true, dur: 0.018, decay: 220, gain: 0.35 },
  ]),
  capture: render(0.18, [
    { freq: 180, glide: 0.5, dur: 0.14, decay: 30, gain: 1 },
    { freq: 420, glide: 0.7, at: 0.025, dur: 0.09, decay: 45, wave: "triangle", gain: 0.45 },
    { noise: true, dur: 0.03, decay: 150, gain: 0.5 },
    { noise: true, at: 0.03, dur: 0.02, decay: 200, gain: 0.3 },
  ]),
  check: render(0.4, [
    { freq: 210, glide: 0.6, dur: 0.1, decay: 40, gain: 0.8 },
    { noise: true, dur: 0.018, decay: 220, gain: 0.3 },
    { freq: 932, at: 0.05, dur: 0.32, decay: 11, bell: true, gain: 0.35 },
  ]),
  castle: render(0.26, [
    { freq: 220, glide: 0.6, dur: 0.1, decay: 40, gain: 0.8 },
    { noise: true, dur: 0.018, decay: 220, gain: 0.3 },
    { freq: 190, glide: 0.6, at: 0.12, dur: 0.1, decay: 40, gain: 0.8 },
    { noise: true, at: 0.12, dur: 0.018, decay: 220, gain: 0.3 },
  ]),
  promote: render(0.55, [
    { freq: 210, glide: 0.6, dur: 0.1, decay: 40, gain: 0.8 },
    { freq: 784, at: 0.06, dur: 0.35, decay: 9, bell: true, gain: 0.35 },
    { freq: 1174.7, at: 0.15, dur: 0.4, decay: 8, bell: true, gain: 0.35 },
  ]),
  "low-time": render(0.32, [
    { freq: 880, dur: 0.07, decay: 45, wave: "triangle", gain: 0.5 },
    { freq: 880, at: 0.16, dur: 0.07, decay: 45, wave: "triangle", gain: 0.5 },
  ]),
};

mkdirSync(OUT, { recursive: true });
for (const [name, samples] of Object.entries(CUES)) writeFileSync(join(OUT, `${name}.wav`), wav(samples));
console.log(`sounds: ${Object.keys(CUES).length} cues`);
