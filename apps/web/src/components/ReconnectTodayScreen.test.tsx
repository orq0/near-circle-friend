import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ReconnectTodayScreen } from './ReconnectTodayScreen';
import type { OpportunityCandidate } from '../types';

const CANDIDATES: OpportunityCandidate[] = [
  {
    id: 'alex',
    display_name: 'Alex',
    distance_m: 750.3,
    bearing_deg: 170,
    walk_minutes: 10,
    closeness: { level: 4, level_source: 'demo_profile' },
    context: 'Nearby and available for discovery',
  },
];

function baseProps(overrides: Partial<Parameters<typeof ReconnectTodayScreen>[0]> = {}) {
  return {
    candidates: null as OpportunityCandidate[] | null,
    loadError: false,
    radiusM: 1000,
    adviceById: {},
    onRadiusChange: () => undefined,
    onRetry: () => undefined,
    onAsk: () => undefined,
    onDismiss: () => undefined,
    onSnooze: () => undefined,
    onDeclineInvite: () => undefined,
    onOpenRoute: () => undefined,
    onBack: () => undefined,
    ...overrides,
  };
}

describe('ReconnectTodayScreen', () => {
  it('shows loading, empty and error states', () => {
    const { rerender } = render(<ReconnectTodayScreen {...baseProps()} />);
    expect(screen.getByText('Finding nearby candidates…')).toBeInTheDocument();
    rerender(<ReconnectTodayScreen {...baseProps({ candidates: [] })} />);
    expect(screen.getByText('Nobody nearby to reconnect with right now.')).toBeInTheDocument();
    const onRetry = vi.fn();
    rerender(<ReconnectTodayScreen {...baseProps({ loadError: true, onRetry })} />);
    expect(screen.getByText('Could not load reconnect candidates.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders one advice panel per candidate with ask wiring', () => {
    const onAsk = vi.fn();
    const onBack = vi.fn();
    render(<ReconnectTodayScreen {...baseProps({ candidates: CANDIDATES, onAsk, onBack })} />);
    expect(screen.getByRole('heading', { name: 'Reconnect today' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ask Meta AI' }));
    expect(onAsk).toHaveBeenCalledTimes(1);
    expect(onAsk).toHaveBeenCalledWith(CANDIDATES[0]);
    fireEvent.click(screen.getByRole('button', { name: '← Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
