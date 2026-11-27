// Sample-accurate rhythmic scheduling ("look-ahead" scheduler).
// Calls schedule(slot, time) a little before each slot is due, using the audio clock.
import { engine } from './engine';

export interface Loop {
  stop: () => void;
  /** slot currently sounding (or -1 before start) */
  current: () => number;
  start: number;
  slotDur: number;
}

export async function startLoop(opts: {
  bpm: number;
  slotsPerBeat: number;
  /** total slots to play; omit to loop forever */
  totalSlots?: number;
  schedule: (slot: number, time: number) => void;
  onEnd?: () => void;
  delay?: number;
}): Promise<Loop> {
  const ctx = await engine.ensureContext();
  const slotDur = 60 / opts.bpm / opts.slotsPerBeat;
  const start = ctx.currentTime + (opts.delay ?? 0.15);
  let next = 0;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    while (start + next * slotDur < ctx.currentTime + 0.12) {
      if (opts.totalSlots !== undefined && next >= opts.totalSlots) {
        const endAt = start + next * slotDur;
        setTimeout(() => { if (!stopped) { stopped = true; clearInterval(id); opts.onEnd?.(); } }, Math.max(0, (endAt - ctx.currentTime) * 1000));
        clearInterval(id);
        return;
      }
      opts.schedule(next, start + next * slotDur);
      next++;
    }
  };
  const id = setInterval(tick, 25);
  tick();
  return {
    stop: () => { stopped = true; clearInterval(id); },
    current: () => Math.floor((ctx.currentTime - start) / slotDur),
    start, slotDur,
  };
}
