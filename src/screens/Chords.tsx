import { useState } from 'react';
import { CHORDS, chordById, LESSONS } from '../content';
import { chordsSoFar, knownChords } from '../engine/course';
import { ChordDiagram, FingerLegend } from '../visuals/ChordDiagram';
import { BuildChord } from '../visuals/BuildChord';
import { ChordChange } from '../visuals/ChordChange';
import { MistakeVisual } from '../visuals/Mistakes';
import { TroubleLink, troublesFor } from './Help';
import { playChord } from '../audio/sounds';
import { AskClaude } from '../ask/AskClaude';
import { Card, useStore } from '../ui';
import { store } from '../storage/store';

export function Chords({ sub }: { sub?: string }) {
  const d = useStore();
  const { settings } = d;
  const soFar = chordsSoFar(d);
  const known = knownChords(d);
  const taught = CHORDS.filter(c => LESSONS.some(l => l.chords.includes(c.id)));
  if (sub) return <ChordDetail id={sub} />;
  // learned and current chords first, then the rest in the order the course teaches them
  const stageOf = (id: string) => LESSONS.find(l => l.chords.includes(id))?.stage ?? 9;
  const orderOf = (id: string) => { const i = LESSONS.findIndex(l => l.chords.includes(id)); return i < 0 ? 999 : i; };
  const rank = (id: string) => (soFar.includes(id) ? 0 : 10000) + stageOf(id) * 1000 + orderOf(id);
  return (
    <div className="stack">
      <header className="page-head">
        <h1>Chord library</h1>
        <p className="lead">Every chord you've learned, with the shape, how to build it, how to change to your other chords, and how to fix common problems.</p>
        <div className="seg" role="radiogroup" aria-label="Diagram view">
          <button role="radio" aria-checked={settings.diagramView === 'chart'} className={settings.diagramView === 'chart' ? 'on' : ''} onClick={() => store.setSettings({ diagramView: 'chart' })}>Chord chart</button>
          <button role="radio" aria-checked={settings.diagramView === 'player'} className={settings.diagramView === 'player' ? 'on' : ''} onClick={() => store.setSettings({ diagramView: 'player' })}>Player's view</button>
        </div>
      </header>
      <FingerLegend />
      <div className="chord-grid">
        {[...taught].sort((a, b) => rank(a.id) - rank(b.id)).map(c => {
          const open = soFar.includes(c.id);
          const lesson = LESSONS.find(l => l.chords.includes(c.id));
          return open ? (
            <a key={c.id} href={`#chords/${c.id}`} className="chord-tile">
              <ChordDiagram chord={c} view={settings.diagramView} width={160} />
              <span className="small">{known.includes(c.id) ? '✓ learned' : 'learning now'}</span>
            </a>
          ) : (
            <div key={c.id} className="chord-tile locked"><span className="chord-id">{c.name}</span><span className="small muted">🔒 Stage {lesson?.stage}</span></div>
          );
        })}
      </div>
    </div>
  );
}

function ChordDetail({ id }: { id: string }) {
  const d = useStore();
  const c = chordById(id);
  const others = chordsSoFar(d).filter(x => x !== id);
  const [other, setOther] = useState(others[0]);
  const troubles = [...(c.troubles ?? []).map(t => ({ id: t })), ...troublesFor(`chord:${id}`)].filter((t, i, a) => a.findIndex(x => x.id === t.id) === i).slice(0, 4);
  const item = d.items[`chord:${id}`];
  return (
    <div className="stack">
      <a className="back-link" href="#chords">← Chord library</a>
      <header className="page-head row wrap spread">
        <div><h1>{c.id} <span className="muted">· {c.name}</span></h1>{c.notes && <p className="lead">{c.notes}</p>}</div>
        <div className="row"><button className="btn" onClick={() => playChord(c)}>▶ Hear it</button><a className="btn primary" href={`#practice/check/${c.id}`}>Check it with the mic</a></div>
      </header>
      {item && <p className="small muted">Your strength on {c.id}: {Math.round(item.strength * 100)}% from {item.count} checks.</p>}
      <div className="grid-2">
        <Card title="Build it, one finger at a time"><BuildChord chord={c} /></Card>
        <Card title="Both views">
          <div className="chord-row">
            <ChordDiagram chord={c} view="chart" width={200} />
            <ChordDiagram chord={c} view="player" width={200} />
          </div>
          {c.tips && <ul className="tips">{c.tips.map(t => <li key={t}>{t}</li>)}</ul>}
        </Card>
      </div>
      {others.length > 0 && (
        <Card title="Changing chords">
          <div className="row wrap"><span className="muted">Change from {c.id} to</span>
            {others.map(o => <button key={o} className={`chip ${other === o ? 'on' : ''}`} onClick={() => setOther(o)}>{o}</button>)}
          </div>
          {other && <div className="center-row"><ChordChange key={other} from={c} to={chordById(other)} /></div>}
          <p className="small"><a href={`#practice/drill/${c.id}>${other}`}>Do a one-minute {c.id} ⇄ {other} drill →</a></p>
        </Card>
      )}
      <Card title="Common problems and fixes">
        <MistakeVisual id={c.barres?.length ? 'barre-roll' : 'finger-flat'} />
        <div className="trouble-grid" style={{ marginTop: 12 }}>{troubles.map(t => <TroubleLink key={t.id} id={t.id} />)}</div>
      </Card>
      <AskClaude context={`Working on the ${c.name} chord (${c.id}).`} />
    </div>
  );
}
