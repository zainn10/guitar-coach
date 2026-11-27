// Fingerpicking pattern (p-i-m-a): which finger plucks which string, in order, animated with sound.
import { useEffect, useRef, useState } from 'react';
import { startLoop, Loop } from '../audio/scheduler';
import { playNote } from '../audio/sounds';
import { chordById } from '../content';
import { chordStrings, STRING_SHORT } from '../audio/notes';

export const RH_FINGERS: Record<string, { name: string; color: string }> = {
  p: { name: 'thumb (p)', color: 'var(--rp)' }, i: { name: 'index (i)', color: 'var(--ri)' },
  m: { name: 'middle (m)', color: 'var(--rm)' }, a: { name: 'ring (a)', color: 'var(--ra)' }, e: { name: 'little (e)', color: 'var(--re)' },
};

/** Default strings: thumb on the chord's lowest note, i-m-a on strings 3-2-1. "p4" forces a string. */
export function parsePicking(pattern: string, chordId: string) {
  const ch = chordById(chordId);
  const lowest = chordStrings(ch).find(s => s.midi !== null)!.string;
  return pattern.trim().split(/[\s-]+/).filter(Boolean).map(tok => {
    const fingers = tok.match(/[pimae]\d?/g) ?? [];
    return fingers.map(f => {
      const finger = f[0];
      const forced = f.length > 1 ? +f[1] : undefined;
      const string = forced ?? (finger === 'p' ? lowest : finger === 'i' ? 3 : finger === 'm' ? 2 : finger === 'a' ? 1 : 1);
      const s = chordStrings(ch).find(x => x.string === string)!;
      return { finger, string, midi: s.midi ?? 40 + [0, 24, 19, 15, 10, 5, 0][string] };
    });
  });
}

export function PickingPattern({ pattern, chord = 'Am', bpm: initialBpm = 60, notesPerBeat = 2 }: { pattern: string; chord?: string; bpm?: number; notesPerBeat?: number }) {
  const steps = parsePicking(pattern, chord);
  const [bpm, setBpm] = useState(initialBpm);
  const [cur, setCur] = useState(-1);
  const [running, setRunning] = useState(false);
  const loop = useRef<Loop | null>(null);
  useEffect(() => () => loop.current?.stop(), []);
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const draw = () => { const l = loop.current; if (l) setCur(l.current()); raf = requestAnimationFrame(draw); };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  const start = async () => {
    loop.current?.stop();
    loop.current = await startLoop({ bpm, slotsPerBeat: notesPerBeat, schedule: (i, t) => { for (const n of steps[i % steps.length]) playNote(n.midi, t, n.finger === 'p' ? 0.38 : 0.28); } });
    setRunning(true);
  };
  const stop = () => { loop.current?.stop(); loop.current = null; setRunning(false); setCur(-1); };
  const pos = cur < 0 ? -1 : cur % steps.length;
  const W = Math.max(320, 70 + steps.length * 52), T = 22, gap = 22, H = T + gap * 5 + 30;
  const x = (i: number) => 60 + i * 52;
  return (
    <figure className="picking">
      <div className="pick-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: Math.min(W, 640) }} role="img" aria-label={`Picking pattern on ${chord}: ${steps.map(s => s.map(n => `${n.finger} on string ${n.string}`).join(' and ')).join(', then ')}`}>
          {[1, 2, 3, 4, 5, 6].map(s => (
            <g key={s}>
              <text x={14} y={T + (s - 1) * gap + 5} fontSize={13} fontWeight={600} fill="var(--muted)">{STRING_SHORT[s]}</text>
              <line x1={32} x2={W - 10} y1={T + (s - 1) * gap} y2={T + (s - 1) * gap} stroke="var(--string)" strokeWidth={0.8 + s * 0.3} className={pos >= 0 && steps[pos]?.some(n => n.string === s) ? 'vibrate' : ''} />
            </g>
          ))}
          {steps.map((st, i) => st.map(n => (
            <g key={`${i}-${n.string}`} style={{ transform: pos === i ? 'scale(1.18)' : undefined, transformOrigin: `${x(i)}px ${T + (n.string - 1) * gap}px`, transition: 'transform 80ms' }}>
              <circle cx={x(i)} cy={T + (n.string - 1) * gap} r={11} fill={RH_FINGERS[n.finger].color} opacity={pos < 0 || pos === i ? 1 : 0.55} />
              <text x={x(i)} y={T + (n.string - 1) * gap + 4.5} textAnchor="middle" fontSize={13} fontWeight={800} fill="#fff">{n.finger}</text>
            </g>
          )))}
          {steps.map((_, i) => <text key={`c${i}`} x={x(i)} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">{i % notesPerBeat === 0 ? i / notesPerBeat + 1 : '&'}</text>)}
        </svg>
      </div>
      <div className="row wrap center-row">
        {running ? <button className="btn primary small" onClick={stop}>■ Stop</button> : <button className="btn primary small" onClick={start}>▶ Play ({chord})</button>}
        <label className="small">Tempo <input type="range" min={30} max={140} value={bpm} onChange={e => { setBpm(+e.target.value); if (running) stop(); }} /> {bpm} bpm</label>
      </div>
      <ul className="rh-legend">{['p', 'i', 'm', 'a'].map(f => <li key={f}><span className="swatch" style={{ background: RH_FINGERS[f].color }}>{f}</span>{RH_FINGERS[f].name}</li>)}</ul>
    </figure>
  );
}
