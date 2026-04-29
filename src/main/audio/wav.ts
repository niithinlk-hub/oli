import { open, type FileHandle } from 'node:fs/promises';

const HEADER_SIZE = 44;

export interface WavWriterOptions {
  filePath: string;
  sampleRate: number;
  channels: number;
  bitsPerSample: 16;
}

/**
 * Streaming WAV writer for 16-bit PCM. Reserves 44-byte header up front,
 * appends little-endian int16 samples, then patches sizes on close().
 */
export class WavWriter {
  private fh: FileHandle | null = null;
  private bytesWritten = 0;
  constructor(private opts: WavWriterOptions) {}

  async open(): Promise<void> {
    this.fh = await open(this.opts.filePath, 'w');
    const header = Buffer.alloc(HEADER_SIZE);
    await this.fh.write(header, 0, HEADER_SIZE, 0);
  }

  async appendFloat32(samples: Float32Array): Promise<void> {
    if (!this.fh) throw new Error('WavWriter not opened');
    const buf = Buffer.alloc(samples.length * 2);
    for (let i = 0; i < samples.length; i++) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      buf.writeInt16LE((s * 0x7fff) | 0, i * 2);
    }
    await this.fh.write(buf, 0, buf.length, HEADER_SIZE + this.bytesWritten);
    this.bytesWritten += buf.length;
  }

  async close(): Promise<{ durationMs: number; totalSamples: number }> {
    if (!this.fh) throw new Error('WavWriter not opened');
    const { sampleRate, channels, bitsPerSample } = this.opts;
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    const blockAlign = channels * (bitsPerSample / 8);
    const dataSize = this.bytesWritten;
    const riffSize = 36 + dataSize;

    const header = Buffer.alloc(HEADER_SIZE);
    header.write('RIFF', 0, 'ascii');
    header.writeUInt32LE(riffSize, 4);
    header.write('WAVE', 8, 'ascii');
    header.write('fmt ', 12, 'ascii');
    header.writeUInt32LE(16, 16);          // PCM fmt chunk size
    header.writeUInt16LE(1, 20);           // PCM format
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36, 'ascii');
    header.writeUInt32LE(dataSize, 40);

    await this.fh.write(header, 0, HEADER_SIZE, 0);
    await this.fh.close();
    this.fh = null;

    const totalSamples = dataSize / blockAlign;
    const durationMs = (totalSamples / sampleRate) * 1000;
    return { durationMs, totalSamples };
  }
}

/** One-shot helper for writing a Float32Array as a 16-bit PCM WAV. */
export async function writeWavFile(
  filePath: string,
  samples: Float32Array,
  sampleRate: number,
  channels = 1
): Promise<void> {
  const w = new WavWriter({ filePath, sampleRate, channels, bitsPerSample: 16 });
  await w.open();
  await w.appendFloat32(samples);
  await w.close();
}
