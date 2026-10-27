import type { FriendDetail } from '../types';
import { formatDistance } from '../radar';
import { PrototypeBanner } from './PrototypeBanner';

interface FriendScreenProps {
  detail: FriendDetail | null;
  loadError: boolean;
  onViewRoute: () => void;
  onBack: () => void;
  onRetry: () => void;
}

export function FriendScreen({ detail, loadError, onViewRoute, onBack, onRetry }: FriendScreenProps) {
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
          <span className="avatar large" aria-hidden="true">
            {detail.display_name.charAt(0)}
          </span>
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
    </section>
  );
}
