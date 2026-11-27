// Onset (strum) detection: spots the moment a new sound starts.
// Method: "spectral flux" — how much louder each frequency got since the last
// frame — measured only in the guitar's main range (below ~1.8 kHz), so the
// high-pitched metronome click is largely ignored.
import { fftInPlace, hann } from './fft';

export interface Onset { /** sample index where the strum starts */ frame: number; strength: number }

export interface OnsetOptions {
  sampleRate: number;
  minGapMs?: number;
  sensitivity?: number; // >1 = more sensitive
  lowHz?: number;
  highHz?: number;
  thresholdK?: number;
  thresholdDelta?: number;
  lagHops?: number;
  holdHops?: number;
  /** Diagnostics hook: called for every analysis frame. */
  onFrame?: (info: { frame: number; flux: number; threshold: number; energy: number; floor: number }) => void;
}

const FRAME = 1024;

export class OnsetDetector {
  readonly sampleRate: number;
  private hop: number;
  private minGap: number;
  private sens: number;
  private buf: Float32Array;
  private bufFill = 0;
  /** absolute sample index of buf[0] */
  private bufStart = 0;
  private bands: [number, number][] = [];
  private bandWeight: number[] = [];
  private bandFloorDb: number[] = [];
  private bandHist: Float64Array[] = [];
  private bandDbHist: Float64Array[] = [];
  private lag: number;
  private hold: number;
  private history: number[] = [];
  private recent: { flux: number; frame: number; energy: number; clickE: number }[] = [];
  private clickLo: number;
  private clickHi: number;
  private lastOnset = -Infinity;
  private noiseEnergy = 1e-6;
  private energyHist: number[] = [];
  private energyHistLen: number;
  private started = false;
  private firstFrame = 0;
  private k: number;
  private delta: number;
  private onFrame?: OnsetOptions['onFrame'];
  private re: Float64Array;
  private im: Float64Array;

  constructor(opts: OnsetOptions) {
    this.sampleRate = opts.sampleRate;
    this.hop = opts.sampleRate > 60000 ? 512 : 256;
    this.minGap = ((opts.minGapMs ?? 180) / 1000) * opts.sampleRate;
    this.sens = opts.sensitivity ?? 1;
        this.onFrame = opts.onFrame;
    this.lag = opts.lagHops ?? 5;
    this.hold = opts.holdHops ?? 3;
    this.k = opts.thresholdK ?? 1.5;
    this.delta = opts.thresholdDelta ?? 13;
    const binHz = opts.sampleRate / FRAME;
    this.energyHistLen = Math.round((4 * opts.sampleRate) / this.hop);
    this.buf = new Float32Array(FRAME * 4);
    this.clickLo = Math.round(2400 / binHz);
    this.clickHi = Math.round(4000 / binHz);
    for (let f = opts.lowHz ?? 90; f < (opts.highHz ?? 2000) * 0.9; f *= 2) {
      const lo = Math.max(1, Math.round(f / binHz));
      const hi = Math.max(lo, Math.round(Math.min(f * 2, opts.highHz ?? 2000) / binHz) - 1);
      this.bands.push([lo, hi]);
      this.bandWeight.push(1);
      this.bandFloorDb.push(-90);
    }
    this.re = new Float64Array(FRAME);
    this.im = new Float64Array(FRAME);
  }

  /** Feed consecutive audio. `startFrame` is the absolute index of samples[0]. Returns any onsets found. */
  push(samples: Float32Array, startFrame?: number): Onset[] {
    if (!this.started) {
      this.bufStart = startFrame ?? 0;
      this.firstFrame = this.bufStart;
      this.started = true;
    }
    const found: Onset[] = [];
    let i = 0;
    while (i < samples.length) {
      const n = Math.min(samples.length - i, this.buf.length - this.bufFill);
      this.buf.set(samples.subarray(i, i + n), this.bufFill);
      this.bufFill += n;
      i += n;
      while (this.bufFill >= FRAME) {
        const o = this.processFrame();
        if (o) found.push(o);
        this.buf.copyWithin(0, this.hop, this.bufFill);
        this.bufFill -= this.hop;
        this.bufStart += this.hop;
      }
    }
    return found;
  }

  private processFrame(): Onset | null {
    const w = hann(FRAME);
    const { re, im } = this;
    for (let k = 0; k < FRAME; k++) {
      re[k] = this.buf[k] * w[k];
      im[k] = 0;
    }
    fftInPlace(re, im);
    // Energy in half-octave bands; onset strength = total dB rise vs 2 hops ago.
    let energy = 0;
    const bandDb = new Float64Array(this.bands.length);
    this.bands.forEach(([lo, hi], b) => {
      let e = 0;
      for (let k = lo; k <= hi; k++) e += re[k] * re[k] + im[k] * im[k];
      energy += e;
      bandDb[b] = 10 * Math.log10(e + 1e-9);
    });
    // Compare with the loudest of the previous 3 hops, so the natural
    // wobble ("beating") of a ringing chord doesn't look like a new strum.
    // Energy around the metronome click pitch (2.4-4 kHz), used to reject clicks.
    let clickE = 0;
    for (let k = this.clickLo; k <= this.clickHi; k++) clickE += re[k] * re[k] + im[k] * im[k];
    let flux = 0;
    if (this.bandHist.length === this.lag + this.hold) for (let b = 0; b < bandDb.length; b++) {
      let ref = this.bandFloorDb[b] + 6;
      for (let j = 0; j < this.hold; j++) ref = Math.max(ref, this.bandHist[j][b]);
      const d = bandDb[b] - ref;
      if (d > 0) flux += d * this.bandWeight[b];
    }
    this.bandHist.push(bandDb);
    if (this.bandHist.length > this.lag + this.hold) this.bandHist.shift();
    this.bandDbHist.push(bandDb);
    if (this.bandDbHist.length > this.energyHistLen) this.bandDbHist.shift();
    if (this.bandDbHist.length % 16 === 1) {
      for (let b = 0; b < bandDb.length; b++) {
        const v = this.bandDbHist.map(x => x[b]).sort((x, y) => x - y);
        this.bandFloorDb[b] = v[Math.floor(v.length * 0.1)];
      }
    }
    // Background level = a low percentile of the last ~4 s, so a still-ringing
    // chord doesn't hide the next strum.
    this.energyHist.push(energy);
    if (this.energyHist.length > this.energyHistLen) this.energyHist.shift();
    if (this.energyHist.length % 8 === 0) {
      const e = [...this.energyHist].sort((a, b) => a - b);
      this.noiseEnergy = e[Math.floor(e.length * 0.1)];
    }

    const frame = this.bufStart; // first sample of this analysis frame
    this.recent.push({ flux, frame, energy, clickE });
    if (this.recent.length > 7) this.recent.shift();
    this.history.push(flux);
    if (this.history.length > 60) this.history.shift();

    // Decide about the frame 3 hops ago (so we can see whether it was a local peak).
    if (this.recent.length < 7) return null;
    const c = this.recent[3];
    const sorted = [...this.history].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const threshold = (median * this.k + this.delta) / this.sens;
    this.onFrame?.({ frame: c.frame, flux: c.flux, threshold, energy: c.energy, floor: this.noiseEnergy });
    for (let j = 0; j < 7; j++) if (j !== 3 && this.recent[j].flux > c.flux) return null;
    const loudEnough = c.energy > (this.noiseEnergy * 4) / this.sens && c.energy > 1e-5;
    if (c.flux < threshold || !loudEnough) return null;
    // A metronome click is mostly high-pitched; a strum is mostly low-pitched.
    const peakClick = Math.max(...this.recent.slice(2, 6).map(r => r.clickE));
    const peakLow = Math.max(...this.recent.slice(2, 6).map(r => r.energy));
    if (peakClick > peakLow * 3) return null;
    // The attack lands roughly in the middle-to-late part of the window where flux peaks.
    const onsetFrame = c.frame + Math.round(FRAME * 0.62 - 0.028 * this.sampleRate);
    // Ignore the first moments while the background level is still being learned.
    if (c.frame - this.firstFrame < this.sampleRate * 0.35) return null;
    if (onsetFrame - this.lastOnset < this.minGap) return null;
    this.lastOnset = onsetFrame;
    return { frame: onsetFrame, strength: c.flux };
  }
}

/** Convenience for whole recordings. */
export function detectOnsets(signal: Float32Array, sampleRate: number, opts: Partial<OnsetOptions> = {}): Onset[] {
  const d = new OnsetDetector({ sampleRate, ...opts });
  return d.push(signal, 0);
}

export type Sensitivity = 'low' | 'medium' | 'high';
/** How loud a sound must be to count as a strum. "low" sensitivity = only firm strums count. */
export const SENSITIVITY_GATES: Record<Sensitivity, { minDb: number; riseDb: number }> = {
  high: { minDb: -52, riseDb: 10 },
  medium: { minDb: -42, riseDb: 15 },
  low: { minDb: -34, riseDb: 20 },
};

const rmsDb = (x: Float32Array, a: number, b: number) => {
  let s = 0, n = 0;
  for (let i = Math.max(0, a); i < Math.min(x.length, b); i++) { s += x[i] * x[i]; n++; }
  return n ? 10 * Math.log10(s / n + 1e-12) : -120;
};

/** Loudness of a sound just after `frame`, and of the room just before it (dB full scale). */
export function soundLevel(signal: Float32Array, sampleRate: number, frame: number) {
  const w = Math.round(0.02 * sampleRate);
  let peak = -120;
  for (let a = frame - w; a < frame + 0.15 * sampleRate; a += w / 2) peak = Math.max(peak, rmsDb(signal, a, a + w));
  const bgs: number[] = [];
  for (let a = frame - 0.6 * sampleRate; a < frame - 0.08 * sampleRate; a += w) bgs.push(rmsDb(signal, a, a + w));
  bgs.sort((x, y) => x - y);
  const background = bgs.length ? bgs[Math.floor(bgs.length * 0.3)] : -120;
  const justBefore = rmsDb(signal, frame - Math.round(0.08 * sampleRate), frame - Math.round(0.02 * sampleRate));
  return { peakDb: peak, backgroundDb: background, justBeforeDb: justBefore };
}

/** True if the sound at `frame` is loud enough, and stands out enough, to be a strum. */
export function isStrum(signal: Float32Array, sampleRate: number, frame: number, sensitivity: Sensitivity = 'medium') {
  const g = SENSITIVITY_GATES[sensitivity];
  const { peakDb, backgroundDb, justBeforeDb } = soundLevel(signal, sampleRate, frame);
  if (peakDb < g.minDb) return false;
  // Quiet room before the sound: it must stand well out from the background.
  if (justBeforeDb < g.minDb) return peakDb - backgroundDb >= g.riseDb;
  // A chord was still ringing: a new strum makes it clearly louder again; a tap doesn't.
  return peakDb - justBeforeDb >= 3;
}

/** Looser check for single plucked notes (quieter than strums, often over ringing strings). */
export function isPluck(signal: Float32Array, sampleRate: number, frame: number, sensitivity: Sensitivity = 'medium') {
  const g = SENSITIVITY_GATES[sensitivity];
  const { peakDb, backgroundDb, justBeforeDb } = soundLevel(signal, sampleRate, frame);
  if (peakDb < g.minDb - 6) return false;
  if (justBeforeDb < g.minDb - 6) return peakDb - backgroundDb >= g.riseDb - 5;
  return true;
}
