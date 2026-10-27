import type { FriendRouteInfo, RouteStatus } from '../types';
import { formatDistance, formatDuration } from '../radar';
import { PrototypeBanner } from './PrototypeBanner';
import { RouteMap } from './RouteMap';

interface RouteScreenProps {
  displayName: string;
  status: RouteStatus;
  route: FriendRouteInfo | null;
  onRetry: () => void;
  onBack: () => void;
}

export function RouteScreen({ displayName, status, route, onRetry, onBack }: RouteScreenProps) {
  return (
    <section className="screen" aria-label="Walking route">
      <PrototypeBanner />
      <header className="sub-header">
        <button type="button" className="back-link" onClick={onBack}>
          ← {displayName}
        </button>
        <h1>Walking route</h1>
      </header>
      {status === 'loading' && (
        <p className="radar-state" role="status">
          Calculating walking route…
        </p>
      )}
      {status === 'unavailable' && (
        <div className="radar-alert">
          <p>No walking route available.</p>
          <p className="alert-sub">
            The friend may be outside your radius, have revoked access, or be
            unreachable on foot from here.
          </p>
        </div>
      )}
      {status === 'error' && (
        <div className="radar-alert">
          <p role="alert">Could not load the walking route.</p>
          <button type="button" className="retry-btn" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
      {status === 'ready' && route !== null && (
        <>
          <RouteMap route={route} />
          <dl className="stat-row">
            <div className="stat">
              <dt>On foot</dt>
              <dd>{formatDistance(route.route_distance_m)}</dd>
            </div>
            <div className="stat">
              <dt>Walk time</dt>
              <dd>{formatDuration(route.duration_s)}</dd>
            </div>
            <div className="stat">
              <dt>Steps (est.)</dt>
              <dd>{route.estimated_steps.toLocaleString('en-US')}</dd>
            </div>
          </dl>
          <p className="route-compare">
            About {formatDistance(route.route_distance_m)} on foot versus{' '}
            {formatDistance(route.straight_line_m)} straight line.
          </p>
          <p className="phase-note">
            Route, time, and steps computed by the pedestrian router. Step count
            is an estimate from a {route.stride_m} m stride.
          </p>
        </>
      )}
    </section>
  );
}
