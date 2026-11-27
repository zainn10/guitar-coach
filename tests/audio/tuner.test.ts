import { detectPitch, tunerReading } from '../../src/audio/tuner';
import { addPluck, highpass, addNoise } from '../../src/audio/synth';
import { OPEN_STRING_MIDI, midiToFreq } from '../../src/audio/notes';

const SR = 48000;
describe('tuner', () => {
  for (const s of [6, 5, 4, 3, 2, 1]) for (const detune of [-30, -8, 0, 12, 40]) {
    it(`string ${s} detuned ${detune} cents`, () => {
      const f = midiToFreq(OPEN_STRING_MIDI[s]) * Math.pow(2, detune / 1200);
      const sig = new Float32Array(SR);
      addPluck(sig, SR, 0, f);
      addNoise(sig, 0.001);
      const mic = highpass(sig, SR, 150);
      const p = detectPitch(mic.subarray(9600, 9600 + 4096), SR, 0.85);
      expect(p).not.toBeNull();
      const r = tunerReading(p!.freq, p!.clarity);
      expect(r.string).toBe(s);
      expect(Math.abs(r.cents - detune)).toBeLessThan(3);
    });
  }
});
