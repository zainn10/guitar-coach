import { useEffect, useState } from 'react';
import { Setup } from './screens/Setup';
import { Tuner } from './screens/Tuner';
import { ChordCheck } from './screens/ChordCheck';
import { PlayAlong } from './screens/PlayAlong';
import { Diagnostics } from './screens/Diagnostics';
import { store } from './storage/store';
import { BUILD, latestVersion } from './version';
import { useEngineState, useStore, LevelMeter, stopMic, MicIcon } from './ui';

const TABS = [
  { id: 'setup', label: 'Setup', el: Setup },
  { id: 'tuner', label: 'Tuner', el: Tuner },
  { id: 'chords', label: 'Chord check', el: ChordCheck },
  { id: 'play', label: 'Play-along', el: PlayAlong },
  { id: 'diag', label: 'Diagnostics', el: Diagnostics },
] as const;
type TabId = typeof TABS[number]['id'];

const readHash = (): TabId => {
  const h = location.hash.replace('#', '');
  return (TABS.find(t => t.id === h)?.id ?? 'setup') as TabId;
};

export function App() {
  const [tab, setTab] = useState<TabId>(readHash);
  const { settings } = useStore();
  const eng = useEngineState();

  // Leaving a page always switches the microphone off.
  useEffect(() => { stopMic(); }, [tab]);
  useEffect(() => {
    const on = () => setTab(readHash());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  const [newer, setNewer] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => { setToast((e as CustomEvent<string>).detail); clearTimeout(t); t = setTimeout(() => setToast(null), 4000); };
    addEventListener('gc-saved', on);
    return () => removeEventListener('gc-saved', on);
  }, []);
  useEffect(() => {
    if (BUILD === 'dev') return;
    latestVersion().then(v => { if (v && v > BUILD) setNewer(v); });
  }, []);

  const Screen = TABS.find(t => t.id === tab)!.el;
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden><circle cx="16" cy="16" r="15" fill="var(--fg)" /><circle cx="16" cy="16" r="6" fill="var(--bg)" />{[0, 1, 2, 3, 4, 5].map(i => <line key={i} x1={9.5 + i * 2.6} x2={9.5 + i * 2.6} y1={3} y2={29} stroke="var(--bg)" strokeWidth={0.8} opacity={0.7} />)}</svg>
          <span>Guitar Coach</span>
          <span className="tag">Phase 0 · listening test</span>
        </div>
        <nav aria-label="Sections">
          {TABS.map(t => (
            <a key={t.id} href={`#${t.id}`} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined}>{t.label}</a>
          ))}
        </nav>
        <div className="top-right">
          {eng.running
            ? <button className="mic-chip on" onClick={stopMic} title="Switch the microphone off"><MicIcon on /> Listening <LevelMeter compact /> <span className="mic-off-label">Turn off</span></button>
            : <span className="mic-chip"><MicIcon /> Mic off</span>}
          <select aria-label="Colour theme" value={settings.theme} onChange={e => store.setSettings({ theme: e.target.value as 'system' })}>
            <option value="system">Auto theme</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </header>
      {newer && (
        <div className="update-bar" role="status">
          A new version of Guitar Coach is ready. Close this window and open Guitar Coach again to get it.
          <button className="btn link" onClick={() => setNewer(null)}>Later</button>
        </div>
      )}
      <main><Screen /></main>
      {toast && <div className="toast" role="status">{toast}</div>}
      <footer className="foot small muted">Everything runs on this computer. Nothing you play is uploaded. · Version {BUILD}</footer>
    </div>
  );
}
