// "Stuck on something?" — the trouble-shooter.
import { useState } from 'react';
import troublesJson from '../../content/troubles.json';
import { MistakeVisual } from '../visuals/Mistakes';
import { Card } from '../ui';
import { AskClaude } from '../ask/AskClaude';

export interface Trouble { id: string; title: string; group: string; symptom: string; why: string; steps: string[]; visual?: string; related: string[] }
export const TROUBLES = troublesJson.troubles as Trouble[];
export const troubleById = (id: string) => TROUBLES.find(t => t.id === id);

/** Troubles relevant to an item key like "chord:G" or "change:C>G". */
export function troublesFor(key: string): Trouble[] {
  const [kind] = key.split(':');
  const exact = TROUBLES.filter(t => t.related.includes(key));
  const general = TROUBLES.filter(t => t.related.includes(`${kind}:*`));
  return [...exact, ...general.filter(g => !exact.includes(g))];
}

export function TroubleLink({ id }: { id: string }) {
  const t = troubleById(id);
  if (!t) return null;
  return (
    <a className="trouble-link" href={`#help/${t.id}`}>
      <span className="tl-icon" aria-hidden>?</span>
      <span><strong>{t.title}</strong><br /><span className="small muted">{t.symptom}</span></span>
    </a>
  );
}

export function TroubleArticle({ t }: { t: Trouble }) {
  return (
    <article className="trouble-article">
      <h2>{t.title}</h2>
      <p className="lead">{t.symptom}</p>
      <p><strong>Why it happens:</strong> {t.why}</p>
      {t.visual && <div className="lesson-visual"><MistakeVisual id={t.visual} /></div>}
      <h3>How to fix it</h3>
      <ol className="fix-steps">{t.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      <AskClaude context={`The learner is reading the help topic "${t.title}" (${t.symptom}).`} />
    </article>
  );
}

export function Help({ sub }: { sub?: string }) {
  const [q, setQ] = useState('');
  const open = sub ? troubleById(sub) : undefined;
  if (open) return (
    <div className="stack">
      <a className="back-link" href="#help">← All help topics</a>
      <Card><TroubleArticle t={open} /></Card>
    </div>
  );
  const groups = [...new Set(TROUBLES.map(t => t.group))];
  const match = (t: Trouble) => !q || (t.title + t.symptom + t.why).toLowerCase().includes(q.toLowerCase());
  return (
    <div className="stack">
      <header className="page-head">
        <h1>Stuck on something?</h1>
        <p className="lead">The things almost every beginner struggles with, and exactly how to fix them. The app also points you here automatically when a check shows you're stuck.</p>
      </header>
      <input className="search" type="search" placeholder="Search, e.g. buzzing, F chord, sore fingers" value={q} onChange={e => setQ(e.target.value)} aria-label="Search help topics" />
      {groups.map(g => {
        const items = TROUBLES.filter(t => t.group === g && match(t));
        if (!items.length) return null;
        return (
          <section key={g}>
            <h2 className="group-title">{g}</h2>
            <div className="trouble-grid">{items.map(t => <TroubleLink key={t.id} id={t.id} />)}</div>
          </section>
        );
      })}
    </div>
  );
}
