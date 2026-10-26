import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App';

const realFetch = globalThis.fetch;

interface MockRoutes {
  visibility?: unknown;
  nearby?: (radius: string) => unknown;
  friends?: unknown;
  detail?: unknown;
  health?: unknown;
  putVisibility?: (body: { enabled: boolean }) => unknown;
  failUrls?: string[];
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const DEFAULT_NEARBY = {
  demo: true,
  center: { lat: 14.581, lon: 120.975 },
  radius_m: 1000,
  count: 2,
  friends: [
    { id: 'coleen', display_name: 'Coleen', distance_m: 280.1, bearing_deg: 45 },
    { id: 'alex', display_name: 'Alex', distance_m: 750.3, bearing_deg: 170 },
  ],
};

const DEFAULT_DETAIL = {
  demo: true,
  id: 'coleen',
  display_name: 'Coleen',
  near_circle_enabled: true,
  discoverable: true,
  distance_m: 280.1,
  bearing_deg: 45,
};

function installFetch(routes: MockRoutes = {}, requested: string[] = []) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requested.push(`${init?.method ?? 'GET'} ${url}`);
    if ((routes.failUrls ?? []).some((fragment) => url.includes(fragment))) {
      throw new Error('network down');
    }
    if (url.endsWith('/health')) {
      return jsonResponse(routes.health ?? { status: 'ok' });
    }
    if (url.includes('/near-circle/visibility') && init?.method === 'PUT') {
      const body = JSON.parse(String(init.body)) as { enabled: boolean };
      return jsonResponse(
        routes.putVisibility !== undefined
          ? routes.putVisibility(body)
          : { enabled: body.enabled, radius_m: 1000 },
      );
    }
    if (url.includes('/near-circle/visibility')) {
      return jsonResponse(routes.visibility ?? { enabled: true, radius_m: 1000 });
    }
    if (url.includes('/friends/nearby')) {
      const radius = new URL(url, 'http://test').searchParams.get('radius_m') ?? '1000';
      return jsonResponse(routes.nearby !== undefined ? routes.nearby(radius) : DEFAULT_NEARBY);
    }
    if (url.includes('/friends/') && !url.endsWith('/friends')) {
      return jsonResponse(routes.detail ?? DEFAULT_DETAIL);
    }
    if (url.endsWith('/friends')) {
      return jsonResponse(routes.friends ?? { demo: true, friends: [] });
    }
    return jsonResponse({}, 404);
  }) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('Near-Circle Phase 2 UI', () => {
  it('renders the messenger inbox with conversations and entry point', async () => {
    installFetch();
    render(<App />);
    expect(await screen.findByText('Chats')).toBeInTheDocument();
    expect(screen.getByText('Coleen', { selector: '.convo-name' })).toBeInTheDocument();
    expect(screen.getByText('Coleen', { selector: '.chat-name' })).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText('Sam')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Near-Circle' })).toBeInTheDocument();
    expect(screen.getByText(/Unofficial prototype/)).toBeInTheDocument();
    expect(screen.getByText('Hey! Are we still on for Saturday?')).toBeInTheDocument();
  });

  it('switches conversations in the panel', async () => {
    installFetch();
    render(<App />);
    await screen.findByText('Chats');
    fireEvent.click(screen.getByText('Sent you a photo from the park.'));
    expect(screen.getByText('Great shot! The light is perfect today.')).toBeInTheDocument();
  });

  it('opens the radar with API-driven dots', async () => {
    installFetch();
    render(<App />);
    await screen.findByText('Chats');
    fireEvent.click(screen.getByRole('button', { name: 'Open Near-Circle' }));
    expect(await screen.findByRole('button', { name: 'Select Coleen' })).toBeInTheDocument();
    expect(screen.getByText('YOU')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Alex' })).toBeInTheDocument();
  });

  it('refetches when the radius changes', async () => {
    const requested: string[] = [];
    installFetch({}, requested);
    render(<App />);
    await screen.findByText('Chats');
    fireEvent.click(screen.getByRole('button', { name: 'Open Near-Circle' }));
    await screen.findByRole('button', { name: 'Select Coleen' });
    fireEvent.click(screen.getByRole('button', { name: '5 km' }));
    await waitFor(() => {
      expect(requested.includes('GET /api/friends/nearby?radius_m=5000')).toBe(true);
    });
  });

  it('selects a dot and shows friend detail with real distance', async () => {
    installFetch();
    render(<App />);
    await screen.findByText('Chats');
    fireEvent.click(screen.getByRole('button', { name: 'Open Near-Circle' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Select Coleen' }));
    expect(await screen.findByText('Near-Circle enabled')).toBeInTheDocument();
    expect(screen.getByText('About 280 m away.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View walking route' }));
    expect(screen.getByLabelText('Walking route')).toBeInTheDocument();
    expect(screen.getByText(/not connected yet/)).toBeInTheDocument();
  });

  it('toggles visibility through the API and gates the radar', async () => {
    const requested: string[] = [];
    installFetch(
      {
        putVisibility: (body) => ({ enabled: body.enabled, radius_m: 1000 }),
      },
      requested,
    );
    render(<App />);
    const toggle = await screen.findByRole('switch', { name: 'Near-Circle visibility' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    });
    expect(requested.some((entry) => entry.startsWith('PUT /api/near-circle/visibility'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Open Near-Circle' }));
    expect(await screen.findByText('Turn on Near-Circle')).toBeInTheDocument();
  });

  it('shows an empty state when nobody is in range', async () => {
    installFetch({
      nearby: (radius) => ({ demo: true, center: { lat: 14.581, lon: 120.975 }, radius_m: Number(radius), count: 0, friends: [] }),
    });
    render(<App />);
    await screen.findByText('Chats');
    fireEvent.click(screen.getByRole('button', { name: 'Open Near-Circle' }));
    expect(await screen.findByText(/No friends within 1 km/)).toBeInTheDocument();
  });

  it('degrades gracefully when the API is unreachable', async () => {
    installFetch({ failUrls: ['/api/'] });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('API unreachable')).toBeInTheDocument();
    });
  });
});
