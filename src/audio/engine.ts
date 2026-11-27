// The microphone engine: opens the mic with all "voice call" processing switched OFF,
// keeps the last 90 seconds of audio in memory, and lets screens listen to new audio.
// Times are measured in audio "frames" (samples) on the same clock as the metronome.

const WORKLET = `
class Capture extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(1024); this.n = 0; this.start = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    if (this.n === 0) this.start = currentFrame;
    this.buf.set(ch, this.n);
    this.n += ch.length;
    if (this.n >= this.buf.length) {
      this.port.postMessage({ start: this.start, data: this.buf.slice(0, this.n) });
      this.n = 0;
    }
    return true;
  }
}
registerProcessor('capture', Capture);
`;

export class MicStopped extends Error { constructor() { super('Microphone switched off'); } }

/** startFrame === -1 means the microphone was just switched off. */
export type ChunkListener = (chunk: Float32Array, startFrame: number) => void;

export interface ProcessingReport { echoCancellation?: boolean; noiseSuppression?: boolean; autoGainControl?: boolean }

export class AudioEngine {
  ctx: AudioContext | null = null;
  stream: MediaStream | null = null;
  sampleRate = 48000;
  processing: ProcessingReport = {};
  deviceLabel = '';
  private ring = new Float32Array(0);
  /** absolute frame index just after the newest sample */
  written = 0;
  private listeners = new Set<ChunkListener>();
  private node: AudioNode | null = null;
  level = 0;

  /** True while the microphone is switched on. */
  get running() { return !!this.stream; }
  private workletReady = false;
  private source: MediaStreamAudioSourceNode | null = null;
  private sink: GainNode | null = null;

  /** Audio output (metronome, reference sounds) works without the microphone. */
  async ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      this.sampleRate = this.ctx.sampleRate;
      this.workletReady = false;
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx;
  }

  async start(deviceId?: string) {
    if (this.running) this.stop();
    const audio: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
    };
    if (deviceId) audio.deviceId = { exact: deviceId };
    const stream = await navigator.mediaDevices.getUserMedia({ audio });
    this.stream = stream;
    const track = stream.getAudioTracks()[0];
    const s = track.getSettings();
    this.processing = { echoCancellation: s.echoCancellation, noiseSuppression: s.noiseSuppression, autoGainControl: s.autoGainControl };
    this.deviceLabel = track.label;
    const ctx = await this.ensureContext();
    if (this.ring.length !== this.sampleRate * 90) this.ring = new Float32Array(this.sampleRate * 90);
    this.written = -1;
    this.source = ctx.createMediaStreamSource(stream);
    this.sink = ctx.createGain();
    this.sink.gain.value = 0;
    this.sink.connect(ctx.destination);
    try {
      // A data: URL works even when the app is opened straight from a file.
      if (!this.workletReady) {
        await ctx.audioWorklet.addModule('data:application/javascript,' + encodeURIComponent(WORKLET));
        this.workletReady = true;
      }
      const node = new AudioWorkletNode(ctx, 'capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
      node.port.onmessage = (e: MessageEvent<{ start: number; data: Float32Array }>) => this.ingest(e.data.data, e.data.start);
      this.source.connect(node).connect(this.sink);
      this.node = node;
    } catch {
      // Older fallback (less precise timing)
      const sp = ctx.createScriptProcessor(1024, 1, 1);
      sp.onaudioprocess = e => {
        const data = new Float32Array(e.inputBuffer.getChannelData(0));
        const start = Math.round(e.playbackTime * this.sampleRate) - data.length;
        this.ingest(data, start);
      };
      this.source.connect(sp).connect(this.sink);
      this.node = sp;
    }
  }

  /** Switch the microphone off completely (the browser's mic indicator goes away). */
  stop() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.source?.disconnect();
    this.node?.disconnect();
    this.sink?.disconnect();
    if (this.node instanceof AudioWorkletNode) this.node.port.onmessage = null;
    this.stream = null; this.node = null; this.source = null; this.sink = null;
    this.level = 0;
    this.listeners.forEach(l => l(new Float32Array(0), -1));
  }

  private ingest(data: Float32Array, start: number) {
    if (!this.stream) return;
    const N = this.ring.length;
    if (this.written < 0) this.written = start;
    if (start > this.written) {
      // gap: fill with silence
      for (let f = this.written; f < start; f++) this.ring[f % N] = 0;
    }
    for (let i = 0; i < data.length; i++) this.ring[(start + i) % N] = data[i];
    this.written = Math.max(this.written, start + data.length);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    this.level = Math.sqrt(sum / data.length);
    this.listeners.forEach(l => l(data, start));
  }

  /** Copy of audio between absolute frames [from, to). Missing audio is silence. */
  getRange(from: number, to: number): Float32Array {
    const out = new Float32Array(Math.max(0, to - from));
    const N = this.ring.length;
    const oldest = this.written - N;
    for (let f = Math.max(from, oldest, 0); f < Math.min(to, this.written); f++) out[f - from] = this.ring[f % N];
    return out;
  }

  latest(n: number) { return this.getRange(this.written - n, this.written); }

  subscribe(l: ChunkListener) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }

  /** Resolves once audio up to `frame` has arrived. */
  waitForFrame(frame: number, timeoutMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.written >= frame) return resolve();
      if (!this.running) return reject(new MicStopped());
      const t = setTimeout(() => { off(); reject(new Error('Audio stopped arriving')); }, timeoutMs);
      const off = this.subscribe((_c, start) => {
        if (start === -1) { clearTimeout(t); off(); reject(new MicStopped()); return; }
        if (this.written >= frame) { clearTimeout(t); off(); resolve(); }
      });
    });
  }

  nowFrame() { return this.ctx ? Math.round(this.ctx.currentTime * this.sampleRate) : 0; }

  /** Play a mono buffer through the speakers/headphones. */
  play(samples: Float32Array, when = 0) {
    if (!this.ctx) { this.ensureContext().then(() => this.play(samples, when)); return; }
    const buf = this.ctx.createBuffer(1, samples.length, this.sampleRate);
    buf.copyToChannel(samples, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    src.start(when || this.ctx.currentTime + 0.02);
    return src;
  }
}

export const engine = new AudioEngine();
