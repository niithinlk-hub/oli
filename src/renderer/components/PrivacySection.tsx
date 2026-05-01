import { useEffect, useState } from 'react';

/**
 * Privacy + telemetry settings card. Defaults: everything OFF. Sentry +
 * PostHog SDKs are not bundled until the user opts in (Phase 4 ships
 * plumbing only).
 */
export function PrivacySection() {
  const [optIn, setOptIn] = useState(false);

  useEffect(() => {
    void window.floyd.telemetry.get().then((r) => setOptIn(r.optIn));
  }, []);

  const toggle = async () => {
    const next = !optIn;
    await window.floyd.telemetry.set(next);
    setOptIn(next);
  };

  return (
    <div className="rounded-card border border-line bg-white p-6 shadow-card">
      <h3 className="text-h4 mb-1">Privacy</h3>
      <p className="text-caption text-ink-muted mb-4">
        Oli is local-first. Audio + transcripts never leave your machine unless you enabled cloud
        STT (Groq) or cloud diarization (AssemblyAI). API keys stay encrypted via Windows DPAPI.
      </p>

      <label className="flex items-center justify-between rounded-md border border-line bg-white px-3 py-3 cursor-pointer">
        <div className="flex-1">
          <p className="text-body-sm font-medium">Anonymous usage telemetry</p>
          <p className="text-caption text-ink-muted mt-0.5">
            Counts of feature usage (e.g. &ldquo;ran enhance&rdquo;), no transcript content, no key fragments.
            Default OFF. Plumbing only in 1.4.0 — no events sent until SDKs land in 1.5.x.
          </p>
        </div>
        <input
          type="checkbox"
          checked={optIn}
          onChange={toggle}
          className="ml-4 h-5 w-5"
        />
      </label>

      <p className="text-caption text-ink-muted mt-4">
        Crash reports (Sentry) follow the same opt-in. PII scrubbed before transport.
      </p>
    </div>
  );
}
