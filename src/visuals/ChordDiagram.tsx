// Chord diagram (SVG). Two views:
//  - "chart": the standard chord-book view (strings vertical, nut at the top, low E on the left)
//  - "player": what you see looking down at the neck while holding the guitar
//    (headstock on the left, low E string nearest your face = top).
import { ChordShape, chordStrings, STRING_SHORT, STRING_LABEL } from '../audio/notes';
import type { StringStatus } from '../audio/chordCheck';

export const FINGER_NAMES: Record<number, string> = { 1: 'Index', 2: 'Middle', 3: 'Ring', 4: 'Little' };

export interface ChordDiagramProps {
  chord: ChordShape;
  view?: 'chart' | 'player';
  /** Per-string result from the microphone, shown as coloured strings and icons. */
  statuses?: Partial<Record<number, StringStatus>>;
  /** Build mode: only show fingers for the first N steps. */
  visibleSteps?: number;
  /** Highlight this string's finger (e.g. the one just added). */
  highlightString?: number;
  width?: number;
  title?: boolean;
}

const STATUS_STYLE: Record<StringStatus, { color: string; icon: string; label: string }> = {
  ok: { color: 'var(--ok)', icon: '✓', label: 'rang clearly' },
  'ok-probably': { color: 'var(--ok)', icon: '✓', label: 'probably rang' },
  weak: { color: 'var(--warn)', icon: '~', label: 'faint' },
  damped: { color: 'var(--warn)', icon: '~', label: 'died away quickly' },
  missing: { color: 'var(--bad)', icon: '✕', label: 'not heard' },
  'missing-probably': { color: 'var(--bad)', icon: '✕', label: 'probably not heard' },
  'wrong-note': { color: 'var(--bad)', icon: '!', label: 'wrong note' },
  extra: { color: 'var(--bad)', icon: '!', label: "shouldn't be played" },
  'extra-maybe': { color: 'var(--warn)', icon: '?', label: 'ringing a little (maybe just humming along)' },
  unsure: { color: 'var(--muted)', icon: '?', label: "can't check on its own" },
  'silent-ok': { color: 'var(--line)', icon: '', label: 'correctly not played' },
};
export const statusStyle = (s: StringStatus) => STATUS_STYLE[s];

export function ChordDiagram({ chord, view = 'chart', statuses, visibleSteps, highlightString, width = 260, title = true }: ChordDiagramProps) {
  const strings = chordStrings(chord);
  const fretted = strings.filter(s => s.fret && s.fret > 0).map(s => s.fret!);
  const maxFret = fretted.length ? Math.max(...fretted) : 1;
  const minFret = fretted.length ? Math.min(...fretted) : 1;
  const base = maxFret <= 4 ? 1 : minFret;
  const nFrets = Math.max(4, maxFret - base + 1);

  let visible = new Set(strings.map(s => s.string));
  if (visibleSteps !== undefined && chord.steps) {
    visible = new Set(chord.steps.slice(0, visibleSteps).map(s => s.string).filter(Boolean));
  }

  const label = `${chord.name} chord diagram. ` + strings.map(s =>
    s.fret === null ? `${STRING_LABEL[s.string]} string: not played` :
      s.fret === 0 ? `${STRING_LABEL[s.string]}: open` :
        `${STRING_LABEL[s.string]}: ${FINGER_NAMES[s.finger ?? 1]?.toLowerCase()} finger, fret ${s.fret}`).join('; ');

  const dot = (cx: number, cy: number, r: number, finger: number | null, str: number) => {
    const show = visible.has(str);
    if (!show) return null;
    const hl = highlightString === str;
    return (
      <g key={`d${str}`} className={hl ? 'dot-new' : undefined}>
        {hl && <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke={`var(--f${finger ?? 1})`} strokeWidth={3} opacity={0.5} />}
        <circle cx={cx} cy={cy} r={r} fill={`var(--f${finger ?? 1})`} stroke="var(--bg)" strokeWidth={2} />
        <text x={cx} y={cy + r * 0.38} textAnchor="middle" fontSize={r * 1.05} fontWeight={700} fill="#fff">{finger ?? ''}</text>
      </g>
    );
  };

  const statusIcon = (x: number, y: number, str: number) => {
    const st = statuses?.[str];
    if (!st || !STATUS_STYLE[st].icon) return null;
    const s = STATUS_STYLE[st];
    return (
      <g key={`s${str}`}>
        <circle cx={x} cy={y} r={10} fill={s.color} />
        <text x={x} y={y + 4.5} textAnchor="middle" fontSize={13} fontWeight={800} fill="#fff">{s.icon}</text>
      </g>
    );
  };
  const stringColor = (str: number) => {
    const st = statuses?.[str];
    return st && st !== 'silent-ok' ? STATUS_STYLE[st].color : 'var(--string)';
  };

  if (view === 'chart') {
    const W = 240, L = 40, R = 22, T = 44, fh = 50, H = T + nFrets * fh + (statuses ? 64 : 40);
    const sp = (W - L - R) / 5;
    const xs = (str: number) => L + (6 - str) * sp;
    return (
      <figure className="chord-diagram" style={{ width, maxWidth: '100%' }}>
        {title && <figcaption><span className="chord-id">{chord.id}</span> <span className="chord-name">{chord.name}</span></figcaption>}
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
          {/* frets */}
          {Array.from({ length: nFrets + 1 }, (_, i) => (
            <line key={`f${i}`} x1={L} x2={W - R} y1={T + i * fh} y2={T + i * fh}
              stroke={i === 0 && base === 1 ? 'var(--fg)' : 'var(--fret)'} strokeWidth={i === 0 && base === 1 ? 7 : 2} strokeLinecap="round" />
          ))}
          {/* fret numbers */}
          {Array.from({ length: nFrets }, (_, i) => (
            <text key={`n${i}`} x={L - 14} y={T + (i + 0.5) * fh + 5} textAnchor="middle" fontSize={13} fill="var(--muted)">{base + i}</text>
          ))}
          {/* strings */}
          {strings.map(s => (
            <line key={`s${s.string}`} x1={xs(s.string)} x2={xs(s.string)} y1={T} y2={T + nFrets * fh}
              stroke={stringColor(s.string)} strokeWidth={0.9 + s.string * 0.35 + (statuses?.[s.string] && statuses[s.string] !== 'silent-ok' ? 1 : 0)} />
          ))}
          {/* open / muted markers */}
          {strings.map(s => {
            const x = xs(s.string), y = T - 20;
            if (s.fret === 0) return <circle key={`o${s.string}`} cx={x} cy={y} r={8} fill="none" stroke="var(--fg)" strokeWidth={2.2} />;
            if (s.fret === null) return (
              <g key={`x${s.string}`} stroke="var(--muted)" strokeWidth={2.4} strokeLinecap="round">
                <line x1={x - 7} y1={y - 7} x2={x + 7} y2={y + 7} /><line x1={x + 7} y1={y - 7} x2={x - 7} y2={y + 7} />
              </g>
            );
            return null;
          })}
          {/* finger dots */}
          {strings.map(s => s.fret && s.fret > 0 ? dot(xs(s.string), T + (s.fret - base + 0.5) * fh, sp * 0.4, s.finger, s.string) : null)}
          {/* string names */}
          {strings.map(s => (
            <text key={`l${s.string}`} x={xs(s.string)} y={T + nFrets * fh + 22} textAnchor="middle" fontSize={14} fontWeight={600} fill="var(--muted)">{STRING_SHORT[s.string]}</text>
          ))}
          {statuses && strings.map(s => statusIcon(xs(s.string), T + nFrets * fh + 46, s.string))}
        </svg>
      </figure>
    );
  }

  // Player's view: neck horizontal, headstock left, low E at the top.
  const L = 64, T = 34, R = statuses ? 40 : 16, fw = 70, sh = 26;
  const W = L + nFrets * fw + R, H = T + 5 * sh + 26;
  const ys = (str: number) => T + (6 - str) * sh;
  return (
    <figure className="chord-diagram" style={{ width: width * 1.35, maxWidth: '100%' }}>
      {title && <figcaption><span className="chord-id">{chord.id}</span> <span className="chord-name">{chord.name} · player's view</span></figcaption>}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label + ". Shown as you see it looking down at the neck."}>
        {Array.from({ length: nFrets + 1 }, (_, i) => (
          <line key={`f${i}`} y1={T} y2={T + 5 * sh} x1={L + i * fw} x2={L + i * fw}
            stroke={i === 0 && base === 1 ? 'var(--fg)' : 'var(--fret)'} strokeWidth={i === 0 && base === 1 ? 7 : 2} strokeLinecap="round" />
        ))}
        {Array.from({ length: nFrets }, (_, i) => (
          <text key={`n${i}`} x={L + (i + 0.5) * fw} y={T - 14} textAnchor="middle" fontSize={13} fill="var(--muted)">{base + i}</text>
        ))}
        {strings.map(s => (
          <line key={`s${s.string}`} x1={L} x2={L + nFrets * fw} y1={ys(s.string)} y2={ys(s.string)}
            stroke={stringColor(s.string)} strokeWidth={0.9 + s.string * 0.35} />
        ))}
        {strings.map(s => (
          <text key={`l${s.string}`} x={14} y={ys(s.string) + 5} textAnchor="middle" fontSize={14} fontWeight={600} fill="var(--muted)">{STRING_SHORT[s.string]}</text>
        ))}
        {strings.map(s => {
          const x = L - 22, y = ys(s.string);
          if (s.fret === 0) return <circle key={`o${s.string}`} cx={x} cy={y} r={7} fill="none" stroke="var(--fg)" strokeWidth={2.2} />;
          if (s.fret === null) return (
            <g key={`x${s.string}`} stroke="var(--muted)" strokeWidth={2.4} strokeLinecap="round">
              <line x1={x - 6} y1={y - 6} x2={x + 6} y2={y + 6} /><line x1={x + 6} y1={y - 6} x2={x - 6} y2={y + 6} />
            </g>
          );
          return null;
        })}
        {strings.map(s => s.fret && s.fret > 0 ? dot(L + (s.fret - base + 0.62) * fw, ys(s.string), sh * 0.46, s.finger, s.string) : null)}
        {statuses && strings.map(s => statusIcon(W - 20, ys(s.string), s.string))}
        <text x={L} y={H - 4} fontSize={11} fill="var(--muted)">← headstock</text>
        <text x={L + nFrets * fw} y={H - 4} fontSize={11} textAnchor="end" fill="var(--muted)">body →</text>
      </svg>
    </figure>
  );
}

export function FingerLegend() {
  return (
    <ul className="finger-legend" aria-label="Finger colours">
      {[1, 2, 3, 4].map(f => (
        <li key={f}><span className="swatch" style={{ background: `var(--f${f})` }}>{f}</span>{FINGER_NAMES[f]}</li>
      ))}
    </ul>
  );
}
