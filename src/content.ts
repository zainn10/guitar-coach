// All course data comes from the /content folder (kept separate from code).
import chordsJson from '../content/chords/open-chords.json';
import songJson from '../content/songs/first-steps.json';
import thresholdsJson from '../content/config/thresholds.json';
import type { ChordShape } from './audio/notes';
import type { Song } from './audio/performance';

export const CHORDS = chordsJson.chords as ChordShape[];
export const PHASE0_CHORDS = ['Em', 'Am', 'A', 'D', 'G'];
export const chordById = (id: string) => CHORDS.find(c => c.id === id)!;
export const FIRST_SONG = songJson as Song;
export const THRESHOLDS = thresholdsJson;

// Basic content check so a typo in a data file shows a clear error.
for (const c of CHORDS) {
  if (c.frets.length !== 6 || c.fingers.length !== 6) throw new Error(`Chord ${c.id}: needs 6 frets and 6 fingers`);
}
for (const b of FIRST_SONG.bars) if (!CHORDS.some(c => c.id === b)) throw new Error(`Song ${FIRST_SONG.id}: unknown chord ${b}`);
