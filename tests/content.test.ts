// Checks every content file: lessons parse, and everything they reference exists.
import { CONTENT_PROBLEMS, LESSONS, CHORDS, SONGS, COURSE_ORDER, songById } from '../src/content';
import troubles from '../content/troubles.json';
import { MISTAKES } from '../src/visuals/Mistakes';
import { SCALES } from '../src/visuals/Fretboard';
import { parseTab } from '../src/visuals/Tab';
import { chordStrings } from '../src/audio/notes';
import goals from '../content/goals.json';

const trIds = new Set(troubles.troubles.map(t => t.id));
const chordIds = new Set(CHORDS.map(c => c.id));

describe('course content', () => {
  it('has no structural problems', () => expect(CONTENT_PROBLEMS).toEqual([]));
  it('every lesson in course order exists, ordered by stage', () => {
    expect(COURSE_ORDER.length).toBe(LESSONS.length);
    const stages = COURSE_ORDER.map(id => LESSONS.find(l => l.id === id)!.stage);
    expect([...stages].sort((a, b) => a - b)).toEqual(stages);
  });
  it('every lesson ends with at least one check (except none)', () => {
    for (const l of LESSONS) expect(l.checks.length, l.id).toBeGreaterThan(0);
  });
  it('every visual in every lesson refers to something real', () => {
    const problems: string[] = [];
    for (const l of LESSONS) {
      const lines = l.body.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (!t.startsWith('::')) continue;
        const [name, ...args] = t.slice(2).split(/\s+/);
        const plain = args.filter(a => !a.includes('='));
        const kv = Object.fromEntries(args.filter(a => a.includes('=')).map(a => a.split('=')));
        const need = (ok: boolean, what: string) => { if (!ok) problems.push(`${l.id}: ${what}`); };
        switch (name) {
          case 'chord': case 'listen': if (!kv.notes) plain.forEach(c => need(chordIds.has(c), `unknown chord ${c}`)); break;
          case 'build': need(chordIds.has(plain[0]), `unknown chord ${plain[0]}`); need(!!CHORDS.find(c => c.id === plain[0])?.steps, `no build steps for ${plain[0]}`); break;
          case 'change': plain.forEach(c => need(chordIds.has(c), `unknown chord ${c}`)); break;
          case 'strum': (kv.chords ?? 'G').split(',').forEach((c: string) => need(chordIds.has(c), `unknown chord ${c}`)); need(/^[DUX-]+$/.test(plain[0]), `bad pattern ${plain[0]}`); break;
          case 'pick': if (kv.chord) need(chordIds.has(kv.chord), `unknown chord ${kv.chord}`); break;
          case 'mistake': plain.forEach(m => need(!!MISTAKES[m], `unknown mistake ${m}`)); break;
          case 'trouble': plain.forEach(m => need(trIds.has(m), `unknown trouble ${m}`)); break;
          case 'scale': need(!!SCALES[plain[0]], `unknown scale ${plain[0]}`); break;
          case 'song': need(!!songById(plain[0]), `unknown song ${plain[0]}`); break;
          case 'tab': {
            const body: string[] = [];
            while (++i < lines.length && lines[i].trim() !== '::end') body.push(lines[i]);
            need(parseTab(body.join('\n')).length > 0, 'tab did not parse');
            break;
          }
          case 'rasgueado': case 'hand': case 'fretboard': case 'guitar': case 'posture': case 'bend': case 'metronome':
          case 'tip': case 'flamenco': case 'warn': case 'goal': break;
          default: problems.push(`${l.id}: unknown visual ::${name}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
  it('every chord taught has a sensible shape', () => {
    for (const c of CHORDS) {
      const s = chordStrings(c);
      expect(s.filter(x => x.midi !== null).length, c.id).toBeGreaterThanOrEqual(3);
      for (const x of s) if (x.fret && x.fret > 0) expect(x.finger, `${c.id} string ${x.string} needs a finger`).not.toBeNull();
    }
  });
  it('every song is chords only and unlockable', () => {
    const taught = new Set(LESSONS.flatMap(l => l.chords));
    for (const s of SONGS) for (const bar of s.bars) for (const c of bar.split(' ')) expect(taught.has(c), `${s.id} uses ${c}, which no lesson teaches`).toBe(true);
  });
  it('goal readiness refers to real lessons and songs', () => {
    for (const g of goals.goals) for (const n of g.needs as { lesson?: string; song?: string }[]) {
      if (n.lesson) expect(COURSE_ORDER.includes(n.lesson), n.lesson).toBe(true);
      if (n.song) expect(!!songById(n.song), n.song).toBe(true);
    }
  });
});
