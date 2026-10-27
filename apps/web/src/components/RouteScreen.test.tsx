import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RouteScreen } from './RouteScreen';
import type { FriendRouteInfo } from '../types';

const ROUTE: FriendRouteInfo = {
  to: { id: 'coleen', display_name: 'Coleen' },
  center: { lat: 14.581, lon: 120.975 },
  target: { lat: 14.5828, lon: 120.9768 },
  geometry: {
    type: 'LineString',
    coordinates: [
      [120.975, 14.581],
      [120.976, 14.582],
      [120.9768, 14.5828],
    ],
  },
  route_distance_m: 340.5,
  straight_line_m: 280.1,
  duration_s: 245,
  estimated_steps: 454,
  stride_m: 0.75,
};

describe('RouteScreen', () => {
  it('renders the map with route stats and the straight-line comparison', () => {
    render(
      <RouteScreen
        displayName="Coleen"
        status="ready"
        route={ROUTE}
        onRetry={() => undefined}
        onBack={() => undefined}
      />,
    );
    expect(screen.getByRole('application', { name: 'Walking route map to Coleen' })).toBeInTheDocument();
    expect(screen.getByText('341 m')).toBeInTheDocument();
    expect(screen.getByText('4 min')).toBeInTheDocument();
    expect(screen.getByText('454')).toBeInTheDocument();
    expect(screen.getByText(/341 m on foot versus/)).toBeInTheDocument();
    expect(screen.getByText(/280 m straight line/)).toBeInTheDocument();
  });

  it('shows a loading state while calculating', () => {
    render(
      <RouteScreen
        displayName="Coleen"
        status="loading"
        route={null}
        onRetry={() => undefined}
        onBack={() => undefined}
      />,
    );
    expect(screen.getByText('Calculating walking route…')).toBeInTheDocument();
  });

  it('shows an honest unavailable state without fabricated geometry', () => {
    render(
      <RouteScreen
        displayName="Coleen"
        status="unavailable"
        route={null}
        onRetry={() => undefined}
        onBack={() => undefined}
      />,
    );
    expect(screen.getByText('No walking route available.')).toBeInTheDocument();
    expect(screen.queryByRole('application')).not.toBeInTheDocument();
  });

  it('shows an error state with a working retry', () => {
    let calls = 0;
    render(
      <RouteScreen
        displayName="Coleen"
        status="error"
        route={null}
        onRetry={() => {
          calls += 1;
        }}
        onBack={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(calls).toBe(1);
  });
});
