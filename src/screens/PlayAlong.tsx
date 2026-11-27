import { useEffect, useRef, useState } from 'react';
import { engine } from '../audio/engine';
import { scheduleClicks } from '../audio/metronome';
import { analyseTake, TakeResult } from '../audio/performance';
import { useStrums } from '../audio/useStrums';
import { addStrum, addClick } from '../audio/synth';
import { encodeWav } from '../audio/wav';
import { saveRecording } from '../storage/folder';
import { ChordDiagram, statusStyle } from '../visuals/ChordDiagram';
import { SongMap, SongMapKey } from '../visuals/SongMap';
import { CHORDS, FIRST_SONG, chordById, THRESHOLDS } from '../content';
import { store, effectiveLatency } from '../storage/store';
import { STRING_SHORT } from '../audio/notes';
import { Card, useStore, startMic, stopMic, micErrorText, MicIcon } from '../ui';

type Phase = 'idle' | 'running' | 'analysing' | 'done';

interface Take { signal: Float32Array; sr: number; downbeats: number[]; result: TakeResult; bpm: number }

export function PlayAlong() {
  const song = FIRST_SONG;
  return (
    <div className="stack">
      <header className="page-head">
        <h1>Play-along: {song.title}</h1>
        <p className="lead">An original 8-bar practice progression. Strum <strong>once</strong> on the first beat of each bar and let it ring while you count to four. Use the 3 free beats to move to the next chord.</p>
      </header>
      <PlayAlongBody />
    </div>
  );
}

function PlayAlongBody() {
  const song = FIRST_SONG;
  const { settings, takes } = useStore();
  const [bpm, setBpm] = useState(song.bpm);
  const [phase, setPhase] = useState<Phase>('idle');
  const [pos, setPos] = useState<{ bar: number; beat: number } | null>(null);
  const [flash, setFlash] = useState(0);
  const [take, setTake] = useState<Take | null>(null);
  const [sel, setSel] = useState<number | undefined>(undefined);
  const cancel = useRef<() => void>(() => {});
  const lat = effectiveLatency(settings);
  const [err, setErr] = useState<string | null>(null);

  useStrums(() => setFlash(f => f + 1), phase === 'running');
  useEffect(() => () => cancel.current(), []);

  const start = async () => {
    setErr(null);
    try { await startMic(); } catch (e) { setErr(micErrorText(e)); return; }
    const ctx = engine.ctx!;
    const sr = engine.sampleRate;
    const beatDur = 60 / bpm;
    const bpb = song.beatsPerBar;
    const barDur = beatDur * bpb;
    const totalBeats = (song.countInBars + song.bars.length) * bpb;
    const t0 = ctx.currentTime + 0.6;
    const clicks = scheduleClicks(ctx, t0, totalBeats, beatDur, bpb, settings.headphones ? 0.5 : 0.35);
    const end = t0 + totalBeats * beatDur;
    setTake(null); setSel(undefined); setPhase('running');
    let stopped = false;
    const timer = setInterval(() => {
      const b = Math.floor((ctx.currentTime - t0) / beatDur);
      if (b < 0) return setPos({ bar: -1, beat: -1 });
      setPos({ bar: Math.floor(b / bpb) - song.countInBars, beat: b % bpb });
    }, 25);
    cancel.current = () => { stopped = true; clicks.cancel(); clearInterval(timer); stopMic(); setPos(null); setPhase('idle'); };

    const L = Math.round((lat.ms / 1000) * sr);
    const recFrom = Math.round(t0 * sr) - Math.round(0.3 * sr);
    const recTo = Math.round(end * sr) + L + Math.round(0.3 * sr);
    try {
      await engine.waitForFrame(recTo, (end - ctx.currentTime) * 1000 + 5000);
    } catch { if (!stopped) cancel.current(); return; }
    if (stopped) return;
    clearInterval(timer); setPos(null); setPhase('analysing');
    const signal = engine.getRange(recFrom, recTo);
    stopMic(); // the take is over: microphone off
    await new Promise(r => setTimeout(r, 30));
    const downbeats = song.bars.map((_, i) => Math.round((t0 + (song.countInBars + i) * barDur) * sr) + L - recFrom);
    const result = analyseTake({ signal, sampleRate: sr, song, downbeatFrames: downbeats, library: CHORDS, timing: THRESHOLDS.timing, chordSettings: THRESHOLDS.chordCheck, sensitivity: settings.sensitivity });
    setTake({ signal, sr, downbeats, result, bpm });
    store.addTake({ t: Date.now(), song: song.id, statuses: result.bars.map(b => b.status), headline: result.headline, meanAbsOffsetMs: result.meanAbsOffsetMs, latencyMs: lat.ms });
    setPhase('done');
    const firstBad = result.bars.find(b => b.status !== 'green');
    setSel(firstBad?.bar);
  };

  const running = phase === 'running';
  const curBar = pos && pos.bar >= 0 ? pos.bar : 0;
  const counting = running && (!pos || pos.bar < 0);
  const current = chordById(song.bars[Math.min(curBar, song.bars.length - 1)]);
  const next = song.bars[curBar + 1] ? chordById(song.bars[curBar + 1]) : null;
  const history = takes.filter(t => t.song === song.id).slice(-8);

  return (
    <div className="stack">
      <Card className="play-card">
        <div className="row spread wrap">
          <div className="row wrap">
            <span className="muted">Tempo</span>
            {[50, 60, 70].map(b => <button key={b} className={`chip ${bpm === b ? 'on' : ''}`} disabled={running} onClick={() => setBpm(b)}>{b} bpm</button>)}
          </div>
          <span className="small muted">Timing delay: {lat.ms} ms ({lat.source}){settings.headphones ? ' · headphones' : ' · speakers'}</span>
        </div>

        <ol className="bar-strip" aria-label="Chords in the progression">
          {song.bars.map((c, i) => (
            <li key={i} className={`${running && !counting && i === curBar ? 'now' : ''} ${take ? 's-' + take.result.bars[i].status : ''}`}>
              <span className="bar-no">{i + 1}</span>{c}
            </li>
          ))}
        </ol>

        {(running || phase === 'idle') && (
          <div className="stage">
            <div className="stage-main">
              <p className="stage-label">{counting ? 'Get ready' : running ? 'Now' : 'First chord'}</p>
              <ChordDiagram chord={current} view={settings.diagramView} width={240} />
            </div>
            <div className="stage-side">
              <div className={`beats ${counting ? 'countin' : ''}`} aria-live="off">
                {Array.from({ length: song.beatsPerBar }, (_, i) => (
                  <span key={i} className={`beat ${pos && pos.beat === i ? 'on' : ''} ${i === 0 ? 'strum' : ''}`}>{i === 0 && !counting ? 'STRUM' : i + 1}</span>
                ))}
              </div>
              <p className="small muted">{counting ? 'Count-in: listen to 4 clicks, then strum on the next "1".' : running ? 'Strum on 1, then move to the next chord.' : `${song.bars.length} bars · one strum per bar`}</p>
              <div className={`heard ${flash ? 'f' + (flash % 2) : ''}`} aria-hidden>{running ? 'strum heard' : ''}</div>
              {next && running && !counting && <div className="next"><p className="stage-label">Next</p><ChordDiagram chord={next} view={settings.diagramView} width={140} /></div>}
            </div>
          </div>
        )}

        <div className="row">
          {!running
            ? <button className="btn primary big" onClick={start} disabled={phase === 'analysing'}>{phase === 'analysing' ? 'Checking your take…' : take ? 'Play again' : 'Start'}</button>
            : <button className="btn big stop" onClick={() => cancel.current()}>Stop (mic off)</button>}
          <span className="small muted"><MicIcon on={running} /> {running ? 'Microphone on for this take. Press Stop to switch it off now.' : 'The microphone switches on when you press Start and off as soon as the take ends.'}</span>
        </div>
        {err && <p className="error" role="alert">{err}</p>}
        {!settings.headphones && <p className="small muted">Tip: wired headphones keep the click out of the microphone.</p>}
      </Card>

      {take && phase === 'done' && <TakeView take={take} sel={sel} setSel={setSel} />}

      {history.length > 0 && (
        <Card title="Your recent takes">
          <ul className="history">
            {history.slice().reverse().map(t => (
              <li key={t.t}>
                <span className="mini-map">{t.statuses.map((s, i) => <i key={i} className={`s-${s}`} />)}</span>
                <span>{new Date(t.t).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="muted small">{t.statuses.filter(s => s === 'green').length}/{t.statuses.length} solid{t.meanAbsOffsetMs != null ? ` · avg ${Math.round(t.meanAbsOffsetMs)} ms off the beat` : ''}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function TakeView({ take, sel, setSel }: { take: Take; sel?: number; setSel: (b: number) => void }) {
  const { settings } = useStore();
  const { result } = take;
  const beatMs = 60000 / take.bpm;
  const bar = sel ? result.bars[sel - 1] : null;

  const playMine = (i: number) => {
    const a = take.downbeats[i] - Math.round(0.3 * take.sr);
    const len = Math.round(((beatMs * FIRST_SONG.beatsPerBar) / 1000) * take.sr);
    engine.play(take.signal.slice(Math.max(0, a), a + len));
  };
  const playRef = (i: number) => {
    const sr = engine.sampleRate;
    const beat = Math.round((beatMs / 1000) * sr);
    const buf = new Float32Array(beat * FIRST_SONG.beatsPerBar + Math.round(0.3 * sr));
    const start = Math.round(0.3 * sr);
    for (let b = 0; b < FIRST_SONG.beatsPerBar; b++) addClick(buf, sr, start + b * beat, b === 0, 0.25);
    addStrum(buf, sr, start, chordById(result.bars[i].chord), { gain: 0.3, spreadMs: 20 });
    engine.play(buf);
  };

  return (
    <Card title="Song map">
      <p className="headline">{result.headline}</p>
      <SongMap bars={result.bars} beatMs={beatMs} selected={sel} onSelect={setSel} />
      <SongMapKey />
      {bar && (
        <div className={`bar-detail s-${bar.status}`}>
          <div className="row spread wrap">
            <h3>Bar {bar.bar}: {bar.prevChord && bar.prevChord !== bar.chord ? `${bar.prevChord} → ${bar.chord}` : bar.chord}</h3>
            <div className="row">
              <button className="btn small" onClick={() => playMine(bar.bar - 1)}>▶ My bar</button>
              <button className="btn small" onClick={() => playRef(bar.bar - 1)}>▶ How it should sound</button>
            </div>
          </div>
          <div className="grid-2 detail-grid">
            <div>
              {bar.messages.length ? (
                <ul className="issues">{bar.messages.map((m, k) => <li key={k}>{m.replace(/^Bar \d+( \([^)]*\))?: /, '')}</li>)}</ul>
              ) : <p className="note ok">Solid: on time and clean.</p>}
              {bar.offsetMs !== null && <p className="small muted">Strum landed {Math.abs(Math.round(bar.offsetMs))} ms {bar.offsetMs >= 0 ? 'after' : 'before'} the beat.</p>}
              {bar.chordResult && (
                <p className="small">{bar.chordResult.strings.filter(s => s.status !== 'silent-ok').map(s => {
                  const st = statusStyle(s.status);
                  return <span key={s.string} className="str-pill"><span className="status-dot" style={{ background: st.color }}>{st.icon}</span>{STRING_SHORT[s.string]}</span>;
                })}</p>
              )}
            </div>
            <ChordDiagram chord={chordById(bar.chord)} view={settings.diagramView} width={200}
              statuses={bar.chordResult ? Object.fromEntries(bar.chordResult.strings.map(s => [s.string, s.status])) : undefined} />
          </div>
        </div>
      )}
      {result.trouble.length > 0 && (
        <div className="trouble">
          <h3>What to practise next</h3>
          <ul>
            {dedupe(result.trouble.map(t => t.kind === 'change' ? `The ${t.from} → ${t.to} change (${t.problem === 'missed' ? 'no strum heard' : 'late'})` : `A clean ${t.to} chord`)).map(s => <li key={s}>{s}</li>)}
          </ul>
          <p className="small muted">From Phase 1 these feed straight into your practice sessions and change drills.</p>
        </div>
      )}
      <button className="btn link" onClick={() => saveRecording(encodeWav(take.signal, take.sr), `play-along-take-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.wav`)}>Save this take as a sound file (for feedback)</button>
    </Card>
  );
}

const dedupe = (a: string[]) => [...new Set(a)];
