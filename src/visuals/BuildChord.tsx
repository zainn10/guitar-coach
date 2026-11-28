// Build-the-chord: the finished chord first, then it builds itself one finger at a time
// and loops, so the page shows the chord without any clicking. Pause or step through by hand.
// Layout never moves while it plays: buttons sit above the text with fixed widths, and the
// text box is always as tall as its longest step.
import { useEffect, useState } from 'react';
import { ChordShape } from '../audio/notes';
import { ChordDiagram } from './ChordDiagram';
import { playChord } from '../audio/sounds';
import { useStore } from '../ui';

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function BuildChord({ chord, onDone, width = 280 }: { chord: ChordShape; onDone?: () => void; width?: number }) {
  const { settings } = useStore();
  const steps = chord.steps ?? [];
  const n = steps.length;
  const FULL = n + 1; // phase after the last finger: the whole chord, held for a moment
  const [phase, setPhase] = useState(FULL);
  const [playing, setPlaying] = useState(() => !reducedMotion() && n > 0);

  useEffect(() => {
    if (!playing) return;
    // time to look: longer on the finished chord, enough to read each finger's instruction
    const ms = phase === FULL ? 3500 : phase === 0 ? 1600 : 2600;
    const id = setTimeout(() => setPhase(p => (p >= FULL ? 0 : p + 1)), ms);
    return () => clearTimeout(id);
  }, [playing, phase, FULL]);

  const go = (p: number) => { setPlaying(false); setPhase(Math.max(0, Math.min(FULL, p))); };
  const visible = phase === FULL ? n : phase;
  const labelOf = (ph: number) => (ph === FULL ? `The whole chord: ${chord.name}` : ph === 0 ? 'Get ready' : `Finger ${ph} of ${n}`);
  const textOf = (ph: number) => (ph === FULL
    ? `${n} finger${n === 1 ? '' : 's'} down. Watch it build one finger at a time, or use Back and Next to go at your own pace.`
    : ph === 0
      ? 'Relax your hand. Thumb behind the neck, roughly behind your middle finger. Fingertips curved like you are holding a small ball.'
      : steps[ph - 1].text);
  return (
    <div className="build-chord">
      <ChordDiagram chord={chord} view={settings.diagramView} width={width} visibleSteps={visible} highlightString={phase > 0 && phase <= n ? steps[phase - 1].string : undefined} />
      <div className="build-steps">
        <ol className="build-progress" aria-hidden>
          {Array.from({ length: n + 1 }, (_, i) => <li key={i} className={(i <= visible && phase !== 0) || i === 0 ? 'done' : ''} />)}
        </ol>
        <div className="row wrap build-controls">
          <button className="btn bc-fixed" onClick={() => setPlaying(v => !v)} aria-label={playing ? 'Pause the animation' : 'Play the animation'}>{playing ? '❚❚ Pause' : '▶ Animate'}</button>
          <button className="btn" disabled={phase === 0} onClick={() => go(phase === FULL ? n : phase - 1)}>Back</button>
          <button className="btn bc-fixed-wide" onClick={() => { if (phase >= FULL) { go(0); onDone?.(); } else go(phase + 1); }}>{phase >= FULL ? 'From the start' : 'Next finger'}</button>
          <button className="btn" onClick={() => playChord(chord)}>▶ Hear it</button>
        </div>
        {/* every step's text sits in the same spot; only the current one is visible */}
        <div className="build-text-stack">
          {Array.from({ length: FULL + 1 }, (_, ph) => (
            <p key={ph} className="build-text" aria-hidden={ph !== phase} aria-live={ph === phase && !playing ? 'polite' : 'off'} style={{ visibility: ph === phase ? 'visible' : 'hidden' }}>
              <strong>{labelOf(ph)}.</strong> {textOf(ph)}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
