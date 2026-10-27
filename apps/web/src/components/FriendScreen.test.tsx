import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FriendScreen } from './FriendScreen';
import type { FriendDetail, OpportunityCandidate } from '../types';
import type { CandidateAdvice } from './ReconnectTodayScreen';

const DETAIL: FriendDetail = {
  id: 'coleen',
  display_name: 'Coleen',
  near_circle_enabled: true,
  discoverable: true,
  distance_m: 280.1,
  bearing_deg: 45,
};

const CANDIDATE: OpportunityCandidate = {
  id: 'coleen',
  display_name: 'Coleen',
  distance_m: 280.1,
  bearing_deg: 45,
  walk_minutes: null,
  closeness: { level: 5, level_source: 'demo_profile' },
  context: 'Nearby and available for discovery',
};

const NOT_REQUESTED: CandidateAdvice = { state: 'not_requested', advice: null, notice: null };

function baseProps(overrides: Partial<Parameters<typeof FriendScreen>[0]> = {}) {
  return {
    detail: DETAIL,
    loadError: false,
    onViewRoute: () => undefined,
    onBack: () => undefined,
    onRetry: () => undefined,
    insight: null,
    insightError: false,
    reassessmentPending: false,
    overrideSaving: false,
    onRetryInsight: () => undefined,
    onRequestReassessment: () => undefined,
    onSaveOverride: () => undefined,
    askCandidate: CANDIDATE,
    askAdvice: NOT_REQUESTED,
    onAskAdvice: () => undefined,
    onDismissAdvice: () => undefined,
    onSnoozeAdvice: () => undefined,
    onDeclineAdviceInvite: () => undefined,
    onOpenAdviceRoute: () => undefined,
    ...overrides,
  };
}

describe('FriendScreen meetup suggestion', () => {
  it('shows the catch-up teaser and Ask action after Circle Insight', () => {
    render(<FriendScreen {...baseProps()} />);
    const insightHead = screen.getByText('Your Circle with Coleen');
    const teaserHead = screen.getByText('✨ Fancy catching up today?');
    expect(insightHead.compareDocumentPosition(teaserHead) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      screen.getByText(/Ask Meta AI for a thoughtful suggestion about reconnecting with Coleen/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask Meta AI' })).toBeInTheDocument();
  });

  it('asks with the selected friend identity preserved', () => {
    const onAskAdvice = vi.fn();
    render(<FriendScreen {...baseProps({ onAskAdvice })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask Meta AI' }));
    expect(onAskAdvice).toHaveBeenCalledTimes(1);
    expect(onAskAdvice).toHaveBeenCalledWith(CANDIDATE);
  });

  it('shows a privacy-safe note with no Ask action when advice is unavailable', () => {
    render(<FriendScreen {...baseProps({ askCandidate: null })} />);
    expect(screen.getByText('✨ Fancy catching up today?')).toBeInTheDocument();
    expect(
      screen.getByText("AI suggestions aren't available for Coleen right now."),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ask Meta AI' })).not.toBeInTheDocument();
  });

  it('renders no suggestion section while the friend is still loading', () => {
    render(<FriendScreen {...baseProps({ detail: null, askCandidate: null })} />);
    expect(screen.queryByText('✨ Fancy catching up today?')).not.toBeInTheDocument();
  });

  it('shows the friend photo on the detail card and the suggestion panel', () => {
    const { container } = render(<FriendScreen {...baseProps()} />);
    expect(container.querySelectorAll('img[src="/img/Coleen.jpg"]').length).toBe(2);
  });
});
