import { create } from 'zustand';

/**
 * Live audio amplitude store. Updated by the renderer-side capture pipeline
 * (mic + system loopback) on every audio chunk. Visualizers subscribe.
 *
 * Values are RMS over the chunk, in [0, 1]. The 36-bin band-power array used
 * by the radial recorder is computed via FFT-lite (we keep cost low — chunks
 * are 1000-sample Float32 frames at 16kHz, so we just bucket adjacent samples
 * into 36 windows and compute |max|. Good enough for a vibe meter.)
 */
interface AmplitudeState {
  micRms: number;
  loopbackRms: number;
  micBars: number[]; // length 36, [0..1]
  loopbackBars: number[];
  micMuted: boolean;
  loopbackMuted: boolean;
  pushMic: (samples: Float32Array) => void;
  pushLoopback: (samples: Float32Array) => void;
  setMicMuted: (m: boolean) => void;
  setLoopbackMuted: (m: boolean) => void;
  reset: () => void;
}

const N_BARS = 36;
const ZERO_BARS = Array(N_BARS).fill(0);

function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.min(1, Math.sqrt(sum / samples.length));
}

function toBars(samples: Float32Array): number[] {
  if (samples.length === 0) return ZERO_BARS.slice();
  const bars = new Array<number>(N_BARS);
  const step = Math.max(1, Math.floor(samples.length / N_BARS));
  for (let b = 0; b < N_BARS; b++) {
    const start = b * step;
    const end = Math.min(samples.length, start + step);
    let peak = 0;
    for (let i = start; i < end; i++) {
      const v = Math.abs(samples[i]);
      if (v > peak) peak = v;
    }
    // Mild compression so quiet peaks still register.
    bars[b] = Math.min(1, Math.pow(peak, 0.6));
  }
  return bars;
}

export const useAmplitude = create<AmplitudeState>((set) => ({
  micRms: 0,
  loopbackRms: 0,
  micBars: ZERO_BARS.slice(),
  loopbackBars: ZERO_BARS.slice(),
  micMuted: false,
  loopbackMuted: false,

  pushMic(samples) {
    set({ micRms: rms(samples), micBars: toBars(samples) });
  },
  pushLoopback(samples) {
    set({ loopbackRms: rms(samples), loopbackBars: toBars(samples) });
  },
  setMicMuted(m) {
    set({ micMuted: m });
  },
  setLoopbackMuted(m) {
    set({ loopbackMuted: m });
  },
  reset() {
    set({
      micRms: 0,
      loopbackRms: 0,
      micBars: ZERO_BARS.slice(),
      loopbackBars: ZERO_BARS.slice()
    });
  }
}));
