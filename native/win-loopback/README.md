# win-loopback

Windows WASAPI loopback addon (planned). See [../README.md](../README.md) for the rationale and integration plan.

Recommended toolchain: `napi-rs` (Rust). Capture from `IMMDeviceEnumerator::GetDefaultAudioEndpoint(eRender, eConsole)` opened in loopback mode (`AUDCLNT_STREAMFLAGS_LOOPBACK`).
