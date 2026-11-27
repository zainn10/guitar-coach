import { useRef, useState } from 'react';
import { engine } from '../audio/engine';
import { analyseChord, ChordResult } from '../audio/chordCheck';
import { useStrums } from '../audio/useStrums';
import { addStrum } from '../audio/synth';
import { STRING_SHORT, STRING_LABEL } from '../audio/notes';
import { encodeWav, downloadBlob } from '../audio/wav';
import { ChordDiagram, FingerLegend, statusStyle } from '../visuals/ChordDiagram';
import { CHORDS, PHASE0_CHORDS, chordById, THRESHOLDS } from '../content';
import { store, masteryState } from '../storage/store';
import { Card, MicGate, useStore, LevelMeter, StopListening, useAutoOff } from '../ui';

export function ChordCheck() {
  const [chordId, setChordId] = useState('Em');
  return (
    <div className="stack">
      <header className="page-head">
        <h1>Chord check</h1>
        <p className="lead">Make the shape, strum all the strings once (slowly is fine) and let it ring. The app tells you which strings rang clearly.</p>
      </header>
      <div className="chips" role="tablist" aria-label="Choose a chord">
        {PHASE0_CHORDS.map(id => <ChordChip key={id} id={id} selected={id === chordId} onClick={() => setChordId(id)} />)}
      </div>
      <ChordCheckBody key={chordId} chordId={chordId} />
    </div>
  );
}

function ChordChip({ id, selected, onClick }: { id: string; selected: boolean; onClick: () => void }) {
  const { attempts } = useStore();
  const m = masteryState(attempts[id], THRESHOLDS.mastery.cleanChord.clean, THRESHOLDS.mastery.cleanChord.outOf);
  return (
    <button role="tab" aria-selected={selected} className={`chip big ${selected ? 'on' : ''}`} onClick={onClick}>
      {id}{m.passed && <span className="pass-mark" aria-label="passed"> ✓</span>}
    </button>
  );
}

function ChordCheckBody({ chordId }: { chordId: string }) {
  const chord = chordById(chordId);
  const { settings, attempts } = useStore();
  const [result, setResult] = useState<ChordResult | null>(null);
  const lastFrame = useRef<number | null>(null);
  const [phase, setPhase] = useState<'listening' | 'hearing' | 'result'>('listening');
  const [buildStep, setBuildStep] = useState<number | null>(null);
  const busy = useRef(false);
  const [ignored, setIgnored] = useState(0);
  const [autoOff, setAutoOff] = useState(false);
  const poke = useAutoOff(120000, () => setAutoOff(true));
  const { clean, outOf } = THRESHOLDS.mastery.cleanChord;
  const m = masteryState(attempts[chordId], clean, outOf);

  useStrums(async frame => {
    poke(); setAutoOff(false);
    if (busy.current) return;
    busy.current = true;
    setPhase('hearing');
    const sr = engine.sampleRate;
    try {
      await engine.waitForFrame(frame + Math.round(0.65 * sr));
      const from = frame - Math.round(0.1 * sr);
      const sig = engine.getRange(from, frame + Math.round(0.7 * sr));
      const r = analyseChord(sig, sr, frame - from, chord, CHORDS, THRESHOLDS.chordCheck);
      lastFrame.current = frame;
      setResult(r);
      setPhase('result');
      if (r.verdict !== 'too-quiet') store.addAttempt(chordId, { t: Date.now(), verdict: r.verdict, issues: r.issues.map(i => i.message) });
    } catch { setPhase('listening'); }
    setTimeout(() => { busy.current = false; }, 400);
  }, buildStep === null, () => setIgnored(n => n + 1));

  const playRef = () => {
    if (!engine.ctx) return;
    const sr = engine.sampleRate;
    const buf = new Float32Array(sr * 4);
    addStrum(buf, sr, 0, chord, { gain: 0.35, spreadMs: 25 });
    busy.current = true; // don't analyse our own reference sound
    engine.play(buf);
    setTimeout(() => { busy.current = false; }, 4200);
  };

  const statuses = result ? Object.fromEntries(result.strings.map(s => [s.string, s.status])) : undefined;
  const steps = chord.steps ?? [];

  return (
    <div className="grid-2 check-grid">
      <Card className="diagram-card">
        <div className="row spread">
          <div className="seg" role="radiogroup" aria-label="Diagram view">
            <button role="radio" aria-checked={settings.diagramView === 'chart'} className={settings.diagramView === 'chart' ? 'on' : ''} onClick={() => store.setSettings({ diagramView: 'chart' })}>Chord chart</button>
            <button role="radio" aria-checked={settings.diagramView === 'player'} className={settings.diagramView === 'player' ? 'on' : ''} onClick={() => store.setSettings({ diagramView: 'player' })}>Player's view</button>
          </div>
          <button className="btn small" onClick={playRef} disabled={!engine.running}>▶ Hear it</button>
        </div>
        <div className="diagram-wrap">
          <ChordDiagram chord={chord} view={settings.diagramView} width={300}
            statuses={buildStep === null ? statuses : undefined}
            visibleSteps={buildStep ?? undefined}
            highlightString={buildStep ? steps[buildStep - 1]?.string : undefined} />
        </div>
        <FingerLegend />
        {chord.notes && <p className="small muted">{chord.notes}</p>}

        <div className="build">
          {buildStep === null ? (
            <button className="btn" onClick={() => setBuildStep(0)}>Build it one finger at a time</button>
          ) : (
            <div className="build-steps">
              <p className="build-text" aria-live="polite">
                {buildStep === 0 ? 'Start with your hand relaxed, thumb behind the neck roughly behind your middle finger.' : steps[buildStep - 1].text}
              </p>
              <div className="row">
                <button className="btn" disabled={buildStep === 0} onClick={() => setBuildStep(buildStep - 1)}>Back</button>
                {buildStep < steps.length
                  ? <button className="btn primary" onClick={() => setBuildStep(buildStep + 1)}>Next ({buildStep + 1} of {steps.length})</button>
                  : <button className="btn primary" onClick={() => setBuildStep(null)}>Done, check it</button>}
              </div>
            </div>
          )}
        </div>
      </Card>

      <MicGate why="Chord check listens to your strum through the microphone." note={autoOff ? <p className="note warn">The microphone switched itself off after 2 minutes without a strum.</p> : undefined}>
        <div className="stack">
          <Card className={`result-card ${result ? 'v-' + result.verdict : ''}`}>
            {phase === 'listening' && !result && (
              <div className="listening"><span className="pulse" aria-hidden /> <p><strong>Listening.</strong> Strum {chord.id} once and let it ring.</p></div>
            )}
            {phase === 'hearing' && <div className="listening"><span className="pulse" aria-hidden /> <p><strong>Heard a strum…</strong> keep it ringing.</p></div>}
            {result && phase !== 'hearing' && <ResultView result={result} onWrong={() => {
              const f = lastFrame.current;
              const sr = engine.sampleRate;
              if (f !== null) downloadBlob(encodeWav(engine.getRange(f - Math.round(0.6 * sr), Math.min(engine.written, f + Math.round(2.4 * sr))), sr), `flagged-${chordId}-said-${result.verdict}-${result.issues.map(i => i.kind + i.string).join('_') || 'clean'}-${Date.now()}.wav`);
            }} />}
            <div className="row spread wrap listen-foot">
              <span className="small muted"><LevelMeter compact /> {ignored > 0 && <span key={ignored} className="fade">Small sound ignored</span>}</span>
              <StopListening />
            </div>
            {buildStep !== null && <p className="small muted">Listening is paused while you build the chord.</p>}
          </Card>

          <Card title="Mastery check">
            <p>Pass mark: <strong>{clean} clean strums out of the last {outOf}</strong>.</p>
            <div className="attempt-dots" aria-label={`${m.cleanCount} clean out of the last ${m.last.length}`}>
              {Array.from({ length: outOf }, (_, i) => {
                const a = m.last[i];
                return <span key={i} className={`ad ${a ? (a.verdict === 'clean' ? 'good' : 'bad') : ''}`} title={a?.verdict}>{a ? (a.verdict === 'clean' ? '✓' : '✕') : ''}</span>;
              })}
            </div>
            {m.passed
              ? <p className="note ok"><strong>Passed.</strong> {chord.id} is solid. Keep it fresh by checking it now and then.</p>
              : <p className="small muted">{m.last.length < outOf ? `${outOf - m.last.length} more strum${outOf - m.last.length > 1 ? 's' : ''} to fill the row.` : 'Keep going. Only your last few strums count.'}</p>}
          </Card>
        </div>
      </MicGate>
    </div>
  );
}

function ResultView({ result, onWrong }: { result: ChordResult; onWrong?: () => void }) {
  const head = { clean: 'Clean!', issues: 'Nearly there', 'wrong-chord': 'Different chord', 'too-quiet': 'Too quiet' }[result.verdict];
  const unsure = result.strings.filter(s => s.status === 'unsure');
  return (
    <div className="result">
      <h2 className="verdict">{head}</h2>
      <p>{result.summary}</p>
      {result.issues.some(i => i.certain) && (
        <ul className="issues">
          {result.issues.filter(i => i.certain).map((i, k) => (
            <li key={k}><strong>{i.message}</strong> <span>{i.fix}</span></li>
          ))}
        </ul>
      )}
      {result.issues.some(i => !i.certain) && (
        <div className="maybe">
          <p className="small"><strong>Worth a glance</strong> (I'm not sure about these):</p>
          <ul className="issues small">
            {result.issues.filter(i => !i.certain).map((i, k) => <li key={k}>{i.message} <span>{i.fix}</span></li>)}
          </ul>
        </div>
      )}
      <table className="string-table">
        <caption className="sr-only">Each string</caption>
        <tbody>
          {result.strings.filter(s => s.status !== 'silent-ok').map(s => {
            const st = statusStyle(s.status);
            return (
              <tr key={s.string}>
                <th scope="row">{STRING_SHORT[s.string]}</th>
                <td><span className="status-dot" style={{ background: st.color }}>{st.icon}</span> {st.label}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {unsure.length > 0 && (
        <p className="small muted">
          The {unsure.map(s => STRING_LABEL[s.string]).join(' and ')} string{unsure.length > 1 ? 's play' : ' plays'} the same note as another string an octave apart, so I can't check {unsure.length > 1 ? 'them' : 'it'} on {unsure.length > 1 ? 'their' : 'its'} own yet.
        </p>
      )}
      {onWrong && <button className="btn link" onClick={onWrong}>That's not right: save this strum for Claude to look at</button>}
    </div>
  );
}

