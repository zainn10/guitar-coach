// Larger illustrations: parts of a classical guitar, sitting position, and bends.
import { useState } from 'react';
import { playNote } from '../audio/sounds';

/** A classical guitar drawn to real proportions (650 mm scale, 12 frets to the body). */
export function GuitarParts() {
  const NUT = 153, SCALE = 455; // px from nut to saddle
  const fretX = (n: number) => NUT + SCALE * (1 - Math.pow(2, -n / 12));
  const halfW = (x: number) => 18 + ((x - NUT) / (fretX(19) - NUT)) * 5; // fingerboard half-width
  const strY = (i: number, x: number) => {
    // string i (0 = 6th/low E at the top of the picture) between nut and saddle
    const t = Math.min(1, Math.max(0, (x - NUT) / SCALE));
    const span = 29 + t * 12;
    return 150 - span / 2 + (i * span) / 5;
  };
  const saddleX = NUT + SCALE;
  const body = 'M376 150 C376 92 410 52 458 52 C492 52 512 66 530 70 C550 74 568 22 625 22 C692 22 718 82 718 150 C718 218 692 278 625 278 C568 278 550 226 530 230 C512 234 492 248 458 248 C410 248 376 208 376 150 Z';
  const labels: { t: string; x: number; y: number; px: number; py: number }[] = [
    { t: 'Headstock', x: 60, y: 28, px: 70, py: 128 },
    { t: 'Tuning pegs', x: 130, y: 278, px: 100, py: 196 },
    { t: 'Nut', x: 190, y: 28, px: 154, py: 132 },
    { t: 'Frets', x: 280, y: 28, px: fretX(5), py: 132 },
    { t: 'Neck', x: 300, y: 278, px: 300, py: 172 },
    { t: 'Soundhole & rosette', x: 470, y: 18, px: 486, py: 116 },
    { t: 'Body', x: 680, y: 18, px: 668, py: 60 },
    { t: 'Bridge & saddle', x: 640, y: 296, px: 612, py: 188 },
  ];
  return (
    <figure className="illus">
      <svg viewBox="0 0 760 305" role="img" aria-label="A classical guitar seen from the front, headstock on the left: slotted headstock with tuning pegs, the nut, the neck with metal frets, the body with a round soundhole and decorative rosette, and the bridge where the strings are tied.">
        <defs>
          <linearGradient id="gp-top" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ecd09b" /><stop offset="0.5" stopColor="#e2bd7f" /><stop offset="1" stopColor="#d3a764" />
          </linearGradient>
          <linearGradient id="gp-board" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a271a" /><stop offset="1" stopColor="#21160e" />
          </linearGradient>
          <linearGradient id="gp-head" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8a5530" /><stop offset="1" stopColor="#5e3519" />
          </linearGradient>
          <radialGradient id="gp-hole" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#1a0f08" /><stop offset="1" stopColor="#2e1b0e" /></radialGradient>
          <filter id="gp-shadow" x="-5%" y="-10%" width="110%" height="125%"><feDropShadow dx="0" dy="4" stdDeviation="5" floodOpacity="0.25" /></filter>
        </defs>

        <g filter="url(#gp-shadow)">
          {/* body with binding */}
          <path d={body} fill="#6b3d1f" />
          <path d={body} fill="url(#gp-top)" stroke="#5a3218" strokeWidth={5} />
          <path d={body} fill="none" stroke="#f3e3c3" strokeWidth={1.2} transform="translate(549 150) scale(0.975) translate(-549 -150)" opacity={0.8} />

          {/* rosette and soundhole */}
          <circle cx={486} cy={150} r={39} fill="none" stroke="#5a3218" strokeWidth={1.5} />
          <circle cx={486} cy={150} r={36} fill="none" stroke="#2f6b4f" strokeWidth={4} strokeDasharray="3 2" />
          <circle cx={486} cy={150} r={33} fill="none" stroke="#b5452b" strokeWidth={2} strokeDasharray="2 2" />
          <circle cx={486} cy={150} r={31} fill="none" stroke="#5a3218" strokeWidth={1.2} />
          <circle cx={486} cy={150} r={29} fill="url(#gp-hole)" />

          {/* neck (behind the fingerboard) and heel */}
          <path d={`M${NUT} ${150 - 20} L381 ${150 - 25} L381 ${150 + 25} L${NUT} ${150 + 20} Z`} fill="#7a4a2a" />
          {/* fingerboard runs over the top to the 19th fret */}
          <path d={`M${NUT} ${150 - halfW(NUT)} L${fretX(19)} ${150 - halfW(fretX(19))} L${fretX(19)} ${150 + halfW(fretX(19))} L${NUT} ${150 + halfW(NUT)} Z`} fill="url(#gp-board)" />
          {Array.from({ length: 19 }, (_, i) => {
            const x = fretX(i + 1);
            return <line key={i} x1={x} x2={x} y1={150 - halfW(x) + 0.5} y2={150 + halfW(x) - 0.5} stroke="#d9d6cf" strokeWidth={1.6} />;
          })}

          {/* bridge with tie block and bone saddle */}
          <path d={`M${saddleX - 10} 86 Q${saddleX - 16} 150 ${saddleX - 10} 214 L${saddleX + 26} 214 Q${saddleX + 30} 150 ${saddleX + 26} 86 Z`} fill="#3d2414" />
          <rect x={saddleX - 2} y={124} width={4} height={52} rx={1.5} fill="#f1ead9" />
          <rect x={saddleX + 12} y={120} width={12} height={60} rx={2} fill="#5a3520" />

          {/* headstock: slotted, with decorative top */}
          <path d="M153 124 L60 118 Q36 116 26 128 Q20 150 26 172 Q36 184 60 182 L153 176 Z" fill="url(#gp-head)" />
          <path d="M26 128 Q16 150 26 172" fill="none" stroke="#3d2414" strokeWidth={2} />
          {[139, 161].map(y => <rect key={y} x={48} y={y - 4} width={92} height={8} rx={4} fill="#20130a" />)}
          {[60, 88, 116].flatMap(x => [139, 161].map(y => <rect key={`${x}-${y}`} x={x - 2.5} y={y - 4} width={5} height={8} rx={1} fill="#efe6d0" />))}
          {/* tuner plates and buttons */}
          {[112, 188].map(y => <rect key={y} x={50} y={y - 2} width={80} height={4} rx={2} fill="#c9a446" />)}
          {[60, 88, 116].flatMap(x => [
            <g key={`t${x}`}><line x1={x} x2={x} y1={114} y2={104} stroke="#c9a446" strokeWidth={2} /><ellipse cx={x} cy={98} rx={6} ry={8} fill="#f4ecd8" stroke="#bda97a" /></g>,
            <g key={`b${x}`}><line x1={x} x2={x} y1={186} y2={196} stroke="#c9a446" strokeWidth={2} /><ellipse cx={x} cy={202} rx={6} ry={8} fill="#f4ecd8" stroke="#bda97a" /></g>,
          ])}
          {/* bone nut */}
          <rect x={NUT - 4} y={150 - 21} width={5} height={42} rx={1} fill="#efe8d8" />

          {/* strings: from the rollers, over the nut and saddle, tied at the bridge */}
          {[0, 1, 2, 3, 4, 5].map(i => {
            const roller = [60, 88, 116][i % 3];
            const slotY = i < 3 ? 139 : 161;
            const bass = i < 3;
            const col = bass ? '#cfcbc3' : '#f7f2e6';
            const w = bass ? 1.6 - i * 0.15 : 1.15 - (i - 3) * 0.12;
            return (
              <g key={i}>
                <path d={`M${roller} ${slotY} L${NUT - 2} ${strY(i, NUT)}`} stroke={col} strokeWidth={w} opacity={0.9} />
                <line x1={NUT} x2={saddleX} y1={strY(i, NUT)} y2={strY(i, saddleX)} stroke={col} strokeWidth={w} />
                <line x1={saddleX} x2={saddleX + 18} y1={strY(i, saddleX)} y2={strY(i, saddleX)} stroke={col} strokeWidth={w} />
              </g>
            );
          })}
        </g>

        {labels.map(l => (
          <g key={l.t}>
            <line x1={l.x} y1={l.y + (l.y < 150 ? 5 : -14)} x2={l.px} y2={l.py} stroke="var(--muted)" strokeWidth={1} />
            <circle cx={l.px} cy={l.py} r={2.5} fill="var(--fg)" />
            <text x={l.x} y={l.y} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--fg)">{l.t}</text>
          </g>
        ))}
      </svg>
      <figcaption>A classical (nylon-string) guitar. It has a wider, flatter neck than a steel-string guitar, a slotted headstock with rollers, and strings tied at the bridge. The neck joins the body at the 12th fret.</figcaption>
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
