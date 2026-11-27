// After a take: the song map, bar details with "my bar" vs "how it should sound", and fix-it.
import { useState } from 'react';
import { engine } from '../audio/engine';
import { addStrum, addClick } from '../audio/synth';
import { encodeWav } from '../audio/wav';
import { saveRecording } from '../storage/folder';
import { ChordDiagram, statusStyle } from './ChordDiagram';
import { SongMap, SongMapKey } from './SongMap';
import { chordById } from '../content';
import { STRING_SHORT } from '../audio/notes';
import { useStore } from '../ui';
import type { Take } from '../checks/TakeRunner';
import { TroubleLink } from '../screens/Help';

const dedupe = (a: string[]) => [...new Set(a)];

/** The bars worth looping: the first stretch containing problems (max 4 bars, plus the bar before for the change). */
export function troubleRange(take: Take): [number, number] | null {
  const bad = take.result.bars.filter(b => b.status !== 'green').map(b => b.bar);
  if (!bad.length) return null;
  const first = Math.min(...bad);
  const start = Math.max(1, first - 1);
  const end = Math.min(Math.max(...bad.filter(b => b <= start + 3)), start + 3);
  return [start, Math.max(end, Math.min(start + 1, take.song.bars.length))];
}

export function TakeView({ take, onFixIt, showSave = true }: { take: Take; onFixIt?: (range: [number, number]) => void; showSave?: boolean }) {
  const { settings } = useStore();
  const { result } = take;
  const beatMs = 60000 / take.bpm;
  const firstBad = result.bars.findIndex(b => b.status !== 'green');
  const [sel, setSel] = useState<number | undefined>(firstBad >= 0 ? firstBad : undefined);
  const bar = sel !== undefined ? result.bars[sel] : null;
  const range = troubleRange(take);

  const playMine = (k: number) => {
    const a = take.downbeats[k] - Math.round(0.3 * take.sr);
    const len = Math.round(((beatMs * take.song.beatsPerBar) / 1000) * take.sr);
    engine.play(take.signal.slice(Math.max(0, a), a + len));
  };
  const playRef = async (k: number) => {
    const ctx = await engine.ensureContext();
    const sr = ctx.sampleRate;
    const beat = Math.round((beatMs / 1000) * sr);
    const bpb = take.song.beatsPerBar;
    const buf = new Float32Array(beat * bpb + Math.round(0.6 * sr));
    const start = Math.round(0.3 * sr);
    for (let b = 0; b < bpb; b++) addClick(buf, sr, start + b * beat, b === 0, 0.25);
    const pattern = take.song.pattern ?? 'D' + '-'.repeat(bpb * 2 - 1);
    const chords = take.song.bars[k].split(/\s+/);
    const slots = pattern.length;
    [...pattern].forEach((c, i) => {
      if (c !== 'D' && c !== 'U') return;
      const ch = chords.length > 1 && i >= slots / 2 ? chords[1] : chords[0];
      addStrum(buf, sr, start + Math.round((i * bpb / slots) * beat), chordById(ch), { gain: c === 'D' ? 0.3 : 0.16, direction: c === 'D' ? 'down' : 'up', spreadMs: c === 'D' ? 18 : 8 });
    });
    engine.play(buf);
  };

  const troubleIds = dedupe(result.trouble.flatMap(t => t.kind === 'change' ? ['slow-changes', ...(t.problem === 'missed' ? ['stopping-at-changes'] : [])] : t.problem === 'wrong-chord' ? [] : ['muted-strings']));
  return (
    <div className="take-view">
      <p className="headline">{result.headline}</p>
      <SongMap bars={result.bars} beatMs={beatMs} selected={sel === undefined ? undefined : result.bars[sel]?.bar} onSelect={b => setSel(result.bars.findIndex(x => x.bar === b))} />
      <SongMapKey />
      {range && onFixIt && (
        <div className="fixit">
          <div>
            <strong>Fix it:</strong> loop bars {range[0]}–{range[1]} slower, then speed back up as they get clean.
          </div>
          <button className="btn primary" onClick={() => onFixIt(range)}>Start fix-it loop</button>
        </div>
      )}
      {bar && (
        <div className={`bar-detail s-${bar.status}`}>
          <div className="row spread wrap">
            <h3>Bar {bar.bar}: {bar.prevChord && bar.prevChord !== bar.chord.split(' ')[0] ? `${bar.prevChord} → ${bar.chord}` : bar.chord}</h3>
            <div className="row">
              <button className="btn small" onClick={() => playMine(sel!)}>▶ My bar</button>
              <button className="btn small" onClick={() => playRef(sel!)}>▶ How it should sound</button>
            </div>
          </div>
          <div className="grid-2 detail-grid">
            <div>
              {bar.messages.length ? (
                <ul className="issues">{bar.messages.map((m, k) => <li key={k}>{m.replace(/^Bar \d+( \([^)]*\))?: /, '')}</li>)}</ul>
              ) : <p className="note ok">Solid: on time and clean.</p>}
              {bar.offsetMs !== null && <p className="small muted">The change landed {Math.abs(Math.round(bar.offsetMs))} ms {bar.offsetMs >= 0 ? 'after' : 'before'} the beat.</p>}
              {bar.expected !== undefined && bar.expected > 1 && <p className="small muted">{bar.matched} of {bar.expected} strums heard on the beat.</p>}
              {bar.chordResult && (
                <p className="small">{bar.chordResult.strings.filter(s => s.status !== 'silent-ok').map(s => {
                  const st = statusStyle(s.status);
                  return <span key={s.string} className="str-pill"><span className="status-dot" style={{ background: st.color }}>{st.icon}</span>{STRING_SHORT[s.string]}</span>;
                })}</p>
              )}
            </div>
            <ChordDiagram chord={chordById(bar.chordResult?.target ?? bar.chord.split(' ')[0])} view={settings.diagramView} width={190}
              statuses={bar.chordResult ? Object.fromEntries(bar.chordResult.strings.map(s => [s.string, s.status])) : undefined} />
          </div>
        </div>
      )}
      {result.trouble.length > 0 && (
        <div className="trouble">
          <h3>Added to your practice</h3>
          <ul>{dedupe(result.trouble.map(t => t.kind === 'change' ? `The ${t.from} → ${t.to} change (${t.problem === 'missed' ? 'no strum heard' : 'late'})` : `A clean ${t.to} chord`)).map(s => <li key={s}>{s}</li>)}</ul>
          <p className="small muted">These come up in your next sessions on the Today page, with change drills for slow changes.</p>
          <div className="trouble-grid">{troubleIds.map(id => <TroubleLink key={id} id={id} />)}</div>
        </div>
      )}
      {showSave && <button className="btn link" onClick={() => saveRecording(encodeWav(take.signal, take.sr), `take-${take.song.id}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.wav`)}>Save this take as a sound file</button>}
    </div>
  );
}
