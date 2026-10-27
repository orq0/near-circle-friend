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

const EMPTY_FIXTURE: CircleInsightData = {
  level: null,
  level_label: 'Not enough information',
  level_source: 'none',
  evidence_quality: 'limited',
  rationale: 'Not enough interaction history to estimate closeness.',
  activity_trend: 'unknown',
  assessed_at: null,
  model_id: null,
  override: null,
  ai_enabled: true,
};

function baseProps(overrides: Partial<Parameters<typeof CircleInsight>[0]> = {}) {
  return {
    friendName: 'Alex',
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
    expect(screen.getByText('Learning about your circle…')).toBeInTheDocument();
  });

  it('shows an error state with retry when loading fails', () => {
    const onRetry = vi.fn();
    render(<CircleInsight {...baseProps({ loadError: true, onRetry })} />);
    expect(screen.getByText("We couldn't load your circle right now.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('titles the card with the friend name', () => {
    render(<CircleInsight {...baseProps({ insight: FIXTURE, friendName: 'Coleen' })} />);
    expect(screen.getByText('Your Circle with Coleen')).toBeInTheDocument();
  });

  it('renders the stored estimate with explicit demo provenance', () => {
    render(<CircleInsight {...baseProps({ insight: FIXTURE })} />);
    expect(screen.getByText('Close Friend')).toBeInTheDocument();
    expect(screen.getByText('Demo profile')).toBeInTheDocument();
    expect(screen.getByText('Longstanding reciprocal friendship.')).toBeInTheDocument();
    expect(screen.getByText('Your connection lately: Picking up')).toBeInTheDocument();
  });

  it('keeps evidence details behind the How-was-this-determined disclosure', () => {
    render(<CircleInsight {...baseProps({ insight: FIXTURE })} />);
    expect(screen.getByText('How was this determined?')).toBeInTheDocument();
    expect(screen.queryByText(/Evidence quality: moderate/)).toBeInTheDocument();
    expect(screen.queryByText(/Assessed /)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: '✨ Refresh insight' }));
    expect(onRequestReassessment).toHaveBeenCalledTimes(1);
  });

  it('saves a manual tier override through descriptive choices', () => {
    const onSaveOverride = vi.fn();
    render(<CircleInsight {...baseProps({ insight: FIXTURE, onSaveOverride })} />);
    fireEvent.click(screen.getByRole('button', { name: '💛 My view of our friendship' }));
    expect(screen.getByText('How would you describe your friendship?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '👋 Casual Friend' }));
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
    fireEvent.click(screen.getByRole('button', { name: '💛 My view of our friendship' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear my view' }));
    expect(onSaveOverride).toHaveBeenCalledWith(null);
  });

  it('shows a warm empty state without an estimate when context is missing', () => {
    render(<CircleInsight {...baseProps({ insight: EMPTY_FIXTURE })} />);
    expect(screen.getByText('Every friendship has its own story.')).toBeInTheDocument();
    expect(
      screen.getByText(/We don't have enough information yet to offer a meaningful insight/),
    ).toBeInTheDocument();
    expect(screen.queryByText('No estimate')).not.toBeInTheDocument();
  });

  it('lets users share their view from the empty state', () => {
    const onSaveOverride = vi.fn();
    render(<CircleInsight {...baseProps({ insight: EMPTY_FIXTURE, onSaveOverride })} />);
    fireEvent.click(screen.getByRole('button', { name: '💛 My view of our friendship' }));
    fireEvent.click(screen.getByRole('button', { name: '😊 Regular Friend' }));
    expect(onSaveOverride).toHaveBeenCalledWith(3);
  });
});
