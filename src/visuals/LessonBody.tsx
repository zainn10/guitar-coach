// Turns a lesson's text into a page. Plain text with a few simple marks:
//   ## Heading, - bullet, 1. numbered, **bold**, *italic*
// and "::" lines that drop in a visual, for example:
//   ::chord Em Am          ::build Em             ::change Em Am
//   ::strum D-DU-UDU bpm=70 chords=G,C            ::pick p-i-m-a chord=Am bpm=60
//   ::rasgueado four chord=E                      ::hand left | right | both
//   ::mistake finger-flat  ::trouble buzzing      ::scale am-pentatonic
//   ::fretboard 6:0,6:1,6:3 names from=0 to=5     ::guitar   ::posture   ::bend
//   ::tip ...   ::flamenco ...   ::warn ...       ::listen Em | notes=40,45
//   ::metronome bpm=60     ::song tom-dooley      ::tab ... ::end
import { Fragment, ReactNode } from 'react';
import { chordById } from '../content';
import { ChordDiagram, FingerLegend } from './ChordDiagram';
import { ChordChange } from './ChordChange';
import { BuildChord } from './BuildChord';
import { StrumPattern } from './StrumPattern';
import { PickingPattern } from './PickingPattern';
import { LeftHand, RightHand, Rasgueado } from './Hands';
import { MistakeVisual } from './Mistakes';
import { Fretboard, ScaleBox } from './Fretboard';
import { TabView } from './Tab';
import { GuitarParts, Posture, BendVisual } from './Illustrations';
import { Metronome } from './Metronome';
import { TroubleLink } from '../screens/Help';
import { playChord, playNote } from '../audio/sounds';
import { useStore } from '../ui';

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) out.push(<strong key={k++}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) out.push(<code key={k++}>{t.slice(1, -1)}</code>);
    else out.push(<em key={k++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function opts(parts: string[]) {
  const o: Record<string, string> = {};
  const rest: string[] = [];
  for (const p of parts) { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i)] = p.slice(i + 1); else rest.push(p); }
  return { o, rest };
}

function Directive({ name, args, block }: { name: string; args: string; block?: string }) {
  const { settings } = useStore();
  const { o, rest } = opts(args.split(/\s+/).filter(Boolean));
  try {
    switch (name) {
      case 'chord':
        return <div className="lesson-visual chord-row">{rest.map(id => <ChordDiagram key={id} chord={chordById(id)} view={settings.diagramView} width={rest.length > 2 ? 170 : 220} />)}<FingerLegend /></div>;
      case 'build': return <div className="lesson-visual"><BuildChord chord={chordById(rest[0])} /></div>;
      case 'change': return <div className="lesson-visual center"><ChordChange from={chordById(rest[0])} to={chordById(rest[1])} /></div>;
      case 'strum': return <div className="lesson-visual"><StrumPattern pattern={rest[0]} bpm={+(o.bpm ?? 70)} chords={(o.chords ?? 'G').split(',')} beatsPerBar={+(o.beats ?? 4)} title={o.title?.replace(/_/g, ' ')} /></div>;
      case 'pick': return <div className="lesson-visual"><PickingPattern pattern={rest.join(' ')} chord={o.chord ?? 'Am'} bpm={+(o.bpm ?? 60)} notesPerBeat={+(o.per ?? 2)} /></div>;
      case 'rasgueado': return <div className="lesson-visual center"><Rasgueado kind={(rest[0] as 'four') ?? 'four'} chord={o.chord ?? 'E'} /></div>;
      case 'hand': return <div className="lesson-visual hand-pair">{rest[0] !== 'right' && <LeftHand />}{rest[0] !== 'left' && <RightHand />}</div>;
      case 'mistake': return <div className="lesson-visual">{rest.map(id => <MistakeVisual key={id} id={id} />)}</div>;
      case 'trouble': return <div className="lesson-visual">{rest.map(id => <TroubleLink key={id} id={id} />)}</div>;
      case 'scale': return <div className="lesson-visual"><ScaleBox id={rest[0]} /></div>;
      case 'fretboard': {
        const marks = rest.filter(r => /^\d:\d+/.test(r)).map(r => { const [s, f, label] = r.split(':'); return { string: +s, fret: +f, label }; });
        return <div className="lesson-visual"><Fretboard from={+(o.from ?? 0)} to={+(o.to ?? 5)} marks={marks} showNames={rest.includes('names')} /></div>;
      }
      case 'guitar': return <div className="lesson-visual"><GuitarParts /></div>;
      case 'posture': return <div className="lesson-visual"><Posture /></div>;
      case 'bend': return <div className="lesson-visual"><BendVisual /></div>;
      case 'metronome': return <div className="lesson-visual"><Metronome initialBpm={+(o.bpm ?? 60)} compact /></div>;
      case 'tab': return <div className="lesson-visual"><TabView text={block ?? ''} bpm={+(o.bpm ?? 70)} notesPerBeat={+(o.per ?? 2)} title={o.title?.replace(/_/g, ' ')} /></div>;
      case 'listen': {
        const label = o.label?.replace(/_/g, ' ');
        if (o.notes) {
          const notes = o.notes.split(',').map(Number);
          return <button className="btn small listen-btn" onClick={() => notes.forEach((n, i) => setTimeout(() => playNote(n), i * 420))}>▶ {label ?? 'Listen'}</button>;
        }
        return <span className="listen-row">{rest.map(id => <button key={id} className="btn small listen-btn" onClick={() => playChord(chordById(id))}>▶ {label ?? `Hear ${id}`}</button>)}</span>;
      }
      case 'song': return <a className="song-link" href={`#songs/${rest[0]}`}>♫ Open the play-along: {rest[0]}</a>;
      case 'tip': case 'flamenco': case 'warn': case 'goal':
        return <div className={`callout c-${name}`}><span className="c-label">{{ tip: 'Tip', flamenco: 'Flamenco corner', warn: 'Careful', goal: 'Goal songs' }[name]}</span> {inline(args)}</div>;
      default: return <p className="error">Unknown visual "{name}"</p>;
    }
  } catch (e) {
    return <p className="error">Couldn't show "{name} {args}": {(e as Error).message}</p>;
  }
}

export function LessonBody({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (para.length) { blocks.push(<p key={blocks.length}>{inline(para.join(' '))}</p>); para = []; }
    if (list) {
      const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>);
      blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
      list = null;
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) { flush(); continue; }
    if (t.startsWith('::')) {
      flush();
      const [name, ...rest] = t.slice(2).split(' ');
      let block: string | undefined;
      if (name === 'tab') {
        const body: string[] = [];
        while (++i < lines.length && lines[i].trim() !== '::end') body.push(lines[i]);
        block = body.join('\n');
      }
      blocks.push(<Directive key={blocks.length} name={name} args={rest.join(' ')} block={block} />);
      continue;
    }
    const h = t.match(/^(#{2,3})\s+(.*)$/);
    if (h) { flush(); blocks.push(h[1].length === 2 ? <h2 key={blocks.length}>{inline(h[2])}</h2> : <h3 key={blocks.length}>{inline(h[2])}</h3>); continue; }
    const li = t.match(/^(-|\d+\.)\s+(.*)$/);
    if (li) {
      if (para.length) { blocks.push(<p key={blocks.length}>{inline(para.join(' '))}</p>); para = []; }
      const ordered = li[1] !== '-';
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push(li[2]);
      continue;
    }
    if (list) flush();
    para.push(t);
  }
  flush();
  return <div className="lesson-body">{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
