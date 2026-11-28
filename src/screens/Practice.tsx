import { useState } from 'react';
import { ChangeDrill } from '../checks/ChangeDrill';
import { Metronome } from '../visuals/Metronome';
import { QuickQuiz } from './QuickQuiz';
import { ChordCheckBody } from './ChordCheck';
import { FreePlay } from './FreePlay';
import { chordsSoFar } from '../engine/course';
import { rankedItems } from '../engine/session';
import { SONGS } from '../content';
import { ladderFor } from './Songs';
import { songUnlocked } from '../engine/course';
import { Card, useStore } from '../ui';

const TABS = [
  { id: 'free', label: 'Play freely' }, { id: 'check', label: 'Chord check' }, { id: 'drill', label: 'Change drill' }, { id: 'metronome', label: 'Metronome' },
  { id: 'ladder', label: 'Tempo ladders' }, { id: 'quiz', label: 'Quick quiz' }, { id: 'ear', label: 'Ear training' },
] as const;

export function Practice({ sub }: { sub?: string }) {
  const d = useStore();
  const [tab, arg] = (sub ?? 'check').split('/');
  const chords = chordsSoFar(d);
  const weakChange = rankedItems(d).find(r => r.key.startsWith('change:'))?.key.slice(7);
  const [pair, setPair] = useState<string>(arg && tab === 'drill' ? arg : weakChange ?? (chords.length >= 2 ? `${chords[0]}>${chords[1]}` : 'Em>Am'));
  const [chord, setChord] = useState<string>(arg && tab === 'check' ? arg : chords[0] ?? 'Em');
  const [a, b] = pair.split('>');
  const [round, setRound] = useState(0); // a new quiz only when you ask for another round
  return (
    <div className="stack">
      <header className="page-head"><h1>Practice</h1><p className="lead">Tools to work on anything directly. The Today page builds these into sessions for you.</p></header>
      <nav className="subnav" aria-label="Practice tools">{TABS.map(t => <a key={t.id} href={`#practice/${t.id}`} className={tab === t.id ? 'on' : ''}>{t.label}</a>)}</nav>
      {tab === 'free' && <FreePlay />}
      {tab === 'check' && (
        <>
          <div className="chips">{(chords.length ? chords : ['Em', 'Am']).map(c => <button key={c} className={`chip big ${chord === c ? 'on' : ''}`} onClick={() => setChord(c)}>{c}</button>)}</div>
          <ChordCheckBody key={chord} chordId={chord} />
        </>
      )}
      {tab === 'drill' && (
        <Card>
          <div className="row wrap">
            <label>From <select value={a} onChange={e => setPair(`${e.target.value}>${b}`)}>{chords.map(c => <option key={c}>{c}</option>)}</select></label>
            <label>to <select value={b} onChange={e => setPair(`${a}>${e.target.value}`)}>{chords.filter(c => c !== a).map(c => <option key={c}>{c}</option>)}</select></label>
            {weakChange && <span className="small muted">Suggested (your weakest change): {weakChange.replace('>', ' ⇄ ')}</span>}
          </div>
          <ChangeDrill key={pair} from={a} to={b} />
        </Card>
      )}
      {tab === 'metronome' && <Card><Metronome initialBpm={70} /></Card>}
      {tab === 'ladder' && (
        <Card title="Tempo ladders">
          <p>Every song starts slow. After two fully clean takes in a row, the tempo goes up 5 bpm, until you reach the target.</p>
          <ul className="ladder-list">
            {SONGS.filter(s => songUnlocked(d, s)).map(s => {
              const l = ladderFor(s);
              const lo = s.startBpm ?? Math.max(40, s.bpm - 20);
              return (
                <li key={s.id}>
                  <a href={`#songs/${s.id}`}>{s.title}</a>
                  <span className="strength"><span style={{ width: `${Math.round(((l.bpm - lo) / Math.max(1, s.bpm - lo)) * 100)}%` }} /></span>
                  <span className="small muted">{l.bpm} / {s.bpm} bpm</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {tab === 'quiz' && <Card title="30-second quiz"><QuickQuiz key={'q' + round} onAgain={() => setRound(r => r + 1)} /></Card>}
      {tab === 'ear' && <Card title="Ear training: major or minor?"><p className="small muted">Major chords sound bright and settled; minor chords sound darker. Train your ear and you'll start recognising chords in songs.</p><QuickQuiz key={'e' + round} kinds={['ear']} onAgain={() => setRound(r => r + 1)} /></Card>}
    </div>
  );
}
