// Pictures of common beginner problems, each next to the fix.
import { ReactNode } from 'react';
import { Skin, jointFinger, FretWire, StringDot, ArtDefs, fingerPath } from './Art';

export const MISTAKES: Record<string, { title: string; wrong: string; right: string; view: string }> = {
  'far-from-fret': { title: 'Where to press', view: 'Side view along one string', wrong: 'Pressing in the middle of the gap: the string buzzes against the fret.', right: 'Fingertip just behind the fret wire: a clean note with much less pressure.' },
  'finger-flat': { title: 'Finger lying flat', view: 'Looking along the neck from the headstock', wrong: 'The soft pad of the finger lies on the next string and mutes it.', right: 'Arch the finger so only the tip touches its own string. The next string rings underneath.' },
  thumb: { title: 'Thumb position', view: 'Looking along the neck', wrong: 'Thumb hooked over the top and palm squeezing the neck: the fingers flatten and the hand tires.', right: 'Thumb pad on the back of the neck, roughly behind your middle finger, with a gap under the palm.' },
  wrist: { title: 'Wrist angle', view: 'Side view of the fretting arm', wrong: 'A sharply bent wrist strains the tendons and makes reaching harder.', right: 'A gentle, relaxed curve from forearm to hand. Bring the elbow in a little.' },
  'barre-roll': { title: 'Barre finger', view: 'Looking down at the neck', wrong: 'Flat finger, away from the fret: strings in the creases of your joints go dead.', right: 'Index rolled slightly onto its bony edge, right behind the fret: every string rings.' },
  'strum-arm': { title: 'Strumming arm', view: 'Front of the guitar', wrong: 'A stiff arm swinging from the shoulder: tiring and uneven.', right: 'Forearm resting on the guitar, swinging from the elbow with a loose wrist.' },
  nails: { title: 'Right-hand nails (nylon guitar)', view: 'Side view of a plucking fingertip', wrong: 'Long or jagged nails catch and click on the strings.', right: 'Short and smooth, just past the fingertip. (Flamenco players keep them a little longer.)' },
};

const Bad = ({ x, y, text }: { x: number; y: number; text: string }) => <text x={x} y={y} fontSize={12} fontWeight={800} fill="var(--bad)" textAnchor="middle">{text}</text>;
const Good = ({ x, y, text }: { x: number; y: number; text: string }) => <text x={x} y={y} fontSize={12} fontWeight={800} fill="var(--ok)" textAnchor="middle">{text}</text>;

function FarFromFret({ ok }: { ok: boolean }) {
  // side view: nut side on the left, body side on the right; frets at 50 and 175
  const tipX = ok ? 160 : 108;
  const f = jointFinger(tipX - 52, 6, 140, 46, 168, 40, 26, -1);
  const tipY = 96;
  return (
    <>
      <rect x={0} y={104} width={220} height={22} fill="url(#board-wood)" />
      <FretWire x={50} y={104} /><FretWire x={175} y={104} />
      {ok
        ? <path d={`M0 90 L${tipX} ${tipY} L175 96 L220 90`} stroke="var(--string)" strokeWidth={2.6} fill="none" />
        : <path d={`M0 90 L${tipX} ${tipY + 4} L162 99 l4 -4 l4 5 l4 -4 L178 96 L220 90`} stroke="var(--bad)" strokeWidth={2.6} fill="none" />}
      <Skin parts={f.parts} />
      <path d={f.nail} fill="var(--nail)" stroke="var(--skin-edge)" strokeWidth={0.8} />
      {!ok && <Bad x={190} y={80} text="bzzz" />}
      <text x={175} y={140} fontSize={11} fill="var(--muted)" textAnchor="middle">fret wire</text>
      <text x={50} y={140} fontSize={11} fill="var(--muted)" textAnchor="middle">fret wire</text>
    </>
  );
}

function FingerFlat({ ok }: { ok: boolean }) {
  const xs = [36, 66, 96, 126, 156, 186];
  const ys = xs.map((_, i) => 92 - Math.sin((i / 5) * Math.PI) * 5);
  // fretting the 4th string (x=96); the 3rd string (x=126) must ring
  const f = ok ? jointFinger(40, 8, 120, 52, 172, 40, 24, -1) : jointFinger(36, 18, 118, 48, 128, 52, 26, -1);
  return (
    <>
      <path d="M14 108 Q110 92 206 108 L206 126 Q110 110 14 126 Z" fill="url(#board-wood)" />
      {xs.map((x, i) => <StringDot key={x} x={x} y={ys[i]} r={5.2 - i * 0.55} color={!ok && i === 3 ? 'var(--bad)' : undefined} />)}
      <Skin parts={f.parts} />
      <path d={f.nail} fill="var(--nail)" stroke="var(--skin-edge)" strokeWidth={0.8} />
      {ok ? <Good x={146} y={66} text="rings ✓" /> : <Bad x={168} y={66} text="muted" />}
      {['E', 'A', 'D', 'G', 'B', 'e'].map((n, i) => <text key={n + i} x={xs[i]} y={142} fontSize={10} fill="var(--muted)" textAnchor="middle">{n}</text>)}
    </>
  );
}

function Thumb({ ok }: { ok: boolean }) {
  // looking along the neck: fingerboard on the left (towards the strings), back of the neck on the right
  const neck = 'M70 30 L94 30 C140 30 160 52 160 80 C160 108 140 130 94 130 L70 130 Z';
  const finger = jointFinger(48, 6, 160, 26, 120, 34, 22, 1);
  const thumb = ok ? { d: fingerPath(46, 24), transform: 'translate(200 112) rotate(-72)' } : { d: fingerPath(50, 24), transform: 'translate(184 64) rotate(-38)' };
  const palm = ok ? 'M30 20 C10 70 40 140 110 148 C160 152 196 132 204 116' : 'M30 20 C14 70 40 136 104 140 C150 140 168 122 172 92 L186 62';
  return (
    <>
      <rect x={58} y={30} width={12} height={100} rx={2} fill="url(#board-wood)" />
      <path d={neck} fill="url(#neck-wood)" />
      {[38, 52, 66, 80, 94, 108, 122].slice(0, 6).map((y, i) => <StringDot key={y} x={52} y={y + 8} r={4 - i * 0.35} />)}
      <path d={palm} stroke="var(--skin-edge)" strokeWidth={30} fill="none" strokeLinecap="round" />
      <Skin parts={[...finger.parts, thumb]} />
      <path d={palm} stroke="var(--skin)" strokeWidth={26} fill="none" strokeLinecap="round" />
      <path d={finger.nail} fill="var(--nail)" stroke="var(--skin-edge)" strokeWidth={0.8} />
      {ok ? <Good x={176} y={22} text="gap under palm" /> : <Bad x={130} y={18} text="thumb over the top" />}
    </>
  );
}

function Wrist({ ok }: { ok: boolean }) {
  const arm = ok ? 'M6 132 Q80 110 136 74' : 'M6 132 Q70 128 120 122 Q140 118 146 84';
  const hand = ok ? 'M136 74 Q150 64 166 52' : 'M146 84 Q150 66 168 54';
  return (
    <>
      <rect x={172} y={10} width={26} height={130} rx={4} fill="url(#neck-wood)" />
      <rect x={168} y={10} width={6} height={130} fill="url(#board-wood)" />
      <path d={arm} stroke="var(--skin-edge)" strokeWidth={30} fill="none" strokeLinecap="round" />
      <path d={hand} stroke="var(--skin-edge)" strokeWidth={24} fill="none" strokeLinecap="round" />
      <path d={arm} stroke="var(--skin)" strokeWidth={26} fill="none" strokeLinecap="round" />
      <path d={hand} stroke="var(--skin)" strokeWidth={20} fill="none" strokeLinecap="round" />
      {!ok && <circle cx={142} cy={110} r={16} fill="none" stroke="var(--bad)" strokeWidth={2.5} strokeDasharray="4 3" />}
      {ok ? <Good x={70} y={92} text="straight line" /> : <Bad x={100} y={100} text="sharp bend" />}
    </>
  );
}

function Barre({ ok }: { ok: boolean }) {
  // looking down at the neck: strings run left-right, fret wire vertical at x=150
  const ys = [32, 50, 68, 86, 104, 122];
  const fx = ok ? 138 : 112;
  const dead = ok ? [] : [1, 3];
  return (
    <>
      <rect x={0} y={20} width={220} height={114} fill="url(#board-wood)" />
      <rect x={148} y={20} width={5} height={114} fill="url(#fret-metal)" />
      {ys.map((y, i) => <line key={y} x1={0} x2={220} y1={y} y2={y} stroke={dead.includes(i) ? 'var(--bad)' : '#d9d6cf'} strokeWidth={2.6 - i * 0.25} />)}
      <Skin parts={[{ d: `M${fx - (ok ? 9 : 12)} 4 L${fx + (ok ? 9 : 12)} 4 L${fx + (ok ? 9 : 12)} 140 Q${fx} 150 ${fx - (ok ? 9 : 12)} 140 Z` }]} />
      {[44, 96].map(y => <path key={y} d={`M${fx - 9} ${y + 6} q9 -3 18 0`} stroke="var(--skin-edge)" strokeWidth={1.5} fill="none" opacity={0.7} />)}
      {!ok && dead.map(i => <Bad key={i} x={60} y={ys[i] + 4} text="✕ dead" />)}
      {ok && <Good x={60} y={14} text="all six ring" />}
      <text x={150} y={150} fontSize={10} fill="var(--muted)" textAnchor="middle">fret wire</text>
    </>
  );
}

function StrumArm({ ok }: { ok: boolean }) {
  const body = 'M40 80 C40 40 70 20 100 30 C120 36 128 28 150 26 C190 22 210 50 210 84 C210 120 186 146 150 142 C128 140 120 132 100 138 C70 146 40 120 40 80 Z';
  return (
    <>
      <path d={body} fill="url(#top-wood)" stroke="#6b3d1f" strokeWidth={3} />
      <circle cx={104} cy={84} r={18} fill="#2a190d" />
      {[0, 1, 2, 3, 4, 5].map(i => <line key={i} x1={0} x2={150} y1={76 + i * 3.4} y2={76 + i * 3.4} stroke="#ece6d6" strokeWidth={0.9} />)}
      {ok ? (
        <>
          <path d="M214 30 Q170 44 132 70" stroke="var(--skin-edge)" strokeWidth={26} fill="none" strokeLinecap="round" />
          <path d="M214 30 Q170 44 132 70" stroke="var(--skin)" strokeWidth={22} fill="none" strokeLinecap="round" />
          <circle cx={126} cy={78} r={13} fill="var(--skin)" stroke="var(--skin-edge)" strokeWidth={2} />
          <path d="M110 58 q-12 22 0 44" stroke="var(--ok)" strokeWidth={3} fill="none" markerEnd="url(#mk-arr-ok)" />
          <Good x={58} y={148} text="small, from the elbow" />
        </>
      ) : (
        <>
          <path d="M200 4 L150 30 L128 64" stroke="var(--skin-edge)" strokeWidth={26} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M200 4 L150 30 L128 64" stroke="var(--skin)" strokeWidth={22} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={124} cy={74} r={13} fill="var(--skin)" stroke="var(--skin-edge)" strokeWidth={2} />
          <path d="M98 14 Q40 84 98 150" stroke="var(--bad)" strokeWidth={3} fill="none" markerEnd="url(#mk-arr-bad)" />
          <Bad x={170} y={148} text="big, stiff swing" />
        </>
      )}
    </>
  );
}

function Nails({ ok }: { ok: boolean }) {
  const f = jointFinger(30, 20, 120, 70, 150, 50, 30, -1);
  return (
    <>
      <StringDot x={f.tip.x + 6} y={f.tip.y + 14} r={6} />
      <line x1={0} x2={220} y1={f.tip.y + 14} y2={f.tip.y + 14} stroke="var(--string)" strokeWidth={1} opacity={0.3} />
      <Skin parts={f.parts} />
      {ok
        ? <path d={f.nail} fill="var(--nail)" stroke="var(--skin-edge)" strokeWidth={0.8} />
        : <path d={`${f.nail} M${f.tip.x - 4} ${f.tip.y - 10} l22 6 l-6 6 l6 6 l-22 -4 Z`} fill="var(--nail)" stroke="var(--bad)" strokeWidth={1.2} />}
      {ok ? <Good x={160} y={40} text="short & smooth" /> : <Bad x={160} y={40} text="long & jagged" />}
    </>
  );
}

const DRAW: Record<string, (p: { ok: boolean }) => ReactNode> = {
  'far-from-fret': FarFromFret, 'finger-flat': FingerFlat, thumb: Thumb, wrist: Wrist, 'barre-roll': Barre, 'strum-arm': StrumArm, nails: Nails,
};

function Panel({ ok, id, text }: { ok: boolean; id: string; text: string }) {
  const D = DRAW[id];
  return (
    <div className={`mk-panel ${ok ? 'ok' : 'bad'}`}>
      <div className="mk-badge" aria-hidden>{ok ? '✓' : '✕'}</div>
      <svg viewBox="0 0 220 152" aria-hidden>
        <ArtDefs />
        <defs>
          <marker id="mk-arr-ok" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--ok)" /></marker>
          <marker id="mk-arr-bad" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--bad)" /></marker>
        </defs>
        <D ok={ok} />
      </svg>
      <p><strong>{ok ? 'Do this' : 'Not this'}:</strong> {text}</p>
    </div>
  );
}

export function MistakeVisual({ id }: { id: string }) {
  const m = MISTAKES[id];
  if (!m) return null;
  return (
    <figure className="mistake">
      <figcaption>{m.title} <span className="muted small">· {m.view}</span></figcaption>
      <div className="mk-pair">
        <Panel ok={false} id={id} text={m.wrong} />
        <Panel ok id={id} text={m.right} />
      </div>
    </figure>
  );
}
