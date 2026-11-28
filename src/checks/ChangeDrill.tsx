// One-minute chord-change drill: strum one chord, change, strum the other... for 60 seconds.
// The microphone counts each change and whether the chord was clean.
import { useEffect, useRef, useState } from 'react';
import { engine } from '../audio/engine';
import { analyseChord, ChordResult } from '../audio/chordCheck';
import { useStrums } from '../audio/useStrums';
import { ChordDiagram } from '../visuals/ChordDiagram';
import { ChordChange } from '../visuals/ChordChange';
import { CHORDS, chordById, THRESHOLDS } from '../content';
import { store, DrillResult } from '../storage/store';
import { changeKey } from '../engine/progress';
import { startMic, stopMic, micErrorText, useStore } from '../ui';

export function changeTarget(a: string, b: string): number {
  const t = THRESHOLDS.mastery.changes;
  const key = [a, b].sort().join('>');
  return (t.pairs as Record<string, number>)[key] ?? t.default;
}

/** What the last strum sounded like, in words you can act on. */
interface StrumNote { kind: 'clean' | 'messy' | 'not-counted'; chord: string; text: string; fix?: string }

function describeStrum(chord: string, r: ChordResult): StrumNote {
  if (r.verdict === 'clean') return { kind: 'clean', chord, text: 'Clean: every string rang.' };
  if (r.verdict === 'too-quiet') return { kind: 'not-counted', chord, text: 'Too quiet to check.', fix: 'Strum a little firmer, across all the strings.' };
  if (r.verdict === 'wrong-chord') return { kind: 'not-counted', chord, text: `Didn't sound like ${chord} yet${r.bestMatch?.id && r.bestMatch.id !== chord ? ` (closer to ${r.bestMatch.id})` : ''}.`, fix: 'Check every finger is on the right string and fret before you strum.' };
  // the problems we're sure about first; anything uncertain is said as "possibly"
  const sure = r.issues.filter(i => i.certain);
  const main = sure[0] ?? r.issues[0];
  if (!main) return { kind: 'messy', chord, text: r.summary };
  const more = sure.length > 1 ? ` (+${sure.length - 1} more)` : '';
  return { kind: 'messy', chord, text: `${sure.length ? '' : 'Possibly: '}${main.message}${more}`, fix: main.fix };
}

export function ChangeDrill({ from, to, seconds = 60, target, onFinish }: { from: string; to: string; seconds?: number; target?: number; onFinish?: (r: DrillResult, passed: boolean, problems: string[]) => void }) {
  const { settings, drills } = useStore();
  const goal = target ?? changeTarget(from, to);
  const [phase, setPhase] = useState<'idle' | 'countdown' | 'running' | 'done'>('idle');
  const [left, setLeft] = useState(seconds);
  const [count, setCount] = useState(3);
  const [changes, setChanges] = useState(0);
  const [clean, setClean] = useState(0);
  const [last, setLast] = useState<StrumNote | null>(null);
  // what went wrong during this minute, most frequent first at the end
  const tally = useRef(new Map<string, { n: number; chord: string; text: string; fix?: string }>());
  const [problems, setProblems] = useState<{ n: number; chord: string; text: string; fix?: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const lastChord = useRef<string | null>(null);
  const counts = useRef({ changes: 0, clean: 0 });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const best = Math.max(0, ...drills.filter(d => changeKey(d.from, d.to) === changeKey(from, to)).map(d => Math.round(d.clean * 60 / d.seconds)));

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const finish = () => {
    if (timer.current) clearInterval(timer.current);
    stopMic();
    setPhase('done');
    const r: DrillResult = { t: Date.now(), from, to, changes: counts.current.changes, clean: counts.current.clean, seconds };
    store.addDrill(r);
    const perMin = (counts.current.clean * 60) / seconds;
    const passed = perMin >= goal;
    store.record(changeKey(from, to), Math.min(1, perMin / goal), passed);
    const top = [...tally.current.values()].sort((a, b) => b.n - a.n).slice(0, 3);
    setProblems(top);
    onFinish?.(r, passed, top.map(p => `${p.chord}: ${p.text}${p.fix ? ` ${p.fix}` : ''} (${p.n}×)`));
  };

  const start = async () => {
    setErr(null);
    try { await startMic(); } catch (e) { setErr(micErrorText(e)); return; }
    counts.current = { changes: 0, clean: 0 }; setChanges(0); setClean(0); setLast(null); lastChord.current = null;
    tally.current = new Map(); setProblems([]);
    setPhase('countdown'); setCount(3);
    let c = 3;
    const cd = setInterval(() => {
      c--; setCount(c);
      if (c === 0) {
        clearInterval(cd);
        setPhase('running'); setLeft(seconds);
        const t0 = Date.now();
        timer.current = setInterval(() => {
          const l = seconds - Math.floor((Date.now() - t0) / 1000);
          setLeft(l);
          if (l <= 0) finish();
        }, 200);
      }
    }, 1000);
  };

  useStrums(async frame => {
    const sr = engine.sampleRate;
    try { await engine.waitForFrame(frame + Math.round(0.6 * sr)); } catch { return; }
    const expected = lastChord.current === null ? null : lastChord.current === from ? to : from;
    const sig = engine.getRange(frame - Math.round(0.1 * sr), frame + Math.round(0.65 * sr));
    const tryChord = (id: string) => analyseChord(sig, sr, Math.round(0.1 * sr), chordById(id), CHORDS, THRESHOLDS.chordCheck);
    let heard: string | null = null, ok = false, res: ChordResult | null = null;
    if (expected) {
      const r = tryChord(expected);
      res = r;
      if (r.verdict !== 'wrong-chord' && r.verdict !== 'too-quiet') { heard = expected; ok = r.verdict === 'clean'; }
    } else {
      const a = tryChord(from), b = tryChord(to);
      if (a.verdict !== 'wrong-chord' && a.targetScore >= b.targetScore) { heard = from; ok = a.verdict === 'clean'; res = a; }
      else if (b.verdict !== 'wrong-chord') { heard = to; ok = b.verdict === 'clean'; res = b; }
      else res = a.targetScore >= b.targetScore ? a : b;
    }
    const note = res ? describeStrum(res.target, res) : null;
    if (note) {
      setLast(note);
      if (note.kind !== 'clean') {
        const key = `${note.chord}|${note.text}`;
        const t = tally.current.get(key);
        tally.current.set(key, { n: (t?.n ?? 0) + 1, chord: note.chord, text: note.text.replace(/ \(\+\d+ more\)$/, ''), fix: note.fix });
      }
    }
    if (!heard) return;
    if (lastChord.current !== null && heard !== lastChord.current) {
      counts.current.changes++; setChanges(counts.current.changes);
      if (ok) { counts.current.clean++; setClean(counts.current.clean); }
    }
    lastChord.current = heard;
  }, phase === 'running');

  const perMin = Math.round((clean * 60) / seconds);
  return (
    <div className="drill">
      <div className="drill-head">
        <ChordDiagram chord={chordById(from)} view={settings.diagramView} width={150} />
        <span className="drill-swap" aria-hidden>⇄</span>
        <ChordDiagram chord={chordById(to)} view={settings.diagramView} width={150} />
      </div>
      {phase === 'idle' && (
        <div className="drill-intro">
          <p>Strum <strong>{from}</strong> once, change to <strong>{to}</strong>, strum once, change back… as many times as you can in {seconds} seconds. Every change counts; clean ones count towards the goal.</p>
          <p className="small">Goal: <strong>{goal} clean changes per minute</strong>.{best > 0 && <> Your best so far: <strong>{best}</strong>.</>}</p>
          <button className="btn primary big" onClick={start}>Start the minute</button>
          <details className="small"><summary>How do the fingers move?</summary><ChordChange from={chordById(from)} to={chordById(to)} /></details>
        </div>
      )}
      {phase === 'countdown' && <div className="drill-big" aria-live="assertive">{count}</div>}
      {phase === 'running' && (
        <div className="drill-live">
          <div className="drill-big">{changes}<span className="small muted"> changes</span></div>
          <div className="drill-meta"><span><strong>{clean}</strong> clean</span><span className="timer">{left}s</span></div>
          <div className={`drill-last ${last?.kind ?? ''}`} aria-live="polite">
            {!last ? <span className="dl-word">Strum {from} to start</span> : <>
              <span className="dl-word">{last.kind === 'clean' ? `✓ ${last.chord} clean` : last.kind === 'messy' ? `~ ${last.chord}: messy` : `? ${last.chord}: not counted`}</span>
              {last.kind !== 'clean' && <span className="dl-text">{last.text}{last.fix && <> <strong>Fix:</strong> {last.fix}</>}</span>}
            </>}
          </div>
          <button className="btn stop" onClick={finish}>Stop (mic off)</button>
        </div>
      )}
      {phase === 'done' && (
        <div className="drill-result">
          <div className="drill-big">{perMin}<span className="small muted"> clean changes / minute</span></div>
          <p>{changes} changes in total, {clean} clean. Goal: {goal}.</p>
          {perMin >= goal ? <p className="note ok"><strong>Goal reached!</strong> This change is ready.</p>
            : <p className="note warn">{goal - perMin} short of the goal. That's normal: most changes take a week or two of daily minutes. It will come back in your sessions.</p>}
          {problems.length > 0 && <div className="drill-problems">
            <h4>What tripped you up most</h4>
            <ol>{problems.map(p => <li key={p.chord + p.text}><strong>{p.chord}</strong> ({p.n}×): {p.text}{p.fix && <> <span className="muted">Fix: {p.fix}</span></>}</li>)}</ol>
          </div>}
          <button className="btn primary" onClick={start}>Go again</button>
        </div>
      )}
      {err && <p className="error" role="alert">{err}</p>}
    </div>
  );
}
