import type { Friend } from '../types';
import { CURRENT_USER } from '../mockData';
import { PrototypeBanner } from './PrototypeBanner';

// Phase 1 preview layout. Positions are illustrative placeholders:
// real dot placement from PostGIS distance + bearing arrives in Phase 2.
const PREVIEW_SPOTS = [
  { left: '64%', top: '30%' },
  { left: '30%', top: '58%' },
  { left: '66%', top: '68%' },
] as const;

interface RadarScreenProps {
  friends: Friend[];
  onSelectFriend: (friend: Friend) => void;
  onBack: () => void;
}

export function RadarScreen({ friends, onSelectFriend, onBack }: RadarScreenProps) {
  return (
    <section className="screen" aria-label="Near-Circle radar">
      <PrototypeBanner />
      <header className="sub-header">
        <button type="button" className="back-link" onClick={onBack}>
          ← Chats
        </button>
        <h1>Near-Circle radar</h1>
      </header>
      <div className="radar-wrap">
        <div className="radar" role="group" aria-label="Nearby friends radar preview">
          <span className="ring ring-1" aria-hidden="true" />
          <span className="ring ring-2" aria-hidden="true" />
          <span className="sweep" aria-hidden="true" />
          <span className="you-dot" title="You are at the center">
            {CURRENT_USER.initial}
            <span className="you-label">YOU</span>
          </span>
          {friends.map((friend, index) => {
            const spot = PREVIEW_SPOTS[index % PREVIEW_SPOTS.length];
            return (
              <button
                key={friend.id}
                type="button"
                className="friend-dot"
                style={{ left: spot.left, top: spot.top }}
                aria-label={`Select ${friend.name}`}
                title={friend.name}
                onClick={() => onSelectFriend(friend)}
              >
                {friend.initial}
              </button>
            );
          })}
        </div>
      </div>
      <p className="radar-rule">
        Radar rule: you stay centered; only eligible, opted-in friends appear,
        positioned by distance and bearing.
      </p>
      <p className="phase-note">Preview layout — live positions arrive in Phase 2.</p>
    </section>
  );
}
