// Course rules: you can always go back, never jump forward.
import { COURSE_ORDER, LESSONS, STAGES, lessonById, SONGS, CHORDS } from '../content';
import type { Data } from '../storage/store';
import type { Song } from '../audio/performance';

export type LessonStatus = 'locked' | 'open' | 'passed';

export function lessonStatus(d: Data, id: string): LessonStatus {
  if (d.lessons[id]?.status === 'passed') return 'passed';
  const i = COURSE_ORDER.indexOf(id);
  if (i <= 0) return 'open';
  return d.lessons[COURSE_ORDER[i - 1]]?.status === 'passed' ? 'open' : 'locked';
}

/** The lesson you should do next (first one not yet passed). */
export function currentLesson(d: Data) {
  const id = COURSE_ORDER.find(x => d.lessons[x]?.status !== 'passed');
  return id ? lessonById(id) : undefined;
}

/** Chords taught in lessons you've passed (plus any chord you've passed a clean-chord check on). */
export function knownChords(d: Data): string[] {
  const set = new Set<string>();
  for (const l of LESSONS) if (d.lessons[l.id]?.status === 'passed') l.chords.forEach(c => set.add(c));
  for (const [k, v] of Object.entries(d.items)) if (k.startsWith('chord:') && v.history.some(h => h.pass)) set.add(k.slice(6));
  return CHORDS.map(c => c.id).filter(c => set.has(c));
}

/** Chords taught so far, including the lesson you're on now (for drills and the library). */
export function chordsSoFar(d: Data): string[] {
  const set = new Set(knownChords(d));
  const cur = currentLesson(d);
  cur?.chords.forEach(c => set.add(c));
  return CHORDS.map(c => c.id).filter(c => set.has(c));
}

export const songChords = (s: Song) => [...new Set(s.bars.flatMap(b => b.split(/\s+/)))];

export function songUnlocked(d: Data, s: Song) {
  const known = new Set(knownChords(d));
  return songChords(s).every(c => known.has(c));
}

export function unlockedSongs(d: Data) { return SONGS.filter(s => songUnlocked(d, s)); }

export function stageProgress(d: Data) {
  return STAGES.map(st => {
    const passed = st.lessons.filter(id => d.lessons[id]?.status === 'passed').length;
    return { stage: st, passed, total: st.lessons.length, done: passed === st.lessons.length };
  });
}

/** Lesson that teaches a given chord or skill (for "review" links). */
export function lessonTeaching(key: string) {
  const [kind, id] = key.split(':');
  if (kind === 'chord') return LESSONS.find(l => l.chords.includes(id));
  return LESSONS.find(l => l.skills.includes(key));
}
