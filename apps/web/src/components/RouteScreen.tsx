import { PrototypeBanner } from './PrototypeBanner';

interface RouteScreenProps {
  displayName: string;
  onBack: () => void;
}

// Screen structure only. Pedestrian routing, ETA, and step estimates
// are computed by the walking engine in Phase 3 — nothing here is live data.
export function RouteScreen({ displayName, onBack }: RouteScreenProps) {
  return (
    <section className="screen" aria-label="Walking route">
      <PrototypeBanner />
      <header className="sub-header">
        <button type="button" className="back-link" onClick={onBack}>
          ← {displayName}
        </button>
        <h1>Walking route</h1>
      </header>
      <div className="map-stub" role="img" aria-label="Street map placeholder">
        <span>Street-map preview arrives with Phase 3 routing</span>
      </div>
      <dl className="stat-row">
        <div className="stat">
          <dt>Distance</dt>
          <dd>—</dd>
        </div>
        <div className="stat">
          <dt>Walk time</dt>
          <dd>—</dd>
        </div>
        <div className="stat">
          <dt>Steps</dt>
          <dd>—</dd>
        </div>
      </dl>
      <p className="phase-note">
        Walking-route engine is not connected yet. Distance, ETA, and steps will
        be calculated from the pedestrian router in Phase 3.
      </p>
    </section>
  );
}
