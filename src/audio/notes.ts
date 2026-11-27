// Musical helpers: note names, frequencies and the guitar's standard tuning.

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** MIDI note numbers of the open strings, indexed by string number (6 = low E ... 1 = high E). */
export const OPEN_STRING_MIDI: Record<number, number> = { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 };
export const STRING_LABEL: Record<number, string> = {
  6: '6th (low E)', 5: '5th (A)', 4: '4th (D)', 3: '3rd (G)', 2: '2nd (B)', 1: '1st (high E)',
};
export const STRING_SHORT: Record<number, string> = { 6: 'E', 5: 'A', 4: 'D', 3: 'G', 2: 'B', 1: 'e' };

export const ordinal = (n: number) => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');

export const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export const freqToMidi = (f: number) => 69 + 12 * Math.log2(f / 440);
export const noteName = (m: number) => NOTE_NAMES[((Math.round(m) % 12) + 12) % 12] + (Math.floor(Math.round(m) / 12) - 1);
export const pitchClassName = (m: number) => NOTE_NAMES[((Math.round(m) % 12) + 12) % 12];
export const centsBetween = (f: number, ref: number) => 1200 * Math.log2(f / ref);

export interface ChordShape {
  id: string;
  name: string;
  quality?: string;
  /** Strings 6..1. null = not played (X), 0 = open. */
  frets: (number | null)[];
  fingers: (number | null)[];
  steps?: { string: number; text: string }[];
  notes?: string;
  reference?: boolean;
  /** Octave-twin strings that tests showed CAN be checked reliably in this chord. */
  checkShared?: number[];
}

export interface StringNote { string: number; fret: number | null; finger: number | null; midi: number | null }

/** Turn a chord shape into one entry per string (6..1), with the MIDI note it should produce. */
export function chordStrings(chord: ChordShape): StringNote[] {
  return chord.frets.map((fret, i) => {
    const string = 6 - i;
    return {
      string,
      fret,
      finger: chord.fingers[i] ?? null,
      midi: fret === null ? null : OPEN_STRING_MIDI[string] + fret,
    };
  });
}
