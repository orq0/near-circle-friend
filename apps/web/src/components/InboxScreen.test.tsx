import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { InboxScreen } from './InboxScreen';
import type { Friend } from '../types';

const FRIENDS: Friend[] = [
  {
    id: 'coleen',
    name: 'Coleen',
    initial: 'C',
    status: 'online',
    statusLabel: 'Active now',
    preview: 'See you!',
  },
];

function baseProps(overrides: Partial<Parameters<typeof InboxScreen>[0]> = {}) {
  return {
    friends: FRIENDS,
    selectedId: 'coleen',
    visibility: null,
    visibilityError: false,
    visibilityLoadError: false,
    onRetryVisibility: () => undefined,
    apiHealthy: true,
    friendStatus: null,
    chatOpen: false,
    onSelectConversation: () => undefined,
    onBackToList: () => undefined,
    onVisibilityChange: () => undefined,
    onOpenNearCircle: () => undefined,
    ...overrides,
  };
}

// Regression: commit 61998a6 referenced `visibilityLoadError` and
// `onRetryVisibility` in the body without destructuring them, so every
// render threw ReferenceError and the app showed a blank white screen.
// These cases render the component directly through each visibility state.
describe('InboxScreen visibility loading', () => {
  it('shows the loading state while visibility is pending', () => {
    render(<InboxScreen {...baseProps()} />);
    expect(screen.getByText('Loading Near-Circle status…')).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Near-Circle visibility' })).not.toBeInTheDocument();
  });

  it('shows the error state with a working retry when visibility failed to load', () => {
    const onRetryVisibility = vi.fn();
    render(<InboxScreen {...baseProps({ visibilityLoadError: true, onRetryVisibility })} />);
    expect(
      screen.getByText('Could not load Near-Circle status. Check the API connection, then retry.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Loading Near-Circle status…')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetryVisibility).toHaveBeenCalledTimes(1);
  });

  it('shows the visibility toggle once visibility has loaded', () => {
    render(<InboxScreen {...baseProps({ visibility: { enabled: true, radius_m: 1000 } })} />);
    expect(screen.getByRole('switch', { name: 'Near-Circle visibility' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.queryByText('Loading Near-Circle status…')).not.toBeInTheDocument();
  });
});
