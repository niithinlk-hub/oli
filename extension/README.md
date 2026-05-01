# Oli browser extension

Companion to the Oli desktop app. Adds a `✦ Oli` button to the Gmail and Outlook Web compose UIs that rephrases the current draft via the desktop app's local HTTP server.

## Install (unpacked)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. **Load unpacked** → select this `extension/` folder.
4. Open Oli desktop app → **Settings → Browser extension → Pair an extension**.
5. Copy the 6-character code → paste into the extension popup → **Pair**.

## How it works

- All requests go to `127.0.0.1:7421` (Oli desktop's local HTTP server).
- A bearer token from `/pair` is stored in `chrome.storage.local`.
- Oli desktop re-uses your configured AI provider key (OpenAI / Claude / Gemini / Groq) — keys never leave the desktop.

## Permissions

- `storage` — persist the bearer token
- `activeTab`, `scripting` — inject the compose button
- Host permissions: Gmail, Outlook Web, `127.0.0.1`, `localhost`

No remote permissions. No network calls beyond loopback.
