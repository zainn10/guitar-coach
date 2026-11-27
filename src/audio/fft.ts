// Small, dependency-free FFT (radix-2) and spectrum helpers.

export function fftInPlace(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

const hannCache = new Map<number, Float64Array>();
export function hann(n: number): Float64Array {
  let w = hannCache.get(n);
  if (!w) {
    w = new Float64Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    hannCache.set(n, w);
  }
  return w;
}

export const nextPow2 = (n: number) => 1 << Math.ceil(Math.log2(Math.max(2, n)));

export interface Spectrum { mag: Float64Array; binHz: number; sampleRate: number }

/** Magnitude spectrum of signal[start .. start+length) with a Hann window, zero-padded to fftSize. */
export function spectrum(signal: Float32Array, start: number, length: number, sampleRate: number, fftSize?: number): Spectrum {
  const size = fftSize ?? nextPow2(length);
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  const w = hann(length);
  for (let i = 0; i < length; i++) {
    const s = signal[start + i];
    re[i] = (s === undefined ? 0 : s) * w[i];
  }
  fftInPlace(re, im);
  const half = size / 2;
  const mag = new Float64Array(half);
  const norm = 2 / (length * 0.5); // so a full-scale sine reads about 1.0
  for (let k = 0; k < half; k++) mag[k] = Math.hypot(re[k], im[k]) * norm;
  return { mag, binHz: sampleRate / size, sampleRate };
}

export const toDb = (x: number) => 20 * Math.log10(Math.max(x, 1e-12));

/** Strongest magnitude within +/- cents of freq. */
export function peakAt(sp: Spectrum, freq: number, cents = 25): number {
  const lo = Math.max(1, Math.floor((freq * Math.pow(2, -cents / 1200)) / sp.binHz));
  const hi = Math.min(sp.mag.length - 1, Math.max(lo + 1, Math.ceil((freq * Math.pow(2, cents / 1200)) / sp.binHz)));
  let m = 0;
  for (let k = lo; k <= hi; k++) if (sp.mag[k] > m) m = sp.mag[k];
  return m;
}

/** Typical background level around freq (median of a +/- semitones band). */
export function floorAt(sp: Spectrum, freq: number, semitones = 3): number {
  const lo = Math.max(1, Math.floor((freq * Math.pow(2, -semitones / 12)) / sp.binHz));
  const hi = Math.min(sp.mag.length - 1, Math.ceil((freq * Math.pow(2, semitones / 12)) / sp.binHz));
  const vals = Array.from(sp.mag.subarray(lo, hi + 1)).sort((a, b) => a - b);
  return vals[Math.floor(vals.length * 0.5)] || 1e-12;
}
