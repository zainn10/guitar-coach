// Latency calibration: how long between the app making a sound and the
// microphone recording it (or between a click and you strumming along to it).
import { detectOnsets, isStrum, Sensitivity } from './onset';

/** Find a metronome click (2.8/3.4 kHz) in `signal` after frame `from`. Returns the frame or null. */
export function findClick(signal: Float32Array, sampleRate: number, from: number, to: number): number | null {
  const win = Math.round(sampleRate * 0.004);
  const hop = Math.max(8, Math.round(win / 8));
  const freqs = [2800, 3400];
  const energyAt = (start: number) => {
    let best = 0;
    for (const f of freqs) {
      const w = (2 * Math.PI * f) / sampleRate;
      let re = 0, im = 0;
      for (let i = 0; i < win; i++) { const x = signal[start + i] ?? 0; re += x * Math.cos(w * i); im -= x * Math.sin(w * i); }
      best = Math.max(best, re * re + im * im);
    }
    return best;
  };
  // background level just before the click window
  const bg: number[] = [];
  for (let s = Math.max(0, from - Math.round(sampleRate * 0.1)); s < from; s += hop) bg.push(energyAt(s));
  bg.sort((a, b) => a - b);
  const noise = bg.length ? bg[Math.floor(bg.length * 0.5)] : 0;
  let peak = 0;
  const vals: { s: number; e: number }[] = [];
  for (let s = from; s < to - win; s += hop) { const e = energyAt(s); vals.push({ s, e }); peak = Math.max(peak, e); }
  if (peak < noise * 40 || peak < 1e-6) return null;
  const th = Math.max(noise * 10, peak * 0.1);
  const hit = vals.find(v => v.e > th);
  return hit ? hit.s + win - Math.round(sampleRate * 0.0035) : null;
}

export interface CalibrationResult { ok: boolean; latencyMs: number | null; spreadMs: number | null; detail: string; samples: number[] }

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

/** Speaker → microphone test. clickFrames: where each click was scheduled (frames relative to signal). */
export function loopbackLatency(signal: Float32Array, sampleRate: number, clickFrames: number[]): CalibrationResult {
  const delays: number[] = [];
  for (const c of clickFrames) {
    const f = findClick(signal, sampleRate, c, c + Math.round(sampleRate * 0.45));
    if (f !== null) delays.push(((f - c) / sampleRate) * 1000);
  }
  if (delays.length < 4) {
    return { ok: false, latencyMs: null, spreadMs: null, samples: delays, detail: `I only heard ${delays.length} of ${clickFrames.length} clicks. Turn the volume up, or use the strum-along test instead.` };
  }
  const m = median(delays);
  const close = delays.filter(d => Math.abs(d - m) < 6);
  const spread = Math.max(...close) - Math.min(...close);
  const ok = close.length >= Math.min(5, clickFrames.length - 2);
  return { ok, latencyMs: Math.round(m), spreadMs: Math.round(spread), samples: delays, detail: ok ? `Heard ${close.length} of ${clickFrames.length} clicks consistently.` : 'The clicks came back inconsistently. Try again in a quieter room, or use the strum-along test.' };
}

/** You strum along to clicks; we measure how far after each click the strum is recorded. */
export function strumAlongLatency(signal: Float32Array, sampleRate: number, clickFrames: number[], sensitivity: Sensitivity = 'medium'): CalibrationResult {
  const onsets = detectOnsets(signal, sampleRate).filter(o => isStrum(signal, sampleRate, o.frame, sensitivity));
  const offs: number[] = [];
  for (const c of clickFrames) {
    const near = onsets.filter(o => Math.abs(o.frame - c - 0.1 * sampleRate) < 0.3 * sampleRate);
    if (near.length) offs.push(((near[0].frame - c) / sampleRate) * 1000);
  }
  if (offs.length < 4) {
    return { ok: false, latencyMs: null, spreadMs: null, samples: offs, detail: `I only heard ${offs.length} strums lined up with the clicks. Strum firmly once on each click.` };
  }
  const s = [...offs].sort((a, b) => a - b);
  const iqr = s[Math.floor(s.length * 0.75)] - s[Math.floor(s.length * 0.25)];
  const ok = iqr < 70;
  return { ok, latencyMs: Math.round(median(offs)), spreadMs: Math.round(iqr), samples: offs, detail: ok ? `Matched ${offs.length} strums.` : 'Your strums were quite spread out. Try again, listening closely to each click.' };
}
