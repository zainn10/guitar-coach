import { useEffect, useRef } from 'react';
import { engine } from './engine';
import { OnsetDetector, isStrum } from './onset';
import { THRESHOLDS } from '../content';
import { store } from '../storage/store';
import { useEngineState } from '../ui';

/**
 * Calls onStrum(frame) whenever a real strum is detected live from the microphone.
 * Small sounds (taps, fingers moving, room noise) are ignored; onIgnored is told about them.
 */
export function useStrums(onStrum: (frame: number) => void, active = true, onIgnored?: () => void) {
  const cb = useRef(onStrum);
  cb.current = onStrum;
  const ig = useRef(onIgnored);
  ig.current = onIgnored;
  const { running } = useEngineState();
  useEffect(() => {
    if (!active || !running) return;
    const sr = engine.sampleRate;
    const det = new OnsetDetector({ sampleRate: sr, minGapMs: THRESHOLDS.onset.minGapMs, sensitivity: THRESHOLDS.onset.sensitivity });
    let alive = true;
    const off = engine.subscribe((chunk, start) => {
      if (start < 0) return;
      for (const o of det.push(chunk, start)) {
        // wait for 150 ms of the sound, then check it's loud enough to be a strum
        engine.waitForFrame(o.frame + Math.round(0.16 * sr), 2000).then(() => {
          if (!alive) return;
          const sig = engine.getRange(o.frame - Math.round(0.6 * sr), o.frame + Math.round(0.16 * sr));
          if (isStrum(sig, sr, Math.round(0.6 * sr), store.get().settings.sensitivity)) cb.current(o.frame);
          else ig.current?.();
        }).catch(() => {});
      }
    });
    return () => { alive = false; off(); };
  }, [active, running]);
}
