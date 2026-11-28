// "Play freely": work out what a sound was (one of your chords, a single note, or just noise)
// and whether it was clean, in words you can act on. Unsure results are said as "?",
// never as a mistake; sounds that are clearly not music are ignored.
import { analyseChord, ChordResult } from './chordCheck';
import { noteClarity } from './stringCheck';
import { ChordShape, pitchClassName } from './notes';

export interface StrumNote { kind: 'clean' | 'messy' | 'not-counted'; chord: string; text: string; fix?: string }

/** One chord strum, described: clean, messy (which string and the fix) or not counted. */
export function describeStrum(chord: string, r: ChordResult): StrumNote {
  if (r.verdict === 'clean') return { kind: 'clean', chord, text: 'Clean: every string rang.' };
  if (r.verdict === 'too-quiet') return { kind: 'not-counted', chord, text: 'Too quiet to check.', fix: 'Strum a little firmer, across all the strings.' };
  if (r.verdict === 'wrong-chord') return { kind: 'not-counted', chord, text: `Didn't sound like ${chord} yet${r.bestMatch?.id && r.bestMatch.id !== chord ? ` (closer to ${r.bestMatch.id})` : ''}.`, fix: 'Check every finger is on the right string and fret before you strum.' };
  const sure = r.issues.filter(i => i.certain);
  const main = sure[0] ?? r.issues[0];
  if (!main) return { kind: 'messy', chord, text: r.summary };
  const more = sure.length > 1 ? ` (+${sure.length - 1} more)` : '';
  return { kind: 'messy', chord, text: `${sure.length ? '' : 'Possibly: '}${main.message}${more}`, fix: main.fix };
}

export type FreeEvent =
  | { kind: 'chord'; chord: string; clean: boolean; text: string; fix?: string; /** another of your chords it could equally be */ alt?: string }
  | { kind: 'unsure'; text: string; fix?: string }
  | { kind: 'note'; name: string; clear: boolean; text: string; fix?: string }
  | { kind: 'noise' };

const rmsDb = (x: Float32Array, a: number, b: number) => {
  let s = 0, n = 0;
  for (let i = Math.max(0, a); i < Math.min(x.length, b); i++) { s += x[i] * x[i]; n++; }
  return n ? 10 * Math.log10(s / n + 1e-12) : -120;
};

/**
 * What was the sound at `onset`? `chords` are the chords you might be playing; `expected`, when
 * known (e.g. the next chord of a song), is judged first. Needs ~0.6 s of signal after the onset.
 */
export function judgeSound(signal: Float32Array, sr: number, onset: number, chords: ChordShape[], library: ChordShape[], expected?: ChordShape | null, settings?: Parameters<typeof analyseChord>[5]): FreeEvent {
  const note = noteClarity(signal, sr, onset);
  // A single clear pitch: a plucked note.
  if (note.clarity >= 0.7) {
    const name = pitchClassName(note.midi);
    const early = rmsDb(signal, onset + Math.round(0.03 * sr), onset + Math.round(0.13 * sr));
    const late = rmsDb(signal, onset + Math.round(0.35 * sr), onset + Math.round(0.5 * sr));
    if (early - late > 20) return { kind: 'note', name, clear: false, text: `${name}: died away almost at once.`, fix: 'Press firmly with the very tip of your finger, just behind the fret, and make sure nothing else touches the string.' };
    return { kind: 'note', name, clear: true, text: `${name}: clear and ringing.` };
  }
  const judge = (c: ChordShape) => analyseChord(signal, sr, onset, c, library, settings);
  if (expected) {
    const r = judge(expected);
    if (r.verdict !== 'wrong-chord' && r.verdict !== 'too-quiet') {
      const d = describeStrum(expected.id, r);
      return { kind: 'chord', chord: expected.id, clean: d.kind === 'clean', text: d.text, fix: d.fix };
    }
    // maybe it was a different chord from the set
    for (const c of chords) {
      if (c.id === expected.id) continue;
      const o = judge(c);
      if (o.verdict !== 'wrong-chord' && o.verdict !== 'too-quiet') return { kind: 'unsure', text: `That sounded like ${c.id}, but ${expected.id} comes next.`, fix: `Look at the ${expected.id} shape above and change to it.` };
    }
    if (r.verdict === 'too-quiet' || note.clarity < 0.35) return { kind: 'noise' };
    return { kind: 'unsure', text: `Didn't sound like ${expected.id} yet.`, fix: 'Check each finger is on the right string and fret, then strum again.' };
  }
  const fits: { c: ChordShape; r: ChordResult }[] = [];
  let anyLoud = false;
  for (const c of chords) {
    const r = judge(c);
    if (r.verdict !== 'too-quiet') anyLoud = true;
    if (r.verdict === 'wrong-chord' || r.verdict === 'too-quiet') continue;
    fits.push({ c, r });
  }
  fits.sort((a, b) => (a.r.verdict === 'clean' ? 0 : 1) - (b.r.verdict === 'clean' ? 0 : 1) || b.r.targetScore - a.r.targetScore);
  const best = fits[0];
  if (best) {
    const d = describeStrum(best.c.id, best.r);
    // Two of your chords that differ only in the string that didn't ring (e.g. Am and A with the
    // 2nd string dead) sound the same. Say so instead of guessing.
    const rival = best.r.verdict !== 'clean' ? fits.find(f => f !== best && f.r.verdict !== 'clean' && f.r.targetScore >= best.r.targetScore * 0.8) : undefined;
    if (rival) {
      const strings = [...new Set(best.r.issues.map(i => i.string))];
      const shared = strings.length && rival.r.issues.some(i => strings.includes(i.string));
      return {
        kind: 'chord', chord: best.c.id, alt: rival.c.id, clean: false,
        text: shared ? `${d.text.replace(/ \(\+\d+ more\)$/, '')} Without that string, ${best.c.id} and ${rival.c.id} sound the same, so it can't tell which you meant.` : `Could be ${best.c.id} or ${rival.c.id}, and it wasn't clean: ${d.text}`,
        fix: shared ? 'Get that string ringing first; then it can tell them apart.' : d.fix,
      };
    }
    return { kind: 'chord', chord: best.c.id, clean: d.kind === 'clean', text: d.text, fix: d.fix };
  }
  // nothing recognised: only mention it if it was clearly a strum (loud, several notes)
  if (!anyLoud || note.clarity < 0.35) return { kind: 'noise' };
  return { kind: 'unsure', text: "Couldn't tell which chord that was.", fix: `Is it one of ${chords.map(c => c.id).join(', ')}? Check the shape and strum again.` };
}

/**
 * Is the strumming steady? Needs several strums close together. One-off odd gaps (a strum the
 * mic missed, or an extra sound) are left out, and only a clear trend is reported.
 */
export function rhythmRead(times: number[]): { steady: boolean; trend: 'steady' | 'speeding up' | 'slowing down' | 'uneven' } | null {
  const recent = times.slice(-10);
  const raw = recent.slice(1).map((t, i) => t - recent[i]).filter(g => g > 0.15 && g < 3);
  if (raw.length < 5) return null;
  const sorted = [...raw].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const gaps = raw.filter(g => g > median * 0.65 && g < median * 1.5);
  if (gaps.length < 5) return null;
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const sd = Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length);
  const half = Math.floor(gaps.length / 2);
  const first = gaps.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const second = gaps.slice(-half).reduce((a, b) => a + b, 0) / half;
  if (second < first * 0.88) return { steady: false, trend: 'speeding up' };
  if (second > first * 1.12) return { steady: false, trend: 'slowing down' };
  if (sd / mean > 0.18) return { steady: false, trend: 'uneven' };
  return { steady: true, trend: 'steady' };
}
