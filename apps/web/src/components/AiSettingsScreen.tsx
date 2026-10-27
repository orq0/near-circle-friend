import type { CircleSettings, UsageCounters } from '../types';
import { PrototypeBanner } from './PrototypeBanner';
import { VisibilityToggle } from './VisibilityToggle';
import { ModelDisclosure } from './AiProvenance';

interface AiSettingsScreenProps {
  settings: CircleSettings | null;
  loadError: boolean;
  saveError: boolean;
  saving: boolean;
  usage: UsageCounters | null;
  onRetry: () => void;
  onSave: (patch: Partial<CircleSettings>) => void;
  onBack: () => void;
}

function minutesLabel(value: number | null): string {
  if (value === null) return 'Off';
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function AiSettingsScreen({
  settings,
  loadError,
  saveError,
  saving,
  usage,
  onRetry,
  onSave,
  onBack,
}: AiSettingsScreenProps) {
  return (
    <section className="screen" aria-label="AI Circle settings">
      <PrototypeBanner />
      <header className="sub-header">
        <button type="button" className="back-link" onClick={onBack}>
          ← Back
        </button>
        <h1>AI Circle settings</h1>
      </header>
      {settings === null && !loadError && (
        <p className="radar-state" role="status">
          Loading AI Circle settings…
        </p>
      )}
      {loadError && (
        <div className="radar-alert">
          <p role="alert">Could not load AI Circle settings.</p>
          <button type="button" className="retry-btn" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
      {settings !== null && (
        <>
          <p className="consent-note">
            Circle Intelligence is strictly opt-in. Turning a consent off immediately
            stops new analysis and purges derived suggestions; your manual tiers stay.
          </p>
          <VisibilityToggle
            enabled={settings.analysis_consent}
            onChange={(next) => onSave({ analysis_consent: next })}
            title="AI friendship analysis"
            subtitle={settings.analysis_consent ? 'Estimates closeness from shared signals' : 'Estimates are paused'}
          />
          <VisibilityToggle
            enabled={settings.advice_consent}
            onChange={(next) => onSave({ advice_consent: next })}
            title="Meetup suggestions"
            subtitle={settings.advice_consent ? 'You can ask about catching up' : 'Ask Meta AI is disabled'}
          />
          <VisibilityToggle
            enabled={settings.availability_shared}
            onChange={(next) => onSave({ availability_shared: next })}
            title="Share my availability"
            subtitle={
              settings.availability_shared
                ? 'Mutual availability can inform suggestions'
                : 'Suggestions never claim you are available'
            }
          />
          <div className="friend-card">
            <p className="insight-meta">
              Quiet hours: {minutesLabel(settings.quiet_start_min)} – {minutesLabel(settings.quiet_end_min)}
            </p>
            <div className="insight-actions">
              <button
                type="button"
                className="secondary-cta"
                disabled={saving}
                onClick={() => onSave({ quiet_start_min: 22 * 60, quiet_end_min: 8 * 60 })}
              >
                Evenings off
              </button>
              <button
                type="button"
                className="secondary-cta"
                disabled={saving}
                onClick={() => onSave({ quiet_start_min: null, quiet_end_min: null })}
              >
                Clear quiet hours
              </button>
            </div>
          </div>
          {saveError && (
            <p className="toggle-error" role="alert">
              Could not save AI Circle settings — check the API connection.
            </p>
          )}
        </>
      )}
      {usage !== null && (
        <div className="friend-card">
          <h3>Model usage</h3>
          <p className="insight-meta">
            {usage.model_requests} model calls • {usage.cache_hits} served from recent results
            {usage.rate_limited > 0 && ` • ${usage.rate_limited} over budget`} •{' '}
            {usage.input_tokens + usage.output_tokens} tokens
          </p>
        </div>
      )}
      <ModelDisclosure />
    </section>
  );
}
