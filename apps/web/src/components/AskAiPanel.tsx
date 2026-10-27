import { useState } from 'react';
import type { AdviceResult, AskPanelState, OpportunityCandidate } from '../types';
import { formatDistance } from '../radar';
import { adviceSourceLabel, closenessSourceLabel, ModelDisclosure } from './AiProvenance';
import { Avatar } from './Avatar';

interface AskAiPanelProps {
  candidate: OpportunityCandidate;
  state: AskPanelState;
  advice: AdviceResult | null;
  notice: string | null;
  onAsk: () => void;
  onDismiss: () => void;
  onSnooze: () => void;
  onDeclineInvite: () => void;
  onOpenRoute: () => void;
}

function activityLabel(activity: AdviceResult['activity']): string {
  switch (activity) {
    case 'coffee':
      return 'Coffee';
    case 'walk':
      return 'Walk';
    case 'lunch':
      return 'Lunch';
    case 'catch_up':
      return 'Catch up';
    case 'none':
      return 'No specific activity';
  }
}

export function AskAiPanel({
  candidate,
  state,
  advice,
  notice,
  onAsk,
  onDismiss,
  onSnooze,
  onDeclineInvite,
  onOpenRoute,
}: AskAiPanelProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  const showing = state === 'suggest' || state === 'later' || state === 'insufficient';

  return (
    <div className="friend-card ai-panel" aria-label={`Meetup advice for ${candidate.display_name}`}>
      <div className="ai-panel-head">
        <div className="ai-panel-identity">
          <Avatar
            userId={candidate.id}
            label={candidate.display_name.charAt(0)}
            className="avatar small"
          />
          <div>
            <h3>{candidate.display_name}</h3>
          <p className="proximity-line">
            About {formatDistance(candidate.distance_m)} away
            {candidate.walk_minutes !== null && ` • ~${candidate.walk_minutes} min on foot`}.
          </p>
          {candidate.closeness !== null && (
            <p className="insight-meta">
              Closeness: {candidate.closeness.level === null ? 'Not enough information' : `Tier ${candidate.closeness.level}`} (
              {closenessSourceLabel(candidate.closeness.level_source)})
            </p>
          )}
          </div>
        </div>
        <div className="ai-panel-top-actions">
          <button type="button" className="secondary-cta" onClick={onSnooze}>
            Snooze
          </button>
          <button type="button" className="secondary-cta" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>

      {state === 'not_requested' && (
        <button type="button" className="primary-cta" onClick={onAsk}>
          Ask Meta AI
        </button>
      )}
      {state === 'checking' && (
        <p className="radar-state" role="status">
          Checking eligibility…
        </p>
      )}
      {state === 'consulting' && (
        <p className="radar-state" role="status">
          Consulting the model for {candidate.display_name}…
        </p>
      )}
      {state === 'unavailable' && (
        <div className="radar-alert">
          <p role="alert">
            {notice ?? 'AI is unavailable right now. Map, radar and walking routes still work.'}
          </p>
          <button type="button" className="retry-btn" onClick={onAsk}>
            Try again
          </button>
        </div>
      )}
      {state === 'error' && (
        <div className="radar-alert">
          <p role="alert">{notice ?? 'Could not load meetup advice.'}</p>
          <button type="button" className="retry-btn" onClick={onAsk}>
            Try again
          </button>
        </div>
      )}

      {showing && advice !== null && (
        <>
          <p className="insight-level">
            {advice.outcome === 'suggest'
              ? 'Worth asking today'
              : advice.outcome === 'later'
                ? 'Maybe another time'
                : 'Not enough context'}
            <span className="ai-source">{adviceSourceLabel(advice.source)}</span>
          </p>
          <p className="insight-rationale">{advice.reason}</p>
          <p className="insight-meta">
            Suggested activity: {activityLabel(advice.activity)}
            {advice.model_id !== null && ` • Model: ${advice.model_id}`}
          </p>
          {advice.outcome === 'suggest' && advice.invitation_draft !== null && !confirmed && (
            <div className="invite-composer">
              <label htmlFor={`invite-${candidate.id}`}>Editable invitation (nothing is sent)</label>
              <textarea
                id={`invite-${candidate.id}`}
                rows={3}
                value={draft ?? advice.invitation_draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <div className="invite-actions">
                <button
                  type="button"
                  className="primary-cta"
                  onClick={() => setConfirmed(true)}
                >
                  Confirm invitation
                </button>
                <button
                  type="button"
                  className="secondary-cta"
                  onClick={() => {
                    setDraft(advice.invitation_draft);
                    setCopied(false);
                  }}
                >
                  Regenerate draft
                </button>
                <button
                  type="button"
                  className="secondary-cta"
                  onClick={() => {
                    void navigator.clipboard?.writeText(draft ?? advice.invitation_draft ?? '').then(
                      () => setCopied(true),
                      () => setCopied(false),
                    );
                  }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  className="secondary-cta"
                  onClick={onDeclineInvite}
                >
                  Decline
                </button>
              </div>
            </div>
          )}
          {confirmed && (
            <p className="phase-note" role="status">
              Invitation ready: “{draft ?? advice.invitation_draft ?? ''}” Nothing was sent anywhere.
            </p>
          )}
          <div className="insight-actions">
            <button type="button" className="secondary-cta" onClick={onAsk}>
              Ask again
            </button>
            <button type="button" className="secondary-cta" onClick={onOpenRoute}>
              View walking route
            </button>
          </div>
        </>
      )}
      <ModelDisclosure />
    </div>
  );
}
