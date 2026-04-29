/** Linear-interpolation downsample. Good-enough for speech transcription. */
export function downsampleTo16k(input: Float32Array, srcRate: number): Float32Array {
  const targetRate = 16000;
  if (srcRate === targetRate) return input;
  const ratio = srcRate / targetRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcPos = i * ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const t = srcPos - i0;
    out[i] = input[i0] * (1 - t) + input[i1] * t;
  }
  return out;
}
