// Runs one "take": count-in, metronome, chord prompts, recording, then scoring.
// Used by play-alongs, strumming checks, picking checks and fix-it loops.
import { useEffect, useRef, useState } from 'react';
import { engine } from '../audio/engine';
import { scheduleClicks } from '../audio/metronome';
import { analyseTake, Song, TakeResult, barStrums } from '../audio/performance';
import { useStrums } from '../audio/useStrums';
import { ChordDiagram } from '../visuals/ChordDiagram';
import { CHORDS, chordById, THRESHOLDS } from '../content';
import { effectiveLatency } from '../storage/store';
import { useStore, startMic, stopMic, micErrorText, MicIcon } from '../ui';

export interface Take { signal: Float32Array; sr: number; downbeats: number[]; result: TakeResult; bpm: number; song: Song }

export function TakeRunner({ song, bpm, barRange, loops = 1, onResult, startLabel = 'Start', compact = false }: {
  song: Song; bpm: number; barRange?: [number, number]; loops?: number;
  onResult: (take: Take) => void; startLabel?: string; compact?: boolean;
}) {
  const { settings } = useStore();
  const [phase, setPhase] = useState<'idle' | 'running' | 'analysing'>('idle');
  const [pos, setPos] = useState<{ bar: number; beat: number } | null>(null);
  const [flash, setFlash] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const cancel = useRef<() => void>(() => {});
  const lat = effectiveLatency(settings);
  const [b0, b1] = barRange ?? [1, song.bars.length];
  // bars actually played, in order (a fix-it loop repeats its section)
  const sequence: number[] = [];
  for (let l = 0; l < loops; l++) for (let b = b0; b <= b1; b++) sequence.push(b - 1);
  useStrums(() => setFlash(f => f + 1), phase === 'running');
  useEffect(() => () => cancel.current(), []);

  const start = async () => {
    setErr(null);
    try { await startMic(); } catch (e) { setErr(micErrorText(e)); return; }
    const ctx = engine.ctx!;
    const sr = engine.sampleRate;
    const s = { ...song, bpm };
    const beatDur = 60 / bpm;
    const bpb = song.beatsPerBar;
    const barDur = beatDur * bpb;
    const totalBeats = (song.countInBars + sequence.length) * bpb;
    const t0 = ctx.currentTime + 0.6;
    const clicks = scheduleClicks(ctx, t0, totalBeats, beatDur, bpb, settings.headphones ? 0.5 : 0.35);
    const end = t0 + totalBeats * beatDur;
    setPhase('running');
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
    try { await engine.waitForFrame(recTo, (end - ctx.currentTime) * 1000 + 5000); }
    catch { if (!stopped) cancel.current(); return; }
    if (stopped) return;
    clearInterval(timer); setPos(null); setPhase('analysing');
    const signal = engine.getRange(recFrom, recTo);
    stopMic();
    await new Promise(r => setTimeout(r, 30));
    // Build a song made of exactly the bars played, so scoring lines up with the take.
    const played: Song = { ...s, bars: sequence.map(i => song.bars[i]) };
    const downbeats = sequence.map((_, k) => Math.round((t0 + (song.countInBars + k) * barDur) * sr) + L - recFrom);
    const result = analyseTake({ signal, sampleRate: sr, song: played, downbeatFrames: downbeats, library: CHORDS, timing: THRESHOLDS.timing, chordSettings: THRESHOLDS.chordCheck, sensitivity: settings.sensitivity });
    // number bars as in the original song
    result.bars.forEach((b, k) => { b.bar = sequence[k] + 1; b.messages = b.messages.map(m => m.replace(/^Bar \d+/, `Bar ${sequence[k] + 1}`)); });
    result.trouble.forEach(t => { t.bar = sequence[t.bar - 1] + 1; });
    setPhase('idle');
    onResult({ signal, sr, downbeats, result, bpm, song: played });
  };

  const running = phase === 'running';
  const k = pos && pos.bar >= 0 ? Math.min(pos.bar, sequence.length - 1) : 0;
  const counting = running && (!pos || pos.bar < 0);
  const curBar = sequence[k];
  const curChords = song.bars[curBar].split(/\s+/);
  const curChord = curChords.length > 1 && pos && pos.beat >= song.beatsPerBar / 2 ? curChords[1] : curChords[0];
  const nextBar = sequence[k + 1];
  const next = nextBar !== undefined ? song.bars[nextBar].split(/\s+/)[0] : null;
  const strums = barStrums(song, curBar).strums;

  return (
    <div className={`take-runner ${compact ? 'compact' : ''}`}>
      <ol className="bar-strip" aria-label="Bars">
        {sequence.slice(0, 16).map((bi, i) => (
          <li key={i} className={running && !counting && i === k ? 'now' : ''}><span className="bar-no">{bi + 1}</span>{song.bars[bi]}</li>
        ))}
      </ol>
      {(running || phase === 'idle') && (
        <div className="stage">
          <div className="stage-main">
            <p className="stage-label">{counting ? 'Get ready' : running ? 'Now' : 'First chord'}</p>
            <ChordDiagram chord={chordById(curChord)} view={settings.diagramView} width={compact ? 190 : 230} />
          </div>
          <div className="stage-side">
            <div className={`beats ${counting ? 'countin' : ''}`}>
              {Array.from({ length: song.beatsPerBar }, (_, i) => {
                const hasStrum = strums.some(s => Math.floor(s.beat) === i);
                return <span key={i} className={`beat ${pos && pos.beat === i ? 'on' : ''} ${hasStrum && !counting ? 'strum' : ''}`}>{i + 1}</span>;
              })}
            </div>
            {song.pattern && <p className="pattern-line" aria-label="Strumming pattern">{song.pattern.split('').map((c, i) => <span key={i} className={c === '-' ? 'ghost' : ''}>{c === 'D' ? '↓' : c === 'U' ? '↑' : '·'}</span>)}</p>}
            <p className="small muted">{counting ? `Count-in: ${song.countInBars} bar of clicks, then start.` : running ? 'Keep going, even if a chord is not ready.' : `${sequence.length} bars at ${bpm} bpm`}</p>
            <div className={`heard ${flash ? 'f' + (flash % 2) : ''}`} aria-hidden>{running ? 'heard' : ''}</div>
            {next && running && !counting && <div className="next"><p className="stage-label">Next</p><ChordDiagram chord={chordById(next)} view={settings.diagramView} width={130} /></div>}
          </div>
        </div>
      )}
      <div className="row wrap">
        {!running
          ? <button className="btn primary big" onClick={start} disabled={phase === 'analysing'}>{phase === 'analysing' ? 'Checking…' : startLabel}</button>
          : <button className="btn big stop" onClick={() => cancel.current()}>Stop (mic off)</button>}
        <span className="small muted"><MicIcon on={running} /> {running ? 'Microphone on for this take.' : 'Mic switches on for the take only.'}</span>
      </div>
      {err && <p className="error" role="alert">{err}</p>}
    </div>
  );
}
