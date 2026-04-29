/**
 * AudioWorklet processor: mixes 2 inputs (mic, system) at the AudioContext
 * native sample rate, posts mono Float32 chunks to the main thread.
 *
 * Downsampling to 16kHz happens on the main thread (linear resample), to keep
 * this processor real-time-safe.
 *
 * This file is loaded via `audioWorklet.addModule(URL)` — Vite handles it as
 * a worker via the `?worker&url` import suffix in capture.ts.
 */
const SOURCE = `
class FloydMixer extends AudioWorkletProcessor {
  constructor() {
    super();
    this._frame = 0;
  }
  process(inputs) {
    const a = inputs[0] && inputs[0][0];
    const b = inputs[1] && inputs[1][0];
    const len = (a && a.length) || (b && b.length) || 0;
    if (!len) return true;
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const x = a ? a[i] : 0;
      const y = b ? b[i] : 0;
      let m = x + y;
      if (m > 1) m = 1; else if (m < -1) m = -1;
      out[i] = m;
    }
    this.port.postMessage({ samples: out, sampleRate, frame: this._frame }, [out.buffer]);
    this._frame += len;
    return true;
  }
}
registerProcessor('floyd-mixer', FloydMixer);
`;

export function createWorkletBlobUrl(): string {
  const blob = new Blob([SOURCE], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}
