# win-loopback

Windows WASAPI loopback addon for Oli.

The capture thread opens the default render endpoint with:

- `IMMDeviceEnumerator::GetDefaultAudioEndpoint(eRender, eConsole)`
- `IAudioClient::Initialize(..., AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK, ...)`

Captured packets are converted to mono Float32, linearly resampled to 16 kHz, and emitted to the Electron main process as buffers. Build it with:

```powershell
npm install
npm run build
```
