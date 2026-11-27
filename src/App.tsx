import { useEffect, useRef, useState } from 'react';
import { Today } from './screens/Today';
import { Course, LessonPage } from './screens/Course';
import { Chords } from './screens/Chords';
import { Practice } from './screens/Practice';
import { Songs } from './screens/Songs';
import { Tuner } from './screens/Tuner';
import { Progress } from './screens/Progress';
import { Help } from './screens/Help';
import { Setup } from './screens/Setup';
import { Diagnostics } from './screens/Diagnostics';
import { store } from './storage/store';
import { CONTENT_PROBLEMS } from './content';
import { useEngineState, useStore, LevelMeter, stopMic, MicIcon } from './ui';
import { BUILD, latestVersion } from './version';

const NAV = [
  { id: 'today', label: 'Today' }, { id: 'course', label: 'Course' }, { id: 'chords', label: 'Chords' },
  { id: 'practice', label: 'Practice' }, { id: 'songs', label: 'Songs' }, { id: 'tuner', label: 'Tuner' },
  { id: 'progress', label: 'Progress' }, { id: 'help', label: 'Help' }, { id: 'settings', label: 'Settings' },
];

function readRoute() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ''));
  const [tab, ...rest] = h.split('/');
  const legacy: Record<string, string> = { setup: 'settings', chords: 'chords', play: 'songs', diag: 'settings' };
  const t = NAV.some(n => n.id === tab) || tab === 'lesson' ? tab : legacy[tab] ?? 'today';
  return { tab: t, sub: rest.join('/') || undefined };
}

export function App() {
  const [route, setRoute] = useState(readRoute);
  const { settings } = useStore();
  const eng = useEngineState();
  const [newer, setNewer] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const on = () => { setRoute(readRoute()); setMenu(false); };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  // Leaving a page always switches the microphone off.
  useEffect(() => { stopMic(); }, [route.tab, route.sub]);
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);
  useEffect(() => {
    if (BUILD === 'dev') return;
    latestVersion().then(v => { if (v && v > BUILD) setNewer(v); });
  }, []);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => { setToast((e as CustomEvent<string>).detail); clearTimeout(t); t = setTimeout(() => setToast(null), 4000); };
    addEventListener('gc-saved', on);
    return () => removeEventListener('gc-saved', on);
  }, []);
  usePracticeTimer(route.tab);

  const page = (() => {
    switch (route.tab) {
      case 'course': return <Course />;
      case 'lesson': return <LessonPage id={route.sub ?? ''} />;
      case 'chords': return <Chords sub={route.sub} />;
      case 'practice': return <Practice key={route.sub} sub={route.sub} />;
      case 'songs': return <Songs key={route.sub} sub={route.sub} />;
      case 'tuner': return <Tuner />;
      case 'progress': return <Progress />;
      case 'help': return <Help sub={route.sub} />;
      case 'settings': return route.sub === 'diagnostics' ? <Diagnostics /> : <Setup />;
      default: return <Today />;
    }
  })();
  const navTab = route.tab === 'lesson' ? 'course' : route.tab;

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#today">
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden><circle cx="16" cy="16" r="15" fill="var(--fg)" /><circle cx="16" cy="16" r="6" fill="var(--bg)" />{[0, 1, 2, 3, 4, 5].map(i => <line key={i} x1={9.5 + i * 2.6} x2={9.5 + i * 2.6} y1={3} y2={29} stroke="var(--bg)" strokeWidth={0.8} opacity={0.7} />)}</svg>
          <span>Guitar Coach</span>
        </a>
        <button className="btn small menu-btn" aria-expanded={menu} aria-controls="main-nav" onClick={() => setMenu(m => !m)}>☰ Menu</button>
        <nav id="main-nav" aria-label="Sections" className={menu ? 'open' : ''}>
          {NAV.map(t => <a key={t.id} href={`#${t.id}`} className={navTab === t.id ? 'on' : ''} aria-current={navTab === t.id ? 'page' : undefined}>{t.label}</a>)}
        </nav>
        <div className="top-right">
          {eng.running
            ? <button className="mic-chip on" onClick={stopMic} title="Switch the microphone off"><MicIcon on /> Listening <LevelMeter compact /> <span className="mic-off-label">Turn off</span></button>
            : <span className="mic-chip"><MicIcon /> Mic off</span>}
          <select aria-label="Colour theme" value={settings.theme} onChange={e => store.setSettings({ theme: e.target.value as 'system' })}>
            <option value="system">Auto theme</option><option value="light">Light</option><option value="dark">Dark</option>
          </select>
        </div>
      </header>
      {newer && (
        <div className="update-bar" role="status">
          {location.hostname === 'localhost' || location.hostname === '127.0.0.1'
            ? <>A new version of Guitar Coach is ready. Close this window and open Guitar Coach again to get it.</>
            : <>A new version of Guitar Coach is ready. <button className="btn small" onClick={() => location.reload()}>Update now</button></>}
          <button className="btn link" onClick={() => setNewer(null)}>Later</button>
        </div>
      )}
      {CONTENT_PROBLEMS.length > 0 && <div className="note warn" role="alert"><strong>Content problems:</strong> {CONTENT_PROBLEMS.join('; ')}</div>}
      <main>{page}</main>
      {toast && <div className="toast" role="status">{toast}</div>}
      <footer className="foot small muted">Everything runs on this computer. Nothing you play is uploaded. · Version {BUILD}</footer>
    </div>
  );
}

/** Counts practice time: while the app is visible and you've interacted (or the mic is on) recently. */
function usePracticeTimer(tab: string) {
  const lastActive = useRef(Date.now());
  const pending = useRef(0);
  useEffect(() => {
    const poke = () => { lastActive.current = Date.now(); };
    ['pointerdown', 'keydown', 'scroll'].forEach(e => addEventListener(e, poke, { passive: true }));
    const id = setInterval(() => {
      const micOn = document.querySelector('.mic-chip.on') !== null;
      const active = document.visibilityState === 'visible' && (micOn || Date.now() - lastActive.current < 90000) && tab !== 'settings' && tab !== 'help';
      if (active) pending.current += 5;
      if (pending.current >= 60) { store.addPractice(pending.current); pending.current = 0; }
    }, 5000);
    return () => { clearInterval(id); ['pointerdown', 'keydown', 'scroll'].forEach(e => removeEventListener(e, poke)); if (pending.current) store.addPractice(pending.current); pending.current = 0; };
  }, [tab]);
}
