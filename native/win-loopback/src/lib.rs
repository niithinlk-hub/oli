use std::{
  mem::size_of,
  ptr::null_mut,
  slice,
  sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
  },
  thread::{self, JoinHandle},
  time::Duration,
};

use napi::{
  bindgen_prelude::*,
  threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode},
  Status,
};
use napi_derive::napi;
use windows::{
  core::{Interface, GUID},
  Win32::{
    Foundation::{CloseHandle, HANDLE, WAIT_OBJECT_0},
    Media::Audio::{
      eConsole, eRender, IAudioCaptureClient, IAudioClient, IMMDeviceEnumerator,
      MMDeviceEnumerator, AUDCLNT_BUFFERFLAGS_SILENT, AUDCLNT_SHAREMODE_SHARED,
      AUDCLNT_STREAMFLAGS_EVENTCALLBACK, AUDCLNT_STREAMFLAGS_LOOPBACK, WAVEFORMATEX,
      WAVE_FORMAT_EXTENSIBLE, WAVE_FORMAT_IEEE_FLOAT, WAVE_FORMAT_PCM,
    },
    Media::KernelStreaming::{KSDATAFORMAT_SUBTYPE_IEEE_FLOAT, KSDATAFORMAT_SUBTYPE_PCM},
    System::{
      Com::{CoCreateInstance, CoInitializeEx, CoTaskMemFree, CLSCTX_ALL, COINIT_MULTITHREADED},
      Threading::{CreateEventW, WaitForSingleObject},
    },
  },
};

const TARGET_RATE: u32 = 16_000;
const BUFFER_DURATION_100NS: i64 = 10_000_000;
const WAIT_TIMEOUT_MS: u32 = 2_000;
const FLUSH_SAMPLES: usize = TARGET_RATE as usize;

type JsCallback = ThreadsafeFunction<Buffer, ()>;

#[napi]
pub struct LoopbackCapture {
  stop: Arc<AtomicBool>,
  thread: Option<JoinHandle<()>>,
}

#[napi]
impl LoopbackCapture {
  #[napi(constructor)]
  pub fn new() -> Self {
    Self {
      stop: Arc::new(AtomicBool::new(false)),
      thread: None,
    }
  }

  #[napi]
  pub fn start(&mut self, callback: JsCallback) -> Result<()> {
    if self.thread.is_some() {
      return Err(Error::from_reason("loopback capture already started"));
    }

    self.stop.store(false, Ordering::SeqCst);
    let stop = Arc::clone(&self.stop);
    self.thread = Some(thread::spawn(move || {
      if let Err(err) = capture_loop(stop, callback.clone()) {
        eprintln!("WASAPI loopback capture failed: {}", err.reason);
        let _ = callback.call(Err(Status::GenericFailure), ThreadsafeFunctionCallMode::NonBlocking);
      }
    }));
    Ok(())
  }

  #[napi]
  pub fn stop(&mut self) -> Result<()> {
    self.stop.store(true, Ordering::SeqCst);
    if let Some(handle) = self.thread.take() {
      let _ = handle.join();
    }
    Ok(())
  }
}

impl Drop for LoopbackCapture {
  fn drop(&mut self) {
    let _ = self.stop();
  }
}

struct EventHandle(HANDLE);

impl Drop for EventHandle {
  fn drop(&mut self) {
    unsafe {
      let _ = CloseHandle(self.0);
    }
  }
}

struct MixFormat {
  ptr: *mut WAVEFORMATEX,
  channels: usize,
  sample_rate: u32,
  bits_per_sample: u16,
  format_tag: u16,
  valid_bits_per_sample: u16,
  sub_format: Option<GUID>,
}

impl MixFormat {
  unsafe fn from_ptr(ptr: *mut WAVEFORMATEX) -> Result<Self> {
    if ptr.is_null() {
      return Err(Error::from_reason("IAudioClient::GetMixFormat returned null"));
    }

    let wf = *ptr;
    let mut valid_bits_per_sample = wf.wBitsPerSample;
    let mut sub_format = None;
    if wf.wFormatTag == WAVE_FORMAT_EXTENSIBLE as u16 {
      let extensible = *(ptr as *const WaveFormatExtensible);
      valid_bits_per_sample = extensible.samples.wValidBitsPerSample;
      sub_format = Some(extensible.sub_format);
    }

    Ok(Self {
      ptr,
      channels: wf.nChannels as usize,
      sample_rate: wf.nSamplesPerSec,
      bits_per_sample: wf.wBitsPerSample,
      format_tag: wf.wFormatTag,
      valid_bits_per_sample,
      sub_format,
    })
  }

  fn is_float(&self) -> bool {
    self.format_tag == WAVE_FORMAT_IEEE_FLOAT as u16
      || self
        .sub_format
        .map(|guid| guid == KSDATAFORMAT_SUBTYPE_IEEE_FLOAT)
        .unwrap_or(false)
  }

  fn is_pcm(&self) -> bool {
    self.format_tag == WAVE_FORMAT_PCM as u16
      || self
        .sub_format
        .map(|guid| guid == KSDATAFORMAT_SUBTYPE_PCM)
        .unwrap_or(false)
  }
}

impl Drop for MixFormat {
  fn drop(&mut self) {
    unsafe {
      CoTaskMemFree(Some(self.ptr.cast()));
    }
  }
}

#[repr(C)]
#[allow(non_snake_case)]
struct WaveFormatExtensible {
  format: WAVEFORMATEX,
  samples: SamplesUnion,
  dwChannelMask: u32,
  sub_format: GUID,
}

#[repr(C)]
#[allow(non_snake_case)]
union SamplesUnion {
  wValidBitsPerSample: u16,
  wSamplesPerBlock: u16,
  wReserved: u16,
}

unsafe fn capture_loop(stop: Arc<AtomicBool>, callback: JsCallback) -> Result<()> {
  CoInitializeEx(None, COINIT_MULTITHREADED)
    .map_err(|err| Error::from_reason(format!("CoInitializeEx failed: {err}")))?;

  let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
    .map_err(|err| Error::from_reason(format!("MMDeviceEnumerator failed: {err}")))?;
  let device = enumerator
    .GetDefaultAudioEndpoint(eRender, eConsole)
    .map_err(|err| Error::from_reason(format!("GetDefaultAudioEndpoint(eRender,eConsole) failed: {err}")))?;
  let audio_client: IAudioClient = device
    .Activate(CLSCTX_ALL, None)
    .map_err(|err| Error::from_reason(format!("IMMDevice::Activate(IAudioClient) failed: {err}")))?;

  let format = MixFormat::from_ptr(
    audio_client
      .GetMixFormat()
      .map_err(|err| Error::from_reason(format!("IAudioClient::GetMixFormat failed: {err}")))?,
  )?;

  audio_client
    .Initialize(
      AUDCLNT_SHAREMODE_SHARED,
      AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
      BUFFER_DURATION_100NS,
      0,
      format.ptr,
      None,
    )
    .map_err(|err| Error::from_reason(format!("IAudioClient::Initialize loopback failed: {err}")))?;

  let event = EventHandle(
    CreateEventW(None, false, false, None)
      .map_err(|err| Error::from_reason(format!("CreateEventW failed: {err}")))?,
  );
  audio_client
    .SetEventHandle(event.0)
    .map_err(|err| Error::from_reason(format!("IAudioClient::SetEventHandle failed: {err}")))?;

  let capture_client: IAudioCaptureClient = audio_client
    .GetService()
    .map_err(|err| Error::from_reason(format!("IAudioClient::GetService(IAudioCaptureClient) failed: {err}")))?;

  audio_client
    .Start()
    .map_err(|err| Error::from_reason(format!("IAudioClient::Start failed: {err}")))?;

  let mut resampler = Resampler::new(format.sample_rate, TARGET_RATE);
  let mut pending = Vec::<f32>::with_capacity(FLUSH_SAMPLES * 2);

  while !stop.load(Ordering::SeqCst) {
    let wait = WaitForSingleObject(event.0, WAIT_TIMEOUT_MS);
    if wait != WAIT_OBJECT_0 {
      thread::sleep(Duration::from_millis(5));
      continue;
    }

    let mut packet_frames = 0;
    capture_client
      .GetNextPacketSize(&mut packet_frames)
      .map_err(|err| Error::from_reason(format!("IAudioCaptureClient::GetNextPacketSize failed: {err}")))?;

    while packet_frames > 0 {
      let mut data = null_mut();
      let mut frames = 0;
      let mut flags = 0;
      capture_client
        .GetBuffer(&mut data, &mut frames, &mut flags, None, None)
        .map_err(|err| Error::from_reason(format!("IAudioCaptureClient::GetBuffer failed: {err}")))?;

      if flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32 != 0 {
        pending.extend(resampler.push_interleaved_silence(frames as usize));
      } else {
        let bytes = slice::from_raw_parts(
          data,
          frames as usize * format.channels * (format.bits_per_sample as usize / 8),
        );
        pending.extend(convert_to_16k_mono(bytes, frames as usize, &format, &mut resampler)?);
      }

      capture_client
        .ReleaseBuffer(frames)
        .map_err(|err| Error::from_reason(format!("IAudioCaptureClient::ReleaseBuffer failed: {err}")))?;

      flush_pending(&mut pending, &callback);
      capture_client
        .GetNextPacketSize(&mut packet_frames)
        .map_err(|err| Error::from_reason(format!("IAudioCaptureClient::GetNextPacketSize failed: {err}")))?;
    }
  }

  if !pending.is_empty() {
    send_samples(std::mem::take(&mut pending), &callback);
  }

  let _ = audio_client.Stop();
  Ok(())
}

fn flush_pending(pending: &mut Vec<f32>, callback: &JsCallback) {
  while pending.len() >= FLUSH_SAMPLES {
    let out = pending.drain(..FLUSH_SAMPLES).collect::<Vec<_>>();
    send_samples(out, callback);
  }
}

fn send_samples(samples: Vec<f32>, callback: &JsCallback) {
  let bytes = samples_to_bytes(samples);
  let _ = callback.call(Ok(Buffer::from(bytes)), ThreadsafeFunctionCallMode::NonBlocking);
}

fn samples_to_bytes(samples: Vec<f32>) -> Vec<u8> {
  let mut bytes = Vec::with_capacity(samples.len() * size_of::<f32>());
  for sample in samples {
    bytes.extend_from_slice(&sample.to_le_bytes());
  }
  bytes
}

fn convert_to_16k_mono(
  bytes: &[u8],
  frames: usize,
  format: &MixFormat,
  resampler: &mut Resampler,
) -> Result<Vec<f32>> {
  let mut mono = Vec::with_capacity(frames);
  let channels = format.channels;

  if format.is_float() && format.bits_per_sample == 32 {
    for frame in bytes.chunks_exact(channels * 4) {
      let mut sum = 0.0;
      for ch in 0..channels {
        let offset = ch * 4;
        sum += f32::from_le_bytes([
          frame[offset],
          frame[offset + 1],
          frame[offset + 2],
          frame[offset + 3],
        ]);
      }
      mono.push((sum / channels as f32).clamp(-1.0, 1.0));
    }
  } else if format.is_pcm() && format.bits_per_sample == 16 {
    for frame in bytes.chunks_exact(channels * 2) {
      let mut sum = 0.0;
      for ch in 0..channels {
        let offset = ch * 2;
        let sample = i16::from_le_bytes([frame[offset], frame[offset + 1]]);
        sum += sample as f32 / i16::MAX as f32;
      }
      mono.push((sum / channels as f32).clamp(-1.0, 1.0));
    }
  } else if format.is_pcm() && format.bits_per_sample == 24 {
    for frame in bytes.chunks_exact(channels * 3) {
      let mut sum = 0.0;
      for ch in 0..channels {
        let offset = ch * 3;
        let raw = ((frame[offset] as i32)
          | ((frame[offset + 1] as i32) << 8)
          | ((frame[offset + 2] as i32) << 16))
          << 8;
        sum += raw as f32 / i32::MAX as f32;
      }
      mono.push((sum / channels as f32).clamp(-1.0, 1.0));
    }
  } else if format.is_pcm() && format.bits_per_sample == 32 {
    let shift = 32_u16.saturating_sub(format.valid_bits_per_sample) as u32;
    for frame in bytes.chunks_exact(channels * 4) {
      let mut sum = 0.0;
      for ch in 0..channels {
        let offset = ch * 4;
        let raw = i32::from_le_bytes([
          frame[offset],
          frame[offset + 1],
          frame[offset + 2],
          frame[offset + 3],
        ]) << shift;
        sum += raw as f32 / i32::MAX as f32;
      }
      mono.push((sum / channels as f32).clamp(-1.0, 1.0));
    }
  } else {
    return Err(Error::from_reason(format!(
      "unsupported WASAPI mix format: tag={}, bits={}, channels={}",
      format.format_tag, format.bits_per_sample, format.channels
    )));
  }

  Ok(resampler.push_mono(&mono))
}

struct Resampler {
  source_rate: u32,
  target_rate: u32,
  position: f64,
  previous: f32,
  has_previous: bool,
}

impl Resampler {
  fn new(source_rate: u32, target_rate: u32) -> Self {
    Self {
      source_rate,
      target_rate,
      position: 0.0,
      previous: 0.0,
      has_previous: false,
    }
  }

  fn push_interleaved_silence(&mut self, frames: usize) -> Vec<f32> {
    self.push_mono(&vec![0.0; frames])
  }

  fn push_mono(&mut self, input: &[f32]) -> Vec<f32> {
    if input.is_empty() {
      return Vec::new();
    }
    if self.source_rate == self.target_rate {
      return input.to_vec();
    }

    let mut extended = Vec::with_capacity(input.len() + usize::from(self.has_previous));
    if self.has_previous {
      extended.push(self.previous);
    }
    extended.extend_from_slice(input);

    let step = self.source_rate as f64 / self.target_rate as f64;
    let mut out = Vec::new();
    while self.position + 1.0 < extended.len() as f64 {
      let i0 = self.position.floor() as usize;
      let i1 = i0 + 1;
      let t = (self.position - i0 as f64) as f32;
      out.push(extended[i0] * (1.0 - t) + extended[i1] * t);
      self.position += step;
    }

    self.position -= (extended.len() - 1) as f64;
    self.previous = *extended.last().unwrap_or(&0.0);
    self.has_previous = true;
    out
  }
}
