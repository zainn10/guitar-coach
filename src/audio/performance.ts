// Play-along scoring: given a recorded take and where each bar's downbeat should be,
// find each strum, judge its timing and its chord, and build the bar-by-bar song map.
import { detectOnsets, Onset, isStrum, Sensitivity } from './onset';
import { analyseChord, ChordResult, ChordCheckSettings } from './chordCheck';
import { ChordShape } from './notes';

export interface Song {
  id: string;
  title: string;
  bpm: number;
  beatsPerBar: number;
  countInBars: number;
  strumsPerBar: number;
  bars: string[];
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
}): TakeResult {
  const { signal, sampleRate: sr, song, downbeatFrames, library } = opts;
  const t = { ...DEFAULT_TIMING, ...opts.timing };
  const beat = (60 / song.bpm) * sr;
  const beatMs = 60000 / song.bpm;
  const onsets = (opts.onsets ?? detectOnsets(signal, sr)).filter(o => isStrum(signal, sr, o.frame, opts.sensitivity ?? 'medium'));
  const used = new Set<Onset>();
  const bars: BarResult[] = [];

  song.bars.forEach((chordId, i) => {
    const exp = downbeatFrames[i];
    const nextExp = downbeatFrames[i + 1] ?? exp + beat * song.beatsPerBar;
    const lo = exp - beat * 0.5;
    const hi = Math.min(exp + beat * t.searchWindowBeats, nextExp - beat * 0.5);
    const inWindow = onsets.filter(o => o.frame >= lo && o.frame < hi && !used.has(o));
    // the strum meant for this bar = the first one heard in the window
    const chosen = inWindow[0] ?? null;
    const inBar = onsets.filter(o => o.frame >= lo && o.frame < nextExp - beat * 0.5);
    const extraStrums = song.strumsPerBar === 1 ? Math.max(0, inBar.length - 1) : 0;
    if (chosen) used.add(chosen);
    const prevChord = i > 0 ? song.bars[i - 1] : null;
    const change = prevChord && prevChord !== chordId ? `${prevChord} → ${chordId} change` : chordId;
    const messages: string[] = [];
    let status: BarStatus = 'green';
    const worsen = (s: BarStatus) => { if (s === 'red' || (s === 'amber' && status === 'green')) status = s; };

    let offsetMs: number | null = null;
    let chordResult: ChordResult | null = null;
    if (!chosen) {
      status = 'red';
      messages.push(`Bar ${i + 1} (${change}): no strum heard. Did you stop to find the chord? It's fine to strum on time even if the chord isn't ready yet.`);
    } else {
      offsetMs = ((chosen.frame - exp) / sr) * 1000;
      if (Math.abs(offsetMs) > t.slightlyOffMs) {
        worsen('red');
        messages.push(`Bar ${i + 1} (${change}): ${describeOffset(offsetMs, beatMs)}.`);
      } else if (Math.abs(offsetMs) > t.onTimeMs) {
        worsen('amber');
        messages.push(`Bar ${i + 1} (${change}): ${describeOffset(offsetMs, beatMs)}.`);
      }
      const target = library.find(c => c.id === chordId)!;
      chordResult = analyseChord(signal, sr, chosen.frame, target, library, opts.chordSettings);
      if (chordResult.verdict === 'wrong-chord' || chordResult.verdict === 'too-quiet') {
        worsen('red');
        messages.push(`Bar ${i + 1}: ${chordResult.summary}`);
      } else if (chordResult.verdict === 'issues') {
        const certain = chordResult.issues.filter(x => x.certain);
        worsen(certain.length ? 'amber' : status);
        for (const iss of chordResult.issues) messages.push(`Bar ${i + 1} (${chordId}): ${iss.message} ${iss.fix}`);
      }
      if (extraStrums > 0) {
        worsen('amber');
        messages.push(`Bar ${i + 1}: I heard ${extraStrums + 1} strums. For this exercise strum once and let it ring.`);
      }
    }
    bars.push({ bar: i + 1, chord: chordId, prevChord, expectedFrame: exp, onsetFrame: chosen?.frame ?? null, offsetMs, chordResult, extraStrums, status, messages });
  });

  const trouble: TroubleSpot[] = [];
  for (const b of bars) {
    const changing = b.prevChord && b.prevChord !== b.chord;
    if (b.onsetFrame === null || (b.offsetMs !== null && b.offsetMs > t.onTimeMs)) {
      if (changing) trouble.push({ kind: 'change', from: b.prevChord!, to: b.chord, bar: b.bar, problem: b.onsetFrame === null ? 'missed' : 'late' });
    }
    if (b.chordResult && b.chordResult.verdict !== 'clean') trouble.push({ kind: 'chord', to: b.chord, bar: b.bar, problem: b.chordResult.verdict });
  }
  const offs = bars.filter(b => b.offsetMs !== null).map(b => Math.abs(b.offsetMs!));
  const greenCount = bars.filter(b => b.status === 'green').length;
  const headline =
    greenCount === bars.length ? 'Every bar was solid. Brilliant!'
      : greenCount >= bars.length * 0.75 ? `${greenCount} of ${bars.length} bars solid. Nearly there.`
        : `${greenCount} of ${bars.length} bars solid. Tap a bar to see what happened.`;
  return { bars, trouble, greenCount, meanAbsOffsetMs: offs.length ? offs.reduce((a, b) => a + b, 0) / offs.length : null, headline };
}
