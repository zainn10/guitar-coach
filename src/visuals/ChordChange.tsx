// Chord change animation: fingers travel from one shape to the next.
// Fingers that stay exactly where they are ("anchors") get a gold ring;
// fingers that slide along the same string ("guide fingers") get a dashed ring.
import { useEffect, useState } from 'react';
import { ChordShape, chordStrings, STRING_SHORT, ordinal } from '../audio/notes';
import { FINGER_NAMES } from './ChordDiagram';
import { playChord } from '../audio/sounds';

type Pos = { string: number; fret: number } | null;

function fingerPositions(c: ChordShape): Record<number, Pos> {
  const out: Record<number, Pos> = { 1: null, 2: null, 3: null, 4: null };
  for (const s of chordStrings(c)) if (s.finger && s.fret) out[s.finger] = out[s.finger] ?? { string: s.string, fret: s.fret };
  for (const b of c.barres ?? []) out[b.finger] = { string: b.from, fret: b.fret };
  return out;
}

export function describeChange(a: ChordShape, b: ChordShape) {
  const pa = fingerPositions(a), pb = fingerPositions(b);
  const lines: { finger: number; kind: 'anchor' | 'guide' | 'move' | 'lift' | 'add'; text: string }[] = [];
  const barreOf = (c: ChordShape, f: number) => (c.barres ?? []).find(b => b.finger === f);
  for (const f of [1, 2, 3, 4]) {
    const x = pa[f], y = pb[f];
    const name = FINGER_NAMES[f].toLowerCase();
    const bb = barreOf(b, f), ba = barreOf(a, f);
    if (bb && !(ba && ba.fret === bb.fret && ba.from === bb.from)) {
      lines.push({ finger: f, kind: x && x.fret === bb.fret ? 'guide' : 'move', text: `Lay your ${name} finger flat across strings ${bb.from} to ${bb.to} at fret ${bb.fret} (a barre), right behind the fret wire.` });
      continue;
    }
    if (x && y && x.string === y.string && x.fret === y.fret) lines.push({ finger: f, kind: 'anchor', text: `Your ${name} finger stays put (${ordinal(x.string)} string, fret ${x.fret}). Keep it pressed down as you change; it's your anchor.` });
    else if (x && y && x.string === y.string) lines.push({ finger: f, kind: 'guide', text: `Your ${name} finger slides along the ${ordinal(x.string)} string from fret ${x.fret} to fret ${y.fret}. Keep it touching the string lightly as a guide.` });
    else if (x && y) lines.push({ finger: f, kind: 'move', text: `Your ${name} finger moves from the ${ordinal(x.string)} string (fret ${x.fret}) to the ${ordinal(y.string)} string (fret ${y.fret}).` });
    else if (x && !y) lines.push({ finger: f, kind: 'lift', text: `Lift your ${name} finger off.` });
    else if (!x && y) lines.push({ finger: f, kind: 'add', text: `Place your ${name} finger on the ${ordinal(y.string)} string, fret ${y.fret}.` });
  }
  return lines;
}

export function ChordChange({ from, to, width = 300 }: { from: ChordShape; to: ChordShape; width?: number }) {
  const [showB, setShowB] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [slow, setSlow] = useState(true);
  const holdMs = slow ? 1700 : 1000;
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setShowB(v => !v), holdMs + (slow ? 900 : 450));
    return () => clearInterval(id);
  }, [playing, holdMs, slow]);

  const pa = fingerPositions(from), pb = fingerPositions(to);
  const lines = describeChange(from, to);
  const kindOf = (f: number) => lines.find(l => l.finger === f)?.kind;
  const cur = showB ? to : from;
  const allFrets = [...Object.values(pa), ...Object.values(pb)].filter(Boolean).map(p => p!.fret);
  const maxFret = Math.max(4, ...allFrets);
  const minFret = Math.min(...allFrets, 1);
  const base = maxFret <= 4 ? 1 : minFret;
  const nFrets = Math.max(4, maxFret - base + 1);
  const W = 250, L = 52, R = 22, T = 44, fh = 50, H = T + nFrets * fh + 36;
  const sp = (W - L - R) / 5;
  const xs = (str: number) => L + (6 - str) * sp;
  const y = (fret: number) => T + (fret - base + 0.5) * fh;
  const dur = slow ? 900 : 450;

  return (
    <figure className="chord-change">
      <figcaption>
        <span className={`cc-name ${!showB ? 'on' : ''}`}>{from.id}</span>
        <span className="cc-arrow" aria-hidden>→</span>
        <span className={`cc-name ${showB ? 'on' : ''}`}>{to.id}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Animation of fingers moving from ${from.name} to ${to.name}. ${lines.map(l => l.text).join(' ')}`}>
        {Array.from({ length: nFrets + 1 }, (_, i) => (
          <line key={i} x1={L} x2={W - R} y1={T + i * fh} y2={T + i * fh} stroke={i === 0 && base === 1 ? 'var(--fg)' : 'var(--fret)'} strokeWidth={i === 0 && base === 1 ? 7 : 2} strokeLinecap="round" />
        ))}
        {Array.from({ length: nFrets }, (_, i) => <text key={`n${i}`} x={L - 30} y={y(base + i) + 5} textAnchor="middle" fontSize={13} fill="var(--muted)">{base + i}</text>)}
        {[6, 5, 4, 3, 2, 1].map(s => <line key={s} x1={xs(s)} x2={xs(s)} y1={T} y2={T + nFrets * fh} stroke="var(--string)" strokeWidth={0.9 + s * 0.35} />)}
        {chordStrings(cur).map(s => {
          const x = xs(s.string), yy = T - 20;
          if (s.fret === 0) return <circle key={`o${s.string}`} cx={x} cy={yy} r={8} fill="none" stroke="var(--fg)" strokeWidth={2.2} className="fade-in" />;
          if (s.fret === null) return <g key={`x${s.string}`} stroke="var(--muted)" strokeWidth={2.4} strokeLinecap="round" className="fade-in"><line x1={x - 7} y1={yy - 7} x2={x + 7} y2={yy + 7} /><line x1={x + 7} y1={yy - 7} x2={x - 7} y2={yy + 7} /></g>;
          return null;
        })}
        {[1, 2, 3, 4].map(f => {
          const target = showB ? pb[f] : pa[f];
          const other = showB ? pa[f] : pb[f];
          const p = target ?? other;
          if (!p) return null;
          const k = kindOf(f);
          const r = sp * 0.4;
          return (
            <g key={f} style={{ transform: `translate(${xs(p.string)}px, ${y(p.fret)}px)`, transition: `transform ${dur}ms cubic-bezier(.45,0,.25,1), opacity ${dur * 0.6}ms`, opacity: target ? 1 : 0 }}>
              {k === 'anchor' && <circle r={r + 7} fill="none" stroke="var(--gold)" strokeWidth={3.5} />}
              {k === 'guide' && <circle r={r + 7} fill="none" stroke="var(--gold)" strokeWidth={2.5} strokeDasharray="4 3" />}
              <circle r={r} fill={`var(--f${f})`} stroke="var(--bg)" strokeWidth={2} />
              <text y={r * 0.38} textAnchor="middle" fontSize={r * 1.05} fontWeight={700} fill="#fff">{f}</text>
            </g>
          );
        })}
        {[6, 5, 4, 3, 2, 1].map(s => <text key={`l${s}`} x={xs(s)} y={T + nFrets * fh + 22} textAnchor="middle" fontSize={14} fontWeight={600} fill="var(--muted)">{STRING_SHORT[s]}</text>)}
      </svg>
      <div className="row wrap center-row">
        <button className="btn small" onClick={() => setPlaying(p => !p)}>{playing ? '❚❚ Pause' : '▶ Animate'}</button>
        <button className="btn small" onClick={() => { setPlaying(false); setShowB(v => !v); }}>Show {showB ? from.id : to.id}</button>
        <button className="btn small" onClick={() => setSlow(s => !s)}>{slow ? 'Faster' : 'Slower'}</button>
        <button className="btn small" onClick={async () => { await playChord(from); setTimeout(() => playChord(to), 1100); }}>▶ Hear it</button>
      </div>
      <ul className="cc-lines">
        {lines.map(l => (
          <li key={l.finger} className={`k-${l.kind}`}>
            <span className="swatch" style={{ background: `var(--f${l.finger})` }}>{l.finger}</span>
            <span>{l.text}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
