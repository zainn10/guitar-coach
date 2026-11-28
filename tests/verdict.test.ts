import { barVerdict } from '../src/checks/TakeRunner';
import type { BarResult } from '../src/audio/performance';

const bar = (p: Partial<BarResult>): BarResult => ({ bar: 1, chord: 'Em', prevChord: null, expectedFrame: 0, onsetFrame: 100, offsetMs: 0, chordResult: null, extraStrums: 0, status: 'green', messages: [], ...p });

describe('live bar verdicts', () => {
  it('names each kind of bar in plain words', () => {
    expect(barVerdict(bar({})).word).toBe('Solid');
    expect(barVerdict(bar({ status: 'amber', offsetMs: 90 })).word).toBe('A bit late');
    expect(barVerdict(bar({ status: 'amber', offsetMs: -90 })).word).toBe('A bit early');
    expect(barVerdict(bar({ status: 'amber', offsetMs: 10, messages: ['Bar 1 (Em): The 3rd string is muted. Arch your finger.'] }))).toEqual({ word: 'Messy', detail: 'The 3rd string is muted. Arch your finger.' });
    expect(barVerdict(bar({ status: 'red', offsetMs: 400 })).word).toBe('Struggling');
    expect(barVerdict(bar({ status: 'red', onsetFrame: null, offsetMs: null })).detail).toMatch(/No strum heard/);
  });
});
