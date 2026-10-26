import type { Friend } from '../types';
import { PrototypeBanner } from './PrototypeBanner';

interface FriendScreenProps {
  friend: Friend;
  onViewRoute: () => void;
  onBack: () => void;
}

export function FriendScreen({ friend, onViewRoute, onBack }: FriendScreenProps) {
  return (
    <section className="screen" aria-label="Selected friend">
      <PrototypeBanner />
      <header className="sub-header">
        <button type="button" className="back-link" onClick={onBack}>
          ← Radar
        </button>
        <h1>Friend</h1>
      </header>
      <div className="friend-card">
        <span className="avatar large" aria-hidden="true">
          {friend.initial}
        </span>
        <h2>{friend.name}</h2>
        <p className="enabled-line">
          <span className="enabled-dot" aria-hidden="true" />
          Near-Circle enabled
        </p>
        <p className="proximity-line">Nearby within your discovery radius.</p>
        <p className="consent-note">
          Precise destination access requires the applicable consent.
        </p>
        <button type="button" className="primary-cta" onClick={onViewRoute}>
          View walking route
        </button>
      </div>
    </section>
  );
}
