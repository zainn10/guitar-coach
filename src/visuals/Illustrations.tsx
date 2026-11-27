// Larger illustrations: parts of a classical guitar, sitting position, and bends.
import { useState } from 'react';
import { playNote } from '../audio/sounds';

export function GuitarParts() {
  const labels: [number, number, number, number, string][] = [
    [60, 70, 40, 30, 'Headstock & tuning pegs'], [128, 70, 128, 118, 'Nut'], [215, 70, 215, 118, 'Frets'], [300, 70, 300, 118, 'Neck'],
    [470, 46, 470, 96, 'Soundhole & rosette'], [580, 46, 568, 120, 'Body'], [520, 220, 536, 160, 'Bridge & saddle'],
  ];
  return (
    <figure className="illus">
      <svg viewBox="0 0 680 250" role="img" aria-label="Parts of a classical guitar: headstock with tuning pegs, nut, neck with frets, body with soundhole and rosette, bridge and saddle.">
        <path d="M20 112 l100 -10 l0 40 l-100 -10 z" fill="var(--wood)" />
        <rect x={38} y={112} width={60} height={8} rx={4} fill="var(--bg)" opacity={0.6} />
        {[44, 62, 80].map(x => <g key={x}><rect x={x} y={92} width={8} height={10} fill="var(--fret)" /><rect x={x} y={142} width={8} height={10} fill="var(--fret)" /></g>)}
        <rect x={120} y={104} width={6} height={36} fill="#efe6d2" />
        <rect x={126} y={106} width={300} height={32} fill="#5a3a22" />
        {Array.from({ length: 12 }, (_, i) => <rect key={i} x={126 + 300 * (1 - Math.pow(2, -(i + 1) / 12)) * 1.9} y={106} width={2.5} height={32} fill="var(--fret)" />)}
        <path d="M410 122 q0 -95 95 -95 q55 0 70 45 q15 -40 60 -35 q40 5 40 85 q0 80 -40 85 q-45 5 -60 -35 q-15 45 -70 45 q-95 0 -95 -95 z" fill="var(--wood)" stroke="#6b4423" strokeWidth={2} />
        <circle cx={470} cy={122} r={30} fill="#2b1a0e" />
        <circle cx={470} cy={122} r={38} fill="none" stroke="#e8741c" strokeWidth={5} strokeDasharray="3 3" />
        <rect x={590} y={100} width={14} height={44} rx={3} fill="#3b2414" />
        <rect x={586} y={106} width={3} height={32} fill="#efe6d2" />
        {[0, 1, 2, 3, 4, 5].map(i => <line key={i} x1={30} x2={600} y1={110 + i * 5} y2={110 + i * 5} stroke="#d8d2c4" strokeWidth={0.8 + (5 - i) * 0.25} />)}
        {labels.map(([tx, ty, px, py, t]) => (
          <g key={t}>
            <line x1={tx} y1={ty + 4} x2={px} y2={py} stroke="var(--muted)" strokeWidth={1} />
            <text x={tx} y={ty} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--fg)">{t}</text>
          </g>
        ))}
      </svg>
      <figcaption>A classical (nylon-string) guitar: wider, flatter neck than a steel-string, slotted headstock, and strings tied at the bridge.</figcaption>
    </figure>
  );
}

export function Posture() {
  const [mode, setMode] = useState<'classical' | 'casual'>('classical');
  const c = mode === 'classical';
  return (
    <figure className="illus">
      <div className="seg" role="radiogroup" aria-label="Sitting position">
        <button role="radio" aria-checked={c} className={c ? 'on' : ''} onClick={() => setMode('classical')}>Classical position</button>
        <button role="radio" aria-checked={!c} className={!c ? 'on' : ''} onClick={() => setMode('casual')}>Casual position</button>
      </div>
      <svg viewBox="0 0 360 300" role="img" aria-label={c ? 'Classical position: guitar on the left leg, left foot raised on a footstool, neck pointing up at about 45 degrees, back straight.' : 'Casual position: guitar on the right leg, neck roughly horizontal, slightly raised, back straight.'}>
        <rect x={90} y={190} width={120} height={12} rx={4} fill="var(--fret)" />
        <rect x={98} y={202} width={8} height={80} fill="var(--fret)" /><rect x={194} y={202} width={8} height={80} fill="var(--fret)" />
        <circle cx={150} cy={52} r={24} fill="var(--skin)" stroke="var(--skin-edge)" />
        <path d="M118 84 q32 -10 64 0 l10 106 l-84 0 z" fill="var(--surface-2)" stroke="var(--line)" />
        {/* legs */}
        <path d="M120 190 l-10 90 M180 190 l12 90" stroke="var(--muted)" strokeWidth={16} strokeLinecap="round" />
        {c && <rect x={176} y={270} width={44} height={14} rx={3} fill="var(--f2)" />}
        {c && <text x={232} y={282} fontSize={12} fill="var(--muted)">footstool</text>}
        {/* guitar */}
        <g transform={c ? 'translate(196 176) rotate(-42)' : 'translate(150 178) rotate(-12)'}>
          <path d="M-40 0 q0 -36 30 -36 q16 0 22 14 q6 -12 22 -12 q28 0 28 34 q0 34 -28 34 q-16 0 -22 -12 q-6 14 -22 14 q-30 0 -30 -36 z" fill="var(--wood)" stroke="#6b4423" strokeWidth={2} transform="rotate(90)" />
          <rect x={-6} y={-150} width={12} height={130} fill="#5a3a22" />
          <rect x={-9} y={-176} width={18} height={28} rx={3} fill="var(--wood)" />
        </g>
        <text x={14} y={24} fontSize={13} fill="var(--fg)" fontWeight={700}>{c ? 'Neck up at about 45°' : 'Neck roughly level'}</text>
        <text x={14} y={44} fontSize={12} fill="var(--muted)">{c ? 'Guitar on your LEFT leg' : 'Guitar on your RIGHT leg'}</text>
      </svg>
      <figcaption>{c
        ? 'The classical position gives your left hand the best reach and a straight wrist. Use a footstool (or a pile of books) under your left foot, or a support cushion on your leg.'
        : 'Fine for strumming songs. Keep your back straight and the guitar close to your body. Switch to classical position for fingerpicking and barre chords.'}</figcaption>
    </figure>
  );
}

export function BendVisual() {
  const [amount, setAmount] = useState<1 | 2>(2);
  const hear = () => {
    playNote(67, undefined, 0.3, 0.6);
    setTimeout(() => playNote(67 + amount, undefined, 0.3, 0.6), 650);
  };
  return (
    <figure className="illus">
      <svg viewBox="0 0 320 170" role="img" aria-label={`A bend: the finger pushes the string across the fret towards the ceiling, raising the pitch by ${amount === 2 ? 'a whole step (two frets)' : 'a half step (one fret)'}.`}>
        <rect x={20} y={20} width={280} height={130} rx={8} fill="var(--wood)" opacity={0.25} />
        {[40, 140, 240].map(x => <rect key={x} x={x} y={20} width={4} height={130} fill="var(--fret)" />)}
        {[0, 1, 2, 3, 4, 5].map(i => <line key={i} x1={20} x2={300} y1={36 + i * 22} y2={36 + i * 22} stroke="var(--string)" strokeWidth={0.8 + i * 0.35} opacity={i === 2 ? 0.25 : 1} />)}
        <path d={`M20 80 L190 ${80 - amount * 16} L300 80`} stroke="var(--f1)" strokeWidth={2.5} fill="none" />
        <circle cx={190} cy={80 - amount * 16} r={12} fill="var(--f3)" stroke="var(--bg)" strokeWidth={2} />
        <text x={190} y={84 - amount * 16} textAnchor="middle" fontSize={12} fontWeight={800} fill="#fff">3</text>
        <path d={`M214 80 l0 -${amount * 16}`} stroke="var(--f2)" strokeWidth={3} markerEnd="url(#arr)" />
        <defs><marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--f2)" /></marker></defs>
        <text x={226} y={70} fontSize={12} fill="var(--fg)">push up</text>
      </svg>
      <div className="row wrap center-row">
        <div className="seg"><button className={amount === 1 ? 'on' : ''} onClick={() => setAmount(1)}>Half step</button><button className={amount === 2 ? 'on' : ''} onClick={() => setAmount(2)}>Whole step</button></div>
        <button className="btn small" onClick={hear}>▶ Hear the target</button>
      </div>
      <figcaption>Bend with the ring finger, supported by the middle and index fingers behind it on the same string. Push from the wrist (like turning a door key), not just the fingertip. Aim for the pitch of the note {amount === 2 ? 'two frets' : 'one fret'} higher.</figcaption>
    </figure>
  );
}
