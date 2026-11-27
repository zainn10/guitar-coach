// Metronome clicks scheduled on the audio clock (sample-accurate).
// High-pitched (2.8-3.4 kHz) with a soft start, so strum detection can ignore it.
export function scheduleClick(ctx: AudioContext, time: number, accent = false, volume = 0.5) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.frequency.value = accent ? 3400 : 2800;
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(volume, time + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0005, time + 0.045);
  osc.connect(g).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.06);
  return osc;
}

export function scheduleClicks(ctx: AudioContext, start: number, count: number, interval: number, accentEvery = 4, volume = 0.5) {
  const times: number[] = [];
  const nodes: OscillatorNode[] = [];
  for (let i = 0; i < count; i++) {
    const t = start + i * interval;
    times.push(t);
    nodes.push(scheduleClick(ctx, t, i % accentEvery === 0, volume));
  }
  return { times, cancel: () => nodes.forEach(n => { try { n.stop(); } catch { /* already done */ } }) };
}
