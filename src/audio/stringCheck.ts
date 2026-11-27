// String-by-string check: you keep the chord shape and pluck each string on its own,
// thickest to thinnest. Because each note arrives separately, every string can be
// checked, including the "octave twin" strings a strum can't separate.
//
// For each pluck we look at what NEW sound appeared (the spectrum just after the pluck
// minus the spectrum just before it), then work out which note that new sound is.
import { spectrum, peakAt, toDb, Spectrum } from './fft';
import { ChordShape, chordStrings, midiToFreq, OPEN_STRING_MIDI, STRING_LABEL, noteName } from './notes';

export type PluckStatus = 'ok' | 'muted' | 'wrong-note' | 'not-played';

export interface PluckReport {
  string: number;
  expectedMidi: number;
  status: PluckStatus;
  heardMidi: number | null;
  message: string;
  fix: string;
}

export interface StringCheckResult {
  strings: PluckReport[];
  clean: boolean;
  summary: string;
  /** strings marked X that rang anyway */
  extraPlucks: number;
}

const FINGER: Record<number, string> = { 1: 'index', 2: 'middle', 3: 'ring', 4: 'little' };
const ORD: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th' };

/** Spectrum of what's new after the onset (after minus before, never negative). */
export function newSound(signal: Float32Array, sr: number, onset: number): { sp: Spectrum; level: number } {
  const len = Math.round(0.2 * sr);
  const after = spectrum(signal, onset + Math.round(0.03 * sr), len, sr, 16384);
  const before = spectrum(signal, Math.max(0, onset - len - Math.round(0.015 * sr)), len, sr, 16384);
  const mag = new Float64Array(after.mag.length);
  let level = 0;
  for (let k = 0; k < mag.length; k++) {
    mag[k] = Math.max(0, after.mag[k] - before.mag[k] * 1.1);
    if (k * after.binHz > 70 && k * after.binHz < 3000) level = Math.max(level, mag[k]);
  }
  return { sp: { ...after, mag }, level };
}

/** Which of the candidate notes best explains the new sound? null if nothing clear. */
export function identifyNote(sp: Spectrum, candidates: number[]): { midi: number; strength: number } | null {
  let best: { midi: number; score: number } | null = null;
  for (const m of candidates) {
    const f0 = midiToFreq(m);
    let score = 0;
    for (let h = 1; h <= 6; h++) {
      if (f0 * h > 4000) break;
      score += peakAt(sp, f0 * h, 30) / Math.sqrt(h);
    }
    if (!best || score > best.score) best = { midi: m, score };
  }
  if (!best) return null;
  // Octave check: if the note an octave lower has real energy at its odd overtones
  // (which the higher note can't produce), the lower note is the true one.
  const lower = best.midi - 12;
  if (candidates.includes(lower)) {
    const fl = midiToFreq(lower);
    const odd = peakAt(sp, fl, 30) + peakAt(sp, fl * 3, 30);
    const even = peakAt(sp, fl * 2, 30) + 1e-9;
    if (odd > even * 0.25) best = { midi: lower, score: best.score };
  }
  return { midi: best.midi, strength: best.score };
}

export function analysePlucks(signal: Float32Array, sr: number, onsets: number[], chord: ChordShape): StringCheckResult {
  const strings = chordStrings(chord);
  const sounding = strings.filter(s => s.midi !== null) as { string: number; fret: number | null; finger: number | null; midi: number }[];
  // candidate notes: each string's expected note and its neighbours, plus open X strings
  const cands = new Set<number>();
  for (const s of strings) {
    const base = s.midi ?? OPEN_STRING_MIDI[s.string];
    for (let d = -2; d <= 2; d++) if (base + d >= 40) cands.add(base + d);
  }
  const candList = [...cands];

  const plucks = onsets.map(o => {
    const { sp, level } = newSound(signal, sr, o);
    const id = identifyNote(sp, candList);
    // "clear" = a real harmonic note well above the leftover noise
    let noise = 0;
    for (let k = Math.round(100 / sp.binHz); k < Math.round(1500 / sp.binHz); k++) noise += sp.mag[k];
    noise /= Math.round(1500 / sp.binHz) - Math.round(100 / sp.binHz);
    const f0 = id ? midiToFreq(id.midi) : 0;
    const fundamentalish = id ? Math.max(peakAt(sp, f0, 30), peakAt(sp, f0 * 2, 30)) : 0;
    let clear = id !== null && toDb(fundamentalish) - toDb(noise + 1e-12) > 18;
    // A real note keeps ringing; a muted string is a short "thunk" that dies at once.
    if (clear) {
      const f = midiToFreq(id!.midi);
      const ring = (a: number) => {
        const w = spectrum(signal, o + Math.round(a * sr), Math.round(0.1 * sr), sr, 16384);
        return Math.max(peakAt(w, f, 30), peakAt(w, f * 2, 30));
      };
      if (toDb(ring(0.03)) - toDb(ring(0.2)) > 20) clear = false;
    }
    return { onset: o, midi: clear ? id!.midi : null, level };
  });

  // Match plucks to strings. If the count matches, go in order (thickest first);
  // otherwise match by pitch.
  const reports: PluckReport[] = [];
  const byOrder = plucks.length === sounding.length;
  const used = new Set<number>();
  for (let i = 0; i < sounding.length; i++) {
    const s = sounding[i];
    let p: typeof plucks[number] | undefined;
    if (byOrder) p = plucks[i];
    else {
      const j = plucks.findIndex((x, k) => !used.has(k) && x.midi === s.midi);
      if (j >= 0) { used.add(j); p = plucks[j]; }
    }
    const label = STRING_LABEL[s.string];
    const finger = s.finger ? FINGER[s.finger] : null;
    let status: PluckStatus, message: string, fix = '';
    if (!p) {
      status = 'not-played';
      message = `No clear note came from the ${label} string.`;
      fix = s.fret
        ? `Either it's muted (press with the tip of your ${finger} finger right behind the ${ORD[s.fret]} fret wire, and check no other finger is touching it) or it was skipped. Pluck it firmly on its own to see which.`
        : `Either something is touching it (often a fretting finger lying flat; arch your fingers) or it was skipped. Pluck it firmly on its own to see which.`;
    } else if (p.midi === s.midi) {
      status = 'ok';
      message = `${label}: clear.`;
    } else if (p.midi === null) {
      status = 'muted';
      message = `The ${label} string sounded muted or buzzy (a "thunk" rather than a note).`;
      fix = s.fret
        ? `Press with the tip of your ${finger} finger right behind the ${ORD[s.fret]} fret wire, and make sure the finger next to it isn't leaning on this string.`
        : `Something is touching it. Usually a fretting finger lying flat; arch your fingers so they come down on their tips.`;
    } else {
      status = 'wrong-note';
      const d = p.midi - s.midi;
      message = `The ${label} string played ${noteName(p.midi)} instead of ${noteName(s.midi)}.`;
      fix = s.fret === 0 || !s.fret
        ? 'This string should be open (no finger on it).'
        : `Your ${finger} finger should be on the ${ORD[s.fret]} fret; it sounds ${Math.abs(d)} fret${Math.abs(d) > 1 ? 's' : ''} too ${d > 0 ? 'high (towards the body)' : 'low (towards the headstock)'}.`;
    }
    reports.push({ string: s.string, expectedMidi: s.midi, status, heardMidi: p?.midi ?? null, message, fix });
  }
  const extraPlucks = byOrder ? 0 : Math.max(0, plucks.length - sounding.length);
  const bad = reports.filter(r => r.status !== 'ok');
  const summary = !bad.length
    ? `Every string of ${chord.id} rang clearly. Lovely.`
    : `${sounding.length - bad.length} of ${sounding.length} strings clear. Fix: ${bad.map(b => ORD[b.string]).join(', ')} string${bad.length > 1 ? 's' : ''}.`;
  return { strings: reports, clean: bad.length === 0, summary, extraPlucks };
}

export interface NoteResult { expected: number; heard: number | null; ok: boolean }

/** Checks a played sequence of single notes (e.g. a warm-up, scale or melody) against what was expected. */
export function analyseNoteSequence(signal: Float32Array, sr: number, onsets: number[], expected: number[]): NoteResult[] {
  const cands = new Set<number>();
  for (const m of expected) for (let d = -2; d <= 2; d++) if (m + d >= 38) cands.add(m + d);
  const heard = onsets.map(o => {
    const { sp } = newSound(signal, sr, o);
    const id = identifyNote(sp, [...cands]);
    return id ? id.midi : null;
  });
  // Align in order, allowing for an extra stray pluck: greedy match.
  const out: NoteResult[] = [];
  let j = 0;
  for (const m of expected) {
    let found: number | null = null;
    for (let k = j; k < Math.min(heard.length, j + 2); k++) if (heard[k] === m) { found = k; break; }
    if (found !== null) { out.push({ expected: m, heard: m, ok: true }); j = found + 1; }
    else { out.push({ expected: m, heard: heard[j] ?? null, ok: false }); if (j < heard.length) j++; }
  }
  return out;
}

/**
 * How clearly the new sound at `onset` is a musical note (0..1), and which note.
 * A plucked string puts most of its energy into a neat row of harmonics; a tap, a knock,
 * a finger sliding or a breath spreads its energy everywhere. Used to ignore non-notes.
 */
export function noteClarity(signal: Float32Array, sr: number, onset: number, lo = 38, hi = 88): { midi: number; clarity: number } {
  // What's new after the onset. Subtract in power with headroom, so a note that was already
  // ringing (and only got jostled by a knock) doesn't look like a new note.
  const len = Math.round(0.13 * sr);
  const after = spectrum(signal, onset + Math.round(0.008 * sr), len, sr, 16384);
  const before = spectrum(signal, Math.max(0, onset - len - Math.round(0.015 * sr)), len, sr, 16384);
  const mag = new Float64Array(after.mag.length);
  for (let k = 0; k < mag.length; k++) mag[k] = Math.sqrt(Math.max(0, after.mag[k] ** 2 - (before.mag[k] * 1.2) ** 2));
  const sp = { ...after, mag };
  // Measured against everything new AND a share of everything heard, so a faint leftover
  // of an old note under a knock can't pass as a fresh note.
  let fresh = 0, heard = 0;
  for (let k = 0; k < sp.mag.length; k++) { const f = k * sp.binHz; if (f > 70 && f < 4000) { fresh += sp.mag[k] ** 2; heard += after.mag[k] ** 2; } }
  const total = Math.max(fresh, heard * 0.5);
  let best = { midi: lo, clarity: 0 };
  if (total <= 0) return best;
  for (let m = lo; m <= hi; m++) {
    const f0 = midiToFreq(m);
    // energy on the harmonics, minus energy halfway between them (noise fills both equally)
    let e = 0;
    const band = (f: number) => {
      const c = Math.round(f / sp.binHz), w = Math.max(2, Math.round(f * 0.012 / sp.binHz));
      let x = 0;
      for (let k = c - w; k <= c + w; k++) if (k > 0 && k < sp.mag.length) x += sp.mag[k] * sp.mag[k];
      return x;
    };
    for (let h = 1; h <= 8; h++) {
      const f = f0 * h;
      if (f > 4000) break;
      // a string's harmonics are sharp spikes; a knock's energy is a broad hump,
      // so compare each harmonic with the spectrum just either side of it
      const d = Math.max(f * 0.06, 6 * sp.binHz);
      e += band(f) - Math.max(band(f - d), band(f + d)) * 1.2 - band(f + f0 / 2) * 0.5;
    }
    const cl = Math.max(0, e) / total;
    if (cl > best.clarity + 0.02 || (cl > best.clarity - 0.02 && cl > 0 && m === best.midi - 12)) best = { midi: m, clarity: Math.max(cl, best.clarity) };
  }
  return best;
}
