import { useEffect, useRef } from 'react';
import { engine } from './engine';
import { OnsetDetector, isStrum, isPluck } from './onset';
import { noteClarity } from './stringCheck';
import { THRESHOLDS } from '../content';
import { store } from '../storage/store';
import { useEngineState } from '../ui';

/**
 * Calls onStrum(frame) whenever a real strum is detected live from the microphone.
 * Small sounds (taps, fingers moving, room noise) are ignored; onIgnored is told about them.
 */
export function useStrums(onStrum: (frame: number) => void, active = true, onIgnored?: () => void, mode: 'strum' | 'pluck' = 'strum') {
  const cb = useRef(onStrum);
  cb.current = onStrum;
  const ig = useRef(onIgnored);
  ig.current = onIgnored;
  const { running } = useEngineState();
  useEffect(() => {
    if (!active || !running) return;
    const sr = engine.sampleRate;
    const det = new OnsetDetector({ sampleRate: sr, minGapMs: THRESHOLDS.onset.minGapMs, sensitivity: THRESHOLDS.onset.sensitivity * (mode === 'pluck' ? 1.5 : 1) });
    const gate = mode === 'pluck' ? isPluck : isStrum;
    let alive = true;
    const off = engine.subscribe((chunk, start) => {
      if (start < 0) return;
      for (const o of det.push(chunk, start)) {
        // wait for 150 ms of the sound, then check it's loud enough to be a strum
        // wait for some of the sound (longer for single notes, so its pitch can be checked)
        const after = Math.round((mode === 'pluck' ? 0.26 : 0.16) * sr);
        engine.waitForFrame(o.frame + after, 2000).then(() => {
          if (!alive) return;
          const pre = Math.round(0.6 * sr);
          const sig = engine.getRange(o.frame - pre, o.frame + after);
          let real = gate(sig, sr, pre, store.get().settings.sensitivity);
          // A single note must be a clear musical pitch: taps, knocks and finger noise are not.
          if (real && mode === 'pluck') real = noteClarity(sig, sr, pre).clarity >= (THRESHOLDS.onset.minNoteClarity ?? 0.5);
          if (real) cb.current(o.frame);
          else ig.current?.();
        }).catch(() => {});
      }
    });
    return () => { alive = false; off(); };
  }, [active, running, mode]);
}
