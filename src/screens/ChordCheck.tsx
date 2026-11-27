import { useRef, useState } from 'react';
import { engine } from '../audio/engine';
import { analyseChord, ChordResult } from '../audio/chordCheck';
import { useStrums } from '../audio/useStrums';
import { addStrum } from '../audio/synth';
import { STRING_SHORT, STRING_LABEL, chordStrings } from '../audio/notes';
import { analysePlucks, StringCheckResult, PluckStatus } from '../audio/stringCheck';
import type { StringStatus } from '../audio/chordCheck';

const PLUCK_TO_STATUS: Record<PluckStatus, StringStatus> = { ok: 'ok', muted: 'damped', 'wrong-note': 'wrong-note', 'not-played': 'missing' };
import { encodeWav } from '../audio/wav';
import { saveRecording } from '../storage/folder';
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
        <p className="lead">Make the shape, then either <strong>strum</strong> it once and let it ring (quick check), or switch to <strong>String by string</strong> and pluck each string on its own (checks every string).</p>
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

export function ChordCheckBody({ chordId }: { chordId: string }) {
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
  const [mode, setMode] = useState<'strum' | 'pluck'>('strum');
  const [plucks, setPlucks] = useState<number[]>([]);
  const pluckRef = useRef<number[]>([]);
  const [pluckResult, setPluckResult] = useState<StringCheckResult | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundingCount = chord.frets.filter(f => f !== null).length;
  const soundingStrings = chordStrings(chord).filter(s => s.midi !== null).map(s => s.string);

  const finishPlucks = async (frames: number[]) => {
    if (!frames.length) return;
    const sr = engine.sampleRate;
    const last = frames[frames.length - 1];
    try { await engine.waitForFrame(last + Math.round(0.3 * sr)); } catch { return; }
    const from = frames[0] - Math.round(0.4 * sr);
    const sig = engine.getRange(from, last + Math.round(0.3 * sr));
    const r = analysePlucks(sig, sr, frames.map(f => f - from), chord);
    lastFrame.current = frames[0];
    setPluckResult(r);
    store.addAttempt(chordId, { t: Date.now(), verdict: r.clean ? 'clean' : 'issues', issues: r.strings.filter(x => x.status !== 'ok').map(x => x.message) });
  };

  // String by string: collect single plucks, then check them all together.
  useStrums(frame => {
    poke(); setAutoOff(false);
    if (busy.current) return;
    if (pluckResult) setPluckResult(null);
    const next = [...(pluckResult ? [] : pluckRef.current), frame];
    pluckRef.current = next;
    setPlucks(next);
    if (finishTimer.current) clearTimeout(finishTimer.current);
    if (next.length >= soundingCount) { pluckRef.current = []; finishPlucks(next); }
    else finishTimer.current = setTimeout(() => { pluckRef.current = []; finishPlucks(next); }, 3000);
  }, buildStep === null && mode === 'pluck', () => setIgnored(n => n + 1), 'pluck');

  useStrums(async frame => {
    poke(); setAutoOff(false);
    if (mode !== 'strum') return;
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
  }, buildStep === null && mode === 'strum', () => setIgnored(n => n + 1));

  const pluckStatuses = pluckResult ? Object.fromEntries(pluckResult.strings.map(x => [x.string, PLUCK_TO_STATUS[x.status]])) : undefined;
  const switchMode = (m2: 'strum' | 'pluck') => { setMode(m2); setPlucks([]); pluckRef.current = []; setPluckResult(null); setResult(null); setPhase('listening'); };

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
            statuses={buildStep === null ? (mode === 'pluck' ? pluckStatuses : statuses) : undefined}
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
          <Card className={`result-card ${mode === 'strum' ? (result ? 'v-' + result.verdict : '') : (pluckResult ? (pluckResult.clean ? 'v-clean' : 'v-issues') : '')}`}>
            <div className="seg mode-seg" role="radiogroup" aria-label="How to check">
              <button role="radio" aria-checked={mode === 'strum'} className={mode === 'strum' ? 'on' : ''} onClick={() => switchMode('strum')}>Strum check</button>
              <button role="radio" aria-checked={mode === 'pluck'} className={mode === 'pluck' ? 'on' : ''} onClick={() => switchMode('pluck')}>String by string</button>
            </div>
            {mode === 'pluck' && (
              <div className="pluck-mode">
                {!pluckResult && (
                  <>
                    <div className="listening"><span className="pulse" aria-hidden /> <p><strong>Hold the {chord.id} shape and pluck each string on its own</strong>, from the thickest to the thinnest, about one per second. This checks every string, even the ones a strum can't separate.</p></div>
                    <ol className="pluck-progress" aria-label="Strings plucked so far">
                      {soundingStrings.map((st, i) => (
                        <li key={st} className={i < plucks.length ? 'done' : i === plucks.length ? 'next' : ''}>{STRING_SHORT[st]}</li>
                      ))}
                    </ol>
                    {plucks.length > 0 && <button className="btn link" onClick={() => { setPlucks([]); pluckRef.current = []; if (finishTimer.current) clearTimeout(finishTimer.current); }}>Start again</button>}
                  </>
                )}
                {pluckResult && (
                  <div className="result">
                    <h2 className="verdict">{pluckResult.clean ? 'Every string clear!' : 'Nearly there'}</h2>
                    <p>{pluckResult.summary}</p>
                    {!pluckResult.clean && (
                      <ul className="issues">
                        {pluckResult.strings.filter(x => x.status !== 'ok').map(x => <li key={x.string}><strong>{x.message}</strong> <span>{x.fix}</span></li>)}
                      </ul>
                    )}
                    <p className="small muted">Pluck the strings again to re-check.</p>
                    <button className="btn link" onClick={() => {
                      const f = lastFrame.current; const sr = engine.sampleRate;
                      if (f !== null) saveRecording(encodeWav(engine.getRange(f - Math.round(0.6 * sr), Math.min(engine.written, f + Math.round(8 * sr))), sr), `flagged-${chordId}-strings-${pluckResult.strings.map(x => x.string + x.status).join('_')}-${Date.now()}.wav`);
                    }}>That's not right: save this for Claude to look at</button>
                  </div>
                )}
              </div>
            )}
            {mode === 'strum' && phase === 'listening' && !result && (
              <div className="listening"><span className="pulse" aria-hidden /> <p><strong>Listening.</strong> Strum {chord.id} once and let it ring.</p></div>
            )}
            {mode === 'strum' && phase === 'hearing' && <div className="listening"><span className="pulse" aria-hidden /> <p><strong>Heard a strum…</strong> keep it ringing.</p></div>}
            {mode === 'strum' && result && phase !== 'hearing' && <ResultView result={result} onWrong={() => {
              const f = lastFrame.current;
              const sr = engine.sampleRate;
              if (f !== null) saveRecording(encodeWav(engine.getRange(f - Math.round(0.6 * sr), Math.min(engine.written, f + Math.round(2.4 * sr))), sr), `flagged-${chordId}-said-${result.verdict}-${result.issues.map(i => i.kind + i.string).join('_') || 'clean'}-${Date.now()}.wav`);
            }} />}
            <div className="row spread wrap listen-foot">
              <span className="small muted"><LevelMeter compact /> {ignored > 0 && <span key={ignored} className="fade">Small sound ignored</span>}</span>
              <StopListening />
            </div>
            {buildStep !== null && <p className="small muted">Listening is paused while you build the chord.</p>}
          </Card>

          <Card title="Mastery check">
            <p>Pass mark: <strong>{clean} clean out of the last {outOf}</strong> (strum checks and string-by-string checks both count).</p>
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
          <strong>Why the grey "?"</strong>: in this chord the {unsure.map(s => STRING_LABEL[s.string]).join(' and ')} string{unsure.length > 1 ? 's play' : ' plays'} the same note as another string (just higher or lower), so in a strum the two blur together and I can't tell them apart. That's not a mistake on your part. To check every string, switch to <strong>String by string</strong> above.
        </p>
      )}
      {onWrong && <button className="btn link" onClick={onWrong}>That's not right: save this strum for Claude to look at</button>}
    </div>
  );
}

