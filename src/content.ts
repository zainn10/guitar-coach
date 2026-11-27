// All course data comes from the /content folder (kept separate from code):
//   content/course.json        stages and the order of lessons
//   content/lessons/*.md       one lesson per file (plain text with a small header)
//   content/chords/*.json      chord shapes
//   content/songs/*.json       chord progressions for play-alongs (no lyrics or melodies)
//   content/config/thresholds.json  every pass mark, in one place
import { parse as parseYaml } from 'yaml';
import courseJson from '../content/course.json';
import thresholdsJson from '../content/config/thresholds.json';
import type { ChordShape } from './audio/notes';
import type { Song } from './audio/performance';

export type Check =
  | { type: 'quiz'; title?: string; questions: { q: string; options: string[]; answer: number; explain?: string }[]; pass?: number }
  | { type: 'self'; title?: string; items: string[] }
  | { type: 'tuning'; title?: string }
  | { type: 'chord'; title?: string; chord: string }
  | { type: 'change'; title?: string; from: string; to: string; target?: number }
  | { type: 'strum'; title?: string; pattern: string; bpm: number; bars?: number; chords?: string[]; accuracy?: number }
  | { type: 'song'; title?: string; song: string; bpm?: number; minGreen?: number }
  | { type: 'notes'; title?: string; notes: { string: number; fret: number }[]; label?: string }
  | { type: 'pick'; title?: string; chord: string; pattern: string; bpm: number; bars?: number; accuracy?: number }
  | { type: 'bend'; title?: string; string: number; fret: number; semitones: number; times?: number };

export interface Lesson {
  id: string;
  title: string;
  stage: number;
  minutes: number;
  summary: string;
  chords: string[];
  skills: string[];
  flamenco: boolean;
  checks: Check[];
  body: string;
}

export interface Stage { n: number; title: string; intro: string; lessons: string[] }
export interface PathInfo { id: 'flamenco' | 'fingerstyle' | 'lead'; title: string; summary: string; next: string[] }

// ---- chords
const chordFiles = import.meta.glob('../content/chords/*.json', { eager: true, import: 'default' }) as Record<string, { chords: ChordShape[] }>;
export const CHORDS: ChordShape[] = Object.values(chordFiles).flatMap(f => f.chords);
export const chordById = (id: string) => {
  const c = CHORDS.find(x => x.id === id);
  if (!c) throw new Error(`Unknown chord ${id}`);
  return c;
};
export const PHASE0_CHORDS = ['Em', 'Am', 'A', 'D', 'G'];

// ---- songs
const songFiles = import.meta.glob('../content/songs/*.json', { eager: true, import: 'default' }) as Record<string, Song>;
export const SONGS: Song[] = Object.values(songFiles).sort((a, b) => (a.stage ?? 9) - (b.stage ?? 9) || a.title.localeCompare(b.title));
export const songById = (id: string) => SONGS.find(s => s.id === id);
export const FIRST_SONG = songById('first-steps')!;

// ---- lessons
const lessonFiles = import.meta.glob('../content/lessons/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
function parseLesson(path: string, raw: string): Lesson {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error(`Lesson ${path}: missing the --- header ---`);
  const h = parseYaml(m[1]) as Partial<Lesson>;
  if (!h.id || !h.title || !h.stage) throw new Error(`Lesson ${path}: header needs id, title and stage`);
  return {
    id: h.id, title: h.title, stage: h.stage, minutes: h.minutes ?? 10, summary: h.summary ?? '',
    chords: h.chords ?? [], skills: h.skills ?? [], flamenco: !!h.flamenco, checks: h.checks ?? [], body: m[2],
  };
}
export const LESSONS: Lesson[] = Object.entries(lessonFiles).map(([p, raw]) => parseLesson(p, raw));
export const lessonById = (id: string) => LESSONS.find(l => l.id === id);

export const STAGES: Stage[] = courseJson.stages;
export const PATHS: PathInfo[] = courseJson.paths as PathInfo[];
/** All lessons in course order. */
export const COURSE_ORDER: string[] = STAGES.flatMap(s => s.lessons);

export const THRESHOLDS = thresholdsJson;

// ---- content checks: a typo in a data file shows a clear error instead of a broken page
const problems: string[] = [];
for (const c of CHORDS) if (c.frets.length !== 6 || c.fingers.length !== 6) problems.push(`Chord ${c.id}: needs 6 frets and 6 fingers`);
for (const s of SONGS) for (const bar of s.bars) for (const ch of bar.split(/\s+/)) if (!CHORDS.some(c => c.id === ch)) problems.push(`Song ${s.id}: unknown chord "${ch}"`);
for (const id of COURSE_ORDER) if (!lessonById(id)) problems.push(`course.json lists "${id}" but there's no lesson file with that id`);
for (const l of LESSONS) {
  if (!COURSE_ORDER.includes(l.id)) problems.push(`Lesson ${l.id} isn't listed in course.json`);
  for (const ch of l.chords) if (!CHORDS.some(c => c.id === ch)) problems.push(`Lesson ${l.id}: unknown chord ${ch}`);
  for (const k of l.checks) {
    if (k.type === 'song' && !songById(k.song)) problems.push(`Lesson ${l.id}: unknown song ${k.song}`);
    if ((k.type === 'chord') && !CHORDS.some(c => c.id === k.chord)) problems.push(`Lesson ${l.id}: unknown chord ${k.chord}`);
    if (k.type === 'change' && (!CHORDS.some(c => c.id === k.from) || !CHORDS.some(c => c.id === k.to))) problems.push(`Lesson ${l.id}: unknown chord in change`);
  }
}
export const CONTENT_PROBLEMS = problems;
