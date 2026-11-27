import { useEffect, useMemo, useState } from 'react';
import { makeQuiz, QuizQ } from '../engine/quiz';
import { chordsSoFar } from '../engine/course';
import { ChordDiagram } from '../visuals/ChordDiagram';
import { Fretboard, noteNameAt } from '../visuals/Fretboard';
import { playChord } from '../audio/sounds';
import { chordById } from '../content';
import { store } from '../storage/store';
import { useStore } from '../ui';
import { ordinal, STRING_LABEL } from '../audio/notes';

export function QuickQuiz({ kinds, onDone, seconds = 30 }: { kinds?: QuizQ['kind'][]; onDone?: (correct: number, total: number) => void; seconds?: number }) {
  const d = useStore();
  const qs = useMemo(() => makeQuiz(chordsSoFar(d), 3, kinds), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [left, setLeft] = useState(seconds);
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (over) return;
    const id = setInterval(() => setLeft(l => { if (l <= 1) { clearInterval(id); return 0; } return l - 1; }), 1000);
    return () => clearInterval(id);
  }, [over]);
  useEffect(() => { if (left === 0 && !over) finish(correct); }, [left]); // eslint-disable-line react-hooks/exhaustive-deps
  const finish = (c: number) => {
    setOver(true);
    store.addQuiz(kinds?.join('+') ?? 'mixed', c, qs.length);
    store.record('skill:recall', c / qs.length, c / qs.length >= 0.67);
    onDone?.(c, qs.length);
  };
  const answer = (ok: boolean, explain: string) => {
    const c = correct + (ok ? 1 : 0);
    setCorrect(c);
    setFeedback(ok ? '✓ Right!' : `✕ ${explain}`);
    setTimeout(() => {
      setFeedback(null);
      if (i + 1 >= qs.length) finish(c); else setI(i + 1);
    }, ok ? 700 : 1800);
  };
  if (over) return (
    <div className="quick-quiz done">
      <div className="drill-big">{correct}/{qs.length}</div>
      <p>{correct === qs.length ? 'Perfect recall!' : correct > 0 ? 'Good. The ones you missed will come back.' : "Time's up. These will come back soon."}</p>
    </div>
  );
  const q = qs[i];
  return (
    <div className="quick-quiz">
      <div className="row spread"><span className="small muted">Question {i + 1} of {qs.length}</span><span className={`timer ${left < 10 ? 'low' : ''}`}>{left}s</span></div>
      <QuestionView q={q} onAnswer={answer} disabled={!!feedback} />
      {feedback && <p className={`qq-feedback ${feedback.startsWith('✓') ? 'good' : 'bad'}`} aria-live="assertive">{feedback}</p>}
    </div>
  );
}

function QuestionView({ q, onAnswer, disabled }: { q: QuizQ; onAnswer: (ok: boolean, explain: string) => void; disabled: boolean }) {
  const { settings } = useStore();
  if (q.kind === 'name') return (
    <div className="qq">
      <p className="qq-prompt">Which chord is this?</p>
      <ChordDiagram chord={q.chord} view={settings.diagramView} width={200} title={false} />
      <div className="qq-options">{q.options.map(o => <button key={o} className="btn" disabled={disabled} onClick={() => onAnswer(o === q.answer, `It's ${q.answer} (${chordById(q.answer).name}).`)}>{o}</button>)}</div>
    </div>
  );
  if (q.kind === 'find') return (
    <div className="qq">
      <p className="qq-prompt">Tap where <strong>{q.note}</strong> is on the <strong>{STRING_LABEL[q.string]}</strong> string.</p>
      <Fretboard from={0} to={5} strings={[q.string]} onPick={(s, f) => { if (s !== q.string || disabled) return; onAnswer(noteNameAt(s, f) === q.note, `${q.note} on the ${ordinal(q.string)} string is at fret ${[0, 1, 2, 3, 4, 5].find(x => noteNameAt(q.string, x) === q.note)}.`); }} />
    </div>
  );
  if (q.kind === 'mistake') return (
    <div className="qq">
      <p className="qq-prompt">This is meant to be <strong>{q.chord.id}</strong>, but one finger is in the wrong place. Which string?</p>
      <ChordDiagram chord={q.wrong} view={settings.diagramView} width={200} title={false} />
      <div className="qq-options">{q.options.map(o => <button key={o} className="btn" disabled={disabled} onClick={() => onAnswer(o === q.answer, `It's the ${q.answer}.`)}>{o}</button>)}</div>
    </div>
  );
  return (
    <div className="qq">
      <p className="qq-prompt">Listen. Is this chord major or minor?</p>
      <button className="btn" onClick={() => playChord(chordById(q.play))}>▶ Play again</button>
      <PlayOnce chord={q.play} />
      <div className="qq-options">{q.options.map(o => <button key={o} className="btn" disabled={disabled} onClick={() => onAnswer(o === q.answer, `It was ${q.play}: ${q.answer.toLowerCase()}.`)}>{o}</button>)}</div>
    </div>
  );
}

function PlayOnce({ chord }: { chord: string }) {
  useEffect(() => { playChord(chordById(chord)); }, [chord]);
  return null;
}
