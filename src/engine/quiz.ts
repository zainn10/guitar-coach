// 30-second recall quizzes: name the chord, find the note, spot the mistake, and ear training.
import { CHORDS, chordById } from '../content';
import { ChordShape, OPEN_STRING_MIDI, NOTE_NAMES, ordinal } from '../audio/notes';

export type QuizQ =
  | { kind: 'name'; chord: ChordShape; options: string[]; answer: string }
  | { kind: 'find'; string: number; note: string; frets: [number, number] }
  | { kind: 'mistake'; chord: ChordShape; wrong: ChordShape; wrongString: number; options: string[]; answer: string }
  | { kind: 'ear'; play: string; options: string[]; answer: string };

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

export function makeQuiz(known: string[], n = 3, kinds: QuizQ['kind'][] = ['name', 'find', 'mistake']): QuizQ[] {
  const pool = known.length >= 2 ? known : ['Em', 'Am', 'E', 'A'];
  const out: QuizQ[] = [];
  for (let i = 0; i < n; i++) {
    const kind = kinds[i % kinds.length];
    if (kind === 'name') {
      const c = pick(pool);
      const others = shuffle([...new Set([...pool, 'Em', 'Am', 'E', 'A', 'D', 'Dm', 'G', 'C'])].filter(x => x !== c && CHORDS.some(k => k.id === x))).slice(0, 3);
      out.push({ kind, chord: chordById(c), options: shuffle([c, ...others]), answer: c });
    } else if (kind === 'find') {
      const string = pick([6, 5, 6, 5, 4]);
      const fret = Math.floor(Math.random() * 6);
      out.push({ kind, string, note: NOTE_NAMES[(OPEN_STRING_MIDI[string] + fret) % 12], frets: [0, 5] });
    } else if (kind === 'mistake') {
      const c = chordById(pick(pool));
      const fretted = c.frets.map((f, i) => ({ f, s: 6 - i })).filter(x => x.f && x.f > 0);
      const victim = pick(fretted);
      const frets = [...c.frets];
      const f = victim.f as number;
      frets[6 - victim.s] = f > 1 && Math.random() < 0.5 ? f - 1 : f + 1;
      const wrong: ChordShape = { ...c, id: c.id + '?', frets };
      out.push({ kind, chord: c, wrong, wrongString: victim.s, options: [6, 5, 4, 3, 2, 1].filter(s => c.frets[6 - s] !== null).map(s => `${ordinal(s)} string`), answer: `${ordinal(victim.s)} string` });
    } else {
      const pairs: [string, string][] = [['A', 'Am'], ['E', 'Em'], ['D', 'Dm']];
      const [maj, min] = pick(pairs);
      const play = Math.random() < 0.5 ? maj : min;
      out.push({ kind, play, options: ['Major (bright, happy)', 'Minor (darker, sad)'], answer: play === maj ? 'Major (bright, happy)' : 'Minor (darker, sad)' });
    }
  }
  return out;
}
