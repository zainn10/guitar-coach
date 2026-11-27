// Larger illustrations: parts of a classical guitar, sitting position, and bends.
import { useState } from 'react';
import { playNote } from '../audio/sounds';
import { Skin, fingerPath, Nail, Badge } from './Art';

/** Geometry of the drawn guitar (headstock on the left, body on the right). */
const NUT = 153, SCALE = 455; // px from nut to saddle
const fretX = (n: number) => NUT + SCALE * (1 - Math.pow(2, -n / 12));

/** The classical guitar itself, drawn to real proportions in a 760 x 305 box (centre of the body at 547,150). */
export function GuitarArt({ id = 'gp', shadow = true }: { id?: string; shadow?: boolean }) {
  const halfW = (x: number) => 18 + ((x - NUT) / (fretX(19) - NUT)) * 5; // fingerboard half-width
  const strY = (i: number, x: number) => {
    // string i (0 = 6th/low E at the top of the picture) between nut and saddle
    const t = Math.min(1, Math.max(0, (x - NUT) / SCALE));
    const span = 29 + t * 12;
    return 150 - span / 2 + (i * span) / 5;
  };
  const saddleX = NUT + SCALE;
  const body = 'M376 150 C376 92 410 52 458 52 C492 52 512 66 530 70 C550 74 568 22 625 22 C692 22 718 82 718 150 C718 218 692 278 625 278 C568 278 550 226 530 230 C512 234 492 248 458 248 C410 248 376 208 376 150 Z';
  return (
    <>
        <defs>
          <linearGradient id={`${id}-top`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ecd09b" /><stop offset="0.5" stopColor="#e2bd7f" /><stop offset="1" stopColor="#d3a764" />
          </linearGradient>
          <linearGradient id={`${id}-board`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a271a" /><stop offset="1" stopColor="#21160e" />
          </linearGradient>
          <linearGradient id={`${id}-head`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8a5530" /><stop offset="1" stopColor="#5e3519" />
          </linearGradient>
          <radialGradient id={`${id}-hole`} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#1a0f08" /><stop offset="1" stopColor="#2e1b0e" /></radialGradient>
          <filter id={`${id}-shadow`} x="-5%" y="-10%" width="110%" height="125%"><feDropShadow dx="0" dy="4" stdDeviation="5" floodOpacity="0.25" /></filter>
        </defs>

        <g filter={shadow ? `url(#${id}-shadow)` : undefined}>
          {/* body with binding */}
          <path d={body} fill="#6b3d1f" />
          <path d={body} fill={`url(#${id}-top)`} stroke="#5a3218" strokeWidth={5} />
          <path d={body} fill="none" stroke="#f3e3c3" strokeWidth={1.2} transform="translate(549 150) scale(0.975) translate(-549 -150)" opacity={0.8} />

          {/* rosette and soundhole */}
          <circle cx={486} cy={150} r={39} fill="none" stroke="#5a3218" strokeWidth={1.5} />
          <circle cx={486} cy={150} r={36} fill="none" stroke="#2f6b4f" strokeWidth={4} strokeDasharray="3 2" />
          <circle cx={486} cy={150} r={33} fill="none" stroke="#b5452b" strokeWidth={2} strokeDasharray="2 2" />
          <circle cx={486} cy={150} r={31} fill="none" stroke="#5a3218" strokeWidth={1.2} />
          <circle cx={486} cy={150} r={29} fill={`url(#${id}-hole)`} />

          {/* neck (behind the fingerboard) and heel */}
          <path d={`M${NUT} ${150 - 20} L381 ${150 - 25} L381 ${150 + 25} L${NUT} ${150 + 20} Z`} fill="#7a4a2a" />
          {/* fingerboard runs over the top to the 19th fret */}
          <path d={`M${NUT} ${150 - halfW(NUT)} L${fretX(19)} ${150 - halfW(fretX(19))} L${fretX(19)} ${150 + halfW(fretX(19))} L${NUT} ${150 + halfW(NUT)} Z`} fill={`url(#${id}-board)`} />
          {Array.from({ length: 19 }, (_, i) => {
            const x = fretX(i + 1);
            return <line key={i} x1={x} x2={x} y1={150 - halfW(x) + 0.5} y2={150 + halfW(x) - 0.5} stroke="#d9d6cf" strokeWidth={1.6} />;
          })}

          {/* bridge with tie block and bone saddle */}
          <path d={`M${saddleX - 10} 86 Q${saddleX - 16} 150 ${saddleX - 10} 214 L${saddleX + 26} 214 Q${saddleX + 30} 150 ${saddleX + 26} 86 Z`} fill="#3d2414" />
          <rect x={saddleX - 2} y={124} width={4} height={52} rx={1.5} fill="#f1ead9" />
          <rect x={saddleX + 12} y={120} width={12} height={60} rx={2} fill="#5a3520" />

          {/* headstock: slotted, with decorative top */}
          <path d="M153 124 L60 118 Q36 116 26 128 Q20 150 26 172 Q36 184 60 182 L153 176 Z" fill={`url(#${id}-head)`} />
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

    </>
  );
}

/** A classical guitar drawn to real proportions (650 mm scale, 12 frets to the body). */
export function GuitarParts() {
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
        <GuitarArt />
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

/** A limb drawn as a thick rounded line with an outline. */
function Limb({ d, w, fill, edge = 'var(--skin-edge)' }: { d: string; w: number; fill: string; edge?: string }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={edge} strokeWidth={w + 3} />
      <path d={d} stroke={fill} strokeWidth={w} />
    </g>
  );
}

interface Pose {
  guitar: string; // transform for GuitarArt (body centre at 547,150)
  rKnee: [number, number]; lKnee: [number, number]; rFoot: [number, number]; lFoot: [number, number];
  rArm: string; rHand: [number, number, number]; // x, y, angle
  lArm: string; lHand: [number, number, number];
  stool: boolean;
}

// Seen from the front: the player's RIGHT side is on the viewer's LEFT.
const POSES: Record<'classical' | 'casual', Pose> = {
  classical: {
    guitar: 'translate(176 214) rotate(135) scale(0.36) translate(-547 -150)',
    rKnee: [128, 236], lKnee: [204, 226], rFoot: [124, 306], lFoot: [214, 284],
    rArm: 'M116 116 Q96 160 98 196 Q132 214 164 222', rHand: [170, 222, 200],
    lArm: 'M206 116 Q246 150 258 196 Q258 172 254 154', lHand: [252, 146, -58],
    stool: true,
  },
  casual: {
    guitar: 'translate(146 222) rotate(170) scale(0.36) translate(-547 -150)',
    rKnee: [128, 240], lKnee: [200, 240], rFoot: [124, 306], lFoot: [204, 306],
    rArm: 'M116 116 Q92 164 92 204 Q122 214 150 218', rHand: [156, 218, 190],
    lArm: 'M206 116 Q232 150 240 190 Q246 208 244 218', lHand: [244, 218, 0],
    stool: false,
  },
};

function SittingFigure({ pose }: { pose: Pose }) {
  const trousers = '#3d4b63', trousersEdge = '#27303f', shirt = '#5b8fb0', shirtEdge = '#3d6782', shoe = '#2b2522';
  const [rkx, rky] = pose.rKnee, [lkx, lky] = pose.lKnee, [rfx, rfy] = pose.rFoot, [lfx, lfy] = pose.lFoot;
  return (
    <g>
      {/* chair */}
      <rect x={112} y={96} width={96} height={110} rx={10} fill="#9a7b5f" stroke="#6f5640" strokeWidth={2} />
      <rect x={96} y={204} width={128} height={12} rx={4} fill="#8a6c51" stroke="#6f5640" strokeWidth={2} />
      <path d="M104 216 L100 312 M216 216 L220 312" stroke="#6f5640" strokeWidth={7} strokeLinecap="round" />
      {/* floor */}
      <line x1={20} x2={340} y1={314} y2={314} stroke="var(--line)" strokeWidth={2} />
      {/* footstool */}
      {pose.stool && <g>
        <rect x={188} y={288} width={56} height={9} rx={2} fill="#c06a2b" stroke="#8a4a1d" strokeWidth={1.5} />
        <path d="M194 297 L190 313 M238 297 L242 313" stroke="#8a4a1d" strokeWidth={4} strokeLinecap="round" />
      </g>}
      {/* legs: thighs come towards us, so the knees are round; then the shins go down */}
      <Limb d={`M${rkx} ${rky} L${rfx} ${rfy - 8}`} w={22} fill={trousers} edge={trousersEdge} />
      <Limb d={`M${lkx} ${lky} L${lfx} ${lfy - 8}`} w={22} fill={trousers} edge={trousersEdge} />
      <ellipse cx={rfx - 4} cy={rfy - 2} rx={17} ry={8} fill={shoe} />
      <ellipse cx={lfx + 4} cy={lfy - 2} rx={17} ry={8} fill={shoe} />
      <path d={`M132 204 Q${rkx - 20} ${rky - 30} ${rkx - 14} ${rky + 4} Q${rkx} ${rky + 16} ${rkx + 14} ${rky + 2} L160 206 Z`} fill={trousers} stroke={trousersEdge} strokeWidth={2} />
      <path d={`M160 206 L${lkx - 14} ${lky + 2} Q${lkx} ${lky + 16} ${lkx + 14} ${lky + 4} Q${lkx + 20} ${lky - 30} 188 204 Z`} fill={trousers} stroke={trousersEdge} strokeWidth={2} />
      {/* torso */}
      <path d="M126 106 Q160 96 194 106 Q214 110 214 132 L200 206 L120 206 L106 132 Q106 110 126 106 Z" fill={shirt} stroke={shirtEdge} strokeWidth={2} />
      <path d="M150 103 Q160 114 170 103" fill="none" stroke={shirtEdge} strokeWidth={2} />
      {/* neck and head */}
      <rect x={151} y={80} width={18} height={22} rx={6} fill="var(--skin)" stroke="var(--skin-edge)" strokeWidth={1.5} />
      <ellipse cx={137} cy={64} rx={5} ry={8} fill="var(--skin)" stroke="var(--skin-edge)" strokeWidth={1.5} />
      <ellipse cx={183} cy={64} rx={5} ry={8} fill="var(--skin)" stroke="var(--skin-edge)" strokeWidth={1.5} />
      <ellipse cx={160} cy={62} rx={23} ry={27} fill="var(--skin)" stroke="var(--skin-edge)" strokeWidth={1.5} />
      <path d="M137 58 Q134 30 160 30 Q188 30 184 58 Q178 42 160 42 Q146 42 137 58 Z" fill="#3a2a20" />
      {/* eyes looking down at the fingerboard (towards the player's left) */}
      <ellipse cx={156} cy={66} rx={2} ry={1.5} fill="#3a2a20" /><ellipse cx={171} cy={66} rx={2} ry={1.5} fill="#3a2a20" />
      <path d="M158 78 Q164 81 170 78" fill="none" stroke="#b07a5a" strokeWidth={1.5} strokeLinecap="round" />
    </g>
  );
}

function PostureScene({ mode }: { mode: 'classical' | 'casual' }) {
  const pose = POSES[mode];
  const [lx, ly, la] = pose.lHand, [rx, ry, ra] = pose.rHand;
  return (
    <>
      <SittingFigure pose={pose} />
      {/* left arm goes behind the neck */}
      <Limb d={pose.lArm} w={15} fill="var(--skin)" />
      <g transform={pose.guitar}><GuitarArt id={`pos-${mode}`} shadow={false} /></g>
      {/* left hand: thumb behind, fingertips arching onto the fingerboard */}
      <g transform={`translate(${lx} ${ly}) rotate(${la})`}>
        <Skin parts={[
          { d: 'M-12 8 C-14 -4 -6 -10 4 -10 C14 -10 18 -2 16 8 C14 16 -10 18 -12 8 Z' },
          ...[-8, -1, 6, 13].map((x, i) => ({ d: fingerPath(12 + (i === 3 ? -2 : 2), 6.5), transform: `translate(${x} -4) rotate(${-8 + i * 6})` })),
        ]} outline={2} />
      </g>
      {/* right arm over the lower bout, hand over the strings near the soundhole */}
      <Limb d={pose.rArm} w={16} fill="var(--skin)" />
      <g transform={`translate(${rx} ${ry}) rotate(${ra})`}>
        <Skin parts={[
          { d: 'M-10 -10 C-4 -14 8 -14 12 -8 C15 0 12 10 4 12 C-4 14 -12 8 -12 0 Z' },
          ...[-7, -1, 5].map((x, i) => ({ d: fingerPath(13 - i, 6), transform: `translate(${x} 6) rotate(${170 + i * 6})` })),
          { d: fingerPath(12, 7), transform: 'translate(10 0) rotate(130)' },
        ]} outline={2} />
      </g>
      {/* short sleeves over the shoulders */}
      <path d="M106 112 Q100 128 104 142 L126 140 L126 112 Z" fill="#5b8fb0" stroke="#3d6782" strokeWidth={2} />
      <path d="M214 112 Q222 128 218 142 L196 140 L196 112 Z" fill="#5b8fb0" stroke="#3d6782" strokeWidth={2} />
    </>
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
      <svg viewBox="0 0 400 320" role="img" aria-label={c ? 'Classical position, seen from the front: guitar resting on the left leg, left foot raised on a footstool, neck pointing up to the player\'s left at about 45 degrees, back straight, right forearm over the lower curve of the guitar.' : 'Casual position, seen from the front: guitar resting on the right leg, neck roughly level and pointing to the player\'s left, back straight.'}>
        <g transform="translate(40 0)"><PostureScene mode={mode} /></g>
        <g fontSize={12}>
          <text x={14} y={22} fontSize={14} fill="var(--fg)" fontWeight={700}>{c ? 'Neck up at about 45°' : 'Neck roughly level'}</text>
          <text x={14} y={40} fill="var(--muted)">{c ? 'Guitar on your LEFT leg' : 'Guitar on your RIGHT leg'}</text>
          <text x={14} y={56} fill="var(--muted)">Seen from the front</text>
          {c && <><line x1={302} y1={300} x2={286} y2={294} stroke="var(--muted)" /><text x={306} y={304} fill="var(--muted)">footstool</text></>}
        </g>
      </svg>
      <figcaption>{c
        ? 'The classical position gives your left hand the best reach and a straight wrist. Use a footstool (or a pile of books) under your left foot, or a support cushion on your leg. Sit near the front of the chair with your back straight.'
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
  // Looking down at the neck as you play: the thick string is at the top, the thin one at the bottom.
  // Frets 4..8; the ring finger frets the 3rd (G) string at fret 7, middle and index push behind it.
  const frets = [{ n: 4, x: 22 }, { n: 5, x: 96 }, { n: 6, x: 166 }, { n: 7, x: 232 }, { n: 8, x: 294 }];
  const strY = (i: number) => 40 + i * 22; // i = 0 (6th string) .. 5 (1st string)
  const G = strY(3);
  const lift = amount * 14;
  const fingers = [{ n: 1, x: 70, c: 'var(--f1)' }, { n: 2, x: 140, c: 'var(--f2)' }, { n: 3, x: 208, c: 'var(--f3)' }];
  return (
    <figure className="illus">
      <svg viewBox="0 0 320 226" role="img" aria-label={`A bend, looking down at the neck: the ring finger frets the 3rd string at the 7th fret with the middle and index fingers behind it on the same string, and all three push the string up towards the thicker strings, raising the pitch by ${amount === 2 ? 'a whole step (two frets)' : 'a half step (one fret)'}.`}>
        <defs>
          <linearGradient id="bend-board" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a271a" /><stop offset="1" stopColor="#21160e" /></linearGradient>
          <linearGradient id="bend-fret" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#9c9c9c" /><stop offset="0.5" stopColor="#f2f2f2" /><stop offset="1" stopColor="#a3a3a3" /></linearGradient>
          <marker id="bend-arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--f2)" /></marker>
        </defs>
        <text x={4} y={16} fontSize={11} fill="var(--muted)">looking down at the neck</text>
        <text x={316} y={16} fontSize={12} fontWeight={700} fill="var(--fg)" textAnchor="end">push the string up ↑</text>
        {frets.slice(1).map(f => <text key={f.n} x={f.x - 34} y={36} fontSize={11} fill="var(--muted)" textAnchor="middle">fret {f.n}</text>)}
        <g transform="translate(0 16)">
        <rect x={0} y={26} width={320} height={136} fill="url(#bend-board)" />
        <circle cx={199} cy={94} r={6} fill="#e9e1cf" opacity={0.85} />
        {frets.map(f => <g key={f.n}>
          <rect x={f.x - 2.5} y={26} width={5} height={136} fill="url(#bend-fret)" />
        </g>)}
        {[0, 1, 2, 4, 5].map(i => <line key={i} x1={0} x2={320} y1={strY(i)} y2={strY(i)} stroke={i < 3 ? '#cfcbc3' : '#f2eee4'} strokeWidth={2.6 - i * 0.3} />)}
        {/* where the string started */}
        <line x1={0} x2={320} y1={G} y2={G} stroke="#f2eee4" strokeWidth={1.4} strokeDasharray="3 4" opacity={0.6} />
        {/* the bent G string */}
        <path d={`M0 ${G} L${fingers[0].x} ${G - lift * 0.55} L${fingers[2].x + 4} ${G - lift} L320 ${G}`} stroke="var(--f1)" strokeWidth={2.4} fill="none" />
        {/* three fingers coming up from under the neck, tips on the string */}
        <Skin parts={fingers.map((f, i) => ({ d: fingerPath(220 - (G - lift * (i === 0 ? 0.55 : i === 1 ? 0.8 : 1)) + 4, 26), transform: `translate(${f.x + 6} 224) rotate(${-4 + i * 2})` }))} />
        {fingers.map((f, i) => {
          const tipY = G - lift * (i === 0 ? 0.55 : i === 1 ? 0.8 : 1);
          return <g key={f.n}>
            <Nail len={14} w={15} transform={`translate(${f.x + 7} ${tipY + 16})`} />
            <Badge x={f.x + 6} y={tipY + 40} color={f.c} label={String(f.n)} />
          </g>;
        })}
        <path d={`M262 ${G + 6} L262 ${G - lift - 10}`} stroke="var(--f2)" strokeWidth={3.5} markerEnd="url(#bend-arr)" />
        <text x={4} y={G + 14} fontSize={10} fill="#f2eee4" opacity={0.9}>G string</text>
        </g>
      </svg>
      <div className="row wrap center-row">
        <div className="seg"><button className={amount === 1 ? 'on' : ''} onClick={() => setAmount(1)}>Half step</button><button className={amount === 2 ? 'on' : ''} onClick={() => setAmount(2)}>Whole step</button></div>
        <button className="btn small" onClick={hear}>▶ Hear the target</button>
      </div>
      <figcaption>Bend with the ring finger, supported by the middle and index fingers behind it on the same string. Push from the wrist (like turning a door key), not just the fingertip. Aim for the pitch of the note {amount === 2 ? 'two frets' : 'one fret'} higher.</figcaption>
    </figure>
  );
}
