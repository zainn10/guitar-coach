import { useEffect, useRef, useState } from 'react';
import { engine } from '../audio/engine';
import { scheduleClicks } from '../audio/metronome';
import { loopbackLatency, strumAlongLatency, CalibrationResult } from '../audio/latency';
import { store, effectiveLatency } from '../storage/store';
import { chooseFolder, folderPermission, folderSupported, forgetFolder, getFolder, saveFile, subscribeFolder } from '../storage/folder';
import { isLocalApp } from '../where';
import { syncFromFolder, savePhoneBackup, MAC_FILE, PHONE_FILE } from '../storage/sync';
import { Card, LevelMeter, MicGate, startMic, stopMic, useEngineState, useStore, micErrorText, StopListening } from '../ui';
import { useStrums } from '../audio/useStrums';
import type { Sensitivity } from '../audio/onset';

export function Setup() {
  const { settings } = useStore();
  const eng = useEngineState();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const lat = effectiveLatency(settings);

  useEffect(() => {
    if (!eng.running) return;
    navigator.mediaDevices.enumerateDevices().then(d => setDevices(d.filter(x => x.kind === 'audioinput')));
  }, [eng.running]);

  const processingOn = Object.entries(eng.processing).filter(([, v]) => v).map(([k]) =>
    ({ echoCancellation: 'echo cancellation', noiseSuppression: 'noise suppression', autoGainControl: 'automatic volume' } as Record<string, string>)[k]);

  return (
    <div className="stack">
      <header className="page-head">
        <h1>Settings</h1>
        <p className="lead">Set up the microphone and timing once (three quick steps), and choose where your files are saved.</p>
      </header>

      <Card title={<><span className="step">1</span> Microphone</>}>
        <MicGate why="Check the app can hear your guitar. Sound is analysed on this computer and never recorded or sent anywhere unless you choose to save a clip.">
          <div className="row spread wrap"><p>Strum or pluck a string. The bar should jump.</p><StopListening /></div>
          <LevelMeter />
          <div className="row wrap">
            <label htmlFor="mic-select">Microphone</label>
            <select id="mic-select" value={settings.deviceId ?? ''} onChange={async e => {
              store.setSettings({ deviceId: e.target.value || undefined });
              try { await startMic(e.target.value || undefined); } catch (err) { alertError(err); }
            }}>
              <option value="">Default microphone</option>
              {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>)}
            </select>
          </div>
          <p className="small muted">Using: {eng.label || 'default'} · {eng.sampleRate} Hz</p>
          {processingOn.length > 0
            ? <p className="note warn">Your browser kept {processingOn.join(' and ')} switched on. That's designed for voices and can hide guitar notes. Chrome lets the app switch it off. If you're already in Chrome, try another microphone.</p>
            : <p className="note ok">Voice processing is off, which is what we want for an instrument.</p>}
        </MicGate>
      </Card>

      <SensitivityCard />

      <Card title={<><span className="step">2</span> Headphones or speakers?</>}>
        <div className="choice-row" role="radiogroup" aria-label="How you hear the metronome">
          <button role="radio" aria-checked={settings.headphones} className={`choice ${settings.headphones ? 'on' : ''}`} onClick={() => store.setSettings({ headphones: true })}>
            <strong>Wired headphones</strong><span>Recommended. The click can't leak into the microphone.</span>
          </button>
          <button role="radio" aria-checked={!settings.headphones} className={`choice ${!settings.headphones ? 'on' : ''}`} onClick={() => store.setSettings({ headphones: false })}>
            <strong>Laptop speakers</strong><span>Works. The app filters the click out as well as it can.</span>
          </button>
        </div>
        <p className="small muted">Bluetooth headphones add a big, variable delay. If you use them, the strum-along test below is essential.</p>
      </Card>

      <Card title={<><span className="step">3</span> Timing calibration</>}>
        <p>Every computer has a small delay between making a sound and hearing it through the microphone. Measuring it once means "late" really means late.</p>
        <p className="latency-now">Delay in use: <strong>{lat.ms} ms</strong> <span className="muted">from {lat.source}</span></p>
        <div className="grid-2">
          <SpeakerTest disabled={settings.headphones} />
          <StrumAlongTest />
        </div>
      </Card>

      <SyncCard />

      <BackupCard />

      <ClaudeKeyCard />

      <Card title="Diagnostics">
        <p>Record short examples, check what the app hears, and save sound files to send for tuning the detection.</p>
        <a className="btn" href="#settings/diagnostics">Open diagnostics</a>
      </Card>

      <Card title="What the listening can and can't do" className="honest">
        <ul>
          <li><strong>Reliable:</strong> tuning single strings, telling which chord you strummed, spotting most muted strings, timing of strums.</li>
          <li><strong>Less certain:</strong> a few strings play the same note as another string an octave apart (for example the two E strings in E minor). Those show as "can't check on its own".</li>
          <li><strong>Later, with limits:</strong> fast rasgueado can be checked for chord and timing only, not each finger.</li>
          <li>A quiet room helps a lot. Keep the laptop about an arm's length from the guitar's sound hole.</li>
        </ul>
      </Card>
    </div>
  );
}

function alertError(e: unknown) { console.error(micErrorText(e)); }

function SpeakerTest({ disabled }: { disabled: boolean }) {
  const { settings } = useStore();
  const [state, setState] = useState<'idle' | 'running'>('idle');
  const cancelRef = useRef<() => void>(() => {});
  const [res, setRes] = useState<CalibrationResult | null>(null);
  const run = async () => {
    const wasOn = engine.running;
    try { if (!wasOn) await startMic(); } catch (e) { setRes({ ok: false, latencyMs: null, spreadMs: null, samples: [], detail: micErrorText(e) }); return; }
    const ctx = engine.ctx!;
    setState('running'); setRes(null);
    const t0 = ctx.currentTime + 0.4;
    const { times, cancel } = scheduleClicks(ctx, t0, 8, 0.4, 8, 0.9);
    cancelRef.current = cancel;
    const sr = engine.sampleRate;
    const from = Math.round(t0 * sr) - sr / 2;
    const end = Math.round((times[7] + 0.6) * sr);
    try {
      await engine.waitForFrame(end, 10000);
      const sig = engine.getRange(from, end);
      const r = loopbackLatency(sig, sr, times.map(t => Math.round(t * sr) - from));
      setRes(r);
      if (r.ok) store.setSettings({ loopbackMs: r.latencyMs! });
    } catch { setRes({ ok: false, latencyMs: null, spreadMs: null, samples: [], detail: 'Stopped.' }); }
    if (!wasOn) stopMic();
    setState('idle');
  };
  return (
    <div className={`subcard ${disabled ? 'disabled' : ''}`}>
      <h3>Speaker test</h3>
      <p className="small">Switches the microphone on for 4 seconds, plays 8 clicks through the speakers and times how long the microphone takes to hear them. Turn the volume up and stay quiet for 4 seconds.</p>
      {disabled
        ? <p className="small muted">Not needed with headphones (the mic can't hear them). Use the strum-along test.</p>
        : state === 'running'
          ? <button className="btn stop" onClick={() => { cancelRef.current(); stopMic(); }}>Stop</button>
          : <button className="btn" onClick={run}>Run speaker test</button>}
      {settings.loopbackMs != null && <p className="small">Last result: <strong>{settings.loopbackMs} ms</strong></p>}
      {res && <p className={`note ${res.ok ? 'ok' : 'warn'}`}>{res.ok ? `Measured ${res.latencyMs} ms. ` : ''}{res.detail}</p>}
    </div>
  );
}

function StrumAlongTest() {
  const { settings } = useStore();
  const [beat, setBeat] = useState<number | null>(null);
  const cancelRef = useRef<() => void>(() => {});
  const [res, setRes] = useState<CalibrationResult | null>(null);
  const run = async () => {
    const wasOn = engine.running;
    try { if (!wasOn) await startMic(); } catch (e) { setRes({ ok: false, latencyMs: null, spreadMs: null, samples: [], detail: micErrorText(e) }); return; }
    const ctx = engine.ctx!;
    setRes(null);
    const interval = 0.75; // 80 bpm
    const t0 = ctx.currentTime + 0.5;
    const { times, cancel } = scheduleClicks(ctx, t0, 12, interval, 4, 0.6);
    cancelRef.current = cancel;
    const sr = engine.sampleRate;
    const timer = setInterval(() => {
      const i = Math.floor((ctx.currentTime - t0) / interval);
      setBeat(i >= 0 && i < 12 ? i : null);
    }, 30);
    const from = Math.round(t0 * sr);
    const end = Math.round((times[11] + 0.6) * sr);
    try {
      await engine.waitForFrame(end, 20000);
      const sig = engine.getRange(from, end);
      const r = strumAlongLatency(sig, sr, times.slice(4).map(t => Math.round(t * sr) - from), store.get().settings.sensitivity);
      setRes(r);
      if (r.ok) store.setSettings({ strumMs: r.latencyMs! });
    } catch { setRes({ ok: false, latencyMs: null, spreadMs: null, samples: [], detail: 'Stopped.' }); }
    clearInterval(timer);
    if (!wasOn) stopMic();
    setBeat(null);
  };
  return (
    <div className="subcard">
      <h3>Strum-along test</h3>
      <p className="small">The microphone is on only while this runs (about 10 seconds). You'll hear 4 count-in clicks, then 8 more. Strum any chord, firmly, exactly on each of the 8. (Mute the strings with your hand if you like; it just needs a sharp sound.)</p>
      {beat === null
        ? <button className="btn primary" onClick={run}>Run strum-along test</button>
        : <button className="btn stop" onClick={() => { cancelRef.current(); stopMic(); }}>Stop</button>}
      {beat !== null && (
        <div className="count-dots" aria-live="polite">
          {Array.from({ length: 12 }, (_, i) => <span key={i} className={`cd ${i < 4 ? 'countin' : ''} ${i === beat ? 'now' : ''}`}>{i < 4 ? 4 - i : 'strum'}</span>)}
        </div>
      )}
      {settings.strumMs != null && <p className="small">Last result: <strong>{settings.strumMs} ms</strong> (this one is used)</p>}
      {res && <p className={`note ${res.ok ? 'ok' : 'warn'}`}>{res.ok ? `Measured ${res.latencyMs} ms. ` : ''}{res.detail}</p>}
      {settings.strumMs != null && <button className="btn link" onClick={() => store.setSettings({ strumMs: undefined })}>Forget this result</button>}
    </div>
  );
}

const SENS: { id: Sensitivity; label: string; desc: string }[] = [
  { id: 'low', label: 'Firm strums only', desc: 'Best in a noisy room. Ignores almost everything except a proper strum.' },
  { id: 'medium', label: 'Normal', desc: 'Ignores taps, finger noise and quiet room sounds.' },
  { id: 'high', label: 'Soft strums too', desc: 'For gentle playing in a very quiet room.' },
];

function SensitivityCard() {
  const { settings } = useStore();
  const [last, setLast] = useState<{ ok: boolean; t: number } | null>(null);
  useStrums(() => setLast({ ok: true, t: Date.now() }), true, () => setLast({ ok: false, t: Date.now() }));
  const eng = useEngineState();
  return (
    <Card title="How loud must a strum be?">
      <p>The app ignores small sounds so it only reacts to real strums. If it reacts to taps or fidgeting, choose "Firm strums only". If it misses your strums, choose "Soft strums too".</p>
      <div className="choice-row three" role="radiogroup" aria-label="Strum sensitivity">
        {SENS.map(x => (
          <button key={x.id} role="radio" aria-checked={settings.sensitivity === x.id} className={`choice ${settings.sensitivity === x.id ? 'on' : ''}`} onClick={() => store.setSettings({ sensitivity: x.id })}>
            <strong>{x.label}</strong><span>{x.desc}</span>
          </button>
        ))}
      </div>
      {eng.running
        ? <p className="small" aria-live="polite">Try it: tap the guitar body, then strum. {last ? (last.ok ? <strong className="good-text">Strum detected.</strong> : <span className="muted">Small sound ignored.</span>) : ''}</p>
        : <p className="small muted">Switch the microphone on in step 1 to try it out.</p>}
    </Card>
  );
}

function BackupCard() {
  const [msg, setMsg] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [perm, setPerm] = useState<string>('none');
  const refresh = async () => {
    const d = await getFolder();
    setFolderName(d ? d.name : null);
    setPerm(await folderPermission());
  };
  useEffect(() => { refresh(); return subscribeFolder(refresh); }, []);
  const backupName = () => `guitar-coach-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const backupBlob = () => new Blob([store.exportJson()], { type: 'application/json' });

  return (
    <Card title="Your Guitar Coach folder">
      <p>Choose one folder for everything Guitar Coach saves: sound recordings go in <strong>Recordings</strong>, progress backups in <strong>Backups</strong>. We suggest <strong>Documents → Claude → Guitar Coach</strong>.</p>
      {!folderSupported() && <p className="note ok">On your phone, saving opens the share sheet: tap <strong>Save to Files</strong>, then choose the Guitar Coach folder in iCloud Drive (and its Recordings or Backups folder). Your phone remembers the last folder you picked.</p>}
      {folderSupported() && (
        folderName ? (
          <div className="row wrap">
            <p className="folder-now">Saving to: <strong>{folderName}</strong>{perm !== 'granted' && <span className="muted small"> (Chrome will ask to allow it next time you save)</span>}</p>
            <button className="btn small" onClick={async () => { try { await chooseFolder(); setMsg(null); } catch { /* cancelled */ } }}>Change folder</button>
            <button className="btn link" onClick={forgetFolder}>Stop using a folder</button>
          </div>
        ) : (
          <button className="btn primary" onClick={async () => {
            try {
              await chooseFolder();
              const r = await saveFile('Backups', 'latest-backup.json', backupBlob());
              setMsg(r === 'folder' ? 'Folder set. Your first backup is saved in it.' : 'Folder set.');
            } catch { /* cancelled */ }
          }}>Choose folder…</button>
        )
      )}
      <p className="small muted">Your progress itself lives inside Chrome on this Mac. While a folder is set, the app also keeps <strong>Backups/latest-backup.json</strong> up to date automatically, so nothing is lost if Chrome's data is ever cleared.</p>
      <div className="row wrap">
        <button className="btn" onClick={async () => {
          const r = await saveFile('Backups', backupName(), backupBlob());
          setMsg(r === 'folder' ? `Saved ${backupName()} in your Backups folder.` : 'Backup saved to Downloads.');
        }}>Save a dated backup now</button>
        <label className="btn">
          Restore from backup
          <input type="file" accept="application/json,.json" hidden onChange={async e => {
            const f = e.target.files?.[0];
            if (!f) return;
            try { store.importJson(await f.text()); setMsg('Backup restored.'); } catch (err) { setMsg(String((err as Error).message)); }
            e.target.value = '';
          }} />
        </label>
      </div>
      {msg && <p className="note ok" role="status">{msg}</p>}
    </Card>
  );
}

function ClaudeKeyCard() {
  const { settings } = useStore();
  const [val, setVal] = useState('');
  if (!isLocalApp) return (
    <Card title="Ask Claude">
      <p>For safety, Ask Claude only works in the Mac app. An API key is never stored on the public web address, because other pages on the same address could read it.</p>
    </Card>
  );
  return (
    <Card title="Ask Claude (optional)">
      <p>The "Ask Claude" buttons send what you're working on and your recent results to Claude for a personal tip. They need your own Anthropic API key. Each question costs a fraction of a penny, billed to your Anthropic account.</p>
      <ul className="small">
        <li>Get a key at console.anthropic.com → API keys. Set a low monthly spend limit there for peace of mind.</li>
        <li>The key is stored only inside Chrome on this Mac and is never included in backup files.</li>
        <li>Nothing is sent unless you press an Ask button. Recordings are never sent.</li>
      </ul>
      {settings.claudeKey
        ? <div className="row wrap"><span className="note ok">Key saved (ending …{settings.claudeKey.slice(-4)}).</span><button className="btn" onClick={() => store.setSettings({ claudeKey: undefined })}>Remove key</button></div>
        : <div className="row wrap">
          <input id="claude-key" type="password" className="search" placeholder="sk-ant-…" value={val} onChange={e => setVal(e.target.value.trim())} autoComplete="off" />
          <button className="btn primary" disabled={!val.startsWith('sk-ant-')} onClick={() => { store.setSettings({ claudeKey: val }); setVal(''); }}>Save key</button>
        </div>}
    </Card>
  );
}

export function SyncCard() {
  const d = useStore();
  const [msg, setMsg] = useState<string | null>(null);
  const phone = !folderSupported();
  const last = Object.entries(d.syncedFrom ?? {}).map(([dev, t]) => `${dev === 'phone' ? 'phone' : dev === 'mac' ? 'Mac' : dev}: ${new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`).join(' · ');
  return (
    <Card title={phone ? 'Sync with your Mac' : 'Sync with your phone'}>
      {phone ? (
        <>
          <p>Your progress syncs through the Guitar Coach folder in iCloud Drive. Two taps:</p>
          <div className="row wrap">
            <label className="btn primary">
              1. Load progress from the Mac
              <input type="file" accept="application/json,.json" hidden onChange={async e => {
                const f = e.target.files?.[0];
                if (!f) return;
                try { const r = store.mergeJson(await f.text()); setMsg(r.changed ? 'Done: the Mac\'s progress is merged in.' : 'Already up to date with that file.'); }
                catch (err) { setMsg((err as Error).message); }
                e.target.value = '';
              }} />
            </label>
            <button className="btn primary" onClick={async () => { const r = await savePhoneBackup(); if (r !== 'skipped') setMsg('Saved. Next time the Mac app opens, it picks this up.'); }}>2. Save phone progress to the folder</button>
          </div>
          <p className="small muted">For step 1, choose <strong>Guitar Coach / Backups / {MAC_FILE}</strong>. For step 2, choose <strong>Save to Files</strong> and the same Backups folder, keeping the name {PHONE_FILE} (replace the old one if asked).</p>
        </>
      ) : (
        <>
          <p>The Mac keeps <strong>Backups/{MAC_FILE}</strong> up to date in your Guitar Coach folder and, each time it opens, merges in <strong>Backups/{PHONE_FILE}</strong> if your phone has saved a newer one. Nothing is ever lost on either side.</p>
          <button className="btn" onClick={async () => setMsg(await syncFromFolder(true))}>Sync now</button>
        </>
      )}
      {last && <p className="small muted">Last synced from {last}</p>}
      {msg && <p className="note ok" role="status">{msg}</p>}
    </Card>
  );
}
