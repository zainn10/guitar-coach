import { STAGES, PATHS, lessonById } from '../content';
import { lessonStatus, stageProgress } from '../engine/course';
import { LessonBody } from '../visuals/LessonBody';
import { LessonChecks } from '../checks/Checks';
import { AskClaude } from '../ask/AskClaude';
import { Card, useStore } from '../ui';
import { store } from '../storage/store';
import { COURSE_ORDER } from '../content';
import { useEffect } from 'react';

export function Course() {
  const d = useStore();
  const stages = stageProgress(d);
  const allDone = stages.every(s => s.done);
  return (
    <div className="stack">
      <header className="page-head">
        <h1>Course</h1>
        <p className="lead">Six stages from your first chord to fast runs and flamenco rhythms. Each lesson ends with a check you must pass before the next unlocks. You can always go back.</p>
      </header>
      {STAGES.map((st, si) => {
        const p = stages[si];
        const stageLocked = si > 0 && !stages[si - 1].done && !st.lessons.some(id => lessonStatus(d, id) !== 'locked');
        return (
          <section key={st.n} className={`stage-card ${stageLocked ? 'locked' : ''}`}>
            <div className="stage-head">
              <span className="stage-num">{st.n}</span>
              <div>
                <h2>{st.title}</h2>
                <p className="muted">{st.intro}</p>
              </div>
              <span className="small muted">{p.passed}/{p.total}</span>
            </div>
            <ol className="lesson-list">
              {st.lessons.map(id => {
                const l = lessonById(id)!;
                const s = lessonStatus(d, id);
                return (
                  <li key={id} className={`ls-${s} ${l.flamenco ? 'flam' : ''}`}>
                    {s === 'locked'
                      ? <span className="lesson-row"><span className="ls-dot">🔒</span><span className="ls-title">{l.title}</span><span className="small muted">{l.minutes} min</span></span>
                      : <a className="lesson-row" href={`#lesson/${id}`}><span className="ls-dot">{s === 'passed' ? '✓' : '●'}</span><span className="ls-title">{l.flamenco && <span className="flam-tag">Flamenco</span>}{l.title}</span><span className="small muted">{l.minutes} min</span></a>}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
      <section className={`stage-card ${allDone ? '' : 'locked'}`}>
        <div className="stage-head"><span className="stage-num">→</span><div><h2>Choose your path</h2><p className="muted">After Stage 6, go deeper in the direction you love most.</p></div></div>
        <PathChooser enabled={allDone} />
      </section>
    </div>
  );
}

export function PathChooser({ enabled }: { enabled: boolean }) {
  const d = useStore();
  return (
    <div className="path-grid">
      {PATHS.map(p => (
        <div key={p.id} className={`path-card ${d.path === p.id ? 'on' : ''}`}>
          <h3>{p.title}</h3>
          <p className="small">{p.summary}</p>
          <ul className="small">{p.next.map(n => <li key={n}>{n}</li>)}</ul>
          <button className="btn" disabled={!enabled} onClick={() => store.update(x => ({ ...x, path: p.id }))}>{d.path === p.id ? 'Your path ✓' : enabled ? 'Choose this path' : 'Unlocks after Stage 6'}</button>
        </div>
      ))}
    </div>
  );
}

export function LessonPage({ id }: { id: string }) {
  const d = useStore();
  const l = lessonById(id);
  useEffect(() => { if (l && lessonStatus(store.get(), id) !== 'locked') store.openLesson(id); window.scrollTo(0, 0); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!l) return <p>Lesson not found. <a href="#course">Back to the course</a></p>;
  const status = lessonStatus(d, id);
  const i = COURSE_ORDER.indexOf(id);
  const prev = COURSE_ORDER[i - 1], next = COURSE_ORDER[i + 1];
  const st = STAGES.find(s => s.n === l.stage)!;
  if (status === 'locked') return (
    <div className="stack">
      <a className="back-link" href="#course">← Course</a>
      <Card><h1>🔒 {l.title}</h1><p>This lesson unlocks when you pass the one before it. No skipping ahead: each step builds on the last.</p>{prev && <a className="btn primary" href={`#lesson/${prev}`}>Go to the previous lesson</a>}</Card>
    </div>
  );
  return (
    <div className="stack lesson-page">
      <a className="back-link" href="#course">← Course · Stage {st.n}: {st.title}</a>
      <header className="page-head">
        <p className="eyebrow">{l.flamenco ? 'Flamenco corner · ' : ''}Stage {l.stage} · about {l.minutes} min{status === 'passed' ? ' · ✓ passed' : ''}</p>
        <h1>{l.title}</h1>
        {l.summary && <p className="lead">{l.summary}</p>}
      </header>
      <LessonBody text={l.body} />
      <AskClaude context={`Lesson "${l.title}" (Stage ${l.stage}). ${l.summary}`} label="Stuck? Ask Claude about this lesson" />
      <LessonChecks lesson={l} />
      <nav className="lesson-nav">
        {prev ? <a className="btn" href={`#lesson/${prev}`}>← {lessonById(prev)?.title}</a> : <span />}
        {next && (status === 'passed'
          ? <a className="btn primary" href={`#lesson/${next}`}>Next: {lessonById(next)?.title} →</a>
          : <span className="btn disabled" aria-disabled>🔒 Pass the check to unlock the next lesson</span>)}
      </nav>
    </div>
  );
}
