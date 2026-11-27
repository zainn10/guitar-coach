// Hand diagrams: left-hand finger numbers (1-4) and right-hand letters (p-i-m-a),
// in the same colours used everywhere else in the app.
import { useEffect, useState } from 'react';
import { playChord } from '../audio/sounds';
import { chordById } from '../content';
import { Skin, Nail, Creases, Badge, fingerPath } from './Art';

// Back of the hand, as if you held it up in front of you (left hand: thumb on the right).
const HAND_FINGERS = [
  { n: 4, x: 74, y: 146, len: 58, w: 24, a: -9 },
  { n: 3, x: 99, y: 136, len: 80, w: 26, a: -3 },
  { n: 2, x: 125, y: 133, len: 90, w: 27, a: 1 },
  { n: 1, x: 151, y: 137, len: 80, w: 26, a: 6 },
];
const PALM = 'M62 150 C60 132 70 124 86 124 L158 126 C170 127 174 137 172 150 L168 204 C164 230 146 242 122 244 L104 244 C82 242 68 230 65 206 Z';
const FOREARM = 'M92 236 L140 236 L150 300 L84 300 Z';
const THUMB = { x: 160, y: 206, len: 84, w: 31, a: 40 };

function tip(x: number, y: number, len: number, a: number, back = 14) {
  const r = (a * Math.PI) / 180;
  return { x: x + Math.sin(r) * (len - back), y: y - Math.cos(r) * (len - back) };
}

function HandDrawing({ mirror, labels, colors, highlight }: { mirror: boolean; labels: Record<number | 't', string>; colors: Record<number | 't', string>; highlight?: number | 't' }) {
  const parts = [
    { d: FOREARM }, { d: PALM },
    { d: fingerPath(THUMB.len, THUMB.w), transform: `translate(${THUMB.x} ${THUMB.y}) rotate(${THUMB.a})` },
    ...HAND_FINGERS.map(f => ({ d: fingerPath(f.len + 14, f.w), transform: `translate(${f.x} ${f.y + 14}) rotate(${f.a})` })),
  ];
  const mx = (x: number) => (mirror ? 240 - x : x);
  const all = [...HAND_FINGERS.map(f => ({ key: f.n as number | 't', ...f })), { key: 't' as const, n: 0, ...THUMB }];
  return (
    <svg viewBox="0 0 240 300" aria-hidden>
      <g transform={mirror ? 'translate(240 0) scale(-1 1)' : undefined}>
        <Skin parts={parts} />
        {HAND_FINGERS.map(f => <Nail key={f.n} len={f.len + 14} w={f.w} transform={`translate(${f.x} ${f.y + 14}) rotate(${f.a})`} />)}
        <Nail len={THUMB.len} w={THUMB.w} transform={`translate(${THUMB.x} ${THUMB.y}) rotate(${THUMB.a})`} />
        {HAND_FINGERS.map(f => <Creases key={f.n} len={f.len + 14} w={f.w} transform={`translate(${f.x} ${f.y + 14}) rotate(${f.a})`} />)}
        {/* knuckles */}
        {HAND_FINGERS.map(f => <path key={`k${f.n}`} d={`M${f.x - 7} ${f.y + 16} q7 -4 14 0`} stroke="var(--skin-edge)" strokeWidth={1.2} fill="none" opacity={0.5} />)}
      </g>
      {all.map(f => {
        const p = tip(f.x, f.y + (f.key === 't' ? 0 : 14), f.len + (f.key === 't' ? 0 : 14), f.a, 30);
        if (!labels[f.key]) return null;
        return <Badge key={String(f.key)} x={mx(p.x)} y={p.y} color={colors[f.key]} label={labels[f.key]} r={highlight === f.key ? 14 : 12} />;
      })}
    </svg>
  );
}

export function LeftHand({ highlight }: { highlight?: number }) {
  return (
    <figure className="hand-fig" role="img" aria-label="Left hand, back of the hand facing you: index finger is 1, middle 2, ring 3, little 4. The thumb has no number and stays behind the neck.">
      <HandDrawing mirror={false} highlight={highlight}
        labels={{ 1: '1', 2: '2', 3: '3', 4: '4', t: 'T' }}
        colors={{ 1: 'var(--f1)', 2: 'var(--f2)', 3: 'var(--f3)', 4: 'var(--f4)', t: 'var(--muted)' }} />
      <figcaption><strong>Left hand</strong> (presses the strings): 1 index · 2 middle · 3 ring · 4 little. The thumb (T) stays behind the neck.</figcaption>
    </figure>
  );
}

export function RightHand({ highlight }: { highlight?: string }) {
  const map: Record<string, number | 't'> = { p: 't', i: 1, m: 2, a: 3, e: 4 };
  return (
    <figure className="hand-fig" role="img" aria-label="Right hand, back of the hand facing you: thumb is p, index i, middle m, ring a, little finger e.">
      <HandDrawing mirror highlight={highlight ? map[highlight] : undefined}
        labels={{ 1: 'i', 2: 'm', 3: 'a', 4: 'e', t: 'p' }}
        colors={{ 1: 'var(--ri)', 2: 'var(--rm)', 3: 'var(--ra)', 4: 'var(--re)', t: 'var(--rp)' }} />
      <figcaption><strong>Right hand</strong> (plays the strings): p thumb · i index · m middle · a ring · e little (flamenco). The letters come from Spanish: pulgar, índice, medio, anular.</figcaption>
    </figure>
  );
}

const RASG_PALM = 'M76 46 C74 24 92 12 118 12 L170 13 C192 14 202 30 200 50 L196 84 C194 96 186 100 176 100 L92 100 C82 100 77 94 77 84 Z';

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
      <svg viewBox="0 0 260 185" role="img" aria-label={`${r.label}: the fingers flick out one after another, each striking the strings downwards.`}>
        {/* guitar top and strings */}
        <rect x={0} y={128} width={260} height={52} fill="var(--wood)" opacity={0.25} rx={6} />
        {[0, 1, 2, 3, 4, 5].map(i => <line key={i} x1={0} x2={260} y1={136 + i * 7} y2={136 + i * 7} stroke={curF ? 'var(--f1)' : 'var(--string)'} strokeWidth={2.4 - i * 0.3} />)}
        {/* palm outline first, then fingers, then the palm on top: one clean silhouette */}
        <path d={RASG_PALM} fill="var(--skin-edge)" stroke="var(--skin-edge)" strokeWidth={3} />
        <g transform="translate(66 92) rotate(-28)"><path d={fingerPath(58, 24)} fill="var(--skin-edge)" stroke="var(--skin-edge)" strokeWidth={3} transform="rotate(180)" /><path d={fingerPath(58, 24)} fill="var(--skin)" transform="rotate(180)" /></g>
        {fingers.map((f, i) => {
          const out = curF === f || (kind !== 'i' && step >= 0 && r.seq.slice(0, step).some(s2 => s2[0] === f));
          const x = 106 + i * 25;
          const dur = `${110 / speed}ms`;
          return (
            <g key={f} style={{ transform: `scaleY(${out ? 1 : 0.5})`, transformOrigin: `${x}px 84px`, transformBox: 'view-box', transition: `transform ${dur} ease-out` }}>
              <g transform={`translate(${x} 84) rotate(180)`}>
                <path d={fingerPath(64, 24)} fill="var(--skin-edge)" stroke="var(--skin-edge)" strokeWidth={3} />
                <path d={fingerPath(64, 24)} fill="var(--skin)" />
                <path d="M-8 -30 q8 3 16 0" stroke="var(--skin-edge)" strokeWidth={1.2} fill="none" opacity={0.5} />
              </g>
            </g>
          );
        })}
        <path d={RASG_PALM} fill="var(--skin)" />
        {[0, 1, 2, 3].map(i => <path key={i} d={`M${98 + i * 25} 92 q8 -5 16 0`} stroke="var(--skin-edge)" strokeWidth={1.3} fill="none" opacity={0.55} />)}
        {fingers.map((f, i) => {
          const out = curF === f || (kind !== 'i' && step >= 0 && r.seq.slice(0, step).some(s2 => s2[0] === f));
          const x = 106 + i * 25;
          return (
            <g key={`b${f}`} style={{ transform: `translateY(${out ? 36 : 0}px)`, transition: `transform ${110 / speed}ms ease-out` }}>
              <Badge x={x} y={108} color={`var(--r${f})`} label={f} r={10} />
            </g>
          );
        })}
        {curF && <text x={232} y={118} fontSize={28} fill="var(--f1)" fontWeight={800}>{r.seq[step].includes('↑') ? '↑' : '↓'}</text>}
      </svg>
      <div className="row wrap center-row">
        <button className="btn primary small" onClick={() => { setRunning(v => !v); setStep(-1); }}>{running ? '■ Stop' : '▶ Play'}</button>
        <label className="small">Speed <input type="range" min={0.5} max={3} step={0.25} value={speed} onChange={e => setSpeed(+e.target.value)} /> {speed}×</label>
      </div>
      <p className="small muted center">Fingers start curled into the palm and flick out one at a time, nail first, each one striking all the strings.</p>
    </figure>
  );
}
