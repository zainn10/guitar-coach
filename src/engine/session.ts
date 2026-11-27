// Builds a practice session for the time you have.
// Order of priority: weakest items, then items due for spaced review, then the next
// new skill (never skipping a mastery gate), then a song you've unlocked.
import { store, Data, SessionState, today } from '../storage/store';
import { currentLesson, unlockedSongs, knownChords, lessonTeaching } from './course';
import { songById } from '../content';

export type BlockKind = 'warmup' | 'weak' | 'review' | 'new' | 'drill' | 'song' | 'quiz' | 'technique' | 'ear' | 'free' | 'break' | 'chord';
export interface Block { id: string; kind: BlockKind; title: string; ref?: string; minutes: number; why?: string; done?: boolean }

const DAY = 86400000;

/** Items ranked by how much they need practice right now. */
export function rankedItems(d: Data, now = Date.now()) {
  return Object.entries(d.items)
    .map(([key, it]) => {
      const overdueDays = Math.max(0, (now - it.due) / DAY);
      const practisedToday = today(it.last) === today(now);
      const priority = (1 - it.strength) * 2 + Math.min(2, overdueDays * 0.3) + (it.due <= now ? 0.5 : 0) - (practisedToday ? 0.8 : 0);
      return { key, it, priority, due: it.due <= now };
    })
    .sort((a, b) => b.priority - a.priority);
}

function itemBlock(key: string, kind: 'weak' | 'review', minutes: number, why: string): Block | null {
  const [type, ref] = key.split(':');
  const id = `${kind}-${key}-${Math.random().toString(36).slice(2, 6)}`;
  if (type === 'chord') return { id, kind: 'chord', ref, minutes, title: `Clean ${ref} chord`, why };
  if (type === 'change') { const [a, b] = ref.split('>'); return { id, kind: 'drill', ref: `${a}>${b}`, minutes, title: `${a} ⇄ ${b} change drill`, why }; }
  if (type === 'song') { const s = songById(ref); return s ? { id, kind: 'song', ref, minutes, title: `Play-along: ${s.title}`, why } : null; }
  const lesson = lessonTeaching(key);
  return lesson ? { id, kind: 'review', ref: lesson.id, minutes, title: `Review: ${lesson.title}`, why } : null;
}

function pickSong(d: Data): string | undefined {
  const songs = unlockedSongs(d);
  if (!songs.length) return undefined;
  // weakest unlocked song, preferring ones not played today
  const scored = songs.map(s => {
    const it = d.items[`song:${s.id}`];
    return { s, score: (it?.strength ?? 0) + (it && today(it.last) === today() ? 0.5 : 0) };
  }).sort((a, b) => a.score - b.score);
  return scored[0].s.id;
}

export function buildSession(minutes: number | 'open', d: Data = store.get()): SessionState {
  const blocks: Block[] = [];
  const ranked = rankedItems(d);
  const weak = ranked.filter(r => r.it.strength < 0.75);
  const due = ranked.filter(r => r.due && !weak.slice(0, 2).includes(r));
  const lesson = currentLesson(d);
  const song = pickSong(d);
  const known = knownChords(d);
  const newDays = (Date.now() - d.startedAt) / DAY < 21;
  const add = (b: Block | null | undefined) => { if (b) blocks.push(b); };
  const uid = () => Math.random().toString(36).slice(2, 8);
  const weakBlock = (i: number, mins: number) => weak[i] ? itemBlock(weak[i].key, 'weak', mins, 'One of your weakest areas right now') : due[i] ? itemBlock(due[i].key, 'review', mins, 'Due for review so it sticks') : null;
  const reviewBlock = (i: number, mins: number) => due[i] ? itemBlock(due[i].key, 'review', mins, 'Due for spaced review') : null;
  const newBlock = (mins: number): Block | undefined => lesson ? { id: 'new-' + uid(), kind: 'new', ref: lesson.id, minutes: mins, title: `Next lesson: ${lesson.title}`, why: 'Your next step in the course' } : undefined;
  const songBlock = (mins: number): Block | undefined => song ? { id: 'song-' + uid(), kind: 'song', ref: song, minutes: mins, title: `Play-along: ${songById(song)!.title}`, why: 'Real music with the chords you know' } : undefined;

  if (minutes === 'open') {
    return { date: today(), minutes, blocks: [nextOpenBlock(d, [])] };
  }
  if (minutes <= 5) {
    add(weakBlock(0, 2) ?? newBlock(2));
    add(songBlock(3) ?? (known.length >= 2 ? { id: 'drill-' + uid(), kind: 'drill', ref: `${known[0]}>${known[1]}`, minutes: 3, title: `${known[0]} ⇄ ${known[1]} change drill` } : newBlock(3)));
  } else if (minutes <= 15) {
    add({ id: 'warm-' + uid(), kind: 'warmup', minutes: 2, title: 'Warm-up: tune and finger exercise' });
    add(weakBlock(0, 3) ?? reviewBlock(0, 3));
    add(newBlock(5));
    add(songBlock(4));
    add({ id: 'quiz-' + uid(), kind: 'quiz', minutes: 1, title: '30-second quiz' });
  } else {
    const big = minutes >= 45;
    add({ id: 'warm-' + uid(), kind: 'warmup', minutes: 3, title: 'Warm-up: tune and finger exercise' });
    add(weakBlock(0, 4));
    add(reviewBlock(0, 3) ?? weakBlock(1, 3));
    add(newBlock(big ? 10 : 7));
    if (newDays) add({ id: 'break-' + uid(), kind: 'break', minutes: 2, title: 'Short break: rest your fingertips' });
    add({ id: 'tech-' + uid(), kind: 'technique', minutes: big ? 6 : 4, title: 'Technique: rhythm and strumming' });
    add(songBlock(big ? 10 : 6));
    add({ id: 'ear-' + uid(), kind: 'ear', minutes: big ? 3 : 2, title: 'Ear training' });
    if (big) {
      add(weakBlock(1, 4) ?? reviewBlock(1, 4));
      if (newDays) add({ id: 'break2-' + uid(), kind: 'break', minutes: 2, title: 'Short break' });
      add(songBlock(6));
      add({ id: 'quiz-' + uid(), kind: 'quiz', minutes: 1, title: '30-second quiz' });
    }
    add({ id: 'free-' + uid(), kind: 'free', minutes: big ? 5 : 2, title: 'Free play: anything you enjoy' });
  }
  return { date: today(), minutes, blocks };
}

/** Open-ended sessions: after each block, offer the next most useful one. */
export function nextOpenBlock(d: Data, doneKinds: BlockKind[]): Block {
  const uid = () => Math.random().toString(36).slice(2, 8);
  const count = (k: BlockKind) => doneKinds.filter(x => x === k).length;
  const ranked = rankedItems(d);
  if (!doneKinds.length) return { id: 'warm-' + uid(), kind: 'warmup', minutes: 3, title: 'Warm-up: tune and finger exercise' };
  const newDays = (Date.now() - d.startedAt) / DAY < 21;
  if (newDays && doneKinds.length > 0 && doneKinds.length % 5 === 0) return { id: 'break-' + uid(), kind: 'break', minutes: 2, title: 'Short break: rest your fingertips' };
  const weak = ranked.find(r => r.it.strength < 0.75 && today(r.it.last) !== today());
  if (weak && count('weak') + count('chord') + count('drill') < 3) {
    const b = itemBlock(weak.key, 'weak', 4, 'One of your weakest areas');
    if (b) return b;
  }
  const lesson = currentLesson(d);
  if (lesson && count('new') < 2) return { id: 'new-' + uid(), kind: 'new', ref: lesson.id, minutes: 8, title: `Next lesson: ${lesson.title}` };
  const song = pickSong(d);
  if (song && count('song') <= count('new')) return { id: 'song-' + uid(), kind: 'song', ref: song, minutes: 6, title: `Play-along: ${songById(song)!.title}` };
  const due = ranked.find(r => r.due);
  if (due) { const b = itemBlock(due.key, 'review', 4, 'Due for review'); if (b) return b; }
  const cycle: BlockKind[] = ['technique', 'quiz', 'ear', 'free'];
  const k = cycle[doneKinds.length % cycle.length];
  return { id: k + '-' + uid(), kind: k, minutes: 3, title: { technique: 'Technique: rhythm and strumming', quiz: '30-second quiz', ear: 'Ear training', free: 'Free play' }[k as 'technique'] };
}
