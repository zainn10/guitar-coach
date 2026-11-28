import { useState } from 'react';
import { SONGS, songById, chordById, THRESHOLDS } from '../content';
import { Song } from '../audio/performance';
import { TakeRunner, Take } from '../checks/TakeRunner';
import { TakeView } from '../visuals/TakeView';
import { recordTake } from '../engine/progress';
import { songUnlocked, songChords, knownChords } from '../engine/course';
import { store } from '../storage/store';
import { Card, useStore } from '../ui';
import { StrumPattern } from '../visuals/StrumPattern';
import { ChordDiagram } from '../visuals/ChordDiagram';
import { AskClaude } from '../ask/AskClaude';

const KIND_LABEL = { practice: 'Practice progressions', traditional: 'Traditional songs (chords only)', goal: 'Goal songs (chord progressions only)' };

/** Tempo ladder: start slow; after 2 clean takes in a row, go up 5 bpm, up to the target tempo. */
export function ladderFor(song: Song) {
  const l = store.get().ladders[song.id];
  return l ?? { bpm: song.startBpm ?? Math.max(40, song.bpm - 20), cleanReps: 0, best: 0 };
}

export function SongPractice({ song, onDone }: { song: Song; onDone?: () => void }) {
  useStore();
  const ladder = ladderFor(song);
  const [bpm, setBpm] = useState(ladder.bpm);
  const [take, setTake] = useState<Take | null>(null);
  const [fix, setFix] = useState<{ range: [number, number]; bpm: number; clean: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const minGreen = THRESHOLDS.mastery.song.minGreen;

  const afterTake = (t: Take) => {
    setTake(t);
    if (fix) {
      const clean = t.result.greenCount === t.result.bars.length;
      if (clean) {
        const next = Math.min(song.bpm, fix.bpm + 5);
        if (fix.bpm >= song.bpm || next === fix.bpm) { setMsg(`Those bars are clean at ${fix.bpm} bpm. Fix-it loop complete!`); setFix(null); }
        else { setFix({ ...fix, bpm: next, clean: fix.clean + 1 }); setMsg(`Clean! Speeding up to ${next} bpm.`); }
      } else setMsg('Not clean yet. Same tempo again: relax and keep going.');
      recordTake(song.id, t, song.bpm);
      return;
    }
    recordTake(song.id, t, song.bpm);
    const ratio = t.result.greenCount / t.result.bars.length;
    const l = ladderFor(song);
    if (ratio >= 0.9 && t.bpm >= l.bpm) {
      const reps = l.cleanReps + 1;
      if (reps >= 2 && l.bpm < song.bpm) {
        const nb = Math.min(song.bpm, l.bpm + 5);
        store.setLadder(song.id, { bpm: nb, cleanReps: 0, best: Math.max(l.best, t.bpm) });
        setBpm(nb);
        setMsg(`Two clean takes in a row: the tempo ladder moves up to ${nb} bpm.`);
      } else {
        store.setLadder(song.id, { ...l, cleanReps: reps, best: Math.max(l.best, t.bpm) });
        setMsg(l.bpm >= song.bpm ? `Clean at full tempo (${song.bpm} bpm)!` : `Clean take! One more clean take at ${l.bpm} bpm and the tempo goes up.`);
      }
    } else {
      store.setLadder(song.id, { ...l, cleanReps: 0 });
      setMsg(ratio >= minGreen ? 'Good take. Get it fully clean twice to move up the tempo ladder.' : 'Some bars need work. Try the fix-it loop on the trouble spots.');
    }
  };

  return (
    <div className="song-practice">
      <div className="row wrap spread">
        <div className="row wrap">
          <span className="muted">Tempo</span>
          <button className="btn small" disabled={!!fix} onClick={() => setBpm(Math.max(30, bpm - 5))}>−5</button>
          <strong className="tempo">{fix ? fix.bpm : bpm} bpm</strong>
          <button className="btn small" disabled={!!fix} onClick={() => setBpm(Math.min(200, bpm + 5))}>+5</button>
        </div>
        <span className="small muted">Tempo ladder: {ladder.bpm} → {song.bpm} bpm{ladder.best ? ` · best clean ${ladder.best}` : ''}</span>
      </div>
      {fix && <p className="note warn"><strong>Fix-it loop:</strong> bars {fix.range[0]}–{fix.range[1]}, twice through, at {fix.bpm} bpm. <button className="btn link" onClick={() => setFix(null)}>Exit loop</button></p>}
      <TakeRunner key={fix ? `fix-${fix.bpm}` : `song-${bpm}`} onStart={() => { setTake(null); setMsg(null); }} song={song} bpm={fix ? fix.bpm : bpm} barRange={fix?.range} loops={fix ? 2 : 1}
        startLabel={take ? 'Play again' : 'Start'} onResult={afterTake} />
      {msg && <p className="note ok" role="status">{msg}</p>}
      {take && <Card title="Song map"><TakeView take={take} onFixIt={range => { setFix({ range, bpm: Math.max(40, (fix?.bpm ?? bpm) - 15), clean: 0 }); setMsg(null); }} /></Card>}
      {onDone && <button className="btn" onClick={onDone}>Done with this song</button>}
    </div>
  );
}

export function Songs({ sub }: { sub?: string }) {
  const d = useStore();
  const { settings } = d;
  const open = sub ? songById(sub) : undefined;
  if (open) {
    const unlocked = songUnlocked(d, open);
    return (
      <div className="stack">
        <a className="back-link" href="#songs">← All songs</a>
        <header className="page-head">
          <h1>{open.title}</h1>
          <p className="lead">{open.credit}{open.capo ? ` · Capo on fret ${open.capo}` : ''} · {open.bpm} bpm target · {open.beatsPerBar}/4</p>
        </header>
        {open.notes && <p>{open.notes}</p>}
        <div className="chord-row">{songChords(open).map(c => <ChordDiagram key={c} chord={chordById(c)} view={settings.diagramView} width={130} />)}</div>
        {open.pattern && <Card title="Strumming pattern"><StrumPattern pattern={open.pattern} bpm={open.startBpm ?? open.bpm} chords={open.bars.slice(0, 4).map(b => b.split(' ')[0])} beatsPerBar={open.beatsPerBar} /></Card>}
        {unlocked
          ? <Card title="Play along"><SongPractice song={open} /></Card>
          : <Card><p><strong>Locked.</strong> You'll unlock this when you've learned: {songChords(open).filter(c => !knownChords(d).includes(c)).join(', ')}.</p><p className="small muted">You can still listen to the pattern above and look at the chords.</p></Card>}
        <AskClaude context={`Working on the play-along "${open.title}" (chords ${songChords(open).join(', ')}, target ${open.bpm} bpm).`} />
      </div>
    );
  }
  const groups: ('practice' | 'traditional' | 'goal')[] = ['practice', 'traditional', 'goal'];
  return (
    <div className="stack">
      <header className="page-head">
        <h1>Songs</h1>
        <p className="lead">Play-alongs unlock as soon as you know their chords. Every one starts slow and speeds up as you get it clean. Chord progressions only: no lyrics or melodies.</p>
      </header>
      {groups.map(g => (
        <section key={g}>
          <h2 className="group-title">{KIND_LABEL[g]}</h2>
          <div className="song-grid">
            {SONGS.filter(s => (s.kind ?? 'practice') === g).map(s => {
              const un = songUnlocked(d, s);
              const it = d.items[`song:${s.id}`];
              return (
                <a key={s.id} href={`#songs/${s.id}`} className={`song-card ${un ? '' : 'locked'}`}>
                  <span className="song-title">{un ? '' : '🔒 '}{s.title}</span>
                  <span className="small muted">{songChords(s).join(' · ')}</span>
                  <span className="small muted">{s.credit}</span>
                  {it && <span className="strength"><span style={{ width: `${Math.round(it.strength * 100)}%` }} /></span>}
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
