// Not a real test: writes WAV files used as a fake microphone for browser checks.
import { writeFileSync } from 'node:fs';
import { addStrum, addPluck, addNoise } from '../src/audio/synth';
import { encodeWav } from '../src/audio/wav';
import chordsData from '../content/chords/open-chords.json';
import { midiToFreq } from '../src/audio/notes';
const lib = chordsData.chords as any[];
const OUT = process.env.E2E_OUT;
it.skipIf(!OUT)('writes fake mic files', async () => {
  const sr = 48000;
  const em = new Float32Array(sr * 4);
  addStrum(em, sr, Math.round(0.5 * sr), lib.find(c => c.id === 'Em'), { gain: 0.3 });
  addNoise(em, 0.0005);
  const emMuted = new Float32Array(sr * 4);
  addStrum(emMuted, sr, Math.round(0.5 * sr), lib.find(c => c.id === 'Em'), { gain: 0.3, missing: [3] });
  addNoise(emMuted, 0.0005);
  const a = new Float32Array(sr * 3);
  addPluck(a, sr, Math.round(0.1 * sr), midiToFreq(45) * Math.pow(2, 10 / 1200), { gain: 0.4, sustain: 3 });
  for (const [name, sig] of [['em', em], ['em-muted', emMuted], ['a-sharp', a]] as const) {
    writeFileSync(`${OUT}/${name}.wav`, Buffer.from(await encodeWav(sig, sr).arrayBuffer()));
  }
});
