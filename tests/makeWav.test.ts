// Not a real test: writes WAV files used as a fake microphone for browser checks.
import { writeFileSync } from 'node:fs';
import { addPluck, addNoise } from '../src/audio/synth';
import { encodeWav } from '../src/audio/wav';
import chordsData from '../content/chords/open-chords.json';
import { chordStrings, midiToFreq, ChordShape } from '../src/audio/notes';
const OUT = process.env.E2E_OUT;
it.skipIf(!OUT)('writes fake mic files', async () => {
  const sr = 48000;
  const em = (chordsData.chords as ChordShape[]).find(c => c.id === 'Em')!;
  const sig = new Float32Array(sr * 7);
  chordStrings(em).forEach((n, i) => {
    const at = Math.round((1.0 + i * 0.7) * sr);
    if (n.string === 4) { for (let k = 0; k < 0.04 * sr; k++) sig[at + k] += Math.sin(k * 0.03) * 0.08 * Math.exp(-k / (0.008 * sr)); }
    else addPluck(sig, sr, at, midiToFreq(n.midi!), { gain: 0.25 });
  });
  addNoise(sig, 0.0005);
  writeFileSync(`${OUT}/em-pluck-4muted.wav`, Buffer.from(await encodeWav(sig, sr).arrayBuffer()));
});
