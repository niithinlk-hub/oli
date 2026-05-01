import { useEffect, useState } from 'react';
import type { AppSettings } from '@shared/types';
import { OliLogoHorizontal } from '../components/brand/OliLogoHorizontal';
import { AiProviderSection } from '../components/AiProviderSection';
import { AiSection } from '../components/AiSection';
import { SttProviderSection } from '../components/SttProviderSection';
import { WhisperModelSection } from '../components/WhisperModelSection';
import { CalendarSubscriptionsSection } from '../components/CalendarSubscriptionsSection';

export function Settings({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const [google, setGoogle] = useState<{
    googleConnected: boolean;
    googleClientId: string | null;
    outlookConnected: boolean;
    outlookClientId: string | null;
  }>({ googleConnected: false, googleClientId: null, outlookConnected: false, outlookClientId: null });
  const [clientIdDraft, setClientIdDraft] = useState('');
  const [outlookIdDraft, setOutlookIdDraft] = useState('');
  const [googleMessage, setGoogleMessage] = useState<string | null>(null);
  const [outlookMessage, setOutlookMessage] = useState<string | null>(null);
  const [icsMessage, setIcsMessage] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectingOutlook, setConnectingOutlook] = useState(false);
  const [version, setVersion] = useState<string>('');
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const refresh = async () => {
    const [s, status] = await Promise.all([
      window.floyd.settings.get(),
      window.floyd.calendar.status()
    ]);
    setSettings(s);
    setGoogle(status);
    setClientIdDraft(status.googleClientId ?? '');
    setOutlookIdDraft(status.outlookClientId ?? '');
  };

  useEffect(() => {
    void refresh();
    void window.floyd.app.version().then(setVersion);
  }, []);

  const checkUpdates = async () => {
    setCheckingUpdate(true);
    setUpdateMessage(null);
    const r = await window.floyd.app.checkForUpdates();
    setUpdateMessage(r.message ?? (r.ok ? 'Up to date.' : 'Check failed.'));
    setCheckingUpdate(false);
  };

  const pickWhisperBinary = async () => {
    const path = await window.floyd.settings.pickFile({
      title: 'Select whisper.cpp binary (whisper-cli.exe)',
      filters: [{ name: 'Executable', extensions: ['exe'] }]
    });
    if (path) {
      await window.floyd.settings.setWhisperBinary(path);
      await refresh();
    }
  };
  const pickWhisperModel = async () => {
    const path = await window.floyd.settings.pickFile({
      title: 'Select ggml whisper model (.bin)',
      filters: [{ name: 'GGML model', extensions: ['bin'] }]
    });
    if (path) {
      await window.floyd.settings.setWhisperModel(path);
      await refresh();
    }
  };

  const saveClientId = async () => {
    await window.floyd.calendar.setGoogleClientId(clientIdDraft.trim() || null);
    await refresh();
  };
  const connectGoogle = async () => {
    setConnecting(true);
    setGoogleMessage(null);
    const res = await window.floyd.calendar.connectGoogle();
    setGoogleMessage(res.ok ? 'Connected.' : res.message ?? 'Connection failed.');
    await refresh();
    setConnecting(false);
  };
  const disconnectGoogle = async () => {
    await window.floyd.calendar.disconnectGoogle();
    setGoogleMessage(null);
    await refresh();
  };

  const saveOutlookId = async () => {
    await window.floyd.calendar.setOutlookClientId(outlookIdDraft.trim() || null);
    await refresh();
  };
  const connectOutlook = async () => {
    setConnectingOutlook(true);
    setOutlookMessage(null);
    const res = await window.floyd.calendar.connectOutlook();
    setOutlookMessage(res.ok ? 'Connected.' : res.message ?? 'Connection failed.');
    await refresh();
    setConnectingOutlook(false);
  };
  const disconnectOutlook = async () => {
    await window.floyd.calendar.disconnectOutlook();
    setOutlookMessage(null);
    await refresh();
  };

  const importIcs = async () => {
    setIcsMessage(null);
    const res = await window.floyd.calendar.importIcs();
    if (res.ok) setIcsMessage(`Imported ${res.imported} events.`);
    else setIcsMessage(res.message ?? 'Import failed.');
  };

  if (!settings) {
    return <div className="flex-1 flex items-center justify-center text-ink-muted">Loading…</div>;
  }

  return (
    <section className="flex-1 flex flex-col">
      <header className="titlebar-drag h-14 flex items-center justify-between px-6 border-b border-line bg-white">
        <div className="flex items-center gap-3">
          <OliLogoHorizontal iconSize={24} wordmarkSize={20} />
          <span className="text-caption uppercase tracking-wider text-ink-muted">Settings</span>
        </div>
        <button
          onClick={onClose}
          className="text-btn px-3 py-1.5 rounded-button border border-line bg-white hover:bg-surface-ice"
        >
          Close
        </button>
      </header>

      <div
        className="flex-1 overflow-y-auto p-8 space-y-6 max-w-3xl"
        style={{ background: 'var(--oli-gradient-soft-bg)' }}
      >
        <AiProviderSection />
        <SttProviderSection />
        <AiSection />
        <WhisperModelSection />
        <CalendarSubscriptionsSection />

        <Section
          title="Google Calendar"
          subtitle="Auto-detect upcoming meetings and notify 2 minutes before. Uses PKCE — no client secret stored."
        >
          <div>
            <label className="text-caption uppercase tracking-wider text-ink-muted block mb-1">
              Google OAuth Client ID
            </label>
            <div className="flex gap-2">
              <input
                value={clientIdDraft}
                onChange={(e) => setClientIdDraft(e.target.value)}
                placeholder="xxxx.apps.googleusercontent.com"
                className="flex-1 px-3 py-2 rounded-md border border-line bg-white text-body-sm font-mono"
              />
              <button
                onClick={saveClientId}
                className="px-3 py-2 rounded-button text-btn border border-line bg-white hover:bg-surface-cloud"
              >
                Save
              </button>
            </div>
            <p className="text-caption text-ink-muted mt-1">
              Create one at <span className="font-mono">console.cloud.google.com/apis/credentials</span>{' '}
              as a &ldquo;Desktop app&rdquo; client. No secret needed.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-md border border-line bg-white px-3 py-2 mt-3">
            <div>
              <p className="text-body-sm font-medium">
                {google.googleConnected ? 'Connected' : 'Not connected'}
              </p>
              <p className="text-caption text-ink-muted">
                {google.googleConnected
                  ? 'Polling every 5 min for upcoming events.'
                  : 'Save a client ID and click Connect to authorize.'}
              </p>
            </div>
            {google.googleConnected ? (
              <button
                onClick={disconnectGoogle}
                className="text-btn px-3 py-1.5 rounded-button border border-line text-ink-secondary hover:bg-surface-cloud"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={connectGoogle}
                disabled={connecting || !google.googleClientId}
                className="px-4 py-2 rounded-button text-btn text-white disabled:opacity-50"
                style={{ background: 'var(--oli-gradient-primary)' }}
              >
                {connecting ? 'Waiting for browser…' : 'Connect'}
              </button>
            )}
          </div>
          {googleMessage && <p className="text-caption text-ink-secondary mt-2">{googleMessage}</p>}
        </Section>

        <Section
          title="Microsoft Outlook / 365"
          subtitle="PKCE OAuth via the common (multi-tenant) endpoint. Requires a registered Azure AD application with Calendars.Read + offline_access scopes."
        >
          <div>
            <label className="text-caption uppercase tracking-wider text-ink-muted block mb-1">
              Application (Client) ID
            </label>
            <div className="flex gap-2">
              <input
                value={outlookIdDraft}
                onChange={(e) => setOutlookIdDraft(e.target.value)}
                placeholder="GUID from Azure AD app registration"
                className="flex-1 px-3 py-2 rounded-md border border-line bg-white text-body-sm font-mono"
              />
              <button
                onClick={saveOutlookId}
                className="px-3 py-2 rounded-button text-btn border border-line bg-white hover:bg-surface-cloud"
              >
                Save
              </button>
            </div>
            <p className="text-caption text-ink-muted mt-1">
              Register at <span className="font-mono">portal.azure.com</span> → App registrations.
              Add redirect URI <span className="font-mono">http://127.0.0.1</span> as type &ldquo;Public client&rdquo;.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-md border border-line bg-white px-3 py-2 mt-3">
            <div>
              <p className="text-body-sm font-medium">
                {google.outlookConnected ? 'Connected' : 'Not connected'}
              </p>
              <p className="text-caption text-ink-muted">
                {google.outlookConnected
                  ? 'Polling Outlook calendar every 5 min.'
                  : 'Save a client ID and click Connect to authorize.'}
              </p>
            </div>
            {google.outlookConnected ? (
              <button
                onClick={disconnectOutlook}
                className="text-btn px-3 py-1.5 rounded-button border border-line text-ink-secondary hover:bg-surface-cloud"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={connectOutlook}
                disabled={connectingOutlook || !google.outlookClientId}
                className="px-4 py-2 rounded-button text-btn text-white disabled:opacity-50"
                style={{ background: 'var(--oli-gradient-primary)' }}
              >
                {connectingOutlook ? 'Waiting for browser…' : 'Connect'}
              </button>
            )}
          </div>
          {outlookMessage && <p className="text-caption text-ink-secondary mt-2">{outlookMessage}</p>}
        </Section>

        <Section
          title="ICS file import"
          subtitle="One-shot import of any iCalendar file (.ics) — handy for shared calendars or services without an OAuth app."
        >
          <button
            onClick={importIcs}
            className="px-4 py-2 rounded-button text-btn border border-line bg-white hover:bg-surface-cloud"
          >
            Import .ics file…
          </button>
          {icsMessage && <p className="text-caption text-ink-secondary">{icsMessage}</p>}
        </Section>

        <Section
          title="Whisper.cpp"
          subtitle="Local transcription engine. Required for live and final transcripts."
        >
          <Field
            label="Binary path"
            value={settings.whisperBinaryPath}
            placeholder="Path to whisper.cpp main / whisper-cli executable"
            onPick={pickWhisperBinary}
          />
          <Field
            label="Model path"
            value={settings.whisperModelPath}
            placeholder="Path to a ggml-*.bin file (e.g. ggml-medium.bin)"
            onPick={pickWhisperModel}
          />
          <p className="text-caption text-ink-muted">
            Download from <span className="font-mono">github.com/ggerganov/whisper.cpp/releases</span>{' '}
            and <span className="font-mono">huggingface.co/ggerganov/whisper.cpp</span>.
          </p>
        </Section>

        <Section title="Updates" subtitle="Auto-updates run in the background every 6 hours when packaged.">
          <div className="flex items-center justify-between rounded-md border border-line bg-white px-3 py-2">
            <div>
              <p className="text-body-sm font-medium">Oli {version || '—'}</p>
              <p className="text-caption text-ink-muted">
                {updateMessage ?? 'Click below to check for the latest release now.'}
              </p>
            </div>
            <button
              onClick={checkUpdates}
              disabled={checkingUpdate}
              className="px-3 py-1.5 rounded-button border border-line bg-white hover:bg-surface-cloud text-btn disabled:opacity-50"
            >
              {checkingUpdate ? 'Checking…' : 'Check now'}
            </button>
          </div>
        </Section>
      </div>
    </section>
  );
}

function Section({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-white p-6 shadow-card">
      <h3 className="text-h4 mb-1">{title}</h3>
      <p className="text-caption text-ink-muted mb-4">{subtitle}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  onPick
}: {
  label: string;
  value: string | null;
  placeholder: string;
  onPick: () => void;
}) {
  return (
    <div>
      <label className="text-caption uppercase tracking-wider text-ink-muted block mb-1">
        {label}
      </label>
      <div className="flex gap-2 items-stretch">
        <div className="flex-1 px-3 py-2 rounded-md bg-surface-cloud border border-line text-caption font-mono truncate">
          {value || <span className="text-ink-muted">{placeholder}</span>}
        </div>
        <button
          onClick={onPick}
          className="px-3 py-2 rounded-button border border-line bg-white hover:bg-surface-cloud text-btn"
        >
          Browse…
        </button>
      </div>
    </div>
  );
}
