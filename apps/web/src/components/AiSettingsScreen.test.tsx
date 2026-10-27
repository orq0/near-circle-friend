import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AiSettingsScreen } from './AiSettingsScreen';
import type { CircleSettings } from '../types';

const SETTINGS: CircleSettings = {
  analysis_consent: true,
  advice_consent: false,
  availability_shared: false,
  quiet_start_min: null,
  quiet_end_min: null,
};

function baseProps(overrides: Partial<Parameters<typeof AiSettingsScreen>[0]> = {}) {
  return {
    settings: null as CircleSettings | null,
    loadError: false,
    saveError: false,
    saving: false,
    usage: null,
    onRetry: () => undefined,
    onSave: () => undefined,
    onBack: () => undefined,
    ...overrides,
  };
}

describe('AiSettingsScreen', () => {
  it('shows loading and error states', () => {
    const { rerender } = render(<AiSettingsScreen {...baseProps()} />);
    expect(screen.getByText('Loading AI Circle settings…')).toBeInTheDocument();
    const onRetry = vi.fn();
    rerender(<AiSettingsScreen {...baseProps({ loadError: true, onRetry })} />);
    expect(screen.getByText('Could not load AI Circle settings.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('toggles consents with explicit save patches', () => {
    const onSave = vi.fn();
    render(<AiSettingsScreen {...baseProps({ settings: SETTINGS, onSave })} />);
    fireEvent.click(screen.getByRole('switch', { name: 'AI friendship analysis' }));
    expect(onSave).toHaveBeenCalledWith({ analysis_consent: false });
    fireEvent.click(screen.getByRole('switch', { name: 'Meetup suggestions' }));
    expect(onSave).toHaveBeenCalledWith({ advice_consent: true });
    fireEvent.click(screen.getByRole('button', { name: 'Evenings off' }));
    expect(onSave).toHaveBeenCalledWith({ quiet_start_min: 1320, quiet_end_min: 480 });
  });

  it('shows usage counters and the model disclosure', () => {
    render(
      <AiSettingsScreen
        {...baseProps({
          settings: SETTINGS,
          usage: { model_requests: 4, cache_hits: 9, cache_misses: 5, input_tokens: 1000, output_tokens: 200, rate_limited: 1 },
        })}
      />,
    );
    expect(screen.getByText(/4 model calls/)).toBeInTheDocument();
    expect(screen.getByText(/9 served from recent results/)).toBeInTheDocument();
    expect(screen.getByText(/Prototype powered by Muse Spark 1.3/)).toBeInTheDocument();
  });

  it('explains revocation semantics', () => {
    render(<AiSettingsScreen {...baseProps({ settings: SETTINGS })} />);
    expect(screen.getByText(/purges derived suggestions/)).toBeInTheDocument();
  });
});
