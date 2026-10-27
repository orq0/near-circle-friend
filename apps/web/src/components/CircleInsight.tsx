import { useState } from 'react';
import type { CircleInsight } from '../types';
import { closenessSourceLabel } from './AiProvenance';

interface CircleInsightProps {
  friendName: string;
  insight: CircleInsight | null;
  loadError: boolean;
  requestPending: boolean;
  overrideSaving: boolean;
  onRetry: () => void;
  onRequestReassessment: () => void;
  onSaveOverride: (level: number | null) => void;
}

const TIER_CHOICES = [
  { level: 5, icon: '💖', label: 'Inner Circle' },
  { level: 4, icon: '💛', label: 'Close Friend' },
  { level: 3, icon: '😊', label: 'Regular Friend' },
  { level: 2, icon: '👋', label: 'Casual Friend' },
  { level: 1, icon: '🤝', label: 'Acquaintance' },
] as const;

const TIER_ICONS: Record<number, string> = {
  5: '💖',
  4: '💛',
  3: '😊',
  2: '👋',
  1: '🤝',
};

function trendLabel(trend: CircleInsight['activity_trend']): string {
  switch (trend) {
    case 'stable':
      return 'Steady';
    case 'increasing':
      return 'Picking up';
    case 'decreasing':
      return 'Quiet lately';
    case 'unknown':
      return 'Still getting to know';
  }
}

interface OverrideEditorProps {
  insight: CircleInsight;
  overrideSaving: boolean;
  onSaveOverride: (level: number | null) => void;
  onDone: () => void;
}

function OverrideEditor({ insight, overrideSaving, onSaveOverride, onDone }: OverrideEditorProps) {
  return (
    <div className="insight-choices">
      <p className="insight-choices-title">How would you describe your friendship?</p>
      <div role="group" aria-label="How would you describe your friendship?">
        {TIER_CHOICES.map(({ level, icon, label }) => (
          <button
            key={level}
            type="button"
            className={insight.override?.level === level ? 'tier-pick active' : 'tier-pick'}
            aria-pressed={insight.override?.level === level}
            disabled={overrideSaving}
            onClick={() => {
              onSaveOverride(level);
              onDone();
            }}
          >
            <span>{icon}</span> {label}
          </button>
        ))}
        {insight.override !== null && (
          <button
            type="button"
            className="secondary-cta"
            disabled={overrideSaving}
            onClick={() => {
              onSaveOverride(null);
              onDone();
            }}
          >
            Clear my view
          </button>
        )}
      </div>
    </div>
  );
}

export function CircleInsight({
  friendName,
  insight,
  loadError,
  requestPending,
  overrideSaving,
  onRetry,
  onRequestReassessment,
  onSaveOverride,
}: CircleInsightProps) {
  const [editingOverride, setEditingOverride] = useState(false);
  const title = `Your Circle with ${friendName}`;
  const missingContext = insight !== null && insight.level_source === 'none';

  return (
    <div className="friend-card ai-insight" aria-label={title}>
      <h3>{title}</h3>
      {insight === null && !loadError && (
        <p className="radar-state" role="status">
          Learning about your circle…
        </p>
      )}
      {loadError && (
        <div className="radar-alert">
          <p role="alert">We couldn&apos;t load your circle right now.</p>
          <button type="button" className="retry-btn" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
      {insight !== null && !missingContext && (
        <>
          <p className="insight-level">
            <span aria-hidden="true">{TIER_ICONS[insight.level ?? 0] ?? '💛'}</span> {insight.level_label}
            <span className="ai-source">{closenessSourceLabel(insight.level_source)}</span>
          </p>
          <p className="insight-rationale">{insight.rationale}</p>
          <p className="insight-meta">Your connection lately: {trendLabel(insight.activity_trend)}</p>
          <details className="insight-how">
            <summary>How was this determined?</summary>
            <p className="insight-meta">
              {insight.evidence_quality !== null && `Evidence quality: ${insight.evidence_quality}`}
              {insight.evidence_quality !== null && insight.assessed_at !== null && ' • '}
              {insight.assessed_at !== null &&
                `Assessed ${new Date(insight.assessed_at).toLocaleDateString()}`}
              {(insight.evidence_quality !== null || insight.assessed_at !== null) &&
                insight.model_id !== null &&
                ' • '}
              {insight.model_id !== null && `Model: ${insight.model_id}`}
            </p>
          </details>
          <div className="insight-actions">
            <button
              type="button"
              className="secondary-cta"
              disabled={requestPending || !insight.ai_enabled}
              onClick={onRequestReassessment}
            >
              {requestPending ? 'Refreshing insight…' : '✨ Refresh insight'}
            </button>
            <button type="button" className="secondary-cta" onClick={() => setEditingOverride((v) => !v)}>
              💛 My view of our friendship
            </button>
          </div>
          {editingOverride && (
            <OverrideEditor
              insight={insight}
              overrideSaving={overrideSaving}
              onSaveOverride={onSaveOverride}
              onDone={() => setEditingOverride(false)}
            />
          )}
        </>
      )}
      {insight !== null && missingContext && (
        <>
          <p className="insight-empty-title">Every friendship has its own story.</p>
          <p className="insight-rationale">
            We don&apos;t have enough information yet to offer a meaningful insight into your
            connection with {friendName}.
          </p>
          <div className="insight-actions">
            <button
              type="button"
              className="secondary-cta"
              disabled={requestPending || !insight.ai_enabled}
              onClick={onRequestReassessment}
            >
              {requestPending ? 'Refreshing insight…' : '✨ Refresh insight'}
            </button>
            <button type="button" className="secondary-cta" onClick={() => setEditingOverride((v) => !v)}>
              💛 My view of our friendship
            </button>
          </div>
          {editingOverride && (
            <OverrideEditor
              insight={insight}
              overrideSaving={overrideSaving}
              onSaveOverride={onSaveOverride}
              onDone={() => setEditingOverride(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
