// Sounds used by the teaching visuals: strummed chords, single notes, clicks.
// All synthesised (no recordings), played through the speakers/headphones.
import { engine } from './engine';
import { addStrum, addPluck, addClick } from './synth';
import { ChordShape, midiToFreq } from './notes';

export async function ctx() { return engine.ensureContext(); }

function play(buf: Float32Array, when: number) {
  const c = engine.ctx!;
  const b = c.createBuffer(1, buf.length, c.sampleRate);
  b.copyToChannel(buf, 0);
  const src = c.createBufferSource();
  src.buffer = b;
  src.connect(c.destination);
  src.start(Math.max(when, c.currentTime + 0.005));
  return src;
}

export async function playChord(chord: ChordShape, opts: { when?: number; dir?: 'down' | 'up'; gain?: number; spreadMs?: number } = {}) {
  const c = await ctx();
  const sr = c.sampleRate;
  const buf = new Float32Array(sr * 3);
  addStrum(buf, sr, 0, chord, { gain: opts.gain ?? 0.3, direction: opts.dir ?? 'down', spreadMs: opts.spreadMs ?? 18 });
  return play(buf, opts.when ?? c.currentTime + 0.03);
}

export async function playNote(midi: number, when?: number, gain = 0.35, sustain = 1) {
  const c = await ctx();
  const sr = c.sampleRate;
  const buf = new Float32Array(Math.round(sr * 2.5 * sustain));
  addPluck(buf, sr, 0, midiToFreq(midi), { gain, sustain });
  return play(buf, when ?? c.currentTime + 0.03);
}

export async function playClick(when: number, accent = false) {
  const c = await ctx();
  const buf = new Float32Array(Math.round(c.sampleRate * 0.05));
  addClick(buf, c.sampleRate, 0, accent, 0.25);
  return play(buf, when);
}

/** Muted percussive "chuck" (palm or fingers landing on the strings). */
export async function playChuck(when: number, gain = 0.25) {
  const c = await ctx();
  const sr = c.sampleRate;
  const buf = new Float32Array(Math.round(sr * 0.08));
  let lp = 0;
  for (let i = 0; i < buf.length; i++) {
    lp = lp * 0.85 + (Math.random() * 2 - 1) * 0.15;
    buf[i] = lp * gain * 3 * Math.exp(-i / (0.012 * sr));
  }
  return play(buf, when);
}

/** Stop helper: cancels a list of scheduled sources. */
export const stopAll = (srcs: (AudioBufferSourceNode | undefined)[]) => srcs.forEach(s => { try { s?.stop(); } catch { /* done */ } });
