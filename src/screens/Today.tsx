import { useEffect, useState } from 'react';
import { TunerPanel } from './Tuner';
import { buildSession, nextOpenBlock, rankedItems, Block, BlockKind } from '../engine/session';
import { currentLesson, stageProgress, knownChords } from '../engine/course';
import { store, today } from '../storage/store';
import { lessonById, songById, STAGES } from '../content';
import { ChordCheckBody } from './ChordCheck';
import { ChangeDrill } from '../checks/ChangeDrill';
import { SongPractice } from './Songs';
import { QuickQuiz } from './QuickQuiz';
import { StrumPattern } from '../visuals/StrumPattern';
import { PickingPattern } from '../visuals/PickingPattern';
import { Metronome } from '../visuals/Metronome';
import { TabView } from '../visuals/Tab';
import { TroubleLink, troublesFor } from './Help';
import { Card, useStore, stopMic } from '../ui';
import { streak, minutesOn } from './Progress';
import { folderSupported } from '../storage/folder';

const LENGTHS: { m: number | 'open'; label: string; desc: string }[] = [
  { m: 5, label: '5 min', desc: 'Weakest spot, then a song' },
  { m: 15, label: '15 min', desc: 'Warm-up, weak spot, new skill, song, quiz' },
  { m: 30, label: '30 min', desc: 'Adds review, technique and ear training' },
  { m: 45, label: '45+ min', desc: 'Longer song work and free play' },
  { m: 'open', label: 'Open-ended', desc: 'One block at a time until you stop' },
];

const KIND_LABEL: Record<BlockKind, string> = { warmup: 'Warm-up', weak: 'Weak spot', review: 'Review', new: 'New skill', drill: 'Change drill', song: 'Song', quiz: 'Quiz', technique: 'Technique', ear: 'Ear training', free: 'Free play', break: 'Break', chord: 'Chord' };
const KIND_ICON: Record<BlockKind, string> = { warmup: '⏱', weak: '!', review: '↺', new: '★', drill: '⇄', song: '♫', quiz: '?', technique: '≋', ear: '♪', free: '☺', break: '☕', chord: '✋' };

export function Today() {
  const d = useStore();
  const session = d.session && d.session.date === today() ? d.session : undefined;
  const active = session?.blocks.find(b => !b.done);
  const lesson = currentLesson(d);
  const stages = stageProgress(d);
  const curStage = stages.find(s => !s.done) ?? stages[stages.length - 1];
  const weakest = rankedItems(d).filter(r => r.it.strength < 0.75).slice(0, 3);
  const mins = minutesOn(d, today());
  const st = streak(d);
  const newbie = (Date.now() - d.startedAt) / 86400000 < 21;

  return (
    <div className="stack">
      <header className="page-head today-head">
        <div>
          <h1>{greeting()}</h1>
          <p className="lead">{lesson ? <>You're on <strong>Stage {lesson.stage}</strong>: {STAGES.find(s => s.n === lesson.stage)?.title}.</> : 'You have finished the course. Choose a path to go deeper.'}</p>
        </div>
        <div className="today-stats">
          <div><span className="big-num">{st}</span><span className="small muted">day streak</span></div>
          <div><span className="big-num">{mins}</span><span className="small muted">min today</span></div>
          <div><span className="big-num">{knownChords(d).length}</span><span className="small muted">chords</span></div>
        </div>
      </header>

      {!Object.keys(d.lessons).length && !session && (
        <Card title="Welcome! Start here" className="welcome">
          <ol className="welcome-steps">
            <li><a href="#settings">Set up the microphone and timing</a> (2 minutes, once).</li>
            <li><a href="#lesson/s1-01-meet">Start the first lesson: Meet your guitar</a>.</li>
            <li>From then on, come to this page, pick how long you've got, and follow the session.</li>
          </ol>
        </Card>
      )}
      {session && active ? (
        <SessionRunner />
      ) : (
        <>
          {session && !active && <p className="note ok"><strong>Session complete.</strong> Nice work. Start another below if you have more time: it carries on from where you left off.</p>}
          <Card title="How long have you got?">
            <div className="length-grid">
              {LENGTHS.map(l => (
                <button key={String(l.m)} className="length-btn" onClick={() => store.setSession(buildSession(l.m))}>
                  <strong>{l.label}</strong><span>{l.desc}</span>
                </button>
              ))}
            </div>
            {newbie && <p className="small muted">First few weeks: your fingertips are toughening up. Longer sessions include short breaks.</p>}
          </Card>
          <div className="grid-2">
            {lesson && (
              <Card title="Continue where you left off">
                <p className="eyebrow">Stage {lesson.stage} · {lesson.minutes} min</p>
                <h3>{lesson.title}</h3>
                <p className="muted">{lesson.summary}</p>
                <a className="btn primary" href={`#lesson/${lesson.id}`}>Open lesson</a>
                <div className="stage-bar" aria-label={`Stage ${curStage.stage.n}: ${curStage.passed} of ${curStage.total} lessons passed`}>
                  {curStage.stage.lessons.map(id => <span key={id} className={d.lessons[id]?.status === 'passed' ? 'done' : id === lesson.id ? 'now' : ''} />)}
                </div>
              </Card>
            )}
            {!folderSupported() && (
              <Card title="On your phone">
                <p className="small">Keep this phone and your Mac in step through the iCloud Guitar Coach folder.</p>
                <a className="btn" href="#settings">Sync with your Mac</a>
              </Card>
            )}
            <Card title="Your weakest areas right now">
              {weakest.length ? (
                <ul className="weak-list">
                  {weakest.map(w => (
                    <li key={w.key}>
                      <span>{labelFor(w.key)}</span>
                      <span className="strength"><span style={{ width: `${Math.round(w.it.strength * 100)}%`, background: w.it.strength < 0.4 ? 'var(--bad)' : 'var(--warn)' }} /></span>
                    </li>
                  ))}
                </ul>
              ) : <p className="muted">Nothing yet. As you play, chords, changes and songs that need work appear here, and every session starts with them.</p>}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export function labelFor(key: string) {
  const [k, v] = key.split(':');
  if (k === 'chord') return `${v} chord`;
  if (k === 'change') return `${v.replace('>', ' ⇄ ')} change`;
  if (k === 'song') return songById(v)?.title ?? v;
  return v.replace(/-/g, ' ');
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function SessionRunner() {
  const d = useStore();
  const s = d.session!;
  const idx = s.blocks.findIndex(b => !b.done);
  const block = s.blocks[idx];
  const total = s.blocks.reduce((a, b) => a + b.minutes, 0);
  const done = s.blocks.filter(b => b.done).reduce((a, b) => a + b.minutes, 0);
  const complete = () => {
    stopMic();
    const blocks = s.blocks.map((b, i) => i === idx ? { ...b, done: true } : b);
    if (s.minutes === 'open') blocks.push(nextOpenBlock(store.get(), blocks.filter(b => b.done).map(b => b.kind as BlockKind)));
    store.setSession({ ...s, blocks });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <div className="session">
      <div className="session-plan" aria-label="Session plan">
        {s.blocks.map((b, i) => (
          <span key={b.id} className={`sp-step ${b.done ? 'done' : i === idx ? 'now' : ''}`} title={b.title}><span aria-hidden>{b.done ? '✓' : KIND_ICON[b.kind]}</span> {KIND_LABEL[b.kind]}</span>
        ))}
        <span className="small muted">{s.minutes === 'open' ? `${done} min so far` : `${done} of ~${total} min`}</span>
        <button className="btn link" onClick={() => { stopMic(); store.setSession(undefined); }}>End session</button>
      </div>
      <Card>
        <p className="eyebrow">{KIND_ICON[block.kind]} {block.minutes} min{block.why ? ` · ${block.why}` : ''}</p>
        <h2>{block.title}</h2>
        <BlockBody block={block} onDone={complete} />
        <div className="row wrap block-foot">
          <button className="btn primary" onClick={complete}>{s.minutes === 'open' ? 'Done: next block' : idx === s.blocks.length - 1 ? 'Finish session' : 'Done: next'}</button>
          {s.minutes === 'open' && <button className="btn" onClick={() => { stopMic(); store.setSession({ ...s, blocks: s.blocks.map((b, i) => i === idx ? { ...b, done: true } : b) }); }}>Stop here</button>}
        </div>
      </Card>
    </div>
  );
}

function BlockBody({ block, onDone }: { block: Block; onDone: () => void }) {
  const d = useStore();
  const lesson = currentLesson(d);
  const stage = lesson?.stage ?? 6;
  switch (block.kind) {
    case 'warmup':
      return (
        <div className="stack">
          <p>1. Quick tune: check all six strings (30 seconds).</p>
          <details className="inline-tuner"><summary>Open the tuner here</summary><TunerPanel /></details>
          <p>2. Finger warm-up: each finger on its own fret, fingertips just behind the fret wire. Slow and even with the click.</p>
          <TabView title="1-2-3-4 warm-up (one finger per fret)" text={`e|--------------------------------1-2-3-4|\nB|--------------------------1-2-3-4------|\nG|--------------------1-2-3-4------------|\nD|--------------1-2-3-4------------------|\nA|--------1-2-3-4------------------------|\nE|--1-2-3-4------------------------------|`} bpm={stage < 3 ? 60 : 80} />
          <Metronome initialBpm={stage < 3 ? 60 : 80} compact />
        </div>
      );
    case 'chord':
    case 'weak':
      return block.ref ? (
        <div className="stack">
          <ChordCheckBody chordId={block.ref} />
          <div className="trouble-grid">{troublesFor(`chord:${block.ref}`).slice(0, 2).map(t => <TroubleLink key={t.id} id={t.id} />)}</div>
        </div>
      ) : null;
    case 'drill': {
      const [a, b] = (block.ref ?? 'Em>Am').split('>');
      return <ChangeDrill from={a} to={b} />;
    }
    case 'review':
    case 'new': {
      const l = block.ref ? lessonById(block.ref) : undefined;
      return l ? (
        <div className="stack">
          <p>{l.summary}</p>
          <p><a className="btn primary" href={`#lesson/${l.id}`}>Open the lesson</a> <span className="small muted">Come back here with the Today tab when you're done; your session waits for you.</span></p>
        </div>
      ) : null;
    }
    case 'song': {
      const s = block.ref ? songById(block.ref) : undefined;
      return s ? <SongPractice song={s} /> : null;
    }
    case 'quiz': return <QuickQuiz />;
    case 'ear': return <QuickQuiz kinds={['ear']} />;
    case 'technique':
      return stage >= 4
        ? <div className="stack"><p>Fingerpicking: thumb on the bass string, then i-m-a on strings 3-2-1. Slow and even.</p><PickingPattern pattern="p i m a m i" chord="Am" bpm={60} /></div>
        : <div className="stack"><p>Keep your arm moving down-up like a pendulum. Strum along with the pattern, then try it with the chord you find hardest.</p><StrumPattern pattern={stage >= 3 ? 'D-DU-UDU' : stage >= 2 ? 'D-D-D-DU' : 'D-D-D-D-'} bpm={stage >= 3 ? 80 : 70} chords={stage >= 3 ? ['G', 'C'] : ['Em', 'Am']} /></div>;
    case 'free': return <FreePlay onDone={onDone} minutes={block.minutes} />;
    case 'break': return <BreakTimer minutes={block.minutes} onDone={onDone} />;
  }
}

function FreePlay({ minutes }: { minutes: number; onDone: () => void }) {
  return (
    <div className="stack">
      <p>Play anything you enjoy for {minutes} minutes: a song you've unlocked, chords in any order, or make up your own rhythm. Enjoying it is part of learning fast.</p>
      <Metronome initialBpm={70} compact />
    </div>
  );
}

function BreakTimer({ minutes, onDone }: { minutes: number; onDone: () => void }) {
  const [left, setLeft] = useState(minutes * 60);
  useEffect(() => {
    const id = setInterval(() => setLeft(l => Math.max(0, l - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (left === 0) onDone(); }, [left]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="stack center-text">
      <div className="drill-big">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</div>
      <p>Put the guitar down. Open and close your hands slowly 10 times, roll your shoulders, and let your fingertips rest. Short breaks now mean longer, pain-free practice later.</p>
    </div>
  );
}
