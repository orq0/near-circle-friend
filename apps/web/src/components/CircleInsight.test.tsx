import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CircleInsight } from './CircleInsight';
import type { CircleInsight as CircleInsightData } from '../types';

const FIXTURE: CircleInsightData = {
  level: 4,
  level_label: 'Close Friend',
  level_source: 'demo_profile',
  evidence_quality: 'moderate',
  rationale: 'Longstanding reciprocal friendship.',
  activity_trend: 'increasing',
  assessed_at: '2026-05-01T12:00:00.000Z',
  model_id: null,
  override: null,
  ai_enabled: true,
};

function baseProps(overrides: Partial<Parameters<typeof CircleInsight>[0]> = {}) {
  return {
    insight: null as CircleInsightData | null,
    loadError: false,
    requestPending: false,
    overrideSaving: false,
    onRetry: () => undefined,
    onRequestReassessment: () => undefined,
    onSaveOverride: () => undefined,
    ...overrides,
  };
}

describe('CircleInsight', () => {
  it('shows a loading state while the profile loads', () => {
    render(<CircleInsight {...baseProps()} />);
    expect(screen.getByText('Loading circle insight…')).toBeInTheDocument();
  });

  it('shows an error state with retry when loading fails', () => {
    const onRetry = vi.fn();
    render(<CircleInsight {...baseProps({ loadError: true, onRetry })} />);
    expect(screen.getByText('Could not load circle insight.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders the stored estimate with explicit demo provenance', () => {
    render(<CircleInsight {...baseProps({ insight: FIXTURE })} />);
    expect(screen.getByText('Close Friend')).toBeInTheDocument();
    expect(screen.getByText('Demo profile')).toBeInTheDocument();
    expect(screen.getByText('Longstanding reciprocal friendship.')).toBeInTheDocument();
    expect(screen.getByText(/Evidence: moderate/)).toBeInTheDocument();
  });

  it('renders a user override first with the stored context beneath', () => {
    render(
      <CircleInsight
        {...baseProps({ insight: { ...FIXTURE, level: 5, level_label: 'Inner Circle', level_source: 'user_choice', override: { level: 5, updated_at: null } } })}
      />,
    );
    expect(screen.getByText('Inner Circle')).toBeInTheDocument();
    expect(screen.getByText('Your choice')).toBeInTheDocument();
  });

  it('requests reassessment through the callback', () => {
    const onRequestReassessment = vi.fn();
    render(<CircleInsight {...baseProps({ insight: FIXTURE, onRequestReassessment })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Request reassessment' }));
    expect(onRequestReassessment).toHaveBeenCalledTimes(1);
  });

  it('saves and clears a manual tier override', () => {
    const onSaveOverride = vi.fn();
    render(<CircleInsight {...baseProps({ insight: FIXTURE, onSaveOverride })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Set my tier' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(onSaveOverride).toHaveBeenCalledWith(2);
  });

  it('offers clearing when an override exists', () => {
    const onSaveOverride = vi.fn();
    render(
      <CircleInsight
        {...baseProps({
          insight: { ...FIXTURE, override: { level: 5, updated_at: null } },
          onSaveOverride,
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Change my tier' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onSaveOverride).toHaveBeenCalledWith(null);
  });
});
