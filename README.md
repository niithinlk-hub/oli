# Oli — Windows

Local-first AI meeting memory for Windows laptops. Listens to meetings, transcribes locally with `whisper.cpp`, turns rough notes into structured summaries via GPT-4o, and lets you ask follow-up questions about any past meeting. All data stays on device.

> Codebase folder is `synthetic-floyd/` (original project name). Shipping product is **Oli**.

## Status — all 12 milestones + polish pass complete

| # | Milestone |
|---|-----------|
| 1 | Electron + React + SQLite skeleton |
| 2 | Audio capture (`getDisplayMedia` + mic) → 16kHz WAV |
| 3 | `whisper.cpp` post-recording final pass |
| 4 | Live streaming transcript via 10s WAV windows |
| 5 | Tiptap notes editor (auto-save, formatting toolbar) |
| 6 | OpenAI GPT-4o note enhancement (key via Electron `safeStorage`) |
| 7 | **6 built-in templates** (summary, actions, decision log, 1:1, standup, customer call) |
| 8 | Google Calendar OAuth (PKCE) + 5-min poller + tray + 2-min notifications |
| 9 | Outlook OAuth (PKCE / Graph) + .ics file import |
| 10 | Native WASAPI loopback addon: Windows system audio without the picker, with `getDisplayMedia` fallback |
| 11 | Onboarding wizard + procedurally-rendered tray + window icons |
| 12 | NSIS Windows installer + `electron-updater` (GitHub releases) |

### Polish pass (this session)

- **Markdown rendering** — AI-enhanced output rendered through `marked` + `DOMPurify` (no more `<pre>`).
- **HTML → Markdown** — user notes converted via `turndown` before being sent to GPT-4o.
- **Ask Oli chat** — multi-turn Q&A about any meeting using its transcript + notes as grounded context.
- **Memory search** — `Ctrl+F` opens a global search over titles, notes, and transcripts.
- **Export** — one-click meeting → `.md` file (transcript + notes + AI output).
- **Delete** — confirmation dialog before destructive action.
- **Application menu + shortcuts** — Ctrl+N (new), Ctrl+S (save), Ctrl+R (record toggle), Ctrl+E (export), Ctrl+F (search), Ctrl+K (Ask Oli), Ctrl+, (settings), Ctrl+Backspace (delete meeting).
- **Recording timer** — live `mm:ss` indicator in the meeting header during recording.
- **Window icon** — procedurally rendered 64×64 Oli mark, no PNG asset shipped.
- **ESLint + Prettier** configs.
- **Standup template** — 6th built-in.

## Stack

- Electron 33 + electron-vite, React 18 + TypeScript + Tailwind 3
- Zustand · Tiptap (StarterKit + Placeholder) · better-sqlite3
- whisper.cpp (binary + ggml model, user-supplied)
- OpenAI Node SDK (GPT-4o)
- Google Calendar REST + Microsoft Graph + node-ical
- `marked` + `DOMPurify` (render) · `turndown` (HTML→MD)
- electron-updater + electron-builder (NSIS x64)

## Brand

- Logos under [src/renderer/components/brand/](src/renderer/components/brand/).
- Brand preview / guidelines page accessible via the sidebar logo.
- Tokens in [tailwind.config.js](tailwind.config.js); CSS vars in `globals.css`.
- Fonts: Inter (UI) + Inter Tight (display) + IBM Plex Mono (transcript).

## Getting started

```bash
cd synthetic-floyd
npm install
npm run rebuild      # rebuild better-sqlite3 against the Electron ABI
npm run dev
```

First launch shows the **Onboarding wizard**: whisper paths → OpenAI key → calendar pointer → done. Skip any step; revisit in Settings.

## Daily flow

1. **Ctrl+N** — new meeting.
2. **Ctrl+R** or click **Record**: native WASAPI captures speakers without a system picker when the addon is built; otherwise the app falls back to the system audio picker.
3. Live transcript appears within ~10s. Type rough notes in the right pane (auto-saves).
4. Pick a template, click **✦ Enhance** — GPT-4o produces structured markdown.
5. Switch to **Ask Oli** tab — multi-turn Q&A grounded in transcript + notes.
6. **Ctrl+E** — export full meeting to markdown.
7. **Ctrl+F** — search across all past meetings (titles, notes, transcripts).

## Building

```bash
npm run lint            # ESLint
npm run format          # Prettier
npm run typecheck       # TS in both projects
npm run package         # NSIS Setup.exe in dist/
npm run publish         # Push to GitHub Releases (set GH_TOKEN, replace publish placeholders in package.json)
```

Auto-update polls GitHub Releases on packaged-app boot and every 6 hours, downloads in background, prompts user to restart.

## Native WASAPI loopback

The Windows addon lives in [native/win-loopback/](native/win-loopback/) and is built with `napi-rs`.

```powershell
npm run native:build
```

`npm install` also runs a best-effort postinstall build:

```powershell
napi build --release --platform
```

If Rust or the Windows SDK is missing, install still succeeds and Oli uses the renderer `getDisplayMedia` fallback. When the addon is present, recording starts `recording:start-native` in the main process, captures the default render endpoint with WASAPI loopback, streams mic chunks from the renderer over IPC, mixes both streams in main, and writes `%APPDATA%\Oli\recordings\<meetingId>\mixed.wav`.

## Signing

Windows public builds must be Authenticode-signed before distribution. Use an OV or EV code-signing certificate from a trusted CA such as DigiCert or Sectigo, store the `.pfx` outside this repo, and set these variables only on the build machine:

```powershell
$env:WIN_CSC_LINK = "C:\path\to\oli-codesign.pfx"
$env:WIN_CSC_KEY_PASSWORD = "<password>"
```

The Electron Builder Windows config uses those variables for `certificateFile` and `certificatePassword`, signs DLLs, and sets `publisherName`. After packaging, verify the installer:

```powershell
npm run package
signtool verify /pa /v dist\Oli-0.1.1-Setup.exe
```

SmartScreen reputation is tied to the certificate and download reputation. EV certificates usually clear warnings fastest; OV certificates can still require reputation accumulation.

## Release

Draft GitHub releases are created with Electron Builder. Set `GH_TOKEN` to a PAT with `repo` scope, ensure the signing variables above are present, then run:

```powershell
$env:GH_TOKEN = "<token>"
npm run publish
```

Electron Builder uploads `Oli-x.y.z-Setup.exe` and `latest.yml` as a draft release. Publish the draft after adding release notes. To verify auto-update, install the previous signed build, publish a newer version, then launch the older app and wait for the update prompt.

## Project layout

```
src/
  main/
    audio/          wav.ts, recorder.ts (chunk windows + WAV writer),
                    capture.ts (native WASAPI loopback + main-process mixer)
    whisper/        worker.ts (one-shot), streaming.ts (queue)
    llm/            openai-client.ts (enhance + ask), templates.ts (6 built-in),
                    html-to-markdown.ts
    calendar/
      google.ts     PKCE OAuth + Calendar v3 REST
      outlook.ts    PKCE OAuth + Microsoft Graph
      ics.ts        node-ical file import
      repo.ts, poller.ts (5min poll, 2min notify)
    db/             schema.ts (inlined SQL), repo.ts (incl. search), settings.ts
    ipc/            meetings, recording, settings, llm, calendar, export
    secrets.ts      safeStorage wrapper (OpenAI key, Google + Outlook refresh tokens)
    tray.ts         System tray (procedural 16×16 RGBA Oli mark)
    window-icon.ts  Procedural 64×64 window/installer icon
    menu.ts         Application menu + keyboard shortcuts
    auto-update.ts  electron-updater wiring
    index.ts        Entry: IPC + getDisplayMedia + tray + poller + menu + auto-update
  preload/          contextBridge → typed window.floyd
  renderer/
    audio/          capture.ts, pcm-worklet.ts, resample.ts, useRecorder.ts, useDuration.ts
    components/
      brand/        Oli logo system + BrandPreview + BrandGuidelines
      MeetingList, RecordButton, NotesEditor, TemplatePicker, UpcomingEvents,
      SearchBar, AskOliChat, ConfirmDialog
    pages/          MeetingDetail, Settings, Brand, Onboarding
    store/          Zustand
    utils/          markdown.ts (marked + DOMPurify)
    styles/         globals.css (CSS vars + Tiptap + .oli-md theme)
  shared/           types.ts
build/              electron-builder resources (NSIS)
native/             WASAPI loopback addon (napi-rs)
```

## Data location

- DB: `%APPDATA%\Oli\synthetic-floyd.sqlite`
- Recordings: `%APPDATA%\Oli\recordings\<meetingId>\…`
- Encrypted secrets (DPAPI): `%APPDATA%\Oli\secrets\*.bin`

## Environment-dependent verification

- **Authenticode signing** needs `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` pointing at a real certificate on the build machine.
- **Native WASAPI addon compile** needs Rust, the MSVC toolchain, and the Windows SDK.
- **GitHub release publishing** needs `GH_TOKEN` with `repo` scope.
- **End-to-end recording verification** needs an active Zoom or Teams call on Windows.

## Follow-ups

1. Publish the first signed draft GitHub release.
2. Verify auto-update from the previous signed version on a clean Windows VM.
3. Multi-meeting search-as-you-type with full-text SQLite (FTS5) instead of `LIKE`.
