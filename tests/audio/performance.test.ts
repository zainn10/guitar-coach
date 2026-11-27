import { analyseTake, Song, describeOffset } from '../../src/audio/performance';
import { addStrum, addClick, highpass, addNoise } from '../../src/audio/synth';
import chordsData from '../../content/chords/open-chords.json';
import songData from '../../content/songs/first-steps.json';
import type { ChordShape } from '../../src/audio/notes';

const library = chordsData.chords as ChordShape[];
const song = songData as Song;
const chord = (id: string) => library.find(c => c.id === id)!;
const SR = 48000;

function makeTake(perBar: (bar: number) => { play?: string; lateBeats?: number; skip?: boolean; missing?: number[] }) {
  const beat = (60 / song.bpm) * SR;
  const latency = Math.round(0.12 * SR); // round-trip delay the app has calibrated
  const total = (song.countInBars + song.bars.length + 1) * song.beatsPerBar * beat;
  const sig = new Float32Array(Math.ceil(total + SR));
  // metronome leaking into the mic (no headphones)
  for (let b = 0; b < (song.countInBars + song.bars.length) * song.beatsPerBar; b++)
    addClick(sig, SR, Math.round(b * beat + latency), b % song.beatsPerBar === 0, 0.15);
  const downbeats: number[] = [];
  song.bars.forEach((id, i) => {
    const exp = Math.round((song.countInBars + i) * song.beatsPerBar * beat + latency);
    downbeats.push(exp);
    const p = perBar(i + 1);
    if (p.skip) return;
    addStrum(sig, SR, exp + Math.round((p.lateBeats ?? 0) * beat), chord(p.play ?? id), { seed: i + 2, missing: p.missing });
  });
  addNoise(sig, 0.001);
  return { signal: highpass(sig, SR, 150), downbeats };
}

describe('play-along scoring', () => {
  it('a perfect take is all green', () => {
    const { signal, downbeats } = makeTake(() => ({}));
    const r = analyseTake({ signal, sampleRate: SR, song, downbeatFrames: downbeats, library });
    expect(r.bars.map(b => b.status)).toEqual(Array(8).fill('green'));
    expect(r.trouble.map(x => JSON.stringify(x) + ' ' + r.bars[x.bar - 1].messages.join(' | '))).toEqual([]);
  });

  it('finds a late change, a wrong chord, a muted string and a stop', () => {
    const { signal, downbeats } = makeTake(bar =>
      bar === 5 ? { lateBeats: 0.5 } :          // Am -> D, half a beat late
      bar === 7 ? { play: 'C' } :               // wrong chord
      bar === 3 ? { missing: [2] } :            // Am with B string muted
      bar === 6 ? { skip: true } :              // stopped
      bar === 8 ? { lateBeats: 0.25 } : {});    // slightly late
    const r = analyseTake({ signal, sampleRate: SR, song, downbeatFrames: downbeats, library });
    const st = r.bars.map(b => b.status);
    expect(st).toEqual(['green', 'green', 'amber', 'green', 'red', 'red', 'red', 'amber']);
    expect(r.bars[4].messages[0]).toMatch(/Bar 5 \(Am → D change\): about half a beat late/);
    expect(r.bars[2].messages.join(' ')).toMatch(/2nd \(B\) string/);
    expect(r.trouble).toContainEqual({ kind: 'change', from: 'Am', to: 'D', bar: 5, problem: 'late' });
    expect(r.trouble).toContainEqual({ kind: 'change', from: 'D', to: 'G', bar: 6, problem: 'missed' });
    expect(Math.abs(r.bars[4].offsetMs! - 500)).toBeLessThan(40);
  });

  it('describes offsets in beats', () => {
    expect(describeOffset(480, 1000)).toBe('about half a beat late (0.48 s)');
    expect(describeOffset(-260, 1000)).toBe('about a quarter of a beat early (0.26 s)');
  });
});

describe('play-along with a strumming pattern and two chords in a bar', () => {
  const patSong: Song = { id: 'pat', title: 'Pattern test', bpm: 80, beatsPerBar: 4, countInBars: 1, pattern: 'D-D-D-DU', bars: ['G', 'C', 'G D', 'Em'] };
  function makePatternTake(lateBar?: number, dropUpstrumsBar?: number) {
    const beat = (60 / patSong.bpm) * SR;
    const sig = new Float32Array(Math.ceil((patSong.countInBars + patSong.bars.length + 1) * 4 * beat + SR));
    const downbeats: number[] = [];
    patSong.bars.forEach((bar, i) => {
      const exp = Math.round((patSong.countInBars + i) * 4 * beat);
      downbeats.push(exp);
      const chords = bar.split(' ');
      [0, 1, 2, 3, 3.5].forEach((b, k) => {
        if (b === 2 && dropUpstrumsBar === i + 1) return;
        const ch = chords.length > 1 && b >= 2 ? chords[1] : chords[0];
        let at = exp + Math.round(b * beat);
        if (lateBar === i + 1 && b === 0) at += Math.round(0.5 * beat);
        addStrum(sig, SR, at, chord(ch), { seed: i * 10 + k, gain: b === 3.5 ? 0.08 : 0.16, direction: b === 3.5 ? 'up' : 'down', spreadMs: b === 3.5 ? 6 : 12 });
      });
    });
    addNoise(sig, 0.0008);
    return { signal: highpass(sig, SR, 150), downbeats };
  }
  it('a steady take is all green', () => {
    const { signal, downbeats } = makePatternTake();
    const r = analyseTake({ signal, sampleRate: SR, song: patSong, downbeatFrames: downbeats, library });
    expect(r.bars.map(b => `${b.status} ${b.messages.join(' ')}`)).toEqual(Array(4).fill('green '));
  });
  it('spots a late change and a missing down-strum', () => {
    const { signal, downbeats } = makePatternTake(2, 4);
    const r = analyseTake({ signal, sampleRate: SR, song: patSong, downbeatFrames: downbeats, library });
    expect(r.bars[1].status).toBe('red');
    expect(r.bars[1].messages[0]).toMatch(/G → C change\): about half a beat late/);
    expect(r.bars[3].status).toBe('amber');
    expect(r.bars[3].messages.join(' ')).toMatch(/of 5 strums in the pattern/);
  });
});
