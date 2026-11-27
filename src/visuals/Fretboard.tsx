// Fretboard: the neck as seen in a chord chart turned sideways (thin E string at the top, like tab).
// Used for note-finding, scales and quizzes.
import { OPEN_STRING_MIDI, STRING_SHORT, NOTE_NAMES } from '../audio/notes';
import { playNote } from '../audio/sounds';

export interface FretMark { string: number; fret: number; label?: string; color?: string; root?: boolean }

export const noteAt = (string: number, fret: number) => OPEN_STRING_MIDI[string] + fret;
export const noteNameAt = (string: number, fret: number) => NOTE_NAMES[noteAt(string, fret) % 12];

export function Fretboard({ from = 0, to = 12, marks = [], onPick, showNames = false, strings = [1, 2, 3, 4, 5, 6], ariaLabel }: {
  from?: number; to?: number; marks?: FretMark[]; onPick?: (string: number, fret: number) => void; showNames?: boolean; strings?: number[]; ariaLabel?: string;
}) {
  const fw = 56, L = 40, T = 20, gap = 24;
  const H = T + gap * 5 + 34;
  const realFrom = from === 0 ? 1 : from;
  const cols = from === 0 ? to : to - from + 1;
  const W2 = L + cols * fw + 10;
  return (
    <div className="fretboard-wrap">
      <svg viewBox={`0 0 ${W2} ${H}`} style={{ minWidth: Math.min(W2, 720) }} role="img" aria-label={ariaLabel ?? `Fretboard, frets ${from} to ${to}`}>
        <rect x={L} y={T - 6} width={cols * fw} height={gap * 5 + 12} fill="var(--wood)" opacity={0.25} rx={4} />
        {[3, 5, 7, 9, 15, 17].filter(f => f >= realFrom && f <= to).map(f => <circle key={f} cx={L + (f - realFrom + 0.5) * fw} cy={T + gap * 2.5} r={6} fill="var(--fret)" opacity={0.5} />)}
        {[12].filter(f => f >= realFrom && f <= to).map(f => <g key={f}><circle cx={L + (f - realFrom + 0.5) * fw} cy={T + gap * 1.5} r={6} fill="var(--fret)" opacity={0.5} /><circle cx={L + (f - realFrom + 0.5) * fw} cy={T + gap * 3.5} r={6} fill="var(--fret)" opacity={0.5} /></g>)}
        {Array.from({ length: cols + 1 }, (_, i) => <line key={i} x1={L + i * fw} x2={L + i * fw} y1={T - 6} y2={T + gap * 5 + 6} stroke={i === 0 && from === 0 ? 'var(--fg)' : 'var(--fret)'} strokeWidth={i === 0 && from === 0 ? 6 : 2.5} />)}
        {[1, 2, 3, 4, 5, 6].map(s => (
          <g key={s} opacity={strings.includes(s) ? 1 : 0.3}>
            <text x={8} y={T + (s - 1) * gap + 5} fontSize={13} fontWeight={600} fill="var(--muted)">{STRING_SHORT[s]}</text>
            <line x1={L - 26} x2={L + cols * fw} y1={T + (s - 1) * gap} y2={T + (s - 1) * gap} stroke="var(--string)" strokeWidth={0.8 + s * 0.35} />
          </g>
        ))}
        {Array.from({ length: cols }, (_, i) => <text key={i} x={L + (i + 0.5) * fw} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--muted)">{realFrom + i}</text>)}
        {onPick && [1, 2, 3, 4, 5, 6].filter(s => strings.includes(s)).flatMap(s => Array.from({ length: (from === 0 ? 1 : 0) + cols }, (_, i) => {
          const f = from === 0 ? i : realFrom + i;
          const x = f === 0 ? L - 16 : L + (f - realFrom + 0.5) * fw;
          return <rect key={`${s}-${f}`} className="fb-hit" x={x - fw / 2 + 2} y={T + (s - 1) * gap - gap / 2} width={f === 0 ? 28 : fw - 4} height={gap} rx={6}
            onClick={() => onPick(s, f)} role="button" tabIndex={0} aria-label={`String ${s}, fret ${f}`}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onPick(s, f); }} />;
        }))}
        {marks.map((m, i) => {
          const x = m.fret === 0 ? L - 16 : L + (m.fret - realFrom + 0.5) * fw;
          const y = T + (m.string - 1) * gap;
          return (
            <g key={i} onClick={() => playNote(noteAt(m.string, m.fret))} style={{ cursor: 'pointer' }}>
              <circle cx={x} cy={y} r={11} fill={m.color ?? (m.root ? 'var(--f2)' : 'var(--f1)')} stroke="var(--bg)" strokeWidth={2} />
              <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={800} fill="#fff">{m.label ?? (showNames ? noteNameAt(m.string, m.fret) : '')}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** A scale "box": the shape your hand stays in, with roots highlighted and finger numbers in the dots. */
export const SCALES: Record<string, { title: string; marks: FretMark[]; from: number; to: number; note: string }> = {
  'am-pentatonic': {
    title: 'A minor pentatonic, box 1 (5th fret)', from: 4, to: 9,
    note: 'Root notes (A) in orange. Index finger covers the 5th fret, ring or little finger the 7th/8th. This box is the home of countless rock solos.',
    marks: [[6, 5, 1, true], [6, 8, 4], [5, 5, 1], [5, 7, 3], [4, 5, 1], [4, 7, 3, true], [3, 5, 1], [3, 7, 3], [2, 5, 1], [2, 8, 4], [1, 5, 1, true], [1, 8, 4]]
      .map(([s, f, fi, r]) => ({ string: s as number, fret: f as number, label: String(fi), root: !!r })),
  },
  'bm-pentatonic': {
    title: 'B minor pentatonic, box 1 (7th fret)', from: 6, to: 11,
    note: 'The same shape moved up two frets: now the root is B. Solos in B minor live here.',
    marks: [[6, 7, 1, true], [6, 10, 4], [5, 7, 1], [5, 9, 3], [4, 7, 1], [4, 9, 3, true], [3, 7, 1], [3, 9, 3], [2, 7, 1], [2, 10, 4], [1, 7, 1, true], [1, 10, 4]]
      .map(([s, f, fi, r]) => ({ string: s as number, fret: f as number, label: String(fi), root: !!r })),
  },
  'a-harmonic-minor': {
    title: 'A harmonic minor (one octave, 5th string)', from: 0, to: 5,
    note: 'A B C D E F G♯ A. The raised 7th (G♯) gives that dramatic, Spanish/Middle-Eastern pull back to A.',
    marks: [[5, 0, 0, true], [5, 2, 2], [5, 3, 3], [4, 0, 0], [4, 2, 2], [4, 3, 3], [3, 1, 1], [3, 2, 2, true]]
      .map(([s, f, fi, r]) => ({ string: s as number, fret: f as number, label: fi ? String(fi) : 'o', root: !!r })),
  },
  'e-phrygian': {
    title: 'E Phrygian, the flamenco scale (open position)', from: 0, to: 4,
    note: 'The notes of A minor, but starting and ending on E. The step E→F (a single fret) is the sound of flamenco. Add G♯ for the "Phrygian dominant" flavour.',
    marks: [[6, 0, 0, true], [6, 1, 1], [6, 3, 3], [5, 0, 0], [5, 2, 2], [5, 3, 3], [4, 0, 0], [4, 2, 2, true], [4, 3, 3], [3, 0, 0], [3, 2, 2], [2, 0, 0], [2, 1, 1], [2, 3, 3], [1, 0, 0, true]]
      .map(([s, f, fi, r]) => ({ string: s as number, fret: f as number, label: fi ? String(fi) : 'o', root: !!r })),
  },
};

export function ScaleBox({ id }: { id: string }) {
  const sc = SCALES[id];
  if (!sc) return null;
  const play = () => {
    const seq = [...sc.marks].sort((a, b) => noteAt(a.string, a.fret) - noteAt(b.string, b.fret));
    seq.forEach((m, i) => setTimeout(() => playNote(noteAt(m.string, m.fret), undefined, 0.3, 0.6), i * 330));
  };
  return (
    <figure className="scale-box">
      <figcaption><strong>{sc.title}</strong></figcaption>
      <Fretboard from={sc.from} to={sc.to} marks={sc.marks} />
      <div className="row wrap"><button className="btn small" onClick={play}>▶ Hear it going up</button><span className="small muted">Tap any dot to hear that note.</span></div>
      <p className="small">{sc.note}</p>
    </figure>
  );
}
