// Strumming pattern: arrows timed to the beat, an animated strumming hand that
// keeps moving down-up like a pendulum (touching the strings only on the arrows),
// and the actual sound so you can hear the rhythm.
import { useEffect, useRef, useState } from 'react';
import { startLoop, Loop } from '../audio/scheduler';
import { playChord, playClick, playChuck } from '../audio/sounds';
import { chordById } from '../content';

export function countLabels(slots: number, beatsPerBar = 4) {
  const per = slots / beatsPerBar;
  return Array.from({ length: slots }, (_, i) => {
    const b = Math.floor(i / per) + 1;
    const sub = i % per;
    if (sub === 0) return String(b);
    if (per === 2) return '&';
    return ['', 'e', '&', 'a'][sub] ?? '';
  });
}

export function StrumPattern({ pattern, bpm: initialBpm = 70, chords = ['G'], beatsPerBar = 4, title }: { pattern: string; bpm?: number; chords?: string[]; beatsPerBar?: number; title?: string }) {
  const slots = pattern.replace(/\s/g, '').split('');
  const labels = countLabels(slots.length, beatsPerBar);
  const [bpm, setBpm] = useState(initialBpm);
  const [cur, setCur] = useState(-1);
  const [running, setRunning] = useState(false);
  const [clicks, setClicks] = useState(true);
  const loop = useRef<Loop | null>(null);
  const per = slots.length / beatsPerBar;

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
    loop.current = await startLoop({
      bpm, slotsPerBeat: per,
      schedule: (i, t) => {
        const s = slots[i % slots.length];
        const bar = Math.floor(i / slots.length);
        const chord = chordById(chords[bar % chords.length]);
        if (clicks && i % per === 0) playClick(t, i % slots.length === 0);
        if (s === 'D' || s === 'U') playChord(chord, { when: t, dir: s === 'D' ? 'down' : 'up', gain: s === 'D' ? 0.28 : 0.16, spreadMs: s === 'D' ? 14 : 8 });
        if (s === 'X') playChuck(t);
      },
    });
    setRunning(true);
  };
  const stop = () => { loop.current?.stop(); loop.current = null; setRunning(false); setCur(-1); };

  const pos = cur < 0 ? -1 : cur % slots.length;
  // hand position: down-strokes on the beat (and on "&" in 16ths it alternates); pendulum
  const handDown = pos >= 0 ? pos % 2 === 0 : false;
  const hitting = pos >= 0 && (slots[pos] === 'D' || slots[pos] === 'U');

  return (
    <figure className="strum-pattern">
      {title && <figcaption>{title}</figcaption>}
      <div className="sp-wrap">
        <svg className="sp-hand" viewBox="0 0 90 150" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map(i => <line key={i} x1={12 + i * 13} x2={12 + i * 13} y1={20} y2={130} stroke={hitting ? 'var(--f1)' : 'var(--string)'} strokeWidth={2.6 - i * 0.3} className={hitting ? 'vibrate' : ''} />)}
          <g style={{ transform: `translateY(${pos < 0 ? 0 : handDown ? 70 : 0}px)`, transition: `transform ${(60 / bpm / per) * 1000 * 0.9}ms ease-in-out` }}>
            <path d="M5 30 q40 -14 80 0 l-4 14 q-36 -10 -72 0 z" fill="var(--skin)" stroke="var(--skin-edge)" strokeWidth={1.5} />
            <path d="M40 38 l8 18 l8 -18 z" fill="var(--pick)" />
          </g>
        </svg>
        <div className="sp-grid" style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }}>
          {slots.map((s, i) => (
            <div key={i} className={`sp-cell ${pos === i ? 'now' : ''} ${i % per === 0 ? 'on-beat' : ''}`}>
              <span className={`sp-arrow ${s === 'D' ? 'down' : s === 'U' ? 'up' : s === 'X' ? 'chuck' : 'ghost'}`} aria-label={s === 'D' ? 'down' : s === 'U' ? 'up' : s === 'X' ? 'mute' : 'miss'}>
                {s === 'D' ? '↓' : s === 'U' ? '↑' : s === 'X' ? '✕' : (i % 2 === 0 ? '↓' : '↑')}
              </span>
              <span className="sp-count">{labels[i]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="row wrap center-row">
        {running ? <button className="btn primary small" onClick={stop}>■ Stop</button> : <button className="btn primary small" onClick={start}>▶ Play pattern</button>}
        <label className="small">Tempo <input type="range" min={40} max={140} value={bpm} onChange={e => { setBpm(+e.target.value); if (running) stop(); }} /> {bpm} bpm</label>
        <label className="small"><input type="checkbox" checked={clicks} onChange={e => setClicks(e.target.checked)} /> Click</label>
      </div>
      <p className="small muted center">Faint arrows: your hand still moves but misses the strings. Keep the arm swinging down-up like a pendulum.</p>
    </figure>
  );
}
