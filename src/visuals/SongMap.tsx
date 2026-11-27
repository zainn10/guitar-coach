// Bar-by-bar map of a take: green = solid, amber = late or messy, red = struggling.
// Each bar shows a small timeline: the line is the beat, the dot is when you strummed.
import type { BarResult } from '../audio/performance';

const STATUS_TEXT = { green: 'solid', amber: 'a bit late or messy', red: 'struggling' };

export function SongMap({ bars, beatMs, selected, onSelect }: { bars: BarResult[]; beatMs: number; selected?: number; onSelect?: (bar: number) => void }) {
  return (
    <ol className="song-map" aria-label="Song map">
      {bars.map(b => {
        const pos = b.offsetMs === null ? null : Math.max(-0.5, Math.min(1.5, b.offsetMs / beatMs));
        return (
          <li key={b.bar}>
            <button className={`bar-cell s-${b.status} ${selected === b.bar ? 'sel' : ''}`} onClick={() => onSelect?.(b.bar)}
              aria-label={`Bar ${b.bar}, ${b.chord}: ${STATUS_TEXT[b.status]}${b.offsetMs !== null ? `, ${Math.round(b.offsetMs)} milliseconds ${b.offsetMs >= 0 ? 'late' : 'early'}` : ', no strum heard'}`}>
              <span className="bar-no">{b.bar}</span>
              <span className="bar-chord">{b.chord}</span>
              <svg viewBox="0 0 100 16" className="bar-timing" aria-hidden>
                <line x1={0} x2={100} y1={8} y2={8} stroke="currentColor" strokeOpacity={0.25} strokeWidth={2} />
                <line x1={25} x2={25} y1={1} y2={15} stroke="currentColor" strokeOpacity={0.7} strokeWidth={2} />
                {pos !== null ? <circle cx={25 + pos * 50} cy={8} r={5} fill="currentColor" /> : <text x={60} y={12} fontSize={10} fill="currentColor">none</text>}
              </svg>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function SongMapKey() {
  return (
    <ul className="map-key">
      <li><span className="k s-green" /> Solid</li>
      <li><span className="k s-amber" /> A bit late or messy</li>
      <li><span className="k s-red" /> Struggling</li>
      <li className="muted small">In each bar the upright line is the beat and the dot is your strum.</li>
    </ul>
  );
}
