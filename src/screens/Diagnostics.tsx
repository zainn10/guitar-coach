import { useState } from 'react';
import { engine } from '../audio/engine';
import { detectOnsets } from '../audio/onset';
import { analyseChord, ChordResult } from '../audio/chordCheck';
import { encodeWav, downloadBlob } from '../audio/wav';
import { STRING_SHORT } from '../audio/notes';
import { CHORDS, PHASE0_CHORDS, chordById, THRESHOLDS } from '../content';
import { effectiveLatency } from '../storage/store';
import { Card, MicGate, useEngineState, useStore, StopListening } from '../ui';

export function Diagnostics() {
  return (
    <div className="stack">
      <header className="page-head">
        <h1>Diagnostics</h1>
        <p className="lead">If the app hears something wrong, record a short example here and save it as a sound file. Sending me those files is the fastest way to tune detection to your guitar and room.</p>
      </header>
      <MicGate why="Diagnostics records a short clip from the microphone."><Body /></MicGate>
    </div>
  );
}

function Body() {
  const eng = useEngineState();
  const { settings } = useStore();
  const [chordId, setChordId] = useState('Em');
  const [rec, setRec] = useState<{ sig: Float32Array; sr: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ onsets: number[]; results: ChordResult[] } | null>(null);
  const lat = effectiveLatency(settings);

  const record = async () => {
    setBusy(true); setReport(null);
    const sr = engine.sampleRate;
    const from = engine.written;
    const to = from + 5 * sr;
    await engine.waitForFrame(to, 8000);
    const sig = engine.getRange(from, to);
    setRec({ sig, sr });
    const onsets = detectOnsets(sig, sr);
    const results = onsets.filter(o => o.frame + 0.65 * sr < sig.length).map(o => analyseChord(sig, sr, o.frame, chordById(chordId), CHORDS, THRESHOLDS.chordCheck));
    setReport({ onsets: onsets.map(o => o.frame / sr), results });
    setBusy(false);
  };

  return (
    <div className="grid-2">
      <Card title="Record a 5-second example">
        <div className="chips">
          {PHASE0_CHORDS.map(id => <button key={id} className={`chip ${chordId === id ? 'on' : ''}`} onClick={() => setChordId(id)}>{id}</button>)}
        </div>
        <p className="small">Pick the chord you're trying to play, press Record, then strum it once or twice.</p>
        <StopListening />
        <div className="row">
          <button className="btn primary" onClick={record} disabled={busy}>{busy ? 'Recording…' : 'Record 5 seconds'}</button>
          {rec && <button className="btn" onClick={() => engine.play(rec.sig)}>▶ Play back</button>}
          {rec && <button className="btn" onClick={() => downloadBlob(encodeWav(rec.sig, rec.sr), `chord-${chordId}-${Date.now()}.wav`)}>Save .wav</button>}
        </div>
        {report && (
          <div className="diag">
            <p>Strums found at: {report.onsets.length ? report.onsets.map(t => t.toFixed(2) + ' s').join(', ') : 'none'}</p>
            {report.results.map((r, i) => (
              <div key={i} className="diag-row">
                <strong>Strum {i + 1}: {r.verdict}</strong> (sounds most like {r.bestMatch.id}; level {r.levelDb.toFixed(0)} dB)
                <div className="mono small">{r.strings.map(s => `${STRING_SHORT[s.string]}: ${s.status} ${s.evidenceDb > -90 ? s.evidenceDb.toFixed(0) + 'dB' : ''}`).join(' · ')}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card title="Audio details">
        <dl className="facts">
          <dt>Microphone</dt><dd>{eng.label || 'default'}</dd>
          <dt>Sample rate</dt><dd>{eng.sampleRate} Hz</dd>
          <dt>Voice processing</dt><dd>{Object.entries(eng.processing).map(([k, v]) => `${k}: ${v ? 'ON' : 'off'}`).join(', ') || 'unknown'}</dd>
          <dt>Browser output delay</dt><dd>{engine.ctx ? `${Math.round((engine.ctx.baseLatency + (engine.ctx.outputLatency || 0)) * 1000)} ms` : '–'}</dd>
          <dt>Timing delay in use</dt><dd>{lat.ms} ms ({lat.source})</dd>
          <dt>Settings file</dt><dd className="small">Pass marks and detection settings live in <code>content/config/thresholds.json</code>.</dd>
        </dl>
      </Card>
    </div>
  );
}
