import { useEffect, useRef, useState } from 'react';
import { engine } from '../audio/engine';
import { detectPitch, tunerReading, TunerReading, TunerSmoother } from '../audio/tuner';
import { OPEN_STRING_MIDI, midiToFreq, STRING_SHORT, STRING_LABEL, noteName, ordinal } from '../audio/notes';
import { addPluck } from '../audio/synth';
import { Card, MicGate, useStore, StopListening, useAutoOff } from '../ui';
import { THRESHOLDS } from '../content';

export function Tuner() {
  return (
    <div className="stack">
      <header className="page-head">
        <h1>Tuner</h1>
        <p className="lead">Pluck one string at a time and let it ring. New nylon strings stretch for a week or two, so expect to retune often.</p>
      </header>
      <MicGate why="The tuner listens to each string through the microphone."><TunerBody /></MicGate>
    </div>
  );
}

function TunerBody() {
  useStore();
  const [only, setOnly] = useState<number | undefined>(undefined);
  const [reading, setReading] = useState<TunerReading | null>(null);
  const [cents, setCents] = useState(0);
  const lastHeard = useRef(0);
  const smoother = useRef(new TunerSmoother());
  const poke = useAutoOff(120000);

  useEffect(() => {
    smoother.current.reset();
    const id = setInterval(() => {
      const buf = engine.latest(4096);
      const p = detectPitch(buf, engine.sampleRate);
      if (p) {
        const r = tunerReading(p.freq, p.clarity, only);
        setReading(r);
        setCents(smoother.current.push(r.cents));
        lastHeard.current = performance.now();
        poke();
      } else if (performance.now() - lastHeard.current > 1500) {
        setReading(null);
        smoother.current.reset();
      }
    }, 50);
    return () => clearInterval(id);
  }, [only, poke]);

  const inTune = reading && Math.abs(cents) <= THRESHOLDS.tuner.inTuneCents;
  const close = reading && Math.abs(cents) <= THRESHOLDS.tuner.closeCents;
  const advice = !reading ? 'Pluck a string…'
    : inTune ? 'In tune'
      : cents < 0 ? 'Too low: tighten the string (tune up)' : 'Too high: loosen the string (tune down)';

  const playRef = (s: number) => {
    const sr = engine.sampleRate;
    const buf = new Float32Array(sr * 3);
    addPluck(buf, sr, 0, midiToFreq(OPEN_STRING_MIDI[s]), { gain: 0.5 });
    engine.play(buf);
  };

  return (
    <div className="grid-2 tuner-grid">
      <Card className="tuner-card">
        <div className={`tuner-note ${inTune ? 'good' : close ? 'close' : ''}`}>
          <span className="big">{reading ? STRING_SHORT[reading.string] : '–'}</span>
          <span className="sub">{reading ? `${reading.stringLabel} string · ${noteName(OPEN_STRING_MIDI[reading.string])}` : 'Listening'}</span>
        </div>
        <Needle cents={reading ? cents : null} />
        <p className={`advice ${inTune ? 'good' : ''}`} aria-live="polite">{advice}</p>
        {reading && <p className="small muted center">{reading.freq.toFixed(1)} Hz · {cents > 0 ? '+' : ''}{cents.toFixed(0)} cents</p>}
        <div className="center-row"><StopListening label="Finished tuning: mic off" /></div>
        <p className="small muted center">The microphone switches itself off after 2 minutes without a note.</p>
      </Card>
      <Card title="Strings">
        <p className="small">"Auto" picks the nearest string. If a string is very far out, choose it here so the tuner doesn't jump to the wrong one.</p>
        <div className="string-buttons">
          <button className={`chip ${only === undefined ? 'on' : ''}`} onClick={() => setOnly(undefined)}>Auto</button>
          {[6, 5, 4, 3, 2, 1].map(s => (
            <button key={s} className={`chip ${only === s ? 'on' : ''}`} onClick={() => setOnly(s)} aria-label={`Tune the ${STRING_LABEL[s]} string`}>
              {STRING_SHORT[s]}<small>{ordinal(s)}</small>
            </button>
          ))}
        </div>
        <h3>Hear the right note</h3>
        <div className="string-buttons">
          {[6, 5, 4, 3, 2, 1].map(s => <button key={s} className="chip" onClick={() => playRef(s)}>▶ {STRING_SHORT[s]}</button>)}
        </div>
        <p className="small muted">Standard tuning, thickest to thinnest: E A D G B E. A memory aid: <em>Every Angry Dog Growls Barks Eats</em>.</p>
      </Card>
    </div>
  );
}

function Needle({ cents }: { cents: number | null }) {
  const c = cents === null ? 0 : Math.max(-50, Math.min(50, cents));
  const angle = (c / 50) * 60;
  const color = cents === null ? 'var(--muted)' : Math.abs(c) <= 5 ? 'var(--ok)' : Math.abs(c) <= 15 ? 'var(--warn)' : 'var(--bad)';
  return (
    <svg viewBox="0 0 300 170" className="needle" role="img" aria-label={cents === null ? 'No note' : `${Math.round(c)} cents`}>
      {[-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50].map(t => {
        const a = ((t / 50) * 60 - 90) * Math.PI / 180;
        const r1 = t % 50 === 0 || t === 0 ? 118 : 126;
        return <line key={t} x1={150 + Math.cos(a) * r1} y1={150 + Math.sin(a) * r1} x2={150 + Math.cos(a) * 136} y2={150 + Math.sin(a) * 136} stroke={t === 0 ? 'var(--ok)' : 'var(--fret)'} strokeWidth={t === 0 ? 4 : 2} />;
      })}
      <path d={describeArc(150, 150, 140, -6, 6)} stroke="var(--ok)" strokeWidth={10} fill="none" opacity={0.35} />
      <text x={30} y={165} fontSize={13} fill="var(--muted)">low</text>
      <text x={270} y={165} fontSize={13} fill="var(--muted)" textAnchor="end">high</text>
      <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '150px 150px', transition: 'transform 120ms linear' }}>
        <line x1={150} y1={150} x2={150} y2={26} stroke={color} strokeWidth={5} strokeLinecap="round" />
      </g>
      <circle cx={150} cy={150} r={9} fill={color} />
    </svg>
  );
}

function describeArc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.cos((a - 90) * Math.PI / 180), cy + r * Math.sin((a - 90) * Math.PI / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
}
