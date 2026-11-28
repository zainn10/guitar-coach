import { judgeSound, rhythmRead } from '../../src/audio/freePlay';
import { addStrum, addPluck, addRoomNoise, highpass } from '../../src/audio/synth';
import { midiToFreq, ChordShape } from '../../src/audio/notes';
import open from '../../content/chords/open-chords.json';
import more from '../../content/chords/more-chords.json';
import thresholds from '../../content/config/thresholds.json';

const LIB = [...open.chords, ...more.chords] as ChordShape[];
const C = (id: string) => LIB.find(c => c.id === id)!;
const SR = 48000;
const KNOWN = ['Em', 'Am', 'E', 'A', 'D', 'Dm', 'G', 'C'].map(C);

function sound(fn: (s: Float32Array) => void) {
  const s = new Float32Array(SR * 2);
  fn(s);
  addRoomNoise(s, SR, 0.0015, 3);
  return highpass(s, SR);
}
const AT = Math.round(0.5 * SR);
const judge = (sig: Float32Array, expected?: string) => judgeSound(sig, SR, AT, KNOWN, LIB, expected ? C(expected) : null, thresholds.chordCheck);

describe('play freely: what was that sound?', () => {
  for (const id of ['Em', 'Am', 'D', 'G', 'C']) {
    it(`recognises a clean ${id} among the chords you know`, () => {
      const r = judge(sound(s => addStrum(s, SR, AT, C(id), { gain: 0.3 })));
      expect(r.kind).toBe('chord');
      if (r.kind === 'chord') { expect(r.chord).toBe(id); expect(r.clean).toBe(true); }
    });
  }
  it('names the dead string in a messy chord', () => {
    const r = judge(sound(s => addStrum(s, SR, AT, C('C'), { gain: 0.3, missing: [3] })), 'C');
    expect(r.kind).toBe('chord');
    if (r.kind === 'chord') { expect(r.clean).toBe(false); expect(r.text).toMatch(/3rd/); expect(r.fix).toBeTruthy(); }
  });
  it('says honestly when a messy chord could be either of two of your chords', () => {
    // Am and A differ only on the 2nd string; with it dead they sound the same
    const r = judge(sound(s => addStrum(s, SR, AT, C('Am'), { gain: 0.3, missing: [2] })));
    expect(r.kind).toBe('chord');
    if (r.kind === 'chord') { expect(r.clean).toBe(false); expect([r.chord, r.alt].sort()).toEqual(['A', 'Am']); expect(r.text).toMatch(/2nd/); }
  });
  it('says when you played a different chord from the one that comes next', () => {
    const r = judge(sound(s => addStrum(s, SR, AT, C('G'), { gain: 0.3 })), 'D');
    expect(r.kind).toBe('unsure');
    if (r.kind === 'unsure') expect(r.text).toMatch(/sounded like G.*D comes next/);
  });
  it('names a clear single note', () => {
    const r = judge(sound(s => addPluck(s, SR, AT, midiToFreq(57), { gain: 0.15 })));
    expect(r.kind).toBe('note');
    if (r.kind === 'note') { expect(r.name).toBe('A'); expect(r.clear).toBe(true); }
  });
  it('spots a note that dies away at once', () => {
    const r = judge(sound(s => addPluck(s, SR, AT, midiToFreq(52), { gain: 0.15, sustain: 0.05 })));
    expect(r.kind).toBe('note');
    if (r.kind === 'note') expect(r.clear).toBe(false);
  });
  it('ignores a knock', () => {
    const r = judge(sound(s => { let x = 7, y = 0; for (let k = 0; k < SR * 0.3; k++) { x = (x * 16807) % 2147483647; y = 0.9 * y + 0.1 * ((x / 2147483647) * 2 - 1); s[AT + k] += y * 0.4 * Math.exp(-k / (0.01 * SR)); } }));
    expect(r.kind).toBe('noise');
  });
  it('reads rhythm: steady, speeding up, slowing down', () => {
    expect(rhythmRead([0, 1, 2, 3, 4, 5, 6, 7])?.trend).toBe('steady');
    expect(rhythmRead([0, 1, 1.93, 2.8, 3.6, 4.35, 5.05, 5.7])?.trend).toBe('speeding up');
    expect(rhythmRead([0, 0.75, 1.55, 2.4, 3.3, 4.25, 5.25, 6.3])?.trend).toBe('slowing down');
    expect(rhythmRead([0, 1, 2])).toBeNull();
    // a missed strum (double gap) or an extra sound (split gap) doesn't count as a rhythm problem
    expect(rhythmRead([0, 1.7, 3.4, 6.8, 8.5, 10.2, 11.9, 13.6])?.trend).toBe('steady');
    expect(rhythmRead([0, 1.7, 3.4, 4.2, 5.1, 6.8, 8.5, 10.2, 11.9])?.trend).toBe('steady');
  });
});
