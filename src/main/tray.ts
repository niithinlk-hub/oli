import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron';

let tray: Tray | null = null;

/**
 * Render a 16x16 RGBA buffer of the Oli mark — navy background, gradient
 * blue ring, single amber pixel for the insight spark. Constructed
 * procedurally so we don't ship a PNG asset.
 */
function buildTrayBitmap(): Buffer {
  const SIZE = 16;
  const buf = Buffer.alloc(SIZE * SIZE * 4);

  const navy = [7, 26, 51];
  const blue = [37, 99, 235];
  const azure = [56, 189, 248];
  const amber = [245, 158, 11];

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const dx = x - 7.5;
      const dy = y - 8.5;
      const r = Math.sqrt(dx * dx + dy * dy);

      let color: number[];
      let alpha = 255;

      // Outer rounded square background
      if (Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) > 7.5) {
        color = [0, 0, 0];
        alpha = 0;
      } else if (r >= 4.0 && r <= 6.2) {
        // Ring with vertical gradient navy → azure
        const t = (y - 2) / (SIZE - 2);
        const k = Math.max(0, Math.min(1, t));
        color = [
          Math.round(blue[0] + (azure[0] - blue[0]) * k),
          Math.round(blue[1] + (azure[1] - blue[1]) * k),
          Math.round(blue[2] + (azure[2] - blue[2]) * k)
        ];
      } else {
        color = navy;
      }

      // Insight spark — top right
      const sx = x - 12;
      const sy = y - 3;
      if (sx * sx + sy * sy <= 2.5) {
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

function showAndFocus(): void {
  const wins = BrowserWindow.getAllWindows();
  const win = wins[0];
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

export function initTray(): void {
  if (tray) return;

  let img;
  try {
    img = nativeImage.createFromBitmap(buildTrayBitmap(), {
      width: 16,
      height: 16,
      scaleFactor: 1
    });
  } catch (err) {
    console.warn('tray bitmap build failed, falling back to empty image:', (err as Error).message);
    img = nativeImage.createEmpty();
  }

  try {
    tray = new Tray(img);
  } catch (err) {
    console.warn('tray init failed:', (err as Error).message);
    return;
  }
  tray.setToolTip('Oli — your AI meeting memory');

  const menu = Menu.buildFromTemplate([
    { label: 'Open Oli', click: showAndFocus },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
  tray.on('click', showAndFocus);
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
