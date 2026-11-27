// Everything the app remembers about you: settings, results, progress through the course,
// how strong each chord/change/skill is, and when it should come back for review.
// Saved inside Chrome on this computer; a copy is kept in your Guitar Coach folder (Backups/).
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
  /** Optional: your own Anthropic API key for the "Ask Claude" button. */
  claudeKey?: string;
}

export interface ChordAttempt { t: number; verdict: ChordVerdict; issues: string[] }
export interface TakeSummary {
  t: number; song: string; statuses: BarStatus[]; headline: string;
  meanAbsOffsetMs: number | null; latencyMs: number; bpm?: number; trouble?: string[];
}

/** One measurable thing you're learning: a chord, a chord change, a skill or a song. */
export interface ItemState {
  /** 0 (shaky) .. 1 (solid), weighted towards recent results */
  strength: number;
  /** spaced-review box: higher = longer gap before it comes back */
  box: number;
  /** when it's next due for review (ms timestamp) */
  due: number;
  last: number;
  count: number;
  history: { t: number; score: number; pass: boolean }[];
}

export interface LessonProgress {
  status: 'started' | 'passed';
  /** which of the lesson's checks are passed (by index) */
  checks?: Record<number, boolean>;
  passedAt?: number;
  attempts: { t: number; passed: boolean; score: number; shortfall: string[] }[];
}

export interface DrillResult { t: number; from: string; to: string; changes: number; clean: number; seconds: number }

export interface SessionState {
  date: string;
  minutes: number | 'open';
  blocks: import('../engine/session').Block[];
}

export interface Data {
  settings: Settings;
  attempts: Record<string, ChordAttempt[]>;
  takes: TakeSummary[];
  lessons: Record<string, LessonProgress>;
  items: Record<string, ItemState>;
  drills: DrillResult[];
  /** seconds practised per day, keyed YYYY-MM-DD */
  practice: Record<string, number>;
  session?: SessionState;
  /** current speed reached on each tempo ladder */
  ladders: Record<string, { bpm: number; cleanReps: number; best: number }>;
  quizzes: { t: number; kind: string; correct: number; total: number }[];
  path?: 'flamenco' | 'fingerstyle' | 'lead';
  lastLesson?: string;
  startedAt: number;
}

const KEY = 'guitar-coach.v0';

const defaults: Data = {
  settings: { headphones: true, theme: 'system', diagramView: 'chart', sensitivity: 'medium' },
  attempts: {}, takes: [], lessons: {}, items: {}, drills: [], practice: {}, ladders: {}, quizzes: [],
  startedAt: Date.now(),
};

function merge(d: Partial<Data>): Data {
  return { ...structuredClone(defaults), ...d, settings: { ...defaults.settings, ...d.settings } } as Data;
}

function load(): Data {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(JSON.parse(raw));
  } catch { /* storage unavailable */ }
  return structuredClone(defaults);
}

let data = load();
const subs = new Set<() => void>();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
  subs.forEach(s => s());
}

const DAY = 86400000;
/** Gaps between reviews, in days, for each box. */
export const REVIEW_GAPS = [0, 1, 2, 4, 7, 14, 30, 60];
export const today = (t = Date.now()) => new Date(t).toLocaleDateString('en-CA'); // YYYY-MM-DD

export const store = {
  get: () => data,
  subscribe(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; },
  update(fn: (d: Data) => Data) { data = fn(data); save(); },
  setSettings(p: Partial<Settings>) { data = { ...data, settings: { ...data.settings, ...p } }; save(); },
  addAttempt(chord: string, a: ChordAttempt) {
    const list = [...(data.attempts[chord] ?? []), a].slice(-30);
    data = { ...data, attempts: { ...data.attempts, [chord]: list } };
    save();
    store.record(`chord:${chord}`, a.verdict === 'clean' ? 1 : a.verdict === 'issues' ? 0.5 : 0, a.verdict === 'clean');
  },
  addTake(t: TakeSummary) { data = { ...data, takes: [...data.takes, t].slice(-200) }; save(); },

  /**
   * Record a result for an item (e.g. "chord:G", "change:C>G", "skill:strum-du", "song:first-steps").
   * score 0..1; pass = met the standard. Drives weak-point tracking and spaced review.
   */
  record(key: string, score: number, pass: boolean, t = Date.now()) {
    const prev = data.items[key];
    const strength = prev ? prev.strength * 0.6 + score * 0.4 : score * 0.7;
    let box = prev?.box ?? 0;
    // Only one box step per day, so cramming doesn't fake long-term memory.
    const sameDay = prev && today(prev.last) === today(t);
    if (pass) { if (!sameDay || box === 0) box = Math.min(REVIEW_GAPS.length - 1, box + 1); }
    else box = Math.max(0, box - 2);
    const due = t + (pass ? REVIEW_GAPS[box] : 0.5) * DAY;
    const item: ItemState = {
      strength, box, due, last: t, count: (prev?.count ?? 0) + 1,
      history: [...(prev?.history ?? []), { t, score, pass }].slice(-60),
    };
    data = { ...data, items: { ...data.items, [key]: item } };
    save();
  },

  lessonAttempt(id: string, passed: boolean, score: number, shortfall: string[]) {
    const prev = data.lessons[id] ?? { status: 'started', attempts: [] };
    const lp: LessonProgress = {
      status: prev.status === 'passed' || passed ? 'passed' : 'started',
      passedAt: prev.passedAt ?? (passed ? Date.now() : undefined),
      attempts: [...prev.attempts, { t: Date.now(), passed, score, shortfall }].slice(-20),
    };
    data = { ...data, lessons: { ...data.lessons, [id]: lp }, lastLesson: id };
    save();
  },
  lessonCheck(id: string, index: number, total: number, passed: boolean, score: number, shortfall: string[]) {
    const prev = data.lessons[id] ?? { status: 'started', attempts: [] };
    const checks = { ...(prev.checks ?? {}), [index]: (prev.checks?.[index] ?? false) || passed };
    const all = Array.from({ length: total }, (_, i) => checks[i]).every(Boolean);
    const lp: LessonProgress = {
      ...prev, checks,
      status: prev.status === 'passed' || all ? 'passed' : 'started',
      passedAt: prev.passedAt ?? (all ? Date.now() : undefined),
      attempts: [...prev.attempts, { t: Date.now(), passed, score, shortfall }].slice(-30),
    };
    data = { ...data, lessons: { ...data.lessons, [id]: lp }, lastLesson: id };
    save();
    return all;
  },
  openLesson(id: string) {
    if (!data.lessons[id]) data = { ...data, lessons: { ...data.lessons, [id]: { status: 'started', attempts: [] } } };
    data = { ...data, lastLesson: id };
    save();
  },

  addDrill(r: DrillResult) {
    data = { ...data, drills: [...data.drills, r].slice(-500) };
    save();
  },
  addQuiz(kind: string, correct: number, total: number) {
    data = { ...data, quizzes: [...data.quizzes, { t: Date.now(), kind, correct, total }].slice(-300) };
    save();
  },
  addPractice(seconds: number) {
    const d = today();
    data = { ...data, practice: { ...data.practice, [d]: (data.practice[d] ?? 0) + seconds } };
    save();
  },
  setLadder(key: string, v: { bpm: number; cleanReps: number; best: number }) {
    data = { ...data, ladders: { ...data.ladders, [key]: v } };
    save();
  },
  setSession(s: SessionState | undefined) { data = { ...data, session: s }; save(); },

  /** Everything, as a backup file's contents (your API key is left out). */
  exportJson() {
    const { claudeKey: _omit, ...settings } = data.settings;
    void _omit;
    return JSON.stringify({ app: 'guitar-coach', version: 1, exported: new Date().toISOString(), data: { ...data, settings } }, null, 2);
  },
  importJson(text: string) {
    const parsed = JSON.parse(text);
    if (parsed?.app !== 'guitar-coach' || !parsed.data) throw new Error("That file isn't a Guitar Coach backup.");
    const key = data.settings.claudeKey;
    data = merge(parsed.data);
    if (key) data.settings.claudeKey = key;
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
