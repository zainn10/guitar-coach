// Play freely: switch on and play. After each strum or note the app says what it heard and whether
// it was clean (and if not, what's wrong and the fix). Tell it the chords or song you're practising
// so it knows what to expect. Every sound can be played back. Problems feed your Today sessions.
import { useEffect, useMemo, useRef, useState } from 'react';
import { engine } from '../audio/engine';
import { useStrums } from '../audio/useStrums';
import { judgeSound, rhythmRead, FreeEvent } from '../audio/freePlay';
import { ChordDiagram, chordSymbol } from '../visuals/ChordDiagram';
import { CHORDS, SONGS, chordById, THRESHOLDS } from '../content';
import { chordsSoFar, songUnlocked } from '../engine/course';
import { store } from '../storage/store';
import { Card, useStore, startMic, stopMic, micErrorText, useEngineState, useAutoOff, MicIcon } from '../ui';

interface Heard { id: number; at: number; ev: Exclude<FreeEvent, { kind: 'noise' }>; clip: Float32Array }

const icon = (ev: Heard['ev']) => ev.kind === 'chord' ? (ev.clean ? '✓' : '~') : ev.kind === 'note' ? (ev.clear ? '♪' : '~') : '?';
const tone = (ev: Heard['ev']) => ev.kind === 'unsure' ? 'unsure' : (ev.kind === 'chord' ? ev.clean : ev.clear) ? 'good' : 'messy';
const title = (ev: Heard['ev']) => ev.kind === 'chord' ? `${chordSymbol(ev.chord)}${ev.alt ? ` or ${chordSymbol(ev.alt)}?` : ''} ${ev.clean ? 'clean' : 'messy'}` : ev.kind === 'note' ? `Note ${ev.name}${ev.clear ? '' : ': muted'}` : 'Not sure';

export function FreePlay() {
  const d = useStore();
  const { settings } = d;
  const { running } = useEngineState();
  const known = chordsSoFar(d);
  const songs = SONGS.filter(s => songUnlocked(d, s));
  const [what, setWhat] = useState<'chords' | 'song'>('chords');
  const [picked, setPicked] = useState<string[]>(known.length ? known : ['Em', 'Am']);
  const [songId, setSongId] = useState(songs[0]?.id ?? '');
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<Heard[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [ignored, setIgnored] = useState(0);
  const [pos, setPos] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ chord: string; clean: number; total: number }[] | null>(null);
  const queue = useRef(Promise.resolve());
  const quietUntil = useRef(0); // don't listen to our own playback
  const nextId = useRef(1);
  const poke = useAutoOff(120000, () => setListening(false));

  // the chords in play: your chosen set, or the song's chords in order
  const song = songs.find(s => s.id === songId);
  const sequence = useMemo(() => {
    if (what !== 'song' || !song) return [];
    const all = song.bars.flatMap(b => b.split(/\s+/));
    return all.filter((c, i) => i === 0 || c !== all[i - 1]);
  }, [what, song]);
  const chordSet = useMemo(() => (what === 'song' ? [...new Set(sequence)] : picked).map(chordById).filter(Boolean), [what, sequence, picked]);
  const expected = what === 'song' && sequence.length ? chordById(sequence[pos % sequence.length]) : null;
  const posRef = useRef(0); posRef.current = pos;

  // mic switched off some other way (Esc, the top bar, idle timeout): finish up the same way as Stop
  useEffect(() => { if (!running && listening) stop(); }, [running, listening]); // eslint-disable-line react-hooks/exhaustive-deps

  useStrums(frame => {
    poke();
    queue.current = queue.current.then(async () => {
      const sr = engine.sampleRate;
      if (engine.ctx && engine.ctx.currentTime < quietUntil.current) return;
      try { await engine.waitForFrame(frame + Math.round(0.7 * sr), 3000); } catch { return; }
      const pre = Math.round(0.1 * sr);
      const sig = engine.getRange(frame - pre, frame + Math.round(0.7 * sr));
      const exp = what === 'song' && sequence.length ? chordById(sequence[posRef.current % sequence.length]) : null;
      const ev = judgeSound(sig, sr, pre, chordSet, CHORDS, exp, THRESHOLDS.chordCheck);
      if (ev.kind === 'noise') { setIgnored(n => n + 1); return; }
      if (exp && ev.kind === 'chord' && ev.chord === exp.id) setPos(p => p + 1);
      const h: Heard = { id: nextId.current++, at: frame / sr, ev, clip: sig };
      setHeard(list => [...list, h].slice(-200));
      setSelected(null);
    });
  }, listening && running, () => setIgnored(n => n + 1), 'any');

  const start = async () => {
    setErr(null); setSummary(null); setHeard([]); setIgnored(0); setPos(0); setSelected(null);
    try { await startMic(); setListening(true); } catch (e) { setErr(micErrorText(e)); }
  };
  const stop = () => {
    stopMic(); setListening(false);
    // what you played feeds your practice plan: chords that were often messy come back in sessions
    const per = new Map<string, { clean: number; total: number }>();
    for (const h of heard) if (h.ev.kind === 'chord' && !h.ev.alt) { const p = per.get(h.ev.chord) ?? { clean: 0, total: 0 }; p.total++; if (h.ev.clean) p.clean++; per.set(h.ev.chord, p); }
    const rows = [...per.entries()].map(([chord, p]) => ({ chord, ...p }));
    for (const r of rows) if (r.total >= 3) store.record(`chord:${r.chord}`, r.clean / r.total, r.clean / r.total >= 0.8);
    setSummary(rows);
  };
  const replay = (h: Heard) => {
    const sr = engine.sampleRate;
    if (engine.ctx) quietUntil.current = engine.ctx.currentTime + h.clip.length / sr + 0.4;
    engine.play(h.clip);
  };

  const last = heard[heard.length - 1];
  const shown = selected !== null ? heard.find(h => h.id === selected) : last;
  const chordStrums = heard.filter(h => h.ev.kind === 'chord');
  const cleanCount = chordStrums.filter(h => h.ev.kind === 'chord' && h.ev.clean).length;
  const rhythm = rhythmRead(chordStrums.map(h => h.at));
  const problems = useMemo(() => {
    const m = new Map<string, { n: number; text: string; fix?: string; label: string }>();
    for (const h of heard) {
      if (tone(h.ev) === 'good' || h.ev.kind === 'unsure') continue;
      const label = h.ev.kind === 'chord' ? chordSymbol(h.ev.chord) + (h.ev.alt ? ` or ${chordSymbol(h.ev.alt)}` : '') : 'Single notes';
      const key = label + '|' + h.ev.text.replace(/ \(\+\d+ more\)$/, '').replace(/^[A-G]#?: /, '');
      const p = m.get(key) ?? { n: 0, text: h.ev.text.replace(/ \(\+\d+ more\)$/, ''), fix: h.ev.fix, label };
      p.n++; m.set(key, p);
    }
    return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 3);
  }, [heard]);

  return (
    <div className="stack free-play">
      {!listening && (
        <Card title="What are you practising?">
          <div className="seg" role="radiogroup" aria-label="What to listen for">
            <button role="radio" aria-checked={what === 'chords'} className={what === 'chords' ? 'on' : ''} onClick={() => setWhat('chords')}>Chords</button>
            <button role="radio" aria-checked={what === 'song'} className={what === 'song' ? 'on' : ''} onClick={() => setWhat('song')} disabled={!songs.length}>A song</button>
          </div>
          {what === 'chords' ? (
            <>
              <p className="small muted">Tap to choose the chords you'll play. Fewer chords = more reliable answers.</p>
              <div className="chips">{[...new Set([...known, ...picked])].map(c => (
                <button key={c} className={`chip ${picked.includes(c) ? 'on' : ''}`} aria-pressed={picked.includes(c)} onClick={() => setPicked(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c])}>{chordSymbol(c)}</button>
              ))}</div>
            </>
          ) : (
            <>
              <label className="small">Song <select value={songId} onChange={e => setSongId(e.target.value)}>{songs.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
              <p className="small muted">Play the chords in order at your own pace, as many strums each as you like. No click, no timer.</p>
            </>
          )}
        </Card>
      )}

      <Card>
        <div className="row wrap">
          {!listening
            ? <button className="btn primary big" onClick={start} disabled={!chordSet.length}>Start listening</button>
            : <button className="btn big stop" onClick={stop}><MicIcon on /> Stop (mic off) <kbd className="kbd-in-btn">Esc</kbd></button>}
          <span className="small muted">{listening ? 'Play anything: strums or single notes. Taps and knocks are ignored.' : 'The mic is only on while this runs, and switches itself off after 2 minutes of silence.'}</span>
        </div>
        {err && <p className="error" role="alert">{err}</p>}

        {listening && expected && (
          <div className="fp-next">
            <div><p className="stage-label">Play now</p><ChordDiagram chord={expected} view={settings.diagramView} width={170} /></div>
            <p className="small muted fp-seq">{sequence.map((c, i) => <span key={i} className={i === pos % sequence.length ? 'now' : ''}>{chordSymbol(c)}</span>)}</p>
          </div>
        )}

        {(listening || heard.length > 0) && (
          <>
            {/* what it heard last: fixed height so nothing jumps */}
            <div className={`fp-last ${shown ? tone(shown.ev) : ''}`} aria-live="polite">
              {!shown ? <span className="fp-word muted">{listening ? 'Listening… play something.' : ''}</span> : <>
                <span className="fp-word">{icon(shown.ev)} {title(shown.ev)}{selected !== null && <span className="small muted"> (earlier)</span>}</span>
                <span className="fp-text">{shown.ev.kind === 'chord' && shown.ev.clean ? 'Every string rang.' : shown.ev.text}{shown.ev.fix && <> <strong>Fix:</strong> {shown.ev.fix}</>}</span>
                <button className="btn small fp-replay" onClick={() => replay(shown)}>▶ Hear it back</button>
              </>}
            </div>
            <div className="fp-stats small">
              <span><strong>{cleanCount}</strong> of {chordStrums.length} strums clean</span>
              <span>{heard.filter(h => h.ev.kind === 'note').length} notes</span>
              {rhythm && <span className={`fp-rhythm ${rhythm.steady ? 'good' : 'messy'}`}>Rhythm: {rhythm.trend}</span>}
              {ignored > 0 && <span className="muted">{ignored} small noises ignored</span>}
            </div>
            <ol className="fp-strip" aria-label="Everything you played, oldest first. Choose one to see it again and hear it back.">
              {heard.slice(-60).map(h => (
                <li key={h.id}><button className={`fp-dot ${tone(h.ev)} ${selected === h.id ? 'sel' : ''}`} title={title(h.ev)} aria-label={title(h.ev)} onClick={() => setSelected(selected === h.id ? null : h.id)}>{icon(h.ev)}</button></li>
              ))}
            </ol>
          </>
        )}
      </Card>

      {!listening && summary && heard.length > 0 && (
        <Card title="How it went">
          {summary.length > 0 && <ul className="fp-summary">{summary.map(r => <li key={r.chord}><strong>{chordSymbol(r.chord)}</strong>: {r.clean} of {r.total} clean</li>)}</ul>}
          {problems.length > 0
            ? <><h4>What tripped you up most</h4><ol>{problems.map(p => <li key={p.label + p.text}><strong>{p.label}</strong> ({p.n}×): {p.text}{p.fix && <span className="muted"> Fix: {p.fix}</span>}</li>)}</ol></>
            : <p className="note ok">Everything the app could check was clean. Nice playing!</p>}
          <p className="small muted">Chords that were often messy now come up more in your Today sessions. Tap any dot above to hear that strum again.</p>
        </Card>
      )}
    </div>
  );
}
