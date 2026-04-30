import { app, nativeImage, type NativeImage } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

function iconPath(): string | null {
  const rp = process.resourcesPath ?? '';
  const candidates = [
    join(app.getAppPath(), 'resources', 'icons', 'oli.png'),
    join(rp, 'app.asar.unpacked', 'resources', 'icons', 'oli.png'),
    join(rp, 'resources', 'icons', 'oli.png'),
    join(__dirname, '../../resources/icons/oli.png'),
    join(__dirname, '../../../resources/icons/oli.png')
  ];
  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }
  return null;
}

export function buildWindowIcon(): NativeImage {
  const path = iconPath();
  if (path) {
    const img = nativeImage.createFromPath(path);
    if (!img.isEmpty()) return img;
  }
  return nativeImage.createEmpty();
}

export function buildTrayIcon(): NativeImage {
  const path = iconPath();
  if (!path) return nativeImage.createEmpty();
  const full = nativeImage.createFromPath(path);
  if (full.isEmpty()) return full;
  return full.resize({ width: 16, height: 16, quality: 'best' });
}
