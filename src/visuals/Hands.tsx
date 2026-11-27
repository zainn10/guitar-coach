// Hand diagrams: left-hand finger numbers (1-4) and right-hand letters (p-i-m-a),
// in the same colours used everywhere else in the app.
import { useEffect, useState } from 'react';
import { playChord } from '../audio/sounds';
import { chordById } from '../content';

function Finger({ x, y, len, angle, w = 26, label, color, lit }: { x: number; y: number; len: number; angle: number; w?: number; label: string; color: string; lit?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <rect x={-w / 2} y={-len} width={w} height={len + 14} rx={w / 2} fill="var(--skin)" stroke="var(--skin-edge)" strokeWidth={1.5} />
      <line x1={-w / 2 + 5} x2={w / 2 - 5} y1={-len * 0.42} y2={-len * 0.42} stroke="var(--skin-edge)" strokeWidth={1} opacity={0.5} />
      <line x1={-w / 2 + 5} x2={w / 2 - 5} y1={-len * 0.72} y2={-len * 0.72} stroke="var(--skin-edge)" strokeWidth={1} opacity={0.5} />
      <circle cx={0} cy={-len + 12} r={lit ? 15 : 13} fill={color} stroke="var(--bg)" strokeWidth={2} />
      <text x={0} y={-len + 17} textAnchor="middle" fontSize={14} fontWeight={800} fill="#fff">{label}</text>
    </g>
  );
}

export function LeftHand({ highlight }: { highlight?: number }) {
  // palm facing you, as if you held your left hand up in front of your face
  return (
    <figure className="hand-fig">
      <svg viewBox="0 0 220 250" role="img" aria-label="Left hand, palm facing you: index finger is 1, middle 2, ring 3, little 4. The thumb has no number.">
        <path d="M58 140 q-4 70 40 92 q34 12 62 -4 q30 -18 30 -60 l2 -40 z" fill="var(--skin)" stroke="var(--skin-edge)" strokeWidth={1.5} />
        <Finger x={70} y={140} len={62} angle={-12} w={23} label="4" color="var(--f4)" lit={highlight === 4} />
        <Finger x={96} y={132} len={84} angle={-4} label="3" color="var(--f3)" lit={highlight === 3} />
        <Finger x={124} y={130} len={92} angle={2} label="2" color="var(--f2)" lit={highlight === 2} />
        <Finger x={152} y={134} len={84} angle={9} label="1" color="var(--f1)" lit={highlight === 1} />
        <g transform="translate(184 186) rotate(52)"><rect x={-13} y={-60} width={27} height={70} rx={13} fill="var(--skin)" stroke="var(--skin-edge)" strokeWidth={1.5} /><text x={0} y={-36} textAnchor="middle" fontSize={12} fill="var(--skin-edge)" fontWeight={700}>T</text></g>
      </svg>
      <figcaption><strong>Left hand</strong> (presses the strings): 1 index · 2 middle · 3 ring · 4 little. The thumb (T) stays behind the neck.</figcaption>
    </figure>
  );
}

export function RightHand({ highlight }: { highlight?: string }) {
  const col = (f: string) => `var(--r${f})`;
  return (
    <figure className="hand-fig">
      <svg viewBox="0 0 220 250" role="img" aria-label="Right hand, palm facing you: thumb is p, index i, middle m, ring a. The little finger is e, used in flamenco rasgueado.">
        <path d="M60 138 q-2 70 30 92 q36 14 64 -2 q34 -20 32 -60 l-2 -32 z" fill="var(--skin)" stroke="var(--skin-edge)" strokeWidth={1.5} />
        <g transform="translate(38 188) rotate(-52)"><rect x={-13} y={-62} width={27} height={72} rx={13} fill="var(--skin)" stroke="var(--skin-edge)" strokeWidth={1.5} /><circle cx={0} cy={-50} r={highlight === 'p' ? 15 : 13} fill={col('p')} stroke="var(--bg)" strokeWidth={2} /><text x={0} y={-45} textAnchor="middle" fontSize={14} fontWeight={800} fill="#fff" transform="rotate(52 0 -50)">p</text></g>
        <Finger x={72} y={134} len={84} angle={-9} label="i" color={col('i')} lit={highlight === 'i'} />
        <Finger x={100} y={130} len={92} angle={-2} label="m" color={col('m')} lit={highlight === 'm'} />
        <Finger x={128} y={132} len={84} angle={4} label="a" color={col('a')} lit={highlight === 'a'} />
        <Finger x={154} y={140} len={62} angle={12} w={23} label="e" color={col('e')} lit={highlight === 'e'} />
      </svg>
      <figcaption><strong>Right hand</strong> (plays the strings): p thumb · i index · m middle · a ring · e little (flamenco). The letters come from the Spanish names: pulgar, índice, medio, anular.</figcaption>
    </figure>
  );
}

const RASG: Record<string, { seq: string[]; label: string }> = {
  four: { seq: ['e', 'a', 'm', 'i'], label: '4-stroke rasgueado (e-a-m-i)' },
  three: { seq: ['a', 'm', 'i'], label: '3-stroke rasgueado (a-m-i)' },
  i: { seq: ['i↓', 'i↑'], label: 'Index down-up (i)' },
};

/** Rasgueado: fingers flick out one after another from a loose fist, each one striking the strings. */
export function Rasgueado({ kind = 'four', chord = 'E' }: { kind?: 'four' | 'three' | 'i'; chord?: string }) {
  const r = RASG[kind];
  const [step, setStep] = useState(-1);
  const [speed, setSpeed] = useState(1);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    let i = 0;
    const gap = 420 / speed;
    const id = setInterval(() => {
      const k = i % (r.seq.length + 2);
      if (k < r.seq.length) {
        setStep(k);
        playChord(chordById(chord), { dir: r.seq[k].includes('↑') ? 'up' : 'down', gain: 0.22, spreadMs: 6 });
      } else setStep(-1);
      i++;
    }, gap);
    return () => clearInterval(id);
  }, [running, speed, r, chord]);
  const fingers = ['e', 'a', 'm', 'i'];
  const curF = step >= 0 ? r.seq[step][0] : null;
  return (
    <figure className="rasg">
      <figcaption><strong>{r.label}</strong></figcaption>
      <svg viewBox="0 0 260 170" role="img" aria-label={`${r.label}: the fingers flick out one after another, each striking the strings downwards.`}>
        {[0, 1, 2, 3, 4, 5].map(i => <line key={i} x1={20} x2={240} y1={120 + i * 7} y2={120 + i * 7} stroke={curF ? 'var(--f1)' : 'var(--string)'} strokeWidth={2.2 - i * 0.25} />)}
        <path d="M60 30 q70 -24 140 0 q18 34 -4 60 q-66 18 -132 0 q-22 -28 -4 -60 z" fill="var(--skin)" stroke="var(--skin-edge)" strokeWidth={1.5} />
        {fingers.map((f, i) => {
          const out = curF === f || (r.seq.length && step >= 0 && r.seq.slice(0, step).some(s => s[0] === f) && kind !== 'i');
          const x = 92 + i * 26;
          // curled: a short knuckle stub tucked under the palm; flicked: finger extended down onto the strings
          const dur = `${120 / speed}ms`;
          return (
            <g key={f}>
              <rect x={x - 10} y={74} width={20} height={56} rx={10} fill="var(--skin)" stroke="var(--skin-edge)" strokeWidth={1.5}
                style={{ transform: `scaleY(${out ? 1 : 0.32})`, transformOrigin: `${x}px 74px`, transformBox: 'view-box', transition: `transform ${dur} ease-out` }} />
              <g style={{ transform: `translateY(${out ? 0 : -36}px)`, transition: `transform ${dur} ease-out` }}>
                <circle cx={x} cy={120} r={9} fill={`var(--r${f})`} />
                <text x={x} y={124} textAnchor="middle" fontSize={11} fontWeight={800} fill="#fff">{f}</text>
              </g>
            </g>
          );
        })}
        {curF && <text x={230} y={100} fontSize={28} fill="var(--f1)" fontWeight={800}>{r.seq[step].includes('↑') ? '↑' : '↓'}</text>}
      </svg>
      <div className="row wrap center-row">
        <button className="btn primary small" onClick={() => { setRunning(v => !v); setStep(-1); }}>{running ? '■ Stop' : '▶ Play'}</button>
        <label className="small">Speed <input type="range" min={0.5} max={3} step={0.25} value={speed} onChange={e => setSpeed(+e.target.value)} /> {speed}×</label>
      </div>
      <p className="small muted center">Fingers start curled into the palm and flick out one at a time, nail first, each one striking all the strings.</p>
    </figure>
  );
}
