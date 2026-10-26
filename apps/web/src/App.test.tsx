import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App';

describe('Near-Circle Phase 1 UI', () => {
  it('renders the inbox with seeded friends and the entry point', () => {
    render(<App />);
    expect(screen.getByText('Chats')).toBeInTheDocument();
    expect(screen.getByText('Coleen')).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText('Sam')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open Near-Circle' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Unofficial prototype/)).toBeInTheDocument();
  });

  it('opens the radar when Open Near-Circle is pressed', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Near-Circle' }));
    expect(screen.getByLabelText('Nearby friends radar preview')).toBeInTheDocument();
    expect(screen.getByText('YOU')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Coleen' })).toBeInTheDocument();
  });

  it('selects a friend dot and reaches the honest route stub', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Near-Circle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select Coleen' }));
    expect(screen.getByText('Near-Circle enabled')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'View walking route' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View walking route' }));
    expect(screen.getByLabelText('Walking route')).toBeInTheDocument();
    expect(screen.getByText(/not connected yet/)).toBeInTheDocument();
  });

  it('toggles visibility state and label', () => {
    render(<App />);
    const toggle = screen.getByRole('switch', { name: 'Near-Circle visibility' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/appear on friends’ radar/)).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/hidden from the radar/)).toBeInTheDocument();
  });

  it('degrades gracefully when the API is unreachable', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('API unreachable')).toBeInTheDocument();
    });
  });
});
