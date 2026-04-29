# Native audio capture addon

This folder contains the Windows-only WASAPI loopback addon used by Oli to capture speakers without showing Electron's system audio picker.

## Layout

| Folder | Target | Status |
|--------|--------|--------|
| `win-loopback/` | Windows WASAPI loopback via `IMMDeviceEnumerator::GetDefaultAudioEndpoint(eRender, eConsole)` and `AUDCLNT_STREAMFLAGS_LOOPBACK` | implemented |

## Build

```powershell
npm --prefix native/win-loopback install
npm --prefix native/win-loopback run build
```

The root `postinstall` runs the same `napi build --release --platform` path on a best-effort basis. If the Rust toolchain or Windows SDK is missing, the app still installs and falls back to renderer `getDisplayMedia`.

## Runtime contract

The addon exports `LoopbackCapture`, whose `start(callback)` method invokes the callback with Node buffers containing 16 kHz mono Float32 samples. The main process converts those buffers to `Float32Array`, mixes them with mic chunks received over IPC, and writes the mixed stream through `src/main/audio/recorder.ts`.
