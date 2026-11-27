import { noteClarity, analyseNoteSequence } from '../../src/audio/stringCheck';
import { detectOnsets, isPluck } from '../../src/audio/onset';
import { addPluck, highpass, addRoomNoise } from '../../src/audio/synth';
import { midiToFreq, OPEN_STRING_MIDI } from '../../src/audio/notes';
import thresholds from '../../content/config/thresholds.json';

const SR = 48000;
const MIN = thresholds.onset.minNoteClarity;

function noise(s: Float32Array, at: number, tau: number, lp: number, gain: number, seed: number) {
  let x = seed, y = 0;
  const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let k = 0; k < SR * 0.3 && at + k < s.length; k++) { y = lp * y + (1 - lp) * rnd(); s[at + k] += y * gain * Math.exp(-k / (tau * SR)); }
}

describe('single notes ignore taps and knocks', () => {
  it('plucked notes are clear, taps/knocks/thuds/scrapes are not', () => {
    for (const midi of [41, 45, 50, 55, 59, 64]) {
      const s = new Float32Array(SR); addPluck(s, SR, SR / 2, midiToFreq(midi), { gain: 0.05, seed: midi }); addRoomNoise(s, SR, 0.0015, 2);
      expect(noteClarity(highpass(s, SR), SR, SR / 2).clarity).toBeGreaterThan(MIN + 0.3);
    }
    for (const [tau, lp] of [[0.004, 0], [0.01, 0.9], [0.03, 0.97], [0.08, 0.5]]) {
      const s = new Float32Array(SR); noise(s, SR / 2, tau, lp, 0.3, 9); addRoomNoise(s, SR, 0.0015, 2);
      expect(noteClarity(highpass(s, SR), SR, SR / 2).clarity).toBeLessThan(MIN - 0.15);
    }
  });

  it('warm-up notes pass even with taps between them', () => {
    const notes = [[6, 1], [6, 2], [6, 3], [6, 4], [5, 1], [5, 2], [5, 3], [5, 4]].map(([st, f]) => OPEN_STRING_MIDI[st] + f);
    const s = new Float32Array(SR * 9);
    notes.forEach((m, i) => {
      addPluck(s, SR, Math.round((0.5 + i * 0.9) * SR), midiToFreq(m), { gain: 0.08, seed: i + 3 });
      noise(s, Math.round((0.95 + i * 0.9) * SR), [0.004, 0.01, 0.03][i % 3], [0, 0.9, 0.97][i % 3], 0.25, i + 11); // a tap/knock between every note
    });
    addRoomNoise(s, SR, 0.0015, 4);
    const sig = highpass(s, SR);
    const all = detectOnsets(sig, SR, { sensitivity: 1.5 }).map(o => o.frame);
    const onsets = all
      .filter(f => isPluck(sig, SR, f) && noteClarity(sig, SR, f).clarity >= MIN);
    expect(onsets.length).toBe(notes.length);
    expect(analyseNoteSequence(sig, SR, onsets, notes).every(r => r.ok)).toBe(true);
  });

  it('a quieter new note over a louder ringing one still counts', () => {
    for (const [a, b] of [[40, 45], [45, 50], [50, 55], [55, 59], [41, 46]]) {
      const s = new Float32Array(SR * 2);
      addPluck(s, SR, Math.round(0.3 * SR), midiToFreq(a), { gain: 0.15, seed: a });
      addPluck(s, SR, Math.round(0.8 * SR), midiToFreq(b), { gain: 0.05, seed: b });
      addRoomNoise(s, SR, 0.0015, 4);
      expect(noteClarity(highpass(s, SR), SR, Math.round(0.8 * SR)).clarity).toBeGreaterThan(MIN);
    }
  });

  it('string-by-string chord: every string counts while the others ring', () => {
    for (const notes of [[40, 47, 52, 55, 59, 64], [45, 52, 57, 60, 64], [43, 47, 50, 55, 59, 67]]) {
      const s = new Float32Array(SR * 6);
      notes.forEach((m, i) => addPluck(s, SR, Math.round((0.4 + i * 0.6) * SR), midiToFreq(m), { gain: 0.06 + (i % 3) * 0.03, seed: m + i }));
      addRoomNoise(s, SR, 0.0015, 5);
      const sig = highpass(s, SR);
      notes.forEach((_, i) => expect(noteClarity(sig, SR, Math.round((0.4 + i * 0.6) * SR)).clarity).toBeGreaterThan(MIN));
    }
  });
});
