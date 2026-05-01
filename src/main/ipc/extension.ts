/**
 * IPC for the browser extension pairing UI + telemetry opt-in.
 */
import { ipcMain } from 'electron';
import {
  generatePairingCode,
  getLocalServerPort,
  listExtensionTokens,
  revokeExtensionToken
} from '../server/localServer';
import { isTelemetryOptIn, setTelemetryOptIn } from '../telemetry';

export function registerExtensionIpc(): void {
  ipcMain.handle('ext:status', async () => ({
    port: getLocalServerPort(),
    tokens: await listExtensionTokens()
  }));
  ipcMain.handle('ext:pair', (_e, label: string = 'Extension') => ({
    code: generatePairingCode(label),
    port: getLocalServerPort(),
    expiresInMs: 5 * 60_000
  }));
  ipcMain.handle('ext:revoke', (_e, id: string) => revokeExtensionToken(id));

  ipcMain.handle('telemetry:get', () => ({ optIn: isTelemetryOptIn() }));
  ipcMain.handle('telemetry:set', (_e, optIn: boolean) => setTelemetryOptIn(optIn));
}
