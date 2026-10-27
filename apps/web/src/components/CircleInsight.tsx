import { useState } from 'react';
import type { CircleInsight } from '../types';
import { closenessSourceLabel } from './AiProvenance';

interface CircleInsightProps {
  insight: CircleInsight | null;
  loadError: boolean;
  requestPending: boolean;
  overrideSaving: boolean;
  onRetry: () => void;
  onRequestReassessment: () => void;
  onSaveOverride: (level: number | null) => void;
}

const OVERRIDE_LEVELS = [5, 4, 3, 2, 1] as const;

function trendLabel(trend: CircleInsight['activity_trend']): string {
  switch (trend) {
    case 'stable':
      return 'Steady';
    case 'increasing':
      return 'Picking up';
    case 'decreasing':
      return 'Quieting down';
    case 'unknown':
      return 'Unknown';
  }
}

export function CircleInsight({
  insight,
  loadError,
  requestPending,
  overrideSaving,
  onRetry,
  onRequestReassessment,
  onSaveOverride,
}: CircleInsightProps) {
  const [editingOverride, setEditingOverride] = useState(false);

  return (
    <div className="friend-card ai-insight" aria-label="Circle Insight">
      <h3>Circle Insight</h3>
      {insight === null && !loadError && (
        <p className="radar-state" role="status">
          Loading circle insight…
        </p>
      )}
      {loadError && (
        <div className="radar-alert">
          <p role="alert">Could not load circle insight.</p>
          <button type="button" className="retry-btn" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
      {insight !== null && (
        <>
          <p className="insight-level">
            {insight.level_label}
            <span className="ai-source">{closenessSourceLabel(insight.level_source)}</span>
          </p>
          <p className="insight-rationale">{insight.rationale}</p>
          <p className="insight-meta">
            Recent activity: {trendLabel(insight.activity_trend)}
            {insight.evidence_quality !== null && ` • Evidence: ${insight.evidence_quality}`}
            {insight.assessed_at !== null && ` • Assessed ${new Date(insight.assessed_at).toLocaleDateString()}`}
          </p>
          {insight.model_id !== null && <p className="insight-meta">Model: {insight.model_id}</p>}
          <div className="insight-actions">
            <button
              type="button"
              className="secondary-cta"
              disabled={requestPending || !insight.ai_enabled}
              onClick={onRequestReassessment}
            >
              {requestPending ? 'Reassessment requested…' : 'Request reassessment'}
            </button>
            <button type="button" className="secondary-cta" onClick={() => setEditingOverride((v) => !v)}>
              {insight.override === null ? 'Set my tier' : 'Change my tier'}
            </button>
          </div>
          {editingOverride && (
            <div className="override-row" role="group" aria-label="Choose your closeness tier">
              {OVERRIDE_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={insight.override?.level === level ? 'radius-btn active' : 'radius-btn'}
                  disabled={overrideSaving}
                  onClick={() => {
                    onSaveOverride(level);
                    setEditingOverride(false);
                  }}
                >
                  {level}
                </button>
              ))}
              {insight.override !== null && (
                <button
                  type="button"
                  className="secondary-cta"
                  disabled={overrideSaving}
                  onClick={() => {
                    onSaveOverride(null);
                    setEditingOverride(false);
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
