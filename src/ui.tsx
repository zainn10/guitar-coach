// Shared hooks and small UI pieces.
import { useEffect, useRef, useState, useSyncExternalStore, ReactNode } from 'react';
import { engine } from './audio/engine';
import { store } from './storage/store';

export const useStore = () => useSyncExternalStore(store.subscribe, store.get);

let engineVersion = 0;
const engineSubs = new Set<() => void>();
export const bumpEngine = () => { engineVersion++; engineSubs.forEach(s => s()); };
export const useEngineState = () => {
  useSyncExternalStore(fn => { engineSubs.add(fn); return () => { engineSubs.delete(fn); }; }, () => engineVersion);
  return { running: engine.running, sampleRate: engine.sampleRate, processing: engine.processing, label: engine.deviceLabel };
};

export async function startMic(deviceId?: string) {
  await engine.start(deviceId ?? store.get().settings.deviceId);
  bumpEngine();
}

export function stopMic() {
  if (!engine.running) return;
  engine.stop();
  bumpEngine();
}

/** Switches the mic off after `ms` without any activity (call `poke()` on activity). */
export function useAutoOff(ms: number, onOff?: () => void) {
  const { running } = useEngineState();
  const last = useRef(Date.now());
  const cb = useRef(onOff);
  cb.current = onOff;
  useEffect(() => {
    if (!running) return;
    last.current = Date.now();
    const id = setInterval(() => {
      if (Date.now() - last.current > ms) { stopMic(); cb.current?.(); }
    }, 1000);
    return () => clearInterval(id);
  }, [running, ms]);
  return () => { last.current = Date.now(); };
}

export function useLevel(active = true) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => { setLevel(engine.level); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return level;
}

export function LevelMeter({ compact = false }: { compact?: boolean }) {
  const level = useLevel();
  const db = 20 * Math.log10(level + 1e-9);
  const pct = Math.max(0, Math.min(100, ((db + 70) / 70) * 100));
  return (
    <div className={`meter ${compact ? 'compact' : ''}`} role="meter" aria-valuemin={-70} aria-valuemax={0} aria-valuenow={Math.round(db)} aria-label="Microphone level">
      <div className="meter-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Shows a "Start listening" prompt until the mic is running. */
export function MicGate({ children, why, note }: { children: ReactNode; why: string; note?: ReactNode }) {
  const { running } = useEngineState();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (running) return <>{children}</>;
  return (
    <div className="card mic-gate">
      <h2><MicIcon /> Microphone is off</h2>
      <p>{why} It only listens while this exercise is running, and you can switch it off at any moment.</p>
      {note}
      <button className="btn primary" disabled={busy} onClick={async () => {
        setBusy(true); setErr(null);
        try { await startMic(); } catch (e) { setErr(micErrorText(e)); }
        setBusy(false);
      }}>{busy ? 'Starting…' : 'Start listening'}</button>
      {err && <p className="error" role="alert">{err}</p>}
    </div>
  );
}

export function micErrorText(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError') return 'The browser blocked the microphone. Click the microphone or lock icon in the address bar, allow the microphone, then try again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone was found. Plug one in, or pick another one on the Setup page.';
  return `The microphone couldn't start (${name ?? String(e)}). Try reloading the page.`;
}

export function Card({ title, children, className = '' }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{title && <h2>{title}</h2>}{children}</section>;
}

export function MicIcon({ on = false }: { on?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden className={`mic-icon ${on ? 'on' : ''}`}>
      <rect x="9" y="3" width="6" height="11" rx="3" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {!on && <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  );
}

/** A clearly visible "stop listening" button for inside exercises. */
export function StopListening({ label = 'Stop listening' }: { label?: string }) {
  const { running } = useEngineState();
  if (!running) return null;
  return <button className="btn stop" onClick={stopMic} title="Shortcut: Esc"><MicIcon on /> {label} <kbd className="kbd-in-btn">Esc</kbd></button>;
}
