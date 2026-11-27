import { analysePlucks } from '../../src/audio/stringCheck';
import { detectOnsets } from '../../src/audio/onset';
import { addPluck, highpass, addRoomNoise } from '../../src/audio/synth';
import chordsData from '../../content/chords/open-chords.json';
import { ChordShape, chordStrings, midiToFreq } from '../../src/audio/notes';

const library = chordsData.chords as ChordShape[];
const chord = (id: string) => library.find(c => c.id === id)!;
const SR = 48000;

/** Pluck each sounding string in turn, thickest first, ~0.6 s apart. */
function arpeggio(id: string, opts: { muted?: number[]; skip?: number[]; wrong?: { string: number; delta: number }[] } = {}, seed = 1) {
  const notes = chordStrings(chord(id)).filter(s => s.midi !== null);
  const sig = new Float32Array(SR * (notes.length * 0.6 + 1.5));
  const truth: number[] = [];
  notes.forEach((n, i) => {
    if (opts.skip?.includes(n.string)) return;
    const at = Math.round((0.5 + i * 0.6 + ((seed * 7 + i * 3) % 5) * 0.02) * SR);
    truth.push(at);
    const midi = n.midi! + (opts.wrong?.find(w => w.string === n.string)?.delta ?? 0);
    const gain = 0.2 * Math.pow(10, -(((seed * 13 + i * 5) % 9)) / 20);
    if (opts.muted?.includes(n.string)) {
      // a muted string: a short dull thunk
      // (often with a faint pitch, so it must be judged by how fast it dies away)
      for (let k = 0; k < 0.06 * SR; k++) sig[at + k] += Math.sin(k * 0.02 * ((seed % 3) + 1)) * gain * 0.8 * Math.exp(-k / (0.008 * SR));
    } else addPluck(sig, SR, at, midiToFreq(midi), { gain, seed: seed * 31 + i });
  });
  addRoomNoise(sig, SR, 0.0015, seed);
  return { signal: highpass(sig, SR, 150), truth };
}

function check(id: string, opts: Parameters<typeof arpeggio>[1] = {}, seed = 1) {
  const { signal } = arpeggio(id, opts, seed);
  const onsets = detectOnsets(signal, SR, { sensitivity: 1.5 }).map(o => o.frame);
  return { r: analysePlucks(signal, SR, onsets, chord(id)), onsets };
}

describe('string-by-string check', () => {
  for (const id of ['Em', 'Am', 'A', 'D', 'G']) {
    it(`${id}: every string clear when played properly`, () => {
      for (const seed of [1, 2, 3]) {
        const { r, onsets } = check(id, {}, seed);
        expect(onsets.length, `seed ${seed}`).toBe(chordStrings(chord(id)).filter(s => s.midi !== null).length);
        expect(r.strings.filter(s => s.status !== 'ok').map(s => `${s.string}:${s.status}:${s.heardMidi}`), `seed ${seed}`).toEqual([]);
      }
    });
    it(`${id}: a muted string is named, including octave-twin strings`, () => {
      for (const s of chordStrings(chord(id)).filter(x => x.midi !== null)) {
        const { r } = check(id, { muted: [s.string] }, 2);
        const bad = r.strings.filter(x => x.status !== 'ok').map(x => x.string);
        expect(bad, `muted string ${s.string}`).toEqual([s.string]);
      }
    });
  }
  it('a finger on the wrong fret is named', () => {
    const { r } = check('Em', { wrong: [{ string: 3, delta: 1 }] });
    const s3 = r.strings.find(s => s.string === 3)!;
    expect(s3.status).toBe('wrong-note');
    expect(s3.heardMidi).toBe(56);
  });
  it('a skipped string is reported', () => {
    const { r } = check('A', { skip: [1] });
    expect(r.strings.find(s => s.string === 1)!.status).toBe('not-played');
    expect(r.strings.filter(s => s.status === 'ok')).toHaveLength(4);
  });
});
