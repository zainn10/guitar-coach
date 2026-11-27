// Chord check: listens to ~half a second of a strummed chord and works out,
// string by string, whether each string is ringing properly.
//
// How it works (plain English):
//  1. Each string of the target chord should produce a known note.
//     A note isn't one frequency — it's a "fundamental" plus overtones at 2x, 3x, 4x...
//  2. Where a string's overtone lands on a frequency no other string in the chord
//     produces, we can check that string on its own (reliable).
//  3. Where every overtone of a string is shared with another string (e.g. the two
//     E strings in E minor), we estimate how much of that energy the other strings
//     explain. Those results are marked "probably" because they're less certain.
//  4. We compare the overall "colour" of notes (chroma) with every chord we know,
//     to tell a wrong chord from a slightly messy right one.
import { spectrum, peakAt, floorAt, toDb, Spectrum } from './fft';
import {
  ChordShape, chordStrings, midiToFreq, OPEN_STRING_MIDI, STRING_LABEL, noteName, StringNote,
} from './notes';

export type StringStatus =
  | 'ok'          // rang clearly
  | 'ok-probably' // shared overtones, but looks present
  | 'weak'        // faint
  | 'damped'      // rang then died almost immediately (muted by touch / buzz)
  | 'missing'     // not heard
  | 'missing-probably'
  | 'unsure'      // shared overtones; can't tell
  | 'wrong-note'  // something near the right note is ringing instead
  | 'extra'       // an X string that was played
  | 'extra-maybe' // an X string ringing a bit: maybe played, maybe just humming along
  | 'silent-ok';  // an X string that correctly stayed quiet

export interface StringReport {
  string: number;
  expectedMidi: number | null;
  status: StringStatus;
  /** How far above the background the string's evidence was (dB). */
  evidenceDb: number;
  checkable: 'alone' | 'shared' | 'n/a';
  heardMidi?: number;
}

export interface ChordIssue {
  string: number;
  kind: 'missing' | 'weak' | 'damped' | 'extra' | 'wrong-note';
  certain: boolean;
  message: string;
  fix: string;
  tipId: 'finger-touching' | 'press-near-fret' | 'strum-start' | 'wrong-fret' | 'press-harder';
}

export type ChordVerdict = 'clean' | 'issues' | 'wrong-chord' | 'too-quiet';

export interface ChordResult {
  verdict: ChordVerdict;
  target: string;
  strings: StringReport[];
  issues: ChordIssue[];
  bestMatch: { id: string; score: number };
  targetScore: number;
  ranking: { id: string; score: number }[];
  summary: string;
  levelDb: number;
}

export interface ChordCheckSettings {
  analysisStartMs: number;
  analysisLengthMs: number;
  stringPresentDb: number;
  stringWeakDb: number;
  fastDecayDb: number;
  extraStringDb: number;
  /** How loud an unwanted string must be compared with the chord's strings (dB) to count as played. */
  extraStringRelDb: number;
  wrongChordMargin: number;
  /** For strings that share all their overtones with another string. */
  sharedOkDb: number;
  sharedMissingDb: number;
}

export const DEFAULT_CHORD_SETTINGS: ChordCheckSettings = {
  analysisStartMs: 70,
  analysisLengthMs: 450,
  stringPresentDb: 12,
  stringWeakDb: 6,
  fastDecayDb: 22,
  extraStringDb: 14,
  extraStringRelDb: -6,
  wrongChordMargin: 0.04,
  sharedOkDb: 11,
  sharedMissingDb: 5.5,
};

const FINGER_NAME: Record<number, string> = { 1: 'index', 2: 'middle', 3: 'ring', 4: 'little' };
const ORD: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th' };
const MAX_H = 8;
const MATCH_CENTS = 40;
const amp = (h: number) => Math.pow(h, -1.5);
const near = (a: number, b: number, cents = MATCH_CENTS) => Math.abs(1200 * Math.log2(a / b)) < cents;

interface Overtone { string: number; h: number; f: number }

function partialsOf(notes: { string: number; midi: number }[], maxH = 10): Overtone[] {
  const out: Overtone[] = [];
  for (const n of notes) for (let h = 1; h <= maxH; h++) out.push({ string: n.string, h, f: midiToFreq(n.midi) * h });
  return out;
}

/** Pitch-class profile ("chroma") of a spectrum. */
export function chromaOf(sp: Spectrum, lo = 75, hi = 1600): number[] {
  const c = new Array(12).fill(0);
  const k0 = Math.ceil(lo / sp.binHz), k1 = Math.floor(hi / sp.binHz);
  for (let k = k0; k <= k1; k++) {
    const f = k * sp.binHz;
    const m = 69 + 12 * Math.log2(f / 440);
    const r = Math.round(m);
    if (Math.abs(m - r) > 0.35) continue;
    c[((r % 12) + 12) % 12] += sp.mag[k] * sp.mag[k];
  }
  return c.map(Math.sqrt);
}

function chordChroma(chord: ChordShape): number[] {
  const c = new Array(12).fill(0);
  for (const s of chordStrings(chord)) {
    if (s.midi === null) continue;
    for (let h = 1; h <= 6; h++) {
      const m = s.midi + 12 * Math.log2(h);
      const r = Math.round(m);
      if (Math.abs(m - r) > 0.35) continue;
      c[((r % 12) + 12) % 12] += amp(h) ** 2;
    }
  }
  return c.map(Math.sqrt);
}

function cosine(a: number[], b: number[]) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return d / (Math.sqrt(na * nb) || 1);
}

export function analyseChord(
  signal: Float32Array,
  sampleRate: number,
  onsetFrame: number,
  target: ChordShape,
  library: ChordShape[],
  settings: Partial<ChordCheckSettings> = {},
): ChordResult {
  const st = { ...DEFAULT_CHORD_SETTINGS, ...settings };
  const ampS = (_str: number, h: number) => amp(h);
  const ms = (x: number) => Math.round((x / 1000) * sampleRate);
  const start = onsetFrame + ms(st.analysisStartMs);
  const len = ms(st.analysisLengthMs);
  const sp = spectrum(signal, start, len, sampleRate, 32768);
  const early = spectrum(signal, onsetFrame + ms(40), ms(170), sampleRate, 16384);
  const late = spectrum(signal, onsetFrame + ms(360), ms(170), sampleRate, 16384);
  const before = spectrum(signal, Math.max(0, onsetFrame - ms(190)), ms(170), sampleRate, 16384);

  // overall loudness of the chord (strongest peak 75 Hz - 2 kHz)
  let maxMag = 0;
  for (let k = Math.ceil(75 / sp.binHz); k < 2000 / sp.binHz; k++) maxMag = Math.max(maxMag, sp.mag[k]);
  const levelDb = toDb(maxMag);

  const strings = chordStrings(target);
  const sounding = strings.filter(s => s.midi !== null) as (StringNote & { midi: number })[];
  const allPartials = partialsOf(sounding, 30).filter(p => p.f < 3000);

  const evidence = (f: number) => {
    const p = peakAt(sp, f, 25);
    return { db: toDb(p) - toDb(floorAt(sp, f, 3)), lin: p, abs: toDb(p) };
  };
  const audibleFloor = levelDb - 45;

  const reports: StringReport[] = [];
  const issues: ChordIssue[] = [];
  const level = new Map<number, number>(); // estimated fundamental level per string (linear)

  // Rough loudness of each string (as if it were its fundamental), used to
  // predict how much of a shared frequency the OTHER strings explain.
  const ownDominant = (str: number, f: number, h: number, ratio = 3) => {
    let others = 0;
    for (const p of allPartials) if (p.string !== str && near(p.f, f)) others += amp(p.h);
    return amp(h) >= ratio * others;
  };
  for (const s of sounding) {
    const f0 = midiToFreq(s.midi);
    let L = 0;
    for (let h = 1; h <= 6; h++) if (ownDominant(s.string, f0 * h, h, 3)) L = Math.max(L, peakAt(sp, f0 * h, 25) / ampS(s.string, h));
    if (!L) L = peakAt(sp, f0, 25) / ampS(s.string, 1);
    level.set(s.string, L);
  }
  const predictedOthers = (str: number, f: number) => {
    let sum = 0;
    for (const p of allPartials) if (p.string !== str && near(p.f, f)) sum += (level.get(p.string) ?? 0) * ampS(p.string, p.h);
    return sum;
  };

  const dominance = (str: number, f: number, h: number) => {
    let others = 0;
    for (const p of allPartials) if (p.string !== str && near(p.f, f)) others += amp(p.h);
    return others === 0 ? Infinity : amp(h) / others;
  };
  const scoreAt = (str: number, f: number) => {
    const e = evidence(f);
    const excess = toDb(e.lin) - toDb(Math.max(predictedOthers(str, f), 1e-9));
    // must stand out from the background AND from other strings' overtones
    return e.abs > audibleFloor ? Math.min(e.db, excess + 6) : Math.min(e.db, 0);
  };

  for (const s of sounding) {
    const f0 = midiToFreq(s.midi);
    const cands: { h: number; dom: number }[] = [];
    for (let h = 1; h <= MAX_H; h++) {
      if (f0 * h > 2500) break;
      cands.push({ h, dom: dominance(s.string, f0 * h, h) });
    }
    // Most "own" overtones first (ties: lowest overtone first)
    cands.sort((a, b) => (b.dom - a.dom) || (a.h - b.h));
    const alone = cands[0].dom >= 3;
    const use = alone && f0 < 110 ? cands.filter(c => c.dom >= 3).slice(0, 2) : cands.slice(0, 1);
    let ev = -99, bestH = use[0].h;
    for (const c of use) {
      const sc = scoreAt(s.string, f0 * c.h);
      if (sc > ev) { ev = sc; bestH = c.h; }
    }
    let status: StringStatus;
    if (alone) {
      status = ev >= st.stringPresentDb ? 'ok' : ev >= st.stringWeakDb ? 'weak' : 'missing';
      if (status === 'ok') {
        const drop = toDb(peakAt(early, f0 * bestH, 30)) - toDb(peakAt(late, f0 * bestH, 30));
        if (drop > st.fastDecayDb) status = 'damped';
      }
    } else {
      // Only strings tested as reliably checkable (listed in the chord's data file) may be called missing.
      const checkable = target.checkShared?.includes(s.string);
      status = checkable
        ? (ev < st.sharedMissingDb ? 'missing-probably' : 'ok-probably')
        : (ev >= st.sharedOkDb ? 'ok-probably' : 'unsure');
    }
    reports.push({ string: s.string, expectedMidi: s.midi, status, evidenceDb: ev, checkable: alone ? 'alone' : 'shared' });
  }

  // Strings that shouldn't be played.
  // Unplayed open strings always hum a little in sympathy with the chord, so an
  // "extra" string must be nearly as loud as the strings you meant to play.
  const chordLevels = sounding.map(x => toDb(level.get(x.string) ?? 1e-9)).sort((a, b) => a - b);
  const typicalDb = chordLevels[Math.floor(chordLevels.length / 2)];
  for (const s of strings.filter(x => x.midi === null)) {
    const m = OPEN_STRING_MIDI[s.string];
    let ev = -99, rel = -99;
    for (let h = 1; h <= 4; h++) {
      const f = midiToFreq(m) * h;
      if (allPartials.some(p => near(p.f, f))) continue;
      const e = evidence(f);
      // Must be NEW sound from this strum, not the previous chord still ringing.
      const grew = toDb(peakAt(early, f, 30)) - toDb(peakAt(before, f, 30));
      if (e.abs > audibleFloor && grew > 6) {
        ev = Math.max(ev, e.db);
        rel = Math.max(rel, toDb(e.lin / amp(h)) - typicalDb);
      }
    }
    reports.push({
      string: s.string, expectedMidi: null, checkable: 'n/a', evidenceDb: rel,
      status: ev >= st.extraStringDb && rel >= st.extraStringRelDb ? (rel >= 0 ? 'extra' : 'extra-maybe') : 'silent-ok',
    });
  }

  // Missing strings: is a nearby (wrong-fret) note ringing instead?
  for (const r of reports) {
    if (r.expectedMidi === null || !(r.status === 'missing' || r.status === 'weak')) continue;
    let best: { d: number; db: number } | null = null;
    for (const d of [-2, -1, 1, 2]) {
      const m = r.expectedMidi + d;
      if (m < OPEN_STRING_MIDI[r.string]) continue; // can't go below the open string
      const f = midiToFreq(m);
      if (allPartials.some(p => near(p.f, f, 60))) continue;
      const e = evidence(f);
      if (e.abs > audibleFloor && e.db >= st.stringPresentDb && (!best || e.db > best.db)) best = { d, db: e.db };
    }
    if (best) { r.status = 'wrong-note'; r.heardMidi = r.expectedMidi + best.d; }
  }
  reports.sort((a, b) => b.string - a.string);

  // Chord identity
  const chroma = chromaOf(sp);
  const ranking = library
    .map(c => ({ id: c.id, score: cosine(chroma, chordChroma(c)) }))
    .sort((a, b) => b.score - a.score);
  const targetScore = ranking.find(r => r.id === target.id)?.score ?? 0;
  const bestMatch = ranking[0];

  // Issues + fixes
  const byString = new Map(strings.map(s => [s.string, s]));
  for (const r of reports) {
    const s = byString.get(r.string)!;
    const label = STRING_LABEL[r.string];
    const finger = s.finger ? FINGER_NAME[s.finger] : null;
    const neighbourFinger = () => {
      // The finger on the next THICKER string usually leans onto this one.
      const n = byString.get(r.string + 1);
      return n?.finger ? { finger: FINGER_NAME[n.finger], string: r.string + 1 } : null;
    };
    if (r.status === 'missing' || r.status === 'missing-probably') {
      const certain = r.status === 'missing';
      if (s.fret === 0) {
        const n = neighbourFinger();
        issues.push({
          string: r.string, kind: 'missing', certain,
          message: `${certain ? 'The' : 'Probably the'} ${label} string isn't ringing.`,
          fix: n
            ? `Your ${n.finger} finger on the ${ORD[n.string]} string is probably touching it. Arch that finger more and press with the very tip, so the open ${ORD[r.string]} string is free.`
            : `Make sure your strum reaches the ${ORD[r.string]} string and nothing is resting on it.`,
          tipId: n ? 'finger-touching' : 'strum-start',
        });
      } else {
        issues.push({
          string: r.string, kind: 'missing', certain,
          message: `${certain ? 'The' : 'Probably the'} ${label} string isn't ringing.`,
          fix: `Press it with the tip of your ${finger} finger, just behind the ${ORD[s.fret!]} fret wire, and check the finger beside it isn't leaning on it.`,
          tipId: 'press-near-fret',
        });
      }
    } else if (r.status === 'weak') {
      issues.push({
        string: r.string, kind: 'weak', certain: true,
        message: `The ${label} string is faint.`,
        fix: s.fret ? `Press a little harder with your ${finger} finger, close to the fret wire.` : `Let your strum go fully through the ${ORD[r.string]} string.`,
        tipId: s.fret ? 'press-harder' : 'strum-start',
      });
    } else if (r.status === 'damped') {
      issues.push({
        string: r.string, kind: 'damped', certain: true,
        message: `The ${label} string sounds, then dies away almost at once.`,
        fix: s.fret
          ? `It's probably buzzing or only half-pressed. Move your ${finger} finger right up behind the fret wire and press with the tip.`
          : `Something is lightly touching it, usually the underside of a neighbouring finger. Arch your fingers so they come down on their tips.`,
        tipId: s.fret ? 'press-near-fret' : 'finger-touching',
      });
    } else if (r.status === 'extra' || r.status === 'extra-maybe') {
      const first = strings.find(x => x.midi !== null)!;
      issues.push({
        // As loud as the chord's own strings = definitely played; a bit quieter = maybe
        // just humming along by itself (open strings do that).
        string: r.string, kind: 'extra', certain: r.evidenceDb >= 0,
        message: r.evidenceDb >= 0
          ? `The ${label} string shouldn't be played in ${target.id}.`
          : `The ${label} string may have been played (it shouldn't be in ${target.id}), or it's just humming along.`,
        fix: `Start your strum on the ${ORD[first.string]} string (${STRING_LABEL[first.string].replace(/^\S+ /, '')}).`,
        tipId: 'strum-start',
      });
    } else if (r.status === 'wrong-note') {
      const d = r.heardMidi! - r.expectedMidi!;
      issues.push({
        string: r.string, kind: 'wrong-note', certain: true,
        message: `The ${label} string is playing ${noteName(r.heardMidi!)} instead of ${noteName(r.expectedMidi!)}.`,
        fix: s.fret === 0
          ? `This string should be open. Lift any finger off it.`
          : `Your ${finger} finger should be on the ${ORD[s.fret!]} fret; it sounds ${Math.abs(d)} fret${Math.abs(d) > 1 ? 's' : ''} too ${d > 0 ? 'high (towards the body)' : 'low (towards the headstock)'}.`,
        tipId: 'wrong-fret',
      });
    }
  }

  const soundingCount = sounding.length;
  const serious = reports.filter(r => r.status === 'missing' || r.status === 'wrong-note' || r.status === 'missing-probably').length;
  let verdict: ChordVerdict;
  if (levelDb < -60) verdict = 'too-quiet';
  else if (
    bestMatch.id !== target.id &&
    bestMatch.score - targetScore > st.wrongChordMargin &&
    (serious >= 2 || bestMatch.score - targetScore > 0.15)
  ) verdict = 'wrong-chord';
  else if (serious >= Math.ceil(soundingCount * 0.75)) verdict = 'wrong-chord';
  // "Probably" findings are shown as tips but never stop a strum counting as clean.
  else verdict = issues.some(i => i.certain) ? 'issues' : 'clean';

  let summary: string;
  if (verdict === 'too-quiet') summary = "I couldn't hear a chord. Strum a bit louder or move closer to the microphone.";
  else if (verdict === 'wrong-chord')
    summary = bestMatch.id !== target.id
      ? `That sounded more like ${bestMatch.id} than ${target.id}. Check the diagram and try again.`
      : `That doesn't sound like ${target.id} yet. Check each finger against the diagram.`;
  else if (verdict === 'clean') summary = issues.length
    ? `Clean ${target.id}! One string was a little quiet, worth a glance.`
    : `Clean ${target.id}! Every string rang.`;
  else {
    const n = issues.filter(i => i.certain).length;
    summary = `${target.id} is nearly there: ${n} thing${n > 1 ? 's' : ''} to fix.`;
  }

  if (verdict === 'too-quiet') { issues.length = 0; reports.forEach(r => { if (r.expectedMidi !== null) r.status = 'unsure'; }); }
  return { verdict, target: target.id, strings: reports, issues, bestMatch, targetScore, ranking: ranking.slice(0, 4), summary, levelDb };
}
