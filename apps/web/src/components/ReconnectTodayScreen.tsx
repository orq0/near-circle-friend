import type { AdviceResult, AskPanelState, OpportunityCandidate } from '../types';
import { PrototypeBanner } from './PrototypeBanner';
import { RadiusSelector } from './RadiusSelector';
import { AskAiPanel } from './AskAiPanel';
import { RADII_M } from '../radar';

export interface CandidateAdvice {
  state: AskPanelState;
  advice: AdviceResult | null;
  notice: string | null;
}

interface ReconnectTodayScreenProps {
  candidates: OpportunityCandidate[] | null;
  loadError: boolean;
  radiusM: number;
  adviceById: Record<string, CandidateAdvice>;
  onRadiusChange: (meters: number) => void;
  onRetry: () => void;
  onAsk: (candidate: OpportunityCandidate) => void;
  onDismiss: (candidate: OpportunityCandidate) => void;
  onSnooze: (candidate: OpportunityCandidate) => void;
  onDeclineInvite: (candidate: OpportunityCandidate) => void;
  onOpenRoute: (candidate: OpportunityCandidate) => void;
  onBack: () => void;
}

export function ReconnectTodayScreen({
  candidates,
  loadError,
  radiusM,
  adviceById,
  onRadiusChange,
  onRetry,
  onAsk,
  onDismiss,
  onSnooze,
  onDeclineInvite,
  onOpenRoute,
  onBack,
}: ReconnectTodayScreenProps) {
  return (
    <section className="screen" aria-label="Reconnect today">
      <PrototypeBanner />
      <header className="sub-header">
        <button type="button" className="back-link" onClick={onBack}>
          ← Back
        </button>
        <h1>Reconnect today</h1>
      </header>
      <RadiusSelector
        value={radiusM}
        options={RADII_M}
        disabled={candidates === null && !loadError}
        onChange={onRadiusChange}
      />
      {candidates === null && !loadError && (
        <p className="radar-state" role="status">
          Finding nearby candidates…
        </p>
      )}
      {loadError && (
        <div className="radar-alert">
          <p role="alert">Could not load reconnect candidates.</p>
          <button type="button" className="retry-btn" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
      {candidates !== null && candidates.length === 0 && (
        <p className="radar-state" role="status">
          Nobody nearby to reconnect with right now.
        </p>
      )}
      {candidates !== null &&
        candidates.map((candidate) => {
          const slot = adviceById[candidate.id] ?? { state: 'not_requested' as const, advice: null, notice: null };
          return (
            <AskAiPanel
              key={candidate.id}
              candidate={candidate}
              state={slot.state}
              advice={slot.advice}
              notice={slot.notice}
              onAsk={() => onAsk(candidate)}
              onDismiss={() => onDismiss(candidate)}
              onSnooze={() => onSnooze(candidate)}
              onDeclineInvite={() => onDeclineInvite(candidate)}
              onOpenRoute={() => onOpenRoute(candidate)}
            />
          );
        })}
    </section>
  );
}
