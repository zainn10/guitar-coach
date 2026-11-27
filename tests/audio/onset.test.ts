import { detectOnsets } from '../../src/audio/onset';
import { addStrum, addClick, highpass, addNoise } from '../../src/audio/synth';
import chordsData from '../../content/chords/open-chords.json';
import type { ChordShape } from '../../src/audio/notes';

const chords = chordsData.chords as ChordShape[];
const chord = (id: string) => chords.find(c => c.id === id)!;
const SR = 48000;

describe('strum onset detection', () => {
  it('finds each strum within 25 ms, including late ones', () => {
    const times = [0.5, 1.5, 2.75, 3.5, 4.9, 6.0];
    const sig = new Float32Array(SR * 8);
    const ids = ['Em', 'Am', 'D', 'G', 'A', 'Em'];
    times.forEach((t, i) => addStrum(sig, SR, Math.round(t * SR), chord(ids[i]), { seed: i + 1 }));
    addNoise(sig, 0.0005);
    const onsets = detectOnsets(highpass(sig, SR, 140), SR);
    expect(onsets.length).toBe(times.length);
    onsets.forEach((o, i) => expect(Math.abs(o.frame / SR - times[i])).toBeLessThan(0.025));
  });

  it('ignores metronome clicks leaking into the mic', () => {
    const sig = new Float32Array(SR * 6);
    for (let b = 0; b < 12; b++) addClick(sig, SR, Math.round((0.25 + b * 0.5) * SR), b % 4 === 0, 0.25);
    addStrum(sig, SR, Math.round(1.25 * SR), chord('Em'));
    addStrum(sig, SR, Math.round(3.25 * SR), chord('Am'));
    addNoise(sig, 0.0005);
    const onsets = detectOnsets(sig, SR);
    expect(onsets.map(o => +(o.frame / SR).toFixed(2))).toHaveLength(2);
  });

  it('works at 44.1 kHz too', () => {
    const sr = 44100;
    const sig = new Float32Array(sr * 3);
    addStrum(sig, sr, Math.round(1.0 * sr), chord('G'));
    const onsets = detectOnsets(sig, sr);
    expect(onsets).toHaveLength(1);
    expect(Math.abs(onsets[0].frame / sr - 1.0)).toBeLessThan(0.025);
  });
});

import { isStrum } from '../../src/audio/onset';
describe('loudness gate (ignores small noises)', () => {
  it('a soft tap is ignored, a strum is kept', () => {
    const sig = new Float32Array(SR * 4);
    addNoise(sig, 0.0003);
    // soft tap: a short, quiet knock
    const tapAt = Math.round(1.0 * SR);
    for (let i = 0; i < 0.03 * SR; i++) sig[tapAt + i] += Math.sin(i * 0.05) * 0.004 * Math.exp(-i / (0.006 * SR));
    addStrum(sig, SR, Math.round(2.5 * SR), chord('Em'));
    const onsets = detectOnsets(sig, SR, { sensitivity: 2 });
    expect(onsets.length).toBeGreaterThanOrEqual(2); // the tap IS heard by the raw detector
    const kept = onsets.filter(o => isStrum(sig, SR, o.frame, 'medium'));
    expect(kept).toHaveLength(1);
    expect(Math.abs(kept[0].frame / SR - 2.5)).toBeLessThan(0.03);
  });
});
describe('loudness gate while a chord is ringing', () => {
  it('keeps a new strum over a ringing chord but ignores a tap', () => {
    const sig = new Float32Array(SR * 4);
    addNoise(sig, 0.0003);
    addStrum(sig, SR, Math.round(0.5 * SR), chord('Em'));
    const tapAt = Math.round(1.3 * SR);
    for (let i = 0; i < 0.03 * SR; i++) sig[tapAt + i] += Math.sin(i * 0.05) * 0.01 * Math.exp(-i / (0.006 * SR));
    addStrum(sig, SR, Math.round(2.0 * SR), chord('Am'));
    const kept = detectOnsets(sig, SR, { sensitivity: 2 }).filter(o => isStrum(sig, SR, o.frame, 'medium'));
    expect(kept.map(o => Math.round(o.frame / SR * 10) / 10)).toEqual([0.5, 2.0]);
  });
});
