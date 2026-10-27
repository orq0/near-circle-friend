import type { NearbyFriend, RadarStatus } from '../types';
import { CURRENT_USER } from '../mockData';
import { RADII_M, formatDistance, positionOnRadar } from '../radar';
import { PrototypeBanner } from './PrototypeBanner';
import { RadiusSelector } from './RadiusSelector';

const RING_FRACTIONS = [0.25, 0.5, 0.75] as const;

interface RadarScreenProps {
  status: RadarStatus;
  friends: NearbyFriend[];
  radiusM: number;
  onRadiusChange: (meters: number) => void;
  onSelectFriend: (friend: NearbyFriend) => void;
  onRetry: () => void;
  onEnable: () => void;
  onBack: () => void;
  onOpenReconnect: () => void;
  onOpenAiSettings: () => void;
}

export function RadarScreen({
  status,
  friends,
  radiusM,
  onRadiusChange,
  onSelectFriend,
  onRetry,
  onEnable,
  onBack,
  onOpenReconnect,
  onOpenAiSettings,
}: RadarScreenProps) {
  return (
    <section className="screen" aria-label="Near-Circle radar">
      <PrototypeBanner />
      <header className="sub-header">
        <button type="button" className="back-link" onClick={onBack}>
          ← Chats
        </button>
        <h1>Near-Circle radar</h1>
      </header>
      <RadiusSelector
        value={radiusM}
        options={RADII_M}
        disabled={status === 'loading'}
        onChange={onRadiusChange}
      />
      <div className="radar-wrap">
        <div className="radar" role="group" aria-label="Nearby friends radar">
          {RING_FRACTIONS.map((fraction) => (
            <span
              key={fraction}
              className="ring"
              style={{ inset: `${(1 - fraction) * 50}%` }}
              aria-hidden="true"
            />
          ))}
          <span className="sweep" aria-hidden="true" />
          <span className="you-dot" title="You are at the center">
            {CURRENT_USER.initial}
            <span className="you-label">YOU</span>
          </span>
          {status === 'ready' &&
            friends.map((friend) => {
              const point = positionOnRadar(friend.distance_m, friend.bearing_deg, radiusM);
              return (
                <button
                  key={friend.id}
                  type="button"
                  className="friend-dot"
                  style={{ left: `${point.xPct}%`, top: `${point.yPct}%` }}
                  aria-label={`Select ${friend.display_name}`}
                  title={`${friend.display_name} — ${formatDistance(friend.distance_m)}`}
                  onClick={() => onSelectFriend(friend)}
                >
                  {friend.display_name.charAt(0)}
                </button>
              );
            })}
        </div>
      </div>
      {status === 'loading' && (
        <p className="radar-state" role="status">
          Scanning for nearby friends…
        </p>
      )}
      {status === 'ready' && (
        <p className="radar-state" role="status">
          {friends.length === 1
            ? '1 friend within '
            : `${friends.length} friends within `}
          {formatDistance(radiusM)}.
        </p>
      )}
      {status === 'empty' && (
        <p className="radar-state" role="status">
          No friends within {formatDistance(radiusM)} — try a larger radius.
        </p>
      )}
      {status === 'error' && (
        <div className="radar-alert">
          <p role="alert">Could not load nearby friends.</p>
          <button type="button" className="retry-btn" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
      {status === 'disabled' && (
        <div className="radar-alert">
          <p>Near-Circle is off — discovery is paused.</p>
          <button type="button" className="retry-btn" onClick={onEnable}>
            Turn on Near-Circle
          </button>
        </div>
      )}
      <p className="radar-rule">
        Dots show real PostGIS distance and bearing around Metro Manila demo
        locations. Simulated identities; genuine proximity math.
      </p>
      <div className="insight-actions">
        <button type="button" className="secondary-cta" onClick={onOpenReconnect}>
          Reconnect today
        </button>
        <button type="button" className="secondary-cta" onClick={onOpenAiSettings}>
          AI Circle settings
        </button>
      </div>
    </section>
  );
}
