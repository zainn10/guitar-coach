// Mastery checks: each lesson ends with measurable checks that must be passed
// before the next lesson unlocks. When a check falls short, we say exactly what,
// link the right help topic, and the weak item comes back in your sessions.
import { useEffect, useRef, useState } from 'react';
import { Check, Lesson, songById, THRESHOLDS } from '../content';
import { engine } from '../audio/engine';
import { detectPitch, tunerReading } from '../audio/tuner';
import { useStrums } from '../audio/useStrums';
import { analyseNoteSequence } from '../audio/stringCheck';
import { OPEN_STRING_MIDI, STRING_SHORT, STRING_LABEL, noteName, ordinal } from '../audio/notes';
import { Song } from '../audio/performance';
import { parsePicking } from '../visuals/PickingPattern';
import { StrumPattern } from '../visuals/StrumPattern';
import { ChordCheckBody } from '../screens/ChordCheck';
import { ChangeDrill } from './ChangeDrill';
import { TakeRunner, Take } from './TakeRunner';
import { TakeView } from '../visuals/TakeView';
import { recordTake } from '../engine/progress';
import { store, masteryState } from '../storage/store';
import { TroubleLink } from '../screens/Help';
import { startMic, stopMic, micErrorText, useStore, StopListening } from '../ui';
import { playNote } from '../audio/sounds';

type Done = (passed: boolean, score: number, shortfall: string[], troubles?: string[]) => void;

function QuizCheck({ check, onDone }: { check: Extract<Check, { type: 'quiz' }>; onDone: Done }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const total = check.questions.length;
  const correct = check.questions.filter((q, i) => answers[i] === q.answer).length;
  const need = check.pass ?? THRESHOLDS.mastery.quiz.pass;
  return (
    <div className="quiz">
      {check.questions.map((q, i) => (
        <fieldset key={i} className="quiz-q">
          <legend>{i + 1}. {q.q}</legend>
          {q.options.map((o, k) => {
            const state = submitted ? (k === q.answer ? 'right' : answers[i] === k ? 'wrong' : '') : '';
            return (
              <label key={k} className={`quiz-opt ${answers[i] === k ? 'picked' : ''} ${state}`}>
                <input type="radio" name={`q${i}`} checked={answers[i] === k} disabled={submitted} onChange={() => setAnswers({ ...answers, [i]: k })} /> {o}
              </label>
            );
          })}
          {submitted && answers[i] !== q.answer && q.explain && <p className="small explain">{q.explain}</p>}
        </fieldset>
      ))}
      {!submitted
        ? <button className="btn primary" disabled={Object.keys(answers).length < total} onClick={() => {
          setSubmitted(true);
          const pass = correct / total >= need;
          store.addQuiz('lesson', correct, total);
          onDone(pass, correct / total, check.questions.filter((q, i) => answers[i] !== q.answer).map(q => `Quiz: ${q.q}`));
        }}>Check my answers</button>
        : <div className="row wrap"><strong>{correct} / {total} correct.</strong>{correct / total < need && <button className="btn" onClick={() => { setAnswers({}); setSubmitted(false); }}>Try again</button>}</div>}
    </div>
  );
}

function SelfCheck({ check, onDone }: { check: Extract<Check, { type: 'self' }>; onDone: Done }) {
  const [ticked, setTicked] = useState<boolean[]>(check.items.map(() => false));
  return (
    <div className="selfcheck">
      <p className="small muted">Be honest: tick each one only when you can do it without thinking hard.</p>
      {check.items.map((it, i) => (
        <label key={i} className="self-item"><input type="checkbox" checked={ticked[i]} onChange={e => { const t = [...ticked]; t[i] = e.target.checked; setTicked(t); }} /> {it}</label>
      ))}
      <button className="btn primary" disabled={!ticked.every(Boolean)} onClick={() => onDone(true, 1, [])}>I can do all of these</button>
    </div>
  );
}

function TuningCheck({ onDone }: { onDone: Done }) {
  const [inTune, setInTune] = useState<Record<number, boolean>>({});
  const [reading, setReading] = useState<{ s: number; c: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const streak = useRef<{ s: number; n: number }>({ s: 0, n: 0 });
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (!engine.running) { setRunning(false); return; }
      const p = detectPitch(engine.latest(4096), engine.sampleRate);
      if (!p) return;
      const r = tunerReading(p.freq, p.clarity);
      setReading({ s: r.string, c: r.cents });
      if (Math.abs(r.cents) <= THRESHOLDS.tuner.inTuneCents) {
        streak.current = streak.current.s === r.string ? { s: r.string, n: streak.current.n + 1 } : { s: r.string, n: 1 };
        if (streak.current.n >= THRESHOLDS.tuner.holdReadings) setInTune(t => ({ ...t, [r.string]: true }));
      } else streak.current = { s: r.string, n: 0 };
    }, 60);
    return () => clearInterval(id);
  }, [running]);
  const done = [6, 5, 4, 3, 2, 1].every(s => inTune[s]);
  useEffect(() => { if (done) { stopMic(); setRunning(false); onDone(true, 1, []); } }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="tuning-check">
      <p>Tune each string until it turns green (hold the note steady for a moment). Use the <a href="#tuner">Tuner</a> page if you want the big needle.</p>
      <div className="string-buttons">
        {[6, 5, 4, 3, 2, 1].map(s => <span key={s} className={`chip ${inTune[s] ? 'good' : ''} ${reading?.s === s ? 'on' : ''}`}>{STRING_SHORT[s]}<small>{inTune[s] ? '✓' : reading?.s === s ? `${reading.c > 0 ? '+' : ''}${Math.round(reading.c)}` : ordinal(s)}</small></span>)}
      </div>
      {!running && !done && <button className="btn primary" onClick={async () => { setErr(null); try { await startMic(); setRunning(true); } catch (e) { setErr(micErrorText(e)); } }}>Start listening</button>}
      {running && <StopListening />}
      {err && <p className="error">{err}</p>}
    </div>
  );
}

function ChordMastery({ check, onDone }: { check: Extract<Check, { type: 'chord' }>; onDone: Done }) {
  const { attempts } = useStore();
  const { clean, outOf } = THRESHOLDS.mastery.cleanChord;
  const m = masteryState(attempts[check.chord], clean, outOf);
  const reported = useRef(false);
  useEffect(() => {
    if (m.passed && !reported.current) { reported.current = true; stopMic(); onDone(true, 1, []); }
  }, [m.passed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // after a full row without passing, say what fell short
    if (!m.passed && m.last.length >= outOf && m.last.length % outOf === 0) {
      const issues = m.last.flatMap(a => a.issues);
      const common = [...new Set(issues)].slice(0, 3);
      onDone(false, m.cleanCount / outOf, common.length ? common : ['Not enough clean strums yet'], issues.some(i => /isn't ringing|dies away/.test(i)) ? ['muted-strings', 'buzzing'] : ['buzzing']);
    }
  }, [m.last.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return <ChordCheckBody chordId={check.chord} />;
}

function songFrom(id: string, bars: string[], bpm: number, pattern: string, checkChords = true): Song {
  return { id, title: id, bpm, beatsPerBar: 4, countInBars: 1, pattern, bars, checkChords };
}

function TimedTakeCheck({ song, bpm, accuracy, minGreen, onDone, recordAs }: { song: Song; bpm: number; accuracy?: number; minGreen?: number; onDone: Done; recordAs?: string }) {
  const [take, setTake] = useState<Take | null>(null);
  return (
    <div>
      <TakeRunner song={song} bpm={bpm} compact startLabel={take ? 'Try again' : 'Start'} onResult={t => {
        setTake(t);
        if (recordAs) recordTake(recordAs, t, song.bpm);
        const bars = t.result.bars;
        const matched = bars.reduce((a, b) => a + (b.matched ?? 0), 0);
        const expected = bars.reduce((a, b) => a + (b.expected ?? 1), 0);
        const acc = matched / Math.max(1, expected);
        const green = t.result.greenCount / bars.length;
        const passed = accuracy !== undefined ? acc >= accuracy : green >= (minGreen ?? THRESHOLDS.mastery.song.minGreen);
        const shortfall = passed ? [] : accuracy !== undefined
          ? [`${Math.round(acc * 100)}% of strums on the beat (need ${Math.round(accuracy * 100)}%)`]
          : [`${t.result.greenCount} of ${bars.length} bars solid (need ${Math.ceil((minGreen ?? THRESHOLDS.mastery.song.minGreen) * bars.length)})`, ...t.result.trouble.slice(0, 3).map(x => x.kind === 'change' ? `${x.from}→${x.to} change ${x.problem}` : `${x.to}: ${x.problem}`)];
        onDone(passed, accuracy !== undefined ? acc : green, shortfall, passed ? [] : accuracy !== undefined ? ['losing-beat', 'stiff-strumming'] : ['slow-changes', 'stopping-at-changes']);
      }} />
      {take && <TakeView take={take} showSave={false} />}
    </div>
  );
}

function NotesCheck({ check, onDone }: { check: Extract<Check, { type: 'notes' }>; onDone: Done }) {
  const expected = check.notes.map(n => OPEN_STRING_MIDI[n.string] + n.fret);
  const [frames, setFrames] = useState<number[]>([]);
  const [result, setResult] = useState<ReturnType<typeof analyseNoteSequence> | null>(null);
  const [listening, setListening] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef<number[]>([]);
  const finish = async (f: number[]) => {
    if (!f.length) return;
    const sr = engine.sampleRate;
    try { await engine.waitForFrame(f[f.length - 1] + Math.round(0.3 * sr)); } catch { return; }
    const from = f[0] - Math.round(0.4 * sr);
    const sig = engine.getRange(from, f[f.length - 1] + Math.round(0.3 * sr));
    stopMic(); setListening(false);
    const r = analyseNoteSequence(sig, sr, f.map(x => x - from), expected);
    setResult(r);
    const ok = r.filter(x => x.ok).length;
    const passed = ok === r.length;
    onDone(passed, ok / r.length, r.map((x, i) => x.ok ? null : `Note ${i + 1}: expected ${noteName(x.expected)}${x.heard ? `, heard ${noteName(x.heard)}` : ', no clear note'}`).filter(Boolean) as string[], passed ? [] : ['buzzing', 'muted-strings']);
  };
  useStrums(f => {
    const next = [...frameRef.current, f];
    frameRef.current = next; setFrames(next);
    if (timer.current) clearTimeout(timer.current);
    if (next.length >= expected.length + 1) finish(next);
    else timer.current = setTimeout(() => finish(next), 2500);
  }, listening, undefined, 'pluck');
  const notesText = check.notes.map(n => `${STRING_SHORT[n.string]}${n.fret}`).join(' ');
  return (
    <div className="notes-check">
      <p>{check.label ?? 'Play these notes one at a time, evenly:'} <strong className="mono">{notesText}</strong></p>
      <div className="note-seq">
        {check.notes.map((n, i) => {
          const r = result?.[i];
          return <span key={i} className={`ns ${r ? (r.ok ? 'good' : 'bad') : i < frames.length && listening ? 'heard' : ''}`} title={`${STRING_LABEL[n.string]} string, fret ${n.fret}`}><small>{STRING_SHORT[n.string]}</small>{n.fret}</span>;
        })}
      </div>
      <div className="row wrap">
        <button className="btn small" onClick={() => expected.forEach((m, i) => setTimeout(() => playNote(m, undefined, 0.3, 0.6), i * 450))}>▶ Hear it</button>
        {!listening
          ? <button className="btn primary" onClick={async () => { setErr(null); setResult(null); frameRef.current = []; setFrames([]); try { await startMic(); setListening(true); } catch (e) { setErr(micErrorText(e)); } }}>{result ? 'Try again' : 'Start listening'}</button>
          : <button className="btn stop" onClick={() => { finish(frameRef.current); }}>I've finished</button>}
      </div>
      {listening && <p className="small muted">Listening: {frames.length} of {expected.length} notes heard.</p>}
      {err && <p className="error">{err}</p>}
    </div>
  );
}

function PickCheck({ check, onDone }: { check: Extract<Check, { type: 'pick' }>; onDone: Done }) {
  // Picking patterns run continuously in eighth notes: one pluck on every half-beat.
  const steps = parsePicking(check.pattern, check.chord);
  const song = songFrom('pick', Array(check.bars ?? 4).fill(check.chord), check.bpm, 'DDDDDDDD', false);
  return (
    <div>
      <p className="mono">{steps.map(st => st.map(n => n.finger).join('+')).join(' ')}</p>
      <p>Play the pattern along with the clicks, {check.bars ?? 4} bars. The app checks your timing (single plucked notes are too quiet to check every finger).</p>
      <TimedTakeCheck song={song} bpm={check.bpm} accuracy={check.accuracy ?? THRESHOLDS.mastery.strum.accuracy} onDone={onDone} />
    </div>
  );
}

function BendCheck({ check, onDone }: { check: Extract<Check, { type: 'bend' }>; onDone: Done }) {
  const start = OPEN_STRING_MIDI[check.string] + check.fret;
  const target = start + check.semitones;
  const need = check.times ?? 3;
  const [cents, setCents] = useState<number | null>(null);
  const [hits, setHits] = useState(0);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const hold = useRef(0);
  const armed = useRef(true);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (!engine.running) { setRunning(false); return; }
      const p = detectPitch(engine.latest(2048), engine.sampleRate, 0.85);
      if (!p) { armed.current = true; hold.current = 0; return; }
      const midi = 69 + 12 * Math.log2(p.freq / 440);
      const c = (midi - start) * 100;
      setCents(c);
      if (c < 40) armed.current = true; // back at (or near) the starting note: ready to count the next bend
      if (armed.current && Math.abs(midi - target) * 100 <= 25) {
        hold.current++;
        if (hold.current >= 3) { armed.current = false; hold.current = 0; setHits(h => h + 1); }
      } else hold.current = 0;
    }, 50);
    return () => clearInterval(id);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (hits >= need) { stopMic(); setRunning(false); onDone(true, 1, []); } }, [hits]); // eslint-disable-line react-hooks/exhaustive-deps
  const pct = cents === null ? 0 : Math.max(0, Math.min(1.25, cents / (check.semitones * 100)));
  return (
    <div className="bend-check">
      <p>Play the {STRING_LABEL[check.string]} string at fret {check.fret} ({noteName(start)}) and bend it up {check.semitones === 2 ? 'a whole step' : 'a half step'} to {noteName(target)}. Do it {need} times; each one counts when you hold the target pitch.</p>
      <button className="btn small" onClick={() => { playNote(start, undefined, 0.3, 0.6); setTimeout(() => playNote(target, undefined, 0.3, 0.6), 700); }}>▶ Hear start and target</button>
      <div className="bend-meter" aria-label="Pitch of your bend">
        <span className="bm-target" style={{ left: '80%' }}>target</span>
        <span className="bm-fill" style={{ width: `${Math.min(100, pct * 80)}%`, background: cents !== null && Math.abs(cents - check.semitones * 100) <= 25 ? 'var(--ok)' : 'var(--f1)' }} />
      </div>
      <p className="small">{cents === null ? 'Waiting for a note…' : cents < check.semitones * 100 - 25 ? 'Push a little further' : cents > check.semitones * 100 + 25 ? 'Too far: ease off' : 'On target!'} · Bends hit: <strong>{hits}/{need}</strong></p>
      {!running ? <button className="btn primary" onClick={async () => { setErr(null); try { await startMic(); setRunning(true); } catch (e) { setErr(micErrorText(e)); } }}>Start listening</button> : <StopListening />}
      {err && <p className="error">{err}</p>}
    </div>
  );
}

export function CheckView({ check, onDone }: { check: Check; onDone: Done }) {
  switch (check.type) {
    case 'quiz': return <QuizCheck check={check} onDone={onDone} />;
    case 'self': return <SelfCheck check={check} onDone={onDone} />;
    case 'tuning': return <TuningCheck onDone={onDone} />;
    case 'chord': return <ChordMastery check={check} onDone={onDone} />;
    case 'change': return <ChangeDrill from={check.from} to={check.to} target={check.target} onFinish={(r, passed) => onDone(passed, r.clean / (check.target ?? 30), passed ? [] : [`${Math.round(r.clean * 60 / r.seconds)} clean changes per minute`], passed ? [] : ['slow-changes', 'looking'])} />;
    case 'strum': {
      const song = songFrom('strum', Array(check.bars ?? 4).fill(0).map((_, i) => (check.chords ?? ['G'])[i % (check.chords ?? ['G']).length]), check.bpm, check.pattern, false);
      return <div><StrumPattern pattern={check.pattern} bpm={check.bpm} chords={check.chords} /><TimedTakeCheck song={song} bpm={check.bpm} accuracy={check.accuracy ?? THRESHOLDS.mastery.strum.accuracy} onDone={onDone} /></div>;
    }
    case 'song': {
      const s = songById(check.song)!;
      return <div><p>Play <strong>{s.title}</strong> along with the clicks at {check.bpm ?? s.bpm} bpm without stopping. You need {Math.round((check.minGreen ?? THRESHOLDS.mastery.song.minGreen) * 100)}% of bars solid.</p><TimedTakeCheck song={s} bpm={check.bpm ?? s.bpm} minGreen={check.minGreen} onDone={onDone} recordAs={s.id} /></div>;
    }
    case 'notes': return <NotesCheck check={check} onDone={onDone} />;
    case 'pick': return <PickCheck check={check} onDone={onDone} />;
    case 'bend': return <BendCheck check={check} onDone={onDone} />;
  }
}

const CHECK_TITLE: Record<Check['type'], string> = {
  quiz: 'Quick quiz', self: 'Self-check', tuning: 'Tune all six strings', chord: 'Clean chord check', change: 'One-minute change drill',
  strum: 'Strum in time', song: 'Play-along', notes: 'Play the notes', pick: 'Picking in time', bend: 'Bend to pitch',
};

export function LessonChecks({ lesson }: { lesson: Lesson }) {
  const { lessons } = useStore();
  const lp = lessons[lesson.id];
  const [open, setOpen] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Record<number, { passed: boolean; shortfall: string[]; troubles: string[] }>>({});
  if (!lesson.checks.length) return null;
  return (
    <section className="lesson-checks" aria-label="Mastery checks">
      <h2>Mastery check</h2>
      <p className="small muted">Pass {lesson.checks.length > 1 ? 'all of these' : 'this'} to unlock the next lesson. You can always come back.</p>
      {lesson.checks.map((c, i) => {
        const passed = !!lp?.checks?.[i];
        const fb = feedback[i];
        const title = c.title ?? (c.type === 'chord' ? `Clean ${c.chord}: ${THRESHOLDS.mastery.cleanChord.clean} of ${THRESHOLDS.mastery.cleanChord.outOf}` : c.type === 'change' ? `${c.from} ⇄ ${c.to}: ${c.target ?? 'target'} clean changes a minute` : CHECK_TITLE[c.type]);
        return (
          <div key={i} className={`check-card ${passed ? 'passed' : ''}`}>
            <button className="check-head" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              <span className={`check-dot ${passed ? 'good' : ''}`}>{passed ? '✓' : i + 1}</span>
              <span className="check-title">{title}</span>
              <span className="muted small">{passed ? 'Passed' : open === i ? 'Close' : 'Start'}</span>
            </button>
            {open === i && (
              <div className="check-body">
                <CheckView check={c} onDone={(ok, score, shortfall, troubles = []) => {
                  const all = store.lessonCheck(lesson.id, i, lesson.checks.length, ok, score, shortfall);
                  for (const sk of lesson.skills) store.record(sk, score, ok);
                  setFeedback(f => ({ ...f, [i]: { passed: ok, shortfall, troubles } }));
                  if (all) setTimeout(() => setOpen(null), 1500);
                }} />
                {fb && !fb.passed && (
                  <div className="shortfall">
                    <h3>Not yet. Here's what fell short</h3>
                    <ul>{fb.shortfall.map((s, k) => <li key={k}>{s}</li>)}</ul>
                    <p className="small">This is now a priority in your next practice sessions (Today page). These might help:</p>
                    <div className="trouble-grid">{fb.troubles.map(t => <TroubleLink key={t} id={t} />)}</div>
                  </div>
                )}
                {fb?.passed && <p className="note ok"><strong>Passed!</strong></p>}
              </div>
            )}
          </div>
        );
      })}
      {lp?.status === 'passed' && <p className="note ok lesson-passed"><strong>Lesson passed.</strong> The next lesson is unlocked.</p>}
    </section>
  );
}
