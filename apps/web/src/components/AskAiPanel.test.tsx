import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AskAiPanel } from './AskAiPanel';
import type { AdviceResult, AskPanelState, OpportunityCandidate } from '../types';

const CANDIDATE: OpportunityCandidate = {
  id: 'alex',
  display_name: 'Alex',
  distance_m: 750.3,
  bearing_deg: 170,
  walk_minutes: 10,
  closeness: { level: 4, level_source: 'demo_profile' },
  context: 'Nearby and available for discovery',
};

const ADVICE: AdviceResult = {
  outcome: 'suggest',
  reason: 'Alex is nearby and you both shared availability.',
  activity: 'coffee',
  invitation_draft: 'Hey Alex! Coffee today? No pressure!',
  source: 'demo_fixture',
  model_id: null,
  generated_at: '2026-06-01T12:00:00.000Z',
  trace_id: 'trace-1',
};

function baseProps(overrides: Partial<Parameters<typeof AskAiPanel>[0]> = {}) {
  return {
    candidate: CANDIDATE,
    state: 'not_requested' as AskPanelState,
    advice: null,
    notice: null,
    onAsk: () => undefined,
    onDismiss: () => undefined,
    onSnooze: () => undefined,
    onDeclineInvite: () => undefined,
    onOpenRoute: () => undefined,
    ...overrides,
  };
}

describe('AskAiPanel', () => {
  it('offers to ask and shows candidate facts only', () => {
    render(<AskAiPanel {...baseProps()} />);
    expect(screen.getByRole('button', { name: 'Ask Meta AI' })).toBeInTheDocument();
    expect(screen.getByText(/About 750 m away/)).toBeInTheDocument();
    expect(screen.queryByText(/Worth asking today/)).not.toBeInTheDocument();
  });

  it('shows a consulting state while the request is in flight', () => {
    render(<AskAiPanel {...baseProps({ state: 'consulting' })} />);
    expect(screen.getByText('Consulting the model for Alex…')).toBeInTheDocument();
  });

  it('renders a suggestion with labeled provenance and an editable draft', () => {
    const onDeclineInvite = vi.fn();
    render(<AskAiPanel {...baseProps({ state: 'suggest', advice: ADVICE, onDeclineInvite })} />);
    expect(screen.getByText('Worth asking today')).toBeInTheDocument();
    expect(screen.getByText('Demo suggestion')).toBeInTheDocument();
    const draft = screen.getByLabelText('Editable invitation (nothing is sent)') as HTMLTextAreaElement;
    expect(draft.value).toContain('Hey Alex! Coffee today?');
    fireEvent.change(draft, { target: { value: 'Edited draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm invitation' }));
    expect(screen.getByText(/Invitation ready: “Edited draft”/)).toBeInTheDocument();
    expect(screen.getByText(/Prototype powered by Muse Spark 1.3/)).toBeInTheDocument();
  });

  it('regenerates the draft back to the suggested text', () => {
    render(<AskAiPanel {...baseProps({ state: 'suggest', advice: ADVICE })} />);
    const draft = screen.getByLabelText('Editable invitation (nothing is sent)') as HTMLTextAreaElement;
    fireEvent.change(draft, { target: { value: 'Edited draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate draft' }));
    expect((screen.getByLabelText('Editable invitation (nothing is sent)') as HTMLTextAreaElement).value).toContain(
      'Hey Alex! Coffee today?',
    );
  });

  it('renders later and insufficient states without a composer', () => {
    render(
      <AskAiPanel
        {...baseProps({
          state: 'later',
          advice: { ...ADVICE, outcome: 'later', invitation_draft: null },
        })}
      />,
    );
    expect(screen.getByText('Maybe another time')).toBeInTheDocument();
    expect(screen.queryByLabelText('Editable invitation (nothing is sent)')).not.toBeInTheDocument();
  });

  it('renders unavailable and error states with retry', () => {
    const onAsk = vi.fn();
    const { rerender } = render(<AskAiPanel {...baseProps({ state: 'unavailable', onAsk })} />);
    expect(screen.getByText(/AI is unavailable right now/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onAsk).toHaveBeenCalledTimes(1);
    rerender(<AskAiPanel {...baseProps({ state: 'error', notice: 'AI budget reached for now — try again later.', onAsk })} />);
    expect(screen.getByText(/AI budget reached/)).toBeInTheDocument();
  });

  it('wires dismiss, snooze, decline and route actions', () => {
    const onDismiss = vi.fn();
    const onSnooze = vi.fn();
    const onDeclineInvite = vi.fn();
    const onOpenRoute = vi.fn();
    render(
      <AskAiPanel
        {...baseProps({ state: 'suggest', advice: ADVICE, onDismiss, onSnooze, onDeclineInvite, onOpenRoute })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Snooze' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    fireEvent.click(screen.getByRole('button', { name: 'View walking route' }));
    expect(onSnooze).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDeclineInvite).toHaveBeenCalledTimes(1);
    expect(onOpenRoute).toHaveBeenCalledTimes(1);
  });
});
