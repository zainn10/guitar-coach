// Build-the-chord: fingers added one at a time, each with a plain instruction.
import { useState } from 'react';
import { ChordShape } from '../audio/notes';
import { ChordDiagram } from './ChordDiagram';
import { playChord } from '../audio/sounds';
import { useStore } from '../ui';

export function BuildChord({ chord, onDone, width = 280 }: { chord: ChordShape; onDone?: () => void; width?: number }) {
  const { settings } = useStore();
  const steps = chord.steps ?? [];
  const [step, setStep] = useState(0);
  const text = step === 0
    ? 'Relax your hand. Thumb behind the neck, roughly behind your middle finger. Fingertips curved like you are holding a small ball.'
    : steps[step - 1].text;
  return (
    <div className="build-chord">
      <ChordDiagram chord={chord} view={settings.diagramView} width={width} visibleSteps={step} highlightString={step ? steps[step - 1].string : undefined} />
      <div className="build-steps">
        <ol className="build-progress" aria-hidden>
          {Array.from({ length: steps.length + 1 }, (_, i) => <li key={i} className={i <= step ? 'done' : ''} />)}
        </ol>
        <p className="build-text" aria-live="polite">{step === 0 ? 'Get ready' : `Step ${step} of ${steps.length}`}: {text}</p>
        <div className="row wrap">
          <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
          {step < steps.length
            ? <button className="btn primary" onClick={() => setStep(step + 1)}>Next finger</button>
            : <button className="btn primary" onClick={() => { setStep(0); onDone?.(); }}>Start again</button>}
          <button className="btn" onClick={() => playChord(chord)}>▶ Hear it</button>
        </div>
      </div>
    </div>
  );
}
