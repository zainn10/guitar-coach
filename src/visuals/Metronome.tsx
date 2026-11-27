import { useEffect, useRef, useState } from 'react';
import { startLoop, Loop } from '../audio/scheduler';
import { playClick } from '../audio/sounds';

export function Metronome({ initialBpm = 60, compact = false, onBpm }: { initialBpm?: number; compact?: boolean; onBpm?: (b: number) => void }) {
  const [bpm, setBpm] = useState(initialBpm);
  const [beats, setBeats] = useState(4);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);
  const loop = useRef<Loop | null>(null);
  const taps = useRef<number[]>([]);

  useEffect(() => () => loop.current?.stop(), []);
  useEffect(() => { onBpm?.(bpm); }, [bpm, onBpm]);
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const draw = () => { const l = loop.current; if (l) setBeat(l.current()); raf = requestAnimationFrame(draw); };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const start = async (b = bpm, n = beats) => {
    loop.current?.stop();
    loop.current = await startLoop({ bpm: b, slotsPerBeat: 1, schedule: (i, t) => playClick(t, i % n === 0) });
    setRunning(true);
  };
  const stop = () => { loop.current?.stop(); loop.current = null; setRunning(false); setBeat(-1); };
  const change = (b: number) => { const v = Math.max(30, Math.min(220, b)); setBpm(v); if (running) start(v); };
  const tap = () => {
    const now = performance.now();
    taps.current = [...taps.current.filter(t => now - t < 3000), now];
    if (taps.current.length >= 3) {
      const gaps = taps.current.slice(1).map((t, i) => t - taps.current[i]);
      change(Math.round(60000 / (gaps.reduce((a, c) => a + c, 0) / gaps.length)));
    }
  };

  return (
    <div className={`metronome ${compact ? 'compact' : ''}`}>
      <div className="met-dots" aria-hidden>
        {Array.from({ length: beats }, (_, i) => <span key={i} className={`md ${running && beat >= 0 && beat % beats === i ? 'on' : ''} ${i === 0 ? 'accent' : ''}`} />)}
      </div>
      <div className="met-bpm">
        <button className="btn small" onClick={() => change(bpm - 5)} aria-label="5 slower">−5</button>
        <label className="met-value"><span className="sr-only">Beats per minute</span>
          <input type="number" min={30} max={220} value={bpm} onChange={e => change(+e.target.value || bpm)} /> <span>bpm</span>
        </label>
        <button className="btn small" onClick={() => change(bpm + 5)} aria-label="5 faster">+5</button>
      </div>
      <input className="met-slider" type="range" min={30} max={200} value={bpm} onChange={e => change(+e.target.value)} aria-label="Tempo" />
      <div className="row wrap center-row">
        {running ? <button className="btn primary" onClick={stop}>■ Stop</button> : <button className="btn primary" onClick={() => start()}>▶ Start</button>}
        <button className="btn" onClick={tap}>Tap tempo</button>
        <select aria-label="Beats per bar" value={beats} onChange={e => { const n = +e.target.value; setBeats(n); if (running) start(bpm, n); }}>
          {[2, 3, 4, 6].map(n => <option key={n} value={n}>{n} beats per bar</option>)}
        </select>
      </div>
    </div>
  );
}
