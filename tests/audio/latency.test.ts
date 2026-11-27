import { loopbackLatency, strumAlongLatency } from '../../src/audio/latency';
import { addClick, addStrum, addNoise, highpass } from '../../src/audio/synth';
import chordsData from '../../content/chords/open-chords.json';
import type { ChordShape } from '../../src/audio/notes';
const SR = 48000;
const em = (chordsData.chords as ChordShape[]).find(c => c.id === 'Em')!;

describe('latency calibration', () => {
  it('measures speaker-to-mic delay within 3 ms', () => {
    const sig = new Float32Array(SR * 5);
    const clicks = Array.from({ length: 8 }, (_, i) => Math.round((0.3 + i * 0.4) * SR));
    clicks.forEach((c, i) => addClick(sig, SR, c + Math.round(0.087 * SR), i === 0, 0.05));
    addNoise(sig, 0.002);
    const r = loopbackLatency(highpass(sig, SR, 200), SR, clicks);
    expect(r.ok).toBe(true);
    expect(Math.abs(r.latencyMs! - 87)).toBeLessThanOrEqual(3);
  });
  it('fails politely when no clicks come back', () => {
    const sig = new Float32Array(SR * 5);
    addNoise(sig, 0.002);
    const r = loopbackLatency(sig, SR, [SR, SR * 2, SR * 3]);
    expect(r.ok).toBe(false);
  });
  it('measures strum-along offset', () => {
    const sig = new Float32Array(SR * 9);
    const clicks = Array.from({ length: 8 }, (_, i) => Math.round((0.5 + i * 0.75) * SR));
    clicks.forEach((c, i) => addStrum(sig, SR, c + Math.round((0.14 + (i % 3 - 1) * 0.01) * SR), em, { seed: i }));
    addNoise(sig, 0.001);
    const r = strumAlongLatency(sig, SR, clicks);
    expect(r.ok).toBe(true);
    expect(Math.abs(r.latencyMs! - 140)).toBeLessThan(25);
  });
});
