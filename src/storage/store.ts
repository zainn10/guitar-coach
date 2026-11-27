// Saved settings and results. Phase 0 keeps these in the browser's local storage
// (on this computer). Phase 1 moves progress into a proper database with backup files.
import { ChordVerdict } from '../audio/chordCheck';
import { BarStatus } from '../audio/performance';
import type { Sensitivity } from '../audio/onset';

export interface Settings {
  headphones: boolean;
  deviceId?: string;
  loopbackMs?: number;
  strumMs?: number;
  theme: 'system' | 'light' | 'dark';
  diagramView: 'chart' | 'player';
  /** How loud a sound must be to count as a strum. */
  sensitivity: Sensitivity;
}

export interface ChordAttempt { t: number; verdict: ChordVerdict; issues: string[] }
export interface TakeSummary { t: number; song: string; statuses: BarStatus[]; headline: string; meanAbsOffsetMs: number | null; latencyMs: number }

const KEY = 'guitar-coach.v0';

interface Data { settings: Settings; attempts: Record<string, ChordAttempt[]>; takes: TakeSummary[] }

const defaults: Data = {
  settings: { headphones: true, theme: 'system', diagramView: 'chart', sensitivity: 'medium' },
  attempts: {},
  takes: [],
};

function load(): Data {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      return { ...defaults, ...d, settings: { ...defaults.settings, ...d.settings } };
    }
  } catch { /* storage unavailable */ }
  return structuredClone(defaults);
}

let data = load();
const subs = new Set<() => void>();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
  subs.forEach(s => s());
}

export const store = {
  get: () => data,
  subscribe(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; },
  setSettings(p: Partial<Settings>) { data = { ...data, settings: { ...data.settings, ...p } }; save(); },
  addAttempt(chord: string, a: ChordAttempt) {
    const list = [...(data.attempts[chord] ?? []), a].slice(-30);
    data = { ...data, attempts: { ...data.attempts, [chord]: list } };
    save();
  },
  addTake(t: TakeSummary) { data = { ...data, takes: [...data.takes, t].slice(-100) }; save(); },
  /** Everything, as a backup file's contents. */
  exportJson() { return JSON.stringify({ app: 'guitar-coach', version: 0, exported: new Date().toISOString(), data }, null, 2); },
  importJson(text: string) {
    const parsed = JSON.parse(text);
    if (parsed?.app !== 'guitar-coach' || !parsed.data) throw new Error("That file isn't a Guitar Coach backup.");
    data = { ...defaults, ...parsed.data, settings: { ...defaults.settings, ...parsed.data.settings } };
    save();
  },
};

/** The delay (ms) used to line up what the mic hears with the metronome. */
export function effectiveLatency(s: Settings): { ms: number; source: string } {
  if (s.strumMs != null) return { ms: s.strumMs, source: 'strum-along test' };
  if (s.loopbackMs != null && !s.headphones) return { ms: s.loopbackMs, source: 'speaker test' };
  return { ms: 60, source: 'a rough guess (run a calibration test)' };
}

/** Mastery: at least `clean` clean attempts in the last `outOf`. */
export function masteryState(attempts: ChordAttempt[] | undefined, clean: number, outOf: number) {
  const last = (attempts ?? []).slice(-outOf);
  const n = last.filter(a => a.verdict === 'clean').length;
  return { last, cleanCount: n, passed: last.length >= outOf && n >= clean };
}
