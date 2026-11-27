// Play-along scoring: given a recorded take and where each bar's downbeat should be,
// find each strum, judge its timing and its chord, and build the bar-by-bar song map.
import { detectOnsets, Onset, isStrum, isPluck, Sensitivity } from './onset';
import { analyseChord, ChordResult, ChordCheckSettings } from './chordCheck';
import { ChordShape } from './notes';

export interface Song {
  id: string;
  title: string;
  /** where it comes from, e.g. "Original practice progression" or "Traditional" */
  credit?: string;
  kind?: 'practice' | 'traditional' | 'goal';
  /** stage it belongs to (for ordering) */
  stage?: number;
  bpm: number;
  /** where the tempo ladder starts */
  startBpm?: number;
  beatsPerBar: number;
  countInBars: number;
  strumsPerBar?: number;
  /** Strumming pattern for one bar in eighth notes, e.g. "D-D-D-D-" or "D-DU-UDU". Default: one strum on beat 1. */
  pattern?: string;
  /** One entry per bar: "G" or "G C" (two chords = half a bar each). */
  bars: string[];
  capo?: number;
  notes?: string;
  /** false = only judge timing (e.g. fingerpicking, where single notes aren't chords). */
  checkChords?: boolean;
}

export interface TimingSettings { onTimeMs: number; slightlyOffMs: number; searchWindowBeats: number }
export const DEFAULT_TIMING: TimingSettings = { onTimeMs: 150, slightlyOffMs: 350, searchWindowBeats: 1.5 };

export type BarStatus = 'green' | 'amber' | 'red';

export interface BarResult {
  bar: number;               // 1-based
  chord: string;
  prevChord: string | null;
  expectedFrame: number;
  onsetFrame: number | null;
  offsetMs: number | null;   // + = late
  chordResult: ChordResult | null;
  extraStrums: number;
  status: BarStatus;
  messages: string[];
  /** strums in the pattern heard on time / expected */
  matched?: number;
  expected?: number;
}

export interface TroubleSpot { kind: 'change' | 'chord'; from?: string; to: string; bar: number; problem: string }

export interface TakeResult {
  bars: BarResult[];
  trouble: TroubleSpot[];
  greenCount: number;
  meanAbsOffsetMs: number | null;
  headline: string;
}

export function describeOffset(ms: number, beatMs: number): string {
  const f = Math.abs(ms) / beatMs;
  const dir = ms > 0 ? 'late' : 'early';
  let amount: string;
  if (f < 0.2) amount = 'a touch';
  else if (f < 0.375) amount = 'about a quarter of a beat';
  else if (f < 0.625) amount = 'about half a beat';
  else if (f < 0.875) amount = 'about three-quarters of a beat';
  else amount = `about ${Math.round(f)} beat${Math.round(f) > 1 ? 's' : ''}`;
  return `${amount} ${dir} (${(Math.abs(ms) / 1000).toFixed(2)} s)`;
}

/** Expected strums for one bar: eighth-note slots from the pattern, plus which chord each belongs to. */
export function barStrums(song: Song, barIndex: number) {
  const pattern = (song.pattern ?? 'D' + '-'.repeat(song.beatsPerBar * 2 - 1)).replace(/\s/g, '');
  const slots = pattern.length;
  const chords = song.bars[barIndex].split(/\s+/);
  const out: { slot: number; beat: number; dir: 'D' | 'U'; chord: string; isChordStart: boolean }[] = [];
  const half = slots / 2;
  for (let i = 0; i < slots; i++) {
    const ch = pattern[i];
    if (ch !== 'D' && ch !== 'U') continue;
    const chordIdx = chords.length > 1 && i >= half ? 1 : 0;
    out.push({ slot: i, beat: (i * song.beatsPerBar) / slots, dir: ch, chord: chords[chordIdx], isChordStart: false });
  }
  // the first strum of each chord in the bar is where the change is judged
  for (let c = 0; c < chords.length; c++) {
    const first = out.find(o => o.chord === chords[c] && (c === 0 || o.slot >= half));
    if (first) first.isChordStart = true;
  }
  return { strums: out, chords };
}

export function analyseTake(opts: {
  signal: Float32Array;
  sampleRate: number;
  song: Song;
  /** Sample index in `signal` where each bar's downbeat should be heard (latency already added). */
  downbeatFrames: number[];
  library: ChordShape[];
  timing?: Partial<TimingSettings>;
  chordSettings?: Partial<ChordCheckSettings>;
  onsets?: Onset[];
  sensitivity?: Sensitivity;
  /** Only score these bars (1-based, inclusive), e.g. for a fix-it loop. */
  barRange?: [number, number];
}): TakeResult {
  const { signal, sampleRate: sr, song, downbeatFrames, library } = opts;
  const t = { ...DEFAULT_TIMING, ...opts.timing };
  const beat = (60 / song.bpm) * sr;
  const beatMs = 60000 / song.bpm;
  const multi = !!song.pattern && song.pattern.replace(/[^DU]/g, '').length > 1;
  // Single strums must be firm; in a pattern, quieter up-strums are allowed.
  const onsets = (opts.onsets ?? detectOnsets(signal, sr, multi ? { sensitivity: 1.4 } : {}))
    .filter(o => (multi ? isPluck : isStrum)(signal, sr, o.frame, opts.sensitivity ?? 'medium'));
  const used = new Set<Onset>();
  const bars: BarResult[] = [];
  const [b0, b1] = opts.barRange ?? [1, song.bars.length];
  const slotTol = multi ? beat * 0.24 : beat * 0.5;

  for (let i = b0 - 1; i <= b1 - 1; i++) {
    const { strums, chords } = barStrums(song, i);
    const exp = downbeatFrames[i];
    const nextExp = downbeatFrames[i + 1] ?? exp + beat * song.beatsPerBar;
    const prevChord = i > 0 ? song.bars[i - 1].split(/\s+/).slice(-1)[0] : null;
    const messages: string[] = [];
    let status: BarStatus = 'green';
    const worsen = (s: BarStatus) => { if (s === 'red' || (s === 'amber' && status === 'green')) status = s; };

    let matched = 0;
    let missingDown = 0;
    let changeOffset: number | null = null;
    let changeOnset: Onset | null = null;
    let chordResult: ChordResult | null = null;
    const offsets: number[] = [];
    for (const st of strums) {
      const at = exp + st.beat * beat;
      if (st.isChordStart) {
        // the change itself: allow a wide window so a late change is still found and measured
        const lo = at - beat * 0.5;
        const hi = Math.min(at + beat * t.searchWindowBeats, st.slot === 0 ? nextExp - beat * 0.5 : at + beat * 1.5);
        const cand = onsets.find(o => o.frame >= lo && o.frame < hi && !used.has(o)) ?? null;
        if (cand) {
          used.add(cand); matched++;
          const off = ((cand.frame - at) / sr) * 1000;
          offsets.push(off);
          const prev = st.slot === 0 ? prevChord : chords[0];
          const label = prev && prev !== st.chord ? `${prev} → ${st.chord} change` : st.chord;
          if (changeOffset === null || Math.abs(off) > Math.abs(changeOffset)) { changeOffset = off; changeOnset = cand; }
          if (Math.abs(off) > t.slightlyOffMs) { worsen('red'); messages.push(`Bar ${i + 1} (${label}): ${describeOffset(off, beatMs)}.`); }
          else if (Math.abs(off) > t.onTimeMs) { worsen('amber'); messages.push(`Bar ${i + 1} (${label}): ${describeOffset(off, beatMs)}.`); }
          const target = library.find(c => c.id === st.chord)!;
          const r = song.checkChords === false ? null : analyseChord(signal, sr, cand.frame, target, library, opts.chordSettings);
          if (r) {
          if (!chordResult || r.verdict !== 'clean') chordResult = r;
          if (r.verdict === 'wrong-chord' || r.verdict === 'too-quiet') { worsen('red'); messages.push(`Bar ${i + 1}: ${r.summary}`); }
          else if (r.verdict === 'issues') {
            worsen('amber');
            for (const iss of r.issues.filter(x => x.certain)) messages.push(`Bar ${i + 1} (${st.chord}): ${iss.message} ${iss.fix}`);
          }
          }
        } else {
          worsen('red');
          const prev = st.slot === 0 ? prevChord : chords[0];
          const label = prev && prev !== st.chord ? `${prev} → ${st.chord} change` : st.chord;
          messages.push(`Bar ${i + 1} (${label}): no strum heard. Did you stop to find the chord? It's fine to strum on time even if the chord isn't ready yet.`);
        }
      } else {
        const cand = onsets.find(o => Math.abs(o.frame - at) <= slotTol && !used.has(o));
        if (cand) { used.add(cand); matched++; offsets.push(((cand.frame - at) / sr) * 1000); }
        else if (st.dir === 'D') missingDown++;
      }
    }
    const missing = strums.length - matched;
    // Up-strums are quiet and hard to hear reliably, so a missed up-strum alone doesn't count against you.
    if (multi && (missingDown > 0 || missing > strums.length / 2)) {
      if (missing > strums.length / 2) worsen('red'); else worsen('amber');
      messages.push(`Bar ${i + 1}: ${missing} of ${strums.length} strums in the pattern weren't heard on the beat.`);
    }
    const extra = song.strumsPerBar === 1 || !multi
      ? onsets.filter(o => o.frame >= exp - beat * 0.5 && o.frame < nextExp - beat * 0.5).length - 1
      : 0;
    if (!multi && extra > 0 && changeOnset && song.checkChords !== false) {
      worsen('amber');
      messages.push(`Bar ${i + 1}: I heard ${extra + 1} strums. For this exercise strum once and let it ring.`);
    }
    bars.push({
      bar: i + 1, chord: song.bars[i], prevChord, expectedFrame: exp,
      onsetFrame: changeOnset?.frame ?? null, offsetMs: changeOffset, chordResult,
      extraStrums: Math.max(0, extra), status, messages, matched, expected: strums.length,
    });
  }

  const trouble: TroubleSpot[] = [];
  for (const b of bars) {
    const first = b.chord.split(/\s+/)[0];
    const changing = b.prevChord && b.prevChord !== first;
    if (b.onsetFrame === null || (b.offsetMs !== null && b.offsetMs > t.onTimeMs)) {
      if (changing) trouble.push({ kind: 'change', from: b.prevChord!, to: first, bar: b.bar, problem: b.onsetFrame === null ? 'missed' : 'late' });
    }
    if (b.chordResult && b.chordResult.verdict !== 'clean') trouble.push({ kind: 'chord', to: b.chordResult.target, bar: b.bar, problem: b.chordResult.verdict });
  }
  const offs = bars.filter(b => b.offsetMs !== null).map(b => Math.abs(b.offsetMs!));
  const greenCount = bars.filter(b => b.status === 'green').length;
  const headline =
    greenCount === bars.length ? 'Every bar was solid. Brilliant!'
      : greenCount >= bars.length * 0.75 ? `${greenCount} of ${bars.length} bars solid. Nearly there.`
        : `${greenCount} of ${bars.length} bars solid. Tap a bar to see what happened.`;
  return { bars, trouble, greenCount, meanAbsOffsetMs: offs.length ? offs.reduce((a, b) => a + b, 0) / offs.length : null, headline };
}
