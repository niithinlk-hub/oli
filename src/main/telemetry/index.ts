/**
 * Telemetry plumbing — Sentry + PostHog wiring.
 *
 * Phase 4 ships the scaffolding only. Default OFF. No network calls until
 * the user opts in via Settings → Privacy. Error capture (Sentry) and
 * usage events (PostHog) sit behind the `telemetry.optIn` setting.
 *
 * We do NOT bundle the actual SDKs in 1.4.0 — that's an explicit follow-up
 * Phase 4.4 line item ("ship the plumbing only"). When the user opts in,
 * future versions will load Sentry/PostHog dynamically. For now this module
 * exposes the API the rest of the app should call.
 */
import { settingsRepo } from '../db/settings';

const KEY = 'telemetry.optIn';

export function isTelemetryOptIn(): boolean {
  return settingsRepo.get(KEY) === '1';
}

export function setTelemetryOptIn(opt: boolean): void {
  if (opt) settingsRepo.set(KEY, '1');
  else settingsRepo.delete(KEY);
}

/**
 * PII-scrub a string before any telemetry transport. Removes anything that
 * looks like an email or API key. Conservative — drops 5+ char alnum runs
 * that follow `sk-`, `gsk_`, `AIza`, etc.
 */
export function scrub(s: string): string {
  return s
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[email]')
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|gsk_[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{16,})\b/g, '[key]');
}

export function captureError(err: Error, ctx?: Record<string, unknown>): void {
  if (!isTelemetryOptIn()) return;
  // TODO(phase-4.4): dynamic-load Sentry, send err+ctx after scrub().
  // Until then this is a no-op so we never start sending data unintentionally.
  void err;
  void ctx;
}

export function trackEvent(name: string, properties: Record<string, string | number | boolean> = {}): void {
  if (!isTelemetryOptIn()) return;
  // TODO(phase-4.4): dynamic-load PostHog, posthog.capture(name, properties).
  void name;
  void properties;
}
