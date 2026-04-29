# Native audio capture addon (Windows)

This folder reserves space for a native WASAPI loopback addon. The shipping app already captures system audio cross-platform via `getDisplayMedia` (see [src/renderer/audio/capture.ts](../src/renderer/audio/capture.ts)) backed by Electron's `setDisplayMediaRequestHandler({ useSystemPicker: true })`. That path works today on Windows 10 build 19041+ and is the default.

A native addon is the planned upgrade path: it removes the system picker prompt entirely.

## Status

| Folder | Target | Status |
|--------|--------|--------|
| `win-loopback/` | Windows WASAPI loopback (Win 10 2004+) | scaffold |

## Why we shipped without it

Compiling the addon requires a Rust toolchain (`napi-rs`) plus the Windows SDK — heavyweight for a milestone-sized commit. The `getDisplayMedia` path is good enough for MVP.

## Implementation outline

The addon would expose:

```ts
interface NativeAudioAddon {
  startCapture(opts: { sampleRate: 16000; channels: 1 }): void;
  stopCapture(): void;
  on(event: 'data', cb: (chunk: Float32Array) => void): void;
  on(event: 'error', cb: (err: Error) => void): void;
}
```

Then `src/main/audio/capture.ts` would prefer the addon when available and fall back to `getDisplayMedia`.

## Plan to finish

1. Scaffold a `napi-rs` crate (cargo + per-addon `package.json`).
2. Capture from `IMMDeviceEnumerator::GetDefaultAudioEndpoint(eRender, eConsole)` opened in loopback mode (`AUDCLNT_STREAMFLAGS_LOOPBACK`).
3. Postinstall step builds the addon for the current Electron ABI.
4. Feature-detect in `src/main/audio/capture.ts`.
5. Bundle the prebuilt `.node` artifacts via `electron-builder.files`.
