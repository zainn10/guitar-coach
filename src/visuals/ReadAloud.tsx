// "Read this to me": reads a lesson (or help topic) aloud with the Mac's own voices
// (Web Speech API). Speech is made on this computer by default; nothing is sent anywhere.
// The paragraph being read is highlighted and kept in view. Clicking a paragraph while
// the reader is on jumps there. Reading pauses itself when the microphone switches on.
import { RefObject, useEffect, useRef, useState } from 'react';
import { speakable, chunks } from '../speech';
import { store } from '../storage/store';
import { useEngineState } from '../ui';

interface Unit { el: HTMLElement; parts: string[] }

const SKIP = '.ask-btn, .ask-panel, .read-aloud, .eyebrow, .back-link, button, input, select, [data-noread]';
const TEXT_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4']);
const CONTAINERS = new Set(['HEADER', 'ARTICLE', 'SECTION']);

/** What to say for a picture or interactive visual. */
function visualText(el: HTMLElement): string {
  const chordNames = [...el.querySelectorAll('.chord-diagram .chord-name')].map(e => e.textContent?.trim()).filter(Boolean);
  if (chordNames.length) return `Look at the chord diagram for ${chordNames.join(' and ')}.`;
  if (el.matches('.song-link')) return 'There is a play-along for this below.';
  const topics = [...el.querySelectorAll('.trouble-link strong')].map(e => e.textContent?.trim()).filter(Boolean);
  if (topics.length) return `If you get stuck, there ${topics.length > 1 ? 'are help topics' : 'is a help topic'} below: ${topics.join(', and ')}.`;
  const mistakes = [...el.querySelectorAll('.mistake')];
  if (mistakes.length) {
    return mistakes.map(m => {
      const title = m.querySelector('figcaption')?.childNodes[0]?.textContent?.trim() ?? '';
      const panels = [...m.querySelectorAll('.mk-panel p')].map(p => (p as HTMLElement).innerText.trim().replace(/^(Not this|Do this):\s*/, (_, a) => `${a}. `));
      return `Look at the pictures: ${title}. ${panels.join(' ')}`;
    }).join(' ');
  }
  if (!el.querySelector('svg, img, canvas, figure')) return ''; // just buttons (e.g. "Hear it"): nothing to say
  const bits: string[] = [];
  el.querySelectorAll('figcaption, .mk-panel p, p.small, p.muted').forEach(e => {
    const t = (e as HTMLElement).innerText?.trim();
    if (t && !bits.includes(t)) bits.push(t);
  });
  return ['Have a look at the picture.', ...bits].join(' ').slice(0, 900);
}

function collect(root: HTMLElement): Unit[] {
  const out: Unit[] = [];
  const add = (el: HTMLElement, text: string) => {
    const parts = chunks(speakable(text));
    if (parts.length) out.push({ el, parts });
  };
  const walk = (node: HTMLElement) => {
    for (const child of Array.from(node.children) as HTMLElement[]) {
      if (child.matches(SKIP) || child.closest('[data-noread]')) continue;
      if (child.matches('.lesson-body') || CONTAINERS.has(child.tagName) || child.matches('.stack')) { walk(child); continue; }
      if (child.tagName === 'UL' || child.tagName === 'OL') { (Array.from(child.children) as HTMLElement[]).forEach(li => add(li, li.innerText)); continue; }
      if (child.matches('.callout')) {
        const label = child.querySelector('.c-label')?.textContent ?? '';
        add(child, `${label}: ${child.innerText.slice(label.length)}`);
        continue;
      }
      if (TEXT_TAGS.has(child.tagName)) { add(child, child.innerText); continue; }
      add(child, visualText(child));
    }
  };
  walk(root);
  return out;
}

function localEnglishVoices() {
  const all = typeof speechSynthesis !== 'undefined' ? speechSynthesis.getVoices() : [];
  const en = all.filter(v => v.lang.toLowerCase().startsWith('en'));
  const local = en.filter(v => v.localService);
  return local.length ? local : en;
}

function pickVoice(name?: string) {
  const vs = localEnglishVoices();
  return vs.find(v => v.name === name)
    ?? vs.find(v => /en[-_]GB/i.test(v.lang) && /premium|enhanced/i.test(v.name))
    ?? vs.find(v => /en[-_]GB/i.test(v.lang))
    ?? vs.find(v => v.default) ?? vs[0];
}

export function ReadAloud({ target, what = 'lesson' }: { target: RefObject<HTMLElement>; what?: string }) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [status, setStatus] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const settings = store.get().settings;
  const [rate, setRate] = useState(settings.speechRate ?? 1);
  const [voiceName, setVoiceName] = useState(settings.speechVoice);
  const units = useRef<Unit[]>([]);
  const pos = useRef({ u: 0, c: 0 });
  const [posU, setPosU] = useState(0); // for the "3 / 12" display
  const gen = useRef(0); // bumps on every stop/jump so old "finished" events are ignored
  const { running: micOn } = useEngineState();

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(localEnglishVoices());
    load();
    speechSynthesis.addEventListener('voiceschanged', load);
    return () => speechSynthesis.removeEventListener('voiceschanged', load);
  }, [supported]);

  const mark = (i: number | null) => {
    units.current.forEach((u, k) => u.el.classList.toggle('reading', k === i));
    const el = i !== null ? units.current[i]?.el : null;
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < 90 || r.bottom > window.innerHeight - 40) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  const speakFrom = (u: number, c: number) => {
    const g = ++gen.current;
    speechSynthesis.cancel();
    const list = units.current;
    if (u >= list.length) { stop(); return; }
    pos.current = { u, c };
    setPosU(u);
    mark(u);
    const utt = new SpeechSynthesisUtterance(list[u].parts[c]);
    const v = pickVoice(voiceName);
    if (v) { utt.voice = v; utt.lang = v.lang; } else utt.lang = 'en-GB';
    utt.rate = rate;
    utt.onend = () => {
      if (g !== gen.current) return;
      const next = c + 1 < list[u].parts.length ? { u, c: c + 1 } : { u: u + 1, c: 0 };
      // a short breath between paragraphs
      if (next.u !== u) setTimeout(() => { if (g === gen.current) speakFrom(next.u, next.c); }, 350);
      else speakFrom(next.u, next.c);
    };
    utt.onerror = e => { if (g === gen.current && e.error !== 'interrupted' && e.error !== 'canceled') stop(); };
    speechSynthesis.speak(utt);
    setStatus('playing');
  };

  const start = (from = 0) => {
    if (!target.current) return;
    units.current = collect(target.current);
    speakFrom(from, 0);
  };
  const pause = () => { gen.current++; speechSynthesis.cancel(); setStatus('paused'); };
  const resume = () => speakFrom(pos.current.u, pos.current.c);
  function stop() { gen.current++; if (supported) speechSynthesis.cancel(); mark(null); pos.current = { u: 0, c: 0 }; setStatus('idle'); }
  const skip = (d: number) => speakFrom(Math.max(0, Math.min(units.current.length - 1, pos.current.u + d)), 0);

  // stop when leaving the page; pause when the microphone switches on (it would hear the voice)
  useEffect(() => () => { gen.current++; if (supported) speechSynthesis.cancel(); units.current.forEach(u => u.el.classList.remove('reading')); }, [supported]);
  useEffect(() => { if (micOn && status === 'playing') pause(); }, [micOn]); // eslint-disable-line react-hooks/exhaustive-deps

  // while the reader is on, clicking a paragraph reads from there
  useEffect(() => {
    const root = target.current;
    if (!root || status === 'idle') return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('a, button, input, select, svg, .lesson-visual, [role="button"]')) return;
      const i = units.current.findIndex(u => u.el.contains(t));
      if (i >= 0) speakFrom(i, 0);
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }); // re-bind each render so it sees the latest settings

  // apply a new speed or voice straight away
  useEffect(() => { if (status === 'playing') speakFrom(pos.current.u, pos.current.c); }, [rate, voiceName]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!supported) return null;
  const total = units.current.length;
  return (
    <div className={`read-aloud ${status !== 'idle' ? 'active' : ''}`} role="region" aria-label="Read aloud">
      {status === 'idle'
        ? <button className="btn ra-start" onClick={() => start(0)} disabled={micOn} title={micOn ? 'Switch the microphone off first' : undefined}>🔊 Read this {what} to me</button>
        : <>
          {status === 'playing'
            ? <button className="btn primary small" onClick={pause} aria-label="Pause">❚❚ Pause</button>
            : <button className="btn primary small" onClick={resume} aria-label="Resume" disabled={micOn}>▶ Resume</button>}
          <button className="btn small" onClick={() => skip(-1)} aria-label="Previous paragraph">⏮</button>
          <button className="btn small" onClick={() => skip(1)} aria-label="Next paragraph">⏭</button>
          <button className="btn small" onClick={stop} aria-label="Stop reading">■ Stop</button>
          <span className="small muted ra-pos">{Math.min(posU + 1, total)} / {total}</span>
        </>}
      <label className="small ra-opt">Speed
        <select value={rate} onChange={e => { const r = +e.target.value; setRate(r); store.setSettings({ speechRate: r }); }}>
          {[0.8, 0.9, 1, 1.1, 1.25, 1.5].map(r => <option key={r} value={r}>{r}×</option>)}
        </select>
      </label>
      {voices.length > 1 && <label className="small ra-opt">Voice
        <select value={pickVoice(voiceName)?.name ?? ''} onChange={e => { setVoiceName(e.target.value); store.setSettings({ speechVoice: e.target.value }); }}>
          {voices.map(v => <option key={v.name} value={v.name}>{v.name.replace(/\s*\(.*\)$/, '')} ({v.lang})</option>)}
        </select>
      </label>}
      {status !== 'idle' && <span className="small muted ra-hint">Tip: click any paragraph to jump to it.</span>}
    </div>
  );
}
