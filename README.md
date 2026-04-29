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
| 10 | Native WASAPI loopback addon — scaffold; `getDisplayMedia` covers MVP |
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
2. **Ctrl+R** or click **Record** — system audio picker → pick the call window.
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

## Project layout

```
src/
  main/
    audio/          wav.ts, recorder.ts (chunk windows + WAV writer)
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
native/             WASAPI loopback addon scaffold (deferred)
```

## Data location

- DB: `%APPDATA%\Oli\synthetic-floyd.sqlite`
- Recordings: `%APPDATA%\Oli\recordings\<meetingId>\…`
- Encrypted secrets (DPAPI): `%APPDATA%\Oli\secrets\*.bin`

## Cannot be done in this environment

- **Authenticode signing** — needs a code-signing certificate.
- **Native WASAPI addon compile** — needs Rust toolchain + Windows SDK.
- **GitHub repo placeholders** — replace `REPLACE_WITH_GH_OWNER` / `REPLACE_WITH_GH_REPO` in `package.json > build.publish` before first `npm run publish`.
- **Verifying running app** — Electron desktop, not previewable in browser. Run `npm run dev` locally.

## Follow-ups

1. Replace GitHub publish placeholders in `package.json`.
2. Code-sign the NSIS installer to clear SmartScreen.
3. Build the WASAPI loopback addon to remove the system picker prompt (see `native/win-loopback/`).
4. Multi-meeting search-as-you-type with full-text SQLite (FTS5) instead of `LIKE`.
