// Build-the-chord: the finished chord first, then it builds itself one finger at a time
// and loops, so the page shows the chord without any clicking. Pause or step through by hand.
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
  const label = phase === FULL ? `The whole chord: ${chord.name}` : phase === 0 ? 'Get ready' : `Finger ${phase} of ${n}`;
  const text = phase === FULL
    ? `${n} finger${n === 1 ? '' : 's'} down. Watch it build one finger at a time, or use Back and Next to go at your own pace.`
    : phase === 0
      ? 'Relax your hand. Thumb behind the neck, roughly behind your middle finger. Fingertips curved like you are holding a small ball.'
      : steps[phase - 1].text;
  return (
    <div className="build-chord">
      <ChordDiagram chord={chord} view={settings.diagramView} width={width} visibleSteps={visible} highlightString={phase > 0 && phase <= n ? steps[phase - 1].string : undefined} />
      <div className="build-steps">
        <ol className="build-progress" aria-hidden>
          {Array.from({ length: n + 1 }, (_, i) => <li key={i} className={i <= visible && phase !== 0 || i === 0 ? 'done' : ''} />)}
        </ol>
        <div className="row wrap build-controls">
          <button className="btn bc-fixed" onClick={() => setPlaying(v => !v)} aria-label={playing ? 'Pause the animation' : 'Play the animation'}>{playing ? '❚❚ Pause' : '▶ Animate'}</button>
          <button className="btn" disabled={phase === 0} onClick={() => go(phase === FULL ? n : phase - 1)}>Back</button>
          <button className="btn bc-fixed-wide" onClick={() => { if (phase >= FULL) { go(0); onDone?.(); } else go(phase + 1); }}>{phase >= FULL ? 'From the start' : 'Next finger'}</button>
          <button className="btn" onClick={() => playChord(chord)}>▶ Hear it</button>
        </div>
        <p className="build-text" aria-live={playing ? 'off' : 'polite'}><strong>{label}.</strong> {text}</p>
      </div>
    </div>
  );
}
