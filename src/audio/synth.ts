// A simple nylon-string guitar synthesiser. Used for:
//  - automated tests (known chords, missing strings, late strums), and
//  - "play reference" buttons in the app.
import { ChordShape, chordStrings, midiToFreq, OPEN_STRING_MIDI } from './notes';

export interface PluckOptions {
  /** Higher = brighter. Nylon is fairly dark. */
  brightness?: number;
  /** Multiplies ring time. 0.1 = a string damped by a touching finger. */
  sustain?: number;
  gain?: number;
  /** Deterministic randomness for tests. */
  seed?: number;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) / 4294967296);
  };
}

/** Adds one plucked note into `out` starting at sample `at`. */
export function addPluck(out: Float32Array, sampleRate: number, at: number, freq: number, opts: PluckOptions = {}) {
  const brightness = opts.brightness ?? 1;
  const sustain = opts.sustain ?? 1;
  const gain = opts.gain ?? 0.18;
  const rand = rng(opts.seed ?? Math.round(freq * 1000));
  const B = 0.00004; // slight inharmonicity
  const pluckPos = 0.14 + rand() * 0.04;
  const partials: { f: number; a: number; d: number; ph: number }[] = [];
  for (let h = 1; h <= 24; h++) {
    const f = freq * h * Math.sqrt(1 + B * h * h);
    if (f > sampleRate * 0.45) break;
    const comb = Math.abs(Math.sin(Math.PI * h * pluckPos));
    const a = (Math.pow(h, -(1.9 - 0.5 * brightness)) * (0.3 + comb)) * (0.85 + 0.3 * rand());
    // higher partials die faster; low notes ring longer
    const tau = (sustain * 0.9 * Math.pow(110 / freq, 0.35)) / (1 + 0.12 * Math.pow(h, 1.3));
    partials.push({ f, a, d: 1 / (tau * sampleRate), ph: rand() * Math.PI * 2 });
  }
  const norm = gain / partials.reduce((s, p) => s + p.a, 0) * 2.2;
  const len = Math.min(out.length - at, Math.round(sampleRate * 6 * sustain + sampleRate * 0.1));
  const attack = Math.round(sampleRate * 0.002);
  for (const p of partials) {
    const w = (2 * Math.PI * p.f) / sampleRate;
    let env = p.a * norm;
    const dec = Math.exp(-p.d);
    for (let i = 0; i < len; i++) {
      const idx = at + i;
      if (idx < 0) { env *= dec; continue; }
      const att = i < attack ? i / attack : 1;
      out[idx] += Math.sin(p.ph + w * i) * env * att;
      env *= dec;
      if (env < 1e-6) break;
    }
  }
  // a little finger/nail noise at the attack
  const nLen = Math.round(sampleRate * 0.006);
  let lp = 0;
  for (let i = 0; i < nLen && at + i < out.length; i++) {
    if (at + i < 0) continue;
    lp = lp * 0.6 + (rand() * 2 - 1) * 0.4;
    out[at + i] += lp * gain * 0.25 * (1 - i / nLen);
  }
}

export interface StrumOptions {
  /** Milliseconds between strings within one strum. */
  spreadMs?: number;
  direction?: 'down' | 'up';
  /** Strings (numbers 1-6) that should sound but are silent. */
  missing?: number[];
  /** Strings that are touched by a finger and die very quickly. */
  damped?: number[];
  /** Strings marked X that are accidentally played (open). */
  extra?: number[];
  /** Strings played one fret off: { string, delta } */
  wrongFret?: { string: number; delta: number }[];
  gain?: number;
  seed?: number;
  /** Real-guitar messiness: uneven strings, humming unplayed strings, bright bass strings. */
  realistic?: boolean | 'harsh';
}

/** Adds a strummed chord into `out` with the first string hitting at sample `at`. */
export function addStrum(out: Float32Array, sampleRate: number, at: number, chord: ChordShape, opts: StrumOptions = {}) {
  const spread = (opts.spreadMs ?? 12) * sampleRate / 1000;
  let notes = chordStrings(chord).map(s => ({ ...s }));
  for (const e of opts.extra ?? []) {
    const n = notes.find(x => x.string === e);
    if (n && n.midi === null) { n.midi = OPEN_STRING_MIDI[e]; n.fret = 0; }
  }
  for (const w of opts.wrongFret ?? []) {
    const n = notes.find(x => x.string === w.string);
    if (n && n.midi !== null) n.midi += w.delta;
  }
  notes = notes.filter(n => n.midi !== null);
  if (opts.direction === 'up') notes.reverse();
  const rand = rng((opts.seed ?? 1) * 7919 + 17);
  const real = !!opts.realistic;
  let k = 0;
  for (const n of notes) {
    const t = at + Math.round(k * spread * (real ? 0.6 + rand() * 0.8 : 1));
    k++;
    if (opts.missing?.includes(n.string)) continue;
    const damped = opts.damped?.includes(n.string);
    // real strums hit strings unevenly: up to ~10 dB softer
    const uneven = real ? Math.pow(10, -(rand() * (opts.realistic === 'harsh' ? 14 : 10)) / 20) : 1;
    addPluck(out, sampleRate, t, midiToFreq(n.midi!), {
      sustain: damped ? 0.15 : 1,
      gain: (opts.gain ?? 0.16) * (damped ? 0.7 : 1) * uneven,
      brightness: real && n.string >= 5 ? 1.5 : 1,
      seed: (opts.seed ?? 1) * 97 + n.string * 13,
    });
  }
  if (real) {
    // unplayed open strings hum along quietly (sympathetic resonance), ~26-34 dB down
    for (const s of chordStrings(chord)) {
      if (s.midi !== null && !(opts.extra ?? []).includes(s.string)) continue;
      if ((opts.extra ?? []).includes(s.string)) continue;
      addPluck(out, sampleRate, at + Math.round(0.04 * sampleRate), midiToFreq(OPEN_STRING_MIDI[s.string]), {
        gain: (opts.gain ?? 0.16) * Math.pow(10, -((opts.realistic === 'harsh' ? 20 : 26) + rand() * 8) / 20), seed: s.string * 31,
      });
    }
  }
}

/** Room noise: hiss plus low rumble (fans, traffic). */
export function addRoomNoise(signal: Float32Array, sampleRate: number, level = 0.002, seed = 11) {
  const r = rng(seed);
  let lp = 0;
  const a = Math.exp(-2 * Math.PI * 120 / sampleRate);
  for (let i = 0; i < signal.length; i++) {
    const w = r() * 2 - 1;
    lp = a * lp + (1 - a) * w;
    signal[i] += w * level * 0.5 + lp * level * 6;
  }
}

/** The metronome click sound (also what leaks into the mic without headphones). */
export function addClick(out: Float32Array, sampleRate: number, at: number, accent = false, gain = 0.3) {
  const f = accent ? 3400 : 2800;
  const len = Math.round(sampleRate * 0.03);
  for (let i = 0; i < len && at + i < out.length; i++) {
    if (at + i < 0) continue;
    const t = i / sampleRate;
    const att = Math.min(1, t / 0.004);
    const env = (0.5 - 0.5 * Math.cos(Math.PI * att)) * Math.exp(-Math.max(0, t - 0.004) / 0.006);
    out[at + i] += Math.sin(2 * Math.PI * f * t) * env * gain;
  }
}

/** Crude laptop-microphone simulation: removes bass below ~cutoff Hz (2nd-order). */
export function highpass(signal: Float32Array, sampleRate: number, cutoff = 150): Float32Array {
  const out = new Float32Array(signal.length);
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / sampleRate;
  const a = rc / (rc + dt);
  let y1 = 0, x1 = 0, y2 = 0, x2 = 0;
  for (let i = 0; i < signal.length; i++) {
    const x = signal[i];
    const y = a * (y1 + x - x1); x1 = x; y1 = y;
    const z = a * (y2 + y - x2); x2 = y; y2 = z;
    out[i] = z;
  }
  return out;
}

export function addNoise(signal: Float32Array, level: number, seed = 7) {
  const r = rng(seed);
  for (let i = 0; i < signal.length; i++) signal[i] += (r() * 2 - 1) * level;
}
