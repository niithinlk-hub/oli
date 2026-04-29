import { nativeImage, type NativeImage } from 'electron';

/**
 * 64x64 RGBA buffer of the Oli mark — gradient ring + sound bars + amber spark
 * over a navy rounded background. Built procedurally so we don't ship a PNG.
 */
function buildIconBitmap(size: number): Buffer {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2 - 0.5;
  const cy = size / 2 + 0.5;
  const ringOuter = size * 0.42;
  const ringInner = size * 0.32;
  const cornerRadius = size * 0.18;

  const navy = [7, 26, 51];
  const blue = [37, 99, 235];
  const azure = [56, 189, 248];
  const teal = [20, 184, 166];
  const amber = [245, 158, 11];
  const white = [255, 255, 255];

  const sparkX = size * 0.78;
  const sparkY = size * 0.22;
  const sparkR = size * 0.075;

  const barXs = [size * 0.34, size * 0.43, size * 0.52, size * 0.61];
  const barHs = [size * 0.18, size * 0.32, size * 0.24, size * 0.14];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let color = navy;
      const alpha = 255;

      // Rounded square mask
      const dxRect = Math.max(0, Math.abs(x - size / 2) - (size / 2 - cornerRadius));
      const dyRect = Math.max(0, Math.abs(y - size / 2) - (size / 2 - cornerRadius));
      if (Math.sqrt(dxRect * dxRect + dyRect * dyRect) > cornerRadius) {
        buf[i] = 0;
        buf[i + 1] = 0;
        buf[i + 2] = 0;
        buf[i + 3] = 0;
        continue;
      }

      const dx = x - cx;
      const dy = y - cy;
      const r = Math.sqrt(dx * dx + dy * dy);

      // Ring with diagonal gradient blue → azure → teal
      if (r >= ringInner && r <= ringOuter) {
        const t = ((x + y) / (2 * size)) * 1.0;
        const k = Math.max(0, Math.min(1, t));
        let a = blue;
        let b = azure;
        let kk = k * 2;
        if (kk > 1) {
          a = azure;
          b = teal;
          kk -= 1;
        }
        color = [
          Math.round(a[0] + (b[0] - a[0]) * kk),
          Math.round(a[1] + (b[1] - a[1]) * kk),
          Math.round(a[2] + (b[2] - a[2]) * kk)
        ];
      }

      // Sound bars in negative space
      for (let j = 0; j < barXs.length; j++) {
        const bx = barXs[j];
        const bh = barHs[j];
        const bw = size * 0.045;
        if (
          x >= bx - bw / 2 &&
          x <= bx + bw / 2 &&
          y >= size / 2 - bh / 2 &&
          y <= size / 2 + bh / 2 &&
          r < ringInner
        ) {
          color = white;
        }
      }

      // Insight spark
      const sdx = x - sparkX;
      const sdy = y - sparkY;
      if (sdx * sdx + sdy * sdy <= sparkR * sparkR) {
        color = amber;
      }

      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = alpha;
    }
  }
  return buf;
}

export function buildWindowIcon(): NativeImage {
  try {
    return nativeImage.createFromBitmap(buildIconBitmap(64), {
      width: 64,
      height: 64,
      scaleFactor: 1
    });
  } catch {
    return nativeImage.createEmpty();
  }
}
