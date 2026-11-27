// Turning results into progress: weak-point tracking feeds from here.
import { store } from '../storage/store';
import type { Take } from '../checks/TakeRunner';

/** Same key whichever direction you change: "change:C>G". */
export const changeKey = (a: string, b: string) => `change:${[a, b].sort().join('>')}`;

/** Every take feeds per-chord, per-change and per-song tracking. */
export function recordTake(songId: string, take: Take, targetBpm: number) {
  const { result } = take;
  const t = Date.now();
  for (const b of result.bars) {
    const first = b.chord.split(/\s+/)[0];
    if (b.chordResult && take.song.checkChords !== false) {
      const v = b.chordResult.verdict;
      store.record(`chord:${b.chordResult.target}`, v === 'clean' ? 1 : v === 'issues' ? 0.6 : 0.1, v === 'clean', t);
    }
    if (b.prevChord && b.prevChord !== first) {
      const ok = b.onsetFrame !== null && b.offsetMs !== null && Math.abs(b.offsetMs) <= 150;
      const score = b.onsetFrame === null ? 0 : Math.max(0, 1 - Math.abs(b.offsetMs ?? 0) / 600);
      store.record(changeKey(b.prevChord, first), score, ok, t);
    }
  }
  const ratio = result.greenCount / result.bars.length;
  store.record(`song:${songId}`, ratio * Math.min(1, take.bpm / targetBpm), ratio >= 0.75 && take.bpm >= targetBpm, t);
  store.addTake({
    t, song: songId, statuses: result.bars.map(b => b.status), headline: result.headline,
    meanAbsOffsetMs: result.meanAbsOffsetMs, latencyMs: 0, bpm: take.bpm,
    trouble: result.trouble.map(x => x.kind === 'change' ? `${x.from}→${x.to} change ${x.problem} (bar ${x.bar})` : `${x.to} ${x.problem} (bar ${x.bar})`),
  });
}
