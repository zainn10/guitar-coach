// One-minute chord-change drill: strum one chord, change, strum the other... for 60 seconds.
// The microphone counts each change and whether the chord was clean.
import { useEffect, useRef, useState } from 'react';
import { engine } from '../audio/engine';
import { analyseChord } from '../audio/chordCheck';
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

export function ChangeDrill({ from, to, seconds = 60, target, onFinish }: { from: string; to: string; seconds?: number; target?: number; onFinish?: (r: DrillResult, passed: boolean) => void }) {
  const { settings, drills } = useStore();
  const goal = target ?? changeTarget(from, to);
  const [phase, setPhase] = useState<'idle' | 'countdown' | 'running' | 'done'>('idle');
  const [left, setLeft] = useState(seconds);
  const [count, setCount] = useState(3);
  const [changes, setChanges] = useState(0);
  const [clean, setClean] = useState(0);
  const [last, setLast] = useState<'clean' | 'messy' | null>(null);
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
    onFinish?.(r, passed);
  };

  const start = async () => {
    setErr(null);
    try { await startMic(); } catch (e) { setErr(micErrorText(e)); return; }
    counts.current = { changes: 0, clean: 0 }; setChanges(0); setClean(0); setLast(null); lastChord.current = null;
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
    let heard: string | null = null, ok = false;
    if (expected) {
      const r = tryChord(expected);
      if (r.verdict !== 'wrong-chord' && r.verdict !== 'too-quiet') { heard = expected; ok = r.verdict === 'clean'; }
    } else {
      const a = tryChord(from), b = tryChord(to);
      if (a.verdict !== 'wrong-chord' && a.targetScore >= b.targetScore) { heard = from; ok = a.verdict === 'clean'; }
      else if (b.verdict !== 'wrong-chord') { heard = to; ok = b.verdict === 'clean'; }
    }
    if (!heard) return;
    if (lastChord.current !== null && heard !== lastChord.current) {
      counts.current.changes++; setChanges(counts.current.changes);
      if (ok) { counts.current.clean++; setClean(counts.current.clean); }
    }
    lastChord.current = heard;
    setLast(ok ? 'clean' : 'messy');
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
          <div className={`drill-last ${last ?? ''}`} aria-live="polite">{last === 'clean' ? '✓ clean' : last === 'messy' ? '~ a bit messy' : 'Strum to start'}</div>
          <button className="btn stop" onClick={finish}>Stop (mic off)</button>
        </div>
      )}
      {phase === 'done' && (
        <div className="drill-result">
          <div className="drill-big">{perMin}<span className="small muted"> clean changes / minute</span></div>
          <p>{changes} changes in total, {clean} clean. Goal: {goal}.</p>
          {perMin >= goal ? <p className="note ok"><strong>Goal reached!</strong> This change is ready.</p>
            : <p className="note warn">{goal - perMin} short of the goal. That's normal: most changes take a week or two of daily minutes. It will come back in your sessions.</p>}
          <button className="btn primary" onClick={start}>Go again</button>
        </div>
      )}
      {err && <p className="error" role="alert">{err}</p>}
    </div>
  );
}
