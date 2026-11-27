// Tuner: finds the pitch of a single plucked string and the nearest guitar string.
import { PitchDetector } from 'pitchy';
import { OPEN_STRING_MIDI, midiToFreq, centsBetween, STRING_LABEL } from './notes';

export interface TunerReading {
  freq: number;
  clarity: number;
  string: number;        // nearest string (6..1)
  stringLabel: string;
  targetFreq: number;
  cents: number;         // + = sharp (too high), - = flat (too low)
}

const detectors = new Map<number, PitchDetector<Float32Array>>();

/** Pitch of a mono buffer (use ~4096 samples at 44.1/48 kHz). Returns null when unclear. */
export function detectPitch(buf: Float32Array, sampleRate: number, minClarity = 0.9): { freq: number; clarity: number } | null {
  let d = detectors.get(buf.length);
  if (!d) { d = PitchDetector.forFloat32Array(buf.length); detectors.set(buf.length, d); }
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / buf.length) < 0.002) return null;
  const [freq, clarity] = d.findPitch(buf, sampleRate);
  if (clarity < minClarity || freq < 60 || freq > 1200) return null;
  return { freq, clarity };
}

/** Which string is this pitch closest to? Allows for strings that are badly out of tune. */
export function nearestString(freq: number, only?: number): TunerReading['string'] {
  if (only) return only;
  let best = 6, bestD = Infinity;
  for (const s of [6, 5, 4, 3, 2, 1]) {
    const d = Math.abs(centsBetween(freq, midiToFreq(OPEN_STRING_MIDI[s])));
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

export function tunerReading(freq: number, clarity: number, only?: number): TunerReading {
  const string = nearestString(freq, only);
  const targetFreq = midiToFreq(OPEN_STRING_MIDI[string]);
  let cents = centsBetween(freq, targetFreq);
  // If a specific string is chosen and we're hearing its octave (common with overtones), fold it.
  if (only) while (Math.abs(cents) > 600) cents += cents > 0 ? -1200 : 1200;
  return { freq, clarity, string, stringLabel: STRING_LABEL[string], targetFreq, cents };
}

/** Smooths readings so the needle doesn't jump about. */
export class TunerSmoother {
  private hist: number[] = [];
  push(cents: number) {
    this.hist.push(cents);
    if (this.hist.length > 5) this.hist.shift();
    const s = [...this.hist].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }
  reset() { this.hist = []; }
}
