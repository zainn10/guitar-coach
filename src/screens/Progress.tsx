import { useState } from 'react';
import { Data, today, practiceOn, allPracticeDays } from '../storage/store';
import { stageProgress, knownChords } from '../engine/course';
import { rankedItems } from '../engine/session';
import { changeKey } from '../engine/progress';
import { BarChart, LineChart } from '../visuals/Charts';
import { changeTarget } from '../checks/ChangeDrill';
import { songById } from '../content';
import { Card, useStore } from '../ui';
import { labelFor } from './Today';
import { GoalReadiness } from './Goals';

export const minutesOn = (d: Data, day: string) => Math.round(practiceOn(d, day) / 60);

/** Days in a row with at least 5 minutes of practice (today counts if done; otherwise it ends yesterday). */
export function streak(d: Data) {
  let n = 0;
  const day = new Date();
  if (practiceOn(d, today()) < 300) day.setDate(day.getDate() - 1);
  for (;;) {
    const k = today(day.getTime());
    if (practiceOn(d, k) >= 300) { n++; day.setDate(day.getDate() - 1); } else break;
  }
  return n;
}

export function Progress() {
  const d = useStore();
  const days = Array.from({ length: 28 }, (_, i) => { const t = new Date(); t.setDate(t.getDate() - 27 + i); return today(t.getTime()); });
  const total = Math.round(allPracticeDays(d).reduce((a, k) => a + practiceOn(d, k), 0) / 60);
  const pairs = [...new Set(d.drills.map(r => changeKey(r.from, r.to)))];
  const [pair, setPair] = useState(pairs[pairs.length - 1] ?? '');
  const drillData = d.drills.filter(r => changeKey(r.from, r.to) === pair).slice(-20)
    .map(r => ({ x: new Date(r.t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), y: Math.round(r.clean * 60 / r.seconds), label: new Date(r.t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }));
  const songsPlayed = [...new Set(d.takes.map(t => t.song))];
  const [song, setSong] = useState(songsPlayed[songsPlayed.length - 1] ?? '');
  const songData = d.takes.filter(t => t.song === song).slice(-20)
    .map(t => ({ x: new Date(t.t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), y: Math.round(100 * t.statuses.filter(s => s === 'green').length / t.statuses.length), label: `${new Date(t.t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${t.bpm ? ` at ${t.bpm} bpm` : ''}` }));
  const weakest = rankedItems(d).sort((a, b) => a.it.strength - b.it.strength).slice(0, 8);
  const stages = stageProgress(d);
  const [a, b] = pair.replace('change:', '').split('>');

  return (
    <div className="stack">
      <header className="page-head"><h1>Progress</h1></header>
      <div className="stat-row">
        <div className="stat"><span className="big-num">{streak(d)}</span><span className="small muted">day streak</span></div>
        <div className="stat"><span className="big-num">{total}</span><span className="small muted">minutes in total</span></div>
        <div className="stat"><span className="big-num">{knownChords(d).length}</span><span className="small muted">chords learned</span></div>
        <div className="stat"><span className="big-num">{Object.values(d.lessons).filter(l => l.status === 'passed').length}</span><span className="small muted">lessons passed</span></div>
      </div>

      <Card title="Practice time, last 4 weeks">
        <BarChart data={days.map(k => ({ x: k.slice(8), y: minutesOn(d, k), label: new Date(k).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) }))} unit="min" />
        <p className="small muted">A day counts towards your streak with at least 5 minutes. Little and often beats long and rare.</p>
      </Card>

      <Card title="Course">
        <ol className="stage-list">
          {stages.map(s => (
            <li key={s.stage.n}>
              <span>Stage {s.stage.n}: {s.stage.title}</span>
              <span className="strength"><span style={{ width: `${Math.round((s.passed / s.total) * 100)}%` }} /></span>
              <span className="small muted">{s.passed}/{s.total}</span>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid-2">
        <Card title="Chord-change drills">
          {pairs.length ? (
            <>
              <select aria-label="Chord pair" value={pair} onChange={e => setPair(e.target.value)}>{pairs.map(p => <option key={p} value={p}>{p.replace('change:', '').replace('>', ' ⇄ ')}</option>)}</select>
              <LineChart data={drillData} unit="clean changes / min" target={a && b ? changeTarget(a, b) : undefined} />
            </>
          ) : <p className="muted">Do a one-minute change drill (Practice) and your scores appear here.</p>}
        </Card>
        <Card title="Song improvement">
          {songsPlayed.length ? (
            <>
              <select aria-label="Song" value={song} onChange={e => setSong(e.target.value)}>{songsPlayed.map(s => <option key={s} value={s}>{songById(s)?.title ?? s}</option>)}</select>
              <LineChart data={songData} unit="% bars solid" max={100} />
            </>
          ) : <p className="muted">Play a play-along and each take's score appears here.</p>}
        </Card>
      </div>

      <Card title="Weakest areas">
        {weakest.length ? (
          <ul className="weak-list wide">
            {weakest.map(w => (
              <li key={w.key}>
                <span>{labelFor(w.key)}</span>
                <span className="strength"><span style={{ width: `${Math.round(w.it.strength * 100)}%` }} /></span>
                <span className="small muted">{Math.round(w.it.strength * 100)}%{w.due ? ' · due for review' : ''}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted">Nothing tracked yet.</p>}
        <p className="small muted">Strength mixes your recent results (recent counts more). Sessions on the Today page always start with the weakest.</p>
      </Card>

      <GoalReadiness />
    </div>
  );
}
