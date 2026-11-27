import { analyseChord } from '../../src/audio/chordCheck';
import { addStrum, highpass, addNoise, StrumOptions } from '../../src/audio/synth';
import chordsData from '../../content/chords/open-chords.json';
import { ChordShape, chordStrings } from '../../src/audio/notes';

const library = chordsData.chords as ChordShape[];
const chord = (id: string) => library.find(c => c.id === id)!;
const TARGETS = ['Em', 'Am', 'A', 'D', 'G'];

type Variant = { name: string; sr: number; mic: boolean; noise: number };
const VARIANTS: Variant[] = [
  { name: 'studio 48k', sr: 48000, mic: false, noise: 0.0003 },
  { name: 'laptop mic 48k', sr: 48000, mic: true, noise: 0.001 },
  { name: 'laptop mic 44.1k', sr: 44100, mic: true, noise: 0.001 },
];

function take(target: string, v: Variant, opts: StrumOptions = {}, play?: string) {
  const sig = new Float32Array(v.sr * 2);
  addStrum(sig, v.sr, Math.round(0.3 * v.sr), chord(play ?? target), { seed: 3, ...opts });
  addNoise(sig, v.noise);
  const s = v.mic ? highpass(sig, v.sr, 150) : sig;
  // pretend onset detection was ~10 ms off
  return analyseChord(s, v.sr, Math.round(0.31 * v.sr), chord(target), library);
}

describe('chord check: clean chords', () => {
  for (const v of VARIANTS) for (const t of TARGETS) {
    it(`${t} (${v.name}) is clean`, () => {
      const r = take(t, v);
      expect(r.issues.map(i => i.message)).toEqual([]);
      expect(r.verdict).toBe('clean');
    });
  }
});

describe('chord check: a missing string is named', () => {
  for (const v of VARIANTS) for (const t of TARGETS) {
    for (const s of chordStrings(chord(t)).filter(x => x.midi !== null)) {
      it(`${t} without string ${s.string} (${v.name})`, () => {
        const r = take(t, v, { missing: [s.string] });
        const rep = r.strings.find(x => x.string === s.string)!;
        // No other string may be wrongly accused.
        const accused = r.issues.filter(i => i.certain).map(i => i.string);
        expect(accused.filter(x => x !== s.string)).toEqual([]);
        if (rep.checkable === 'alone') {
          expect(['missing', 'wrong-note', 'weak']).toContain(rep.status);
          expect(r.verdict).not.toBe('clean');
        }
      });
    }
  }
});

describe('chord check: shared strings report (informational)', () => {
  it('prints how often "shared" strings are caught when missing', () => {
    const rows: string[] = [];
    let caught = 0, total = 0;
    for (const t of TARGETS) for (const s of chordStrings(chord(t)).filter(x => x.midi !== null)) {
      const r = take(t, VARIANTS[1], { missing: [s.string] });
      const rep = r.strings.find(x => x.string === s.string)!;
      if (rep.checkable !== 'shared') continue;
      total++;
      const ok = rep.status !== 'ok-probably';
      if (ok) caught++;
      rows.push(`${t} string ${s.string}: ${ok ? 'not claimed present' : 'wrongly looks present'} (${rep.evidenceDb.toFixed(1)} dB)`);
    }
    console.log(`Shared-string detection: ${caught}/${total}\n` + rows.join('\n'));
    expect(total).toBeGreaterThan(0);
  });
});

describe('chord check: other mistakes', () => {
  const v = VARIANTS[1];
  it('a string muted by a touching finger is "damped"', () => {
    const r = take('Em', v, { damped: [3] });
    expect(r.strings.find(s => s.string === 3)!.status).toBe('damped');
  });
  it('D with the low strings strummed: extra strings', () => {
    const r = take('D', v, { extra: [6, 5] });
    expect(r.strings.find(s => s.string === 5)!.status).toMatch(/^extra/);
    expect(r.strings.find(s => s.string === 6)!.status).toMatch(/^extra/);
    expect(r.issues.some(i => i.kind === 'extra' && i.fix.includes('4th'))).toBe(true);
  });
  it('Am with the low E strummed: extra string', () => {
    const r = take('Am', v, { extra: [6] });
    expect(r.strings.find(s => s.string === 6)!.status).toMatch(/^extra/);
  });
  it('C played when Am was asked: wrong chord', () => {
    const r = take('Am', v, {}, 'C');
    expect(r.verdict).toBe('wrong-chord');
  });
  it('G played when Em was asked: wrong chord', () => {
    const r = take('Em', v, {}, 'G');
    expect(r.verdict).toBe('wrong-chord');
    expect(r.bestMatch.id).toBe('G');
  });
  it('Em played when Am was asked: wrong chord', () => {
    expect(take('Am', v, {}, 'Em').verdict).toBe('wrong-chord');
  });
  it('E major played when Em was asked: 3rd string one fret too high', () => {
    const r = take('Em', v, {}, 'E');
    const rep = r.strings.find(s => s.string === 3)!;
    expect(rep.status).toBe('wrong-note');
    expect(rep.heardMidi).toBe(56);
  });
  it('A minor played when A was asked: 2nd string one fret too low', () => {
    const r = take('A', v, {}, 'Am');
    expect(r.strings.find(s => s.string === 2)!.status).toBe('wrong-note');
  });
  it('silence is reported as too quiet', () => {
    const sig = new Float32Array(48000);
    addNoise(sig, 0.00001);
    expect(analyseChord(sig, 48000, 1000, chord('Em'), library).verdict).toBe('too-quiet');
  });
});

describe('chord check: octave-twin strings listed as checkable', () => {
  for (const t of ['Em', 'Am', 'A']) {
    const s = chord(t).checkShared![0];
    it(`${t} string ${s}: caught when missing, never falsely accused when clean`, () => {
      for (const v of VARIANTS) for (const seed of [1, 4, 7]) {
        const clean = take(t, v, { seed });
        expect(clean.issues).toEqual([]);
        const miss = take(t, v, { seed, missing: [s] });
        expect(miss.strings.find(x => x.string === s)!.status).toBe('missing-probably');
      }
    });
  }
});

import { addRoomNoise } from '../../src/audio/synth';
// "Realistic" = uneven strums, unplayed strings humming along, bright bass, room rumble, laptop mic.
function realTake(target: string, realism: true | 'harsh', seed: number, opts: StrumOptions = {}) {
  const sr = 48000;
  const sig = new Float32Array(sr * 2);
  addStrum(sig, sr, Math.round(0.3 * sr), chord(target), { seed, realistic: realism, ...opts });
  addRoomNoise(sig, sr, 0.002, seed);
  return analyseChord(highpass(sig, sr, 150), sr, Math.round(0.31 * sr), chord(target), library);
}

describe('chord check on a realistic guitar', () => {
  for (const realism of [true, 'harsh'] as const) for (const t of TARGETS) {
    it(`correct ${t} is never marked as needing fixes (${realism === true ? 'normal' : 'harsh'} room)`, () => {
      for (let seed = 1; seed <= 8; seed++) {
        const r = realTake(t, realism, seed);
        expect(r.verdict, `seed ${seed}: ${r.issues.map(i => i.message).join(' ')}`).toBe('clean');
      }
    });
  }
  it('still catches most genuinely missing strings', () => {
    let caught = 0, total = 0;
    for (const t of TARGETS) for (const s of chordStrings(chord(t)).filter(x => x.midi !== null)) {
      for (let seed = 1; seed <= 3; seed++) {
        const r = realTake(t, true, seed, { missing: [s.string] });
        const rep = r.strings.find(x => x.string === s.string)!;
        if (rep.checkable === 'shared' && !chord(t).checkShared?.includes(s.string)) continue;
        total++;
        if (r.issues.some(i => i.string === s.string)) caught++;
      }
    }
    expect(caught / total).toBeGreaterThan(0.75);
  });
  it('catches strumming the low strings on D', () => {
    let caught = 0;
    for (let seed = 1; seed <= 6; seed++) if (realTake('D', true, seed, { extra: [6, 5] }).issues.some(i => i.kind === 'extra')) caught++;
    expect(caught).toBe(6);
  });
});
