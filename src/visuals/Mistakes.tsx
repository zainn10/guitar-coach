// Pictures of common beginner problems, each next to the fix.
import { ReactNode } from 'react';

export const MISTAKES: Record<string, { title: string; wrong: string; right: string }> = {
  'far-from-fret': { title: 'Where to press', wrong: 'Pressing in the middle of the gap: the string buzzes against the fret.', right: 'Fingertip just behind the fret wire: clean note, much less pressure needed.' },
  'finger-flat': { title: 'Finger lying flat', wrong: 'The soft pad of the finger lies across the next string and mutes it.', right: 'Arch the finger so only the tip touches its own string. The next string rings freely underneath.' },
  thumb: { title: 'Thumb position', wrong: 'Thumb squeezing over the top of the neck pulls your fingers flat and tires the hand.', right: 'Thumb behind the neck, roughly behind your middle finger. Light pressure, like pinching a sponge.' },
  wrist: { title: 'Wrist angle', wrong: 'A sharply bent wrist strains tendons and makes reaching harder.', right: 'Gentle, relaxed curve. Bring the elbow in a little and let the hand come round the neck.' },
  'barre-roll': { title: 'Barre finger', wrong: 'Flat soft side of the finger: strings land in the creases of your joints and go dead.', right: 'Roll the index finger slightly onto its bony edge, close to the fret, and let your arm weight do the work.' },
  'strum-arm': { title: 'Strumming arm', wrong: 'A stiff arm making big movements from the shoulder: tiring and uneven.', right: 'Swing from the elbow with a loose wrist, small movements, like shaking water off your hand.' },
  nails: { title: 'Right-hand nails (nylon guitar)', wrong: 'Long or jagged nails catch and click on the strings.', right: 'Short and smooth, just past the fingertip, filed in a gentle curve. (Flamenco players keep them a little longer.)' },
};

function Panel({ ok, children, text }: { ok: boolean; children: ReactNode; text: string }) {
  return (
    <div className={`mk-panel ${ok ? 'ok' : 'bad'}`}>
      <div className="mk-badge" aria-hidden>{ok ? '✓' : '✕'}</div>
      <svg viewBox="0 0 220 140" aria-hidden>{children}</svg>
      <p><strong>{ok ? 'Do this' : 'Not this'}:</strong> {text}</p>
    </div>
  );
}

const Board = () => <rect x={10} y={92} width={200} height={14} rx={3} fill="var(--wood)" />;

function drawing(id: string, ok: boolean) {
  switch (id) {
    case 'far-from-fret': {
      const fx = ok ? 150 : 105;
      return (<>
        <Board />
        {[50, 160].map(x => <rect key={x} x={x} y={84} width={6} height={10} rx={2} fill="var(--fret)" />)}
        {ok ? <path d={`M10 82 L${fx} 89 L210 82`} stroke="var(--string)" strokeWidth={2.5} fill="none" />
          : <path d={`M10 82 L56 83 l6 -3 l6 4 l6 -3 l6 4 L${fx} 89 L210 82`} stroke="var(--bad)" strokeWidth={2.5} fill="none" />}
        <path d={`M${fx - 18} 10 q-6 60 18 78 q16 -4 14 -40 q0 -30 -6 -38 z`} fill="var(--skin)" stroke="var(--skin-edge)" strokeWidth={1.5} />
        <text x={160} y={126} fontSize={11} fill="var(--muted)" textAnchor="middle">fret wire</text>
        {!ok && <text x={62} y={70} fontSize={11} fill="var(--bad)" fontWeight={700}>bzzz</text>}
      </>);
    }
    case 'finger-flat': {
      const strings = [40, 70, 100, 130, 160, 190];
      return (<>
        <path d="M20 112 q90 -18 180 0 l0 14 q-90 -18 -180 0 z" fill="var(--wood)" />
        {strings.map((x, i) => <circle key={x} cx={x} cy={98 - Math.sin((i / 5) * Math.PI) * 4} r={4 + (5 - i) * 0.5} fill={!ok && i === 3 ? 'var(--bad)' : 'var(--string)'} />)}
        {ok
          ? <path d="M76 20 q10 40 18 70 q4 6 10 0 q-2 -40 6 -74 z" fill="var(--skin)" stroke="var(--skin-edge)" strokeWidth={1.5} />
          : <path d="M66 22 q14 44 22 66 q20 10 46 4 q-10 -20 -28 -24 q-10 -30 -6 -50 z" fill="var(--skin)" stroke="var(--skin-edge)" strokeWidth={1.5} />}
        <text x={110} y={136} fontSize={11} fill="var(--muted)" textAnchor="middle">looking along the neck</text>
        {!ok && <text x={140} y={84} fontSize={11} fill="var(--bad)" fontWeight={700}>muted</text>}
      </>);
    }
    case 'thumb':
      return (<>
        <ellipse cx={110} cy={70} rx={52} ry={34} fill="var(--wood)" />
        <rect x={58} y={36} width={104} height={10} rx={3} fill="var(--fret)" />
        <text x={110} y={30} fontSize={11} fill="var(--muted)" textAnchor="middle">strings / fingerboard</text>
        {ok ? <ellipse cx={110} cy={106} rx={16} ry={10} fill="var(--skin)" stroke="var(--skin-edge)" strokeWidth={1.5} />
          : <path d="M150 20 q30 10 22 40 q-8 10 -18 0 q4 -20 -10 -30 z" fill="var(--skin)" stroke="var(--bad)" strokeWidth={2} />}
        <text x={110} y={132} fontSize={11} fill="var(--muted)" textAnchor="middle">{ok ? 'thumb pad behind the neck' : 'thumb clamped over the top'}</text>
      </>);
    case 'wrist':
      return (<>
        <rect x={150} y={20} width={22} height={110} rx={4} fill="var(--wood)" />
        {ok ? <path d="M10 120 q60 -10 110 -40 q20 -12 34 -16" stroke="var(--skin-edge)" strokeWidth={22} fill="none" strokeLinecap="round" />
          : <path d="M10 120 q70 -4 100 -10 q30 -6 44 -56" stroke="var(--bad)" strokeWidth={22} fill="none" strokeLinecap="round" opacity={0.8} />}
        <text x={60} y={30} fontSize={11} fill="var(--muted)">{ok ? 'gentle curve' : 'sharp bend'}</text>
      </>);
    case 'barre-roll': {
      return (<>
        <Board />
        {[30, 60, 90, 120, 150, 180].map((x, i) => <circle key={x} cx={x} cy={88} r={4 + (5 - i) * 0.4} fill={!ok && (i === 2 || i === 4) ? 'var(--bad)' : 'var(--string)'} />)}
        <rect x={18} y={ok ? 72 : 70} width={178} height={ok ? 14 : 18} rx={8} fill="var(--skin)" stroke="var(--skin-edge)" strokeWidth={1.5} />
        {!ok && [84, 146].map(x => <path key={x} d={`M${x} 70 q6 10 12 0`} fill="var(--bg)" stroke="var(--skin-edge)" />)}
        <text x={110} y={130} fontSize={11} fill="var(--muted)" textAnchor="middle">{ok ? 'bony edge, close to the fret' : 'strings sit in the joint creases'}</text>
      </>);
    }
    case 'strum-arm':
      return (<>
        <circle cx={40} cy={30} r={10} fill="var(--muted)" />
        {ok ? <><path d="M40 40 L80 80 L120 70" stroke="var(--skin-edge)" strokeWidth={10} fill="none" strokeLinecap="round" /><path d="M128 50 q14 20 0 40" stroke="var(--ok)" strokeWidth={3} fill="none" markerEnd="url(#a)" /></>
          : <><path d="M40 40 L70 100 L110 120" stroke="var(--bad)" strokeWidth={10} fill="none" strokeLinecap="round" opacity={0.8} /><path d="M90 20 q90 50 0 120" stroke="var(--bad)" strokeWidth={3} fill="none" /></>}
        <text x={150} y={130} fontSize={11} fill="var(--muted)">{ok ? 'small, loose' : 'big, stiff'}</text>
      </>);
    case 'nails':
      return (<>
        <path d="M30 60 q120 -30 160 10 q6 20 -10 30 q-60 10 -150 10 z" fill="var(--skin)" stroke="var(--skin-edge)" strokeWidth={1.5} />
        {ok ? <path d="M186 64 q10 8 4 22 q-6 -2 -6 -10 z" fill="#fff" stroke="var(--skin-edge)" />
          : <path d="M186 64 q30 6 24 30 l-6 -4 l-4 6 q-6 -8 -12 -18 z" fill="#fff" stroke="var(--bad)" strokeWidth={1.5} />}
        <text x={110} y={130} fontSize={11} fill="var(--muted)" textAnchor="middle">{ok ? 'short and smooth' : 'long and jagged'}</text>
      </>);
    default: return null;
  }
}

export function MistakeVisual({ id }: { id: string }) {
  const m = MISTAKES[id];
  if (!m) return null;
  return (
    <figure className="mistake">
      <figcaption>{m.title}</figcaption>
      <div className="mk-pair">
        <Panel ok={false} text={m.wrong}>{drawing(id, false)}</Panel>
        <Panel ok text={m.right}>{drawing(id, true)}</Panel>
      </div>
    </figure>
  );
}
