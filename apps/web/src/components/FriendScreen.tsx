import type {
  CircleInsight as CircleInsightData,
  FriendDetail,
  OpportunityCandidate,
} from '../types';
import { formatDistance } from '../radar';
import { Avatar } from './Avatar';
import { PrototypeBanner } from './PrototypeBanner';
import { CircleInsight } from './CircleInsight';
import { AskAiPanel } from './AskAiPanel';
import type { CandidateAdvice } from './ReconnectTodayScreen';

interface FriendScreenProps {
  detail: FriendDetail | null;
  loadError: boolean;
  onViewRoute: () => void;
  onBack: () => void;
  onRetry: () => void;
  insight: CircleInsightData | null;
  insightError: boolean;
  reassessmentPending: boolean;
  overrideSaving: boolean;
  onRetryInsight: () => void;
  onRequestReassessment: () => void;
  onSaveOverride: (level: number | null) => void;
  askCandidate: OpportunityCandidate | null;
  askAdvice: CandidateAdvice;
  onAskAdvice: (candidate: OpportunityCandidate) => void;
  onDismissAdvice: (candidate: OpportunityCandidate) => void;
  onSnoozeAdvice: (candidate: OpportunityCandidate) => void;
  onDeclineAdviceInvite: (candidate: OpportunityCandidate) => void;
  onOpenAdviceRoute: () => void;
}

export function FriendScreen({
  detail,
  loadError,
  onViewRoute,
  onBack,
  onRetry,
  insight,
  insightError,
  reassessmentPending,
  overrideSaving,
  onRetryInsight,
  onRequestReassessment,
  onSaveOverride,
  askCandidate,
  askAdvice,
  onAskAdvice,
  onDismissAdvice,
  onSnoozeAdvice,
  onDeclineAdviceInvite,
  onOpenAdviceRoute,
}: FriendScreenProps) {
  return (
    <section className="screen" aria-label="Selected friend">
      <PrototypeBanner />
      <header className="sub-header">
        <button type="button" className="back-link" onClick={onBack}>
          ← Radar
        </button>
        <h1>Friend</h1>
      </header>
      {detail === null && !loadError && (
        <p className="radar-state" role="status">
          Loading friend information…
        </p>
      )}
      {loadError && (
        <div className="radar-alert">
          <p role="alert">Could not load friend information.</p>
          <button type="button" className="retry-btn" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
      {detail !== null && (
        <div className="friend-card">
          <Avatar
            userId={detail.id}
            label={detail.display_name.charAt(0)}
            className="avatar large"
          />
          <h2>{detail.display_name}</h2>
          <p className="enabled-line">
            <span className="enabled-dot" aria-hidden="true" />
            Near-Circle enabled
          </p>
          <p className="proximity-line">
            About {formatDistance(detail.distance_m ?? NaN)} away.
          </p>
          <p className="consent-note">
            Precise destination access requires the applicable consent.
          </p>
          <button type="button" className="primary-cta" onClick={onViewRoute}>
            View walking route
          </button>
          <p className="phase-note">
            Walking route computed by the pedestrian router on OpenStreetMap data.
          </p>
        </div>
      )}
      {detail !== null && (
        <CircleInsight
          friendName={detail.display_name}
          insight={insight}
          loadError={insightError}
          requestPending={reassessmentPending}
          overrideSaving={overrideSaving}
          onRetry={onRetryInsight}
          onRequestReassessment={onRequestReassessment}
          onSaveOverride={onSaveOverride}
        />
      )}
      {detail !== null && (
        <div className="friend-card ai-panel" aria-label={`Meetup suggestion for ${detail.display_name}`}>
          <h3>✨ Fancy catching up today?</h3>
          {askCandidate !== null ? (
            <p className="insight-rationale">
              Ask Meta AI for a thoughtful suggestion about reconnecting with {detail.display_name} —
              a good moment, a simple plan, and help finding the words.
            </p>
          ) : (
            <p className="insight-rationale">
              AI suggestions aren&apos;t available for {detail.display_name} right now.
            </p>
          )}
        </div>
      )}
      {detail !== null && askCandidate !== null && (
        <AskAiPanel
          candidate={askCandidate}
          state={askAdvice.state}
          advice={askAdvice.advice}
          notice={askAdvice.notice}
          onAsk={() => onAskAdvice(askCandidate)}
          onDismiss={() => onDismissAdvice(askCandidate)}
          onSnooze={() => onSnoozeAdvice(askCandidate)}
          onDeclineInvite={() => onDeclineAdviceInvite(askCandidate)}
          onOpenRoute={onOpenAdviceRoute}
        />
      )}
    </section>
  );
}
