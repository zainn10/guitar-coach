// Tab view: six lines = six strings (thin E at the TOP, as if you looked down at the guitar),
// numbers = which fret to press. Plays back with sound and a moving cursor.
import { useState } from 'react';
import { OPEN_STRING_MIDI, STRING_SHORT } from '../audio/notes';
import { playNote } from '../audio/sounds';

const LINE_ORDER = ['e', 'B', 'G', 'D', 'A', 'E'];
export interface TabEvent { notes: { string: number; fret: number }[]; col: number }

/** Reads plain-text tab (lines like "e|--0--3--|"). */
export function parseTab(text: string): TabEvent[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => /^[eBGDAE]\|/.test(l));
  if (lines.length !== 6) return [];
  const bodies = lines.map(l => l.slice(2));
  const len = Math.max(...bodies.map(b => b.length));
  const events: TabEvent[] = [];
  for (let c = 0; c < len; c++) {
    const notes: { string: number; fret: number }[] = [];
    bodies.forEach((b, i) => {
      const ch = b[c];
      if (ch && /\d/.test(ch) && !/\d/.test(b[c - 1] ?? '')) {
        const num = /\d/.test(b[c + 1] ?? '') ? +(ch + b[c + 1]) : +ch;
        notes.push({ string: i + 1, fret: num });
      }
    });
    if (notes.length) events.push({ notes, col: c });
  }
  return events;
}

export function TabView({ text, bpm = 70, notesPerBeat = 2, title }: { text: string; bpm?: number; notesPerBeat?: number; title?: string }) {
  const events = parseTab(text);
  const [cur, setCur] = useState(-1);
  const lines = text.split('\n').map(l => l.trim()).filter(l => /^[eBGDAE]\|/.test(l));
  const len = Math.max(0, ...lines.map(l => l.length - 2));
  const cw = 12, L = 28, T = 18, gap = 18;
  const W = L + len * cw + 12, H = T + gap * 5 + 20;
  const play = () => {
    const step = (60 / bpm / notesPerBeat) * 1000;
    events.forEach((ev, i) => setTimeout(() => {
      setCur(i);
      ev.notes.forEach(n => playNote(OPEN_STRING_MIDI[n.string] + n.fret, undefined, 0.32, 0.8));
      if (i === events.length - 1) setTimeout(() => setCur(-1), step);
    }, i * step));
  };
  return (
    <figure className="tab-view">
      {title && <figcaption><strong>{title}</strong></figcaption>}
      <div className="pick-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: Math.min(W, 700) }} role="img" aria-label={`Tab: ${events.map(e => e.notes.map(n => `string ${n.string} fret ${n.fret}`).join(' + ')).join(', ')}`}>
          {LINE_ORDER.map((n, i) => (
            <g key={n + i}>
              <text x={6} y={T + i * gap + 5} fontSize={13} fontWeight={700} fill="var(--muted)">{STRING_SHORT[i + 1]}</text>
              <line x1={L - 6} x2={W - 6} y1={T + i * gap} y2={T + i * gap} stroke="var(--string)" strokeWidth={1.2} />
            </g>
          ))}
          {lines.map((l, i) => {
            const body = l.slice(2);
            return [...body].map((ch, c) => ch === '|' ? <line key={`${i}-${c}`} x1={L + c * cw} x2={L + c * cw} y1={T} y2={T + 5 * gap} stroke="var(--fret)" strokeWidth={1.5} /> : null);
          })}
          {events.map((ev, i) => ev.notes.map(n => (
            <g key={`${i}-${n.string}`}>
              <rect x={L + ev.col * cw - 2} y={T + (n.string - 1) * gap - 9} width={n.fret > 9 ? 20 : 14} height={18} rx={4} fill={cur === i ? 'var(--f1)' : 'var(--surface)'} />
              <text x={L + ev.col * cw + (n.fret > 9 ? 8 : 5)} y={T + (n.string - 1) * gap + 5} textAnchor="middle" fontSize={14} fontWeight={800} fill={cur === i ? '#fff' : 'var(--fg)'} style={{ fontVariantNumeric: 'tabular-nums' }}>{n.fret}</text>
            </g>
          )))}
        </svg>
      </div>
      <div className="row wrap"><button className="btn small" onClick={play}>▶ Play it</button><span className="small muted">Top line = thinnest string. Numbers = frets (0 = open).</span></div>
    </figure>
  );
}
