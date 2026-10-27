import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App';

const realFetch = globalThis.fetch;

interface MockRoutes {
  visibility?: unknown;
  nearby?: (radius: string) => unknown;
  friends?: unknown;
  detail?: unknown;
  route?: unknown;
  health?: unknown;
  putVisibility?: (body: { enabled: boolean }) => unknown;
  opportunities?: unknown;
  advise?: unknown;
  adviseStatus?: number;
  closeness?: unknown;
  aiSettings?: unknown;
  putAiSettings?: (body: Record<string, unknown>) => unknown;
  aiUsage?: unknown;
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

const DEFAULT_AI_SETTINGS = {
  ai_enabled: true,
  settings: {
    analysis_consent: true,
    advice_consent: true,
    availability_shared: true,
    quiet_start_min: null,
    quiet_end_min: null,
  },
};

const DEFAULT_INSIGHT = {
  level: 4,
  level_label: 'Close Friend',
  level_source: 'demo_profile',
  evidence_quality: 'moderate',
  rationale: 'Longstanding reciprocal friendship.',
  activity_trend: 'stable',
  assessed_at: '2026-05-01T12:00:00.000Z',
  model_id: null,
  override: null,
  ai_enabled: true,
};

const DEFAULT_OPPORTUNITIES = {
  ai_enabled: true,
  radius_m: 1000,
  candidates: [
    {
      id: 'coleen',
      display_name: 'Coleen',
      distance_m: 280.1,
      bearing_deg: 45,
      walk_minutes: 4,
      closeness: { level: 4, level_source: 'demo_profile' },
      context: 'Nearby and available for discovery',
    },
  ],
};

const DEFAULT_ADVICE = {
  outcome: 'suggest',
  reason: 'Coleen is nearby and you both shared availability.',
  activity: 'coffee',
  invitation_draft: 'Hey Coleen! Coffee today? No pressure!',
  source: 'demo_fixture',
  model_id: null,
  generated_at: '2026-06-01T12:00:00.000Z',
  trace_id: 'trace-1',
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
    if (url.includes('/ai-circle/settings') && init?.method === 'PUT') {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      return jsonResponse(
        routes.putAiSettings !== undefined
          ? routes.putAiSettings(body)
          : { ai_enabled: true, settings: { ...DEFAULT_AI_SETTINGS.settings, ...body } },
      );
    }
    if (url.includes('/ai-circle/settings')) {
      return jsonResponse(routes.aiSettings ?? DEFAULT_AI_SETTINGS);
    }
    if (url.includes('/ai-circle/opportunities') && url.endsWith('/advise') && init?.method === 'POST') {
      return jsonResponse(routes.advise ?? DEFAULT_ADVICE, routes.adviseStatus ?? 200);
    }
    if (url.includes('/ai-circle/opportunities')) {
      return jsonResponse(routes.opportunities ?? DEFAULT_OPPORTUNITIES);
    }
    if (url.includes('/ai-circle/closeness') && url.endsWith('/assess')) {
      return jsonResponse({ job: { id: 1, status: 'pending' }, queued: true, queue_note: 'queued' }, 202);
    }
    if (url.includes('/ai-circle/closeness') && init?.method === 'PUT') {
      return jsonResponse(routes.closeness ?? DEFAULT_INSIGHT);
    }
    if (url.includes('/ai-circle/closeness')) {
      return jsonResponse(routes.closeness ?? DEFAULT_INSIGHT);
    }
    if (url.includes('/ai-circle/feedback')) {
      return jsonResponse({ kind: 'dismiss', expires_at: null });
    }
    if (url.includes('/ai-circle/usage')) {
      return jsonResponse(
        routes.aiUsage ?? {
          ai_enabled: true,
          usage: { model_requests: 0, cache_hits: 0, cache_misses: 0, input_tokens: 0, output_tokens: 0, rate_limited: 0 },
        },
      );
    }
    if (url.includes('/friends/nearby')) {
      const radius = new URL(url, 'http://test').searchParams.get('radius_m') ?? '1000';
      return jsonResponse(routes.nearby !== undefined ? routes.nearby(radius) : DEFAULT_NEARBY);
    }
    if (url.includes('/route')) {
      if (routes.route === undefined) return jsonResponse({}, 404);
      return jsonResponse(routes.route);
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
    expect(screen.getByText(/Proposed Facebook Messenger Feature/)).toBeInTheDocument();
    expect(screen.getByText('Hey! Are we still on for Saturday?')).toBeInTheDocument();
  });

  it('exposes the Near-Circle entry point in the inbox header', async () => {
    installFetch();
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Near-Circle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Near-Circle' })).toBeInTheDocument();
  });

  it('filters conversations with the Messenger search box', async () => {
    installFetch();
    render(<App />);
    await screen.findByText('Chats');
    fireEvent.change(screen.getByLabelText('Search conversations'), {
      target: { value: 'alex' },
    });
    expect(screen.queryByText('Sam')).not.toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search conversations'), {
      target: { value: '' },
    });
    expect(screen.getByText('Sam')).toBeInTheDocument();
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
    // The advisor panel below repeats the proximity context, so scope to the detail card.
    expect(
      screen.getByText('About 280 m away.', { selector: '.friend-card > .proximity-line' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View walking route' }));
    expect(screen.getByLabelText('Walking route')).toBeInTheDocument();
    expect(await screen.findByText('No walking route available.')).toBeInTheDocument();
  });

  it('shows the walking route with map and stats', async () => {
    installFetch({
      route: {
        demo: true,
        radius_m: 1000,
        route: {
          to: { id: 'coleen', display_name: 'Coleen' },
          center: { lat: 14.581, lon: 120.975 },
          target: { lat: 14.5828, lon: 120.9768 },
          geometry: {
            type: 'LineString',
            coordinates: [
              [120.975, 14.581],
              [120.9768, 14.5828],
            ],
          },
          route_distance_m: 340.5,
          straight_line_m: 280.1,
          duration_s: 245,
          estimated_steps: 454,
          stride_m: 0.75,
        },
      },
    });
    render(<App />);
    await screen.findByText('Chats');
    fireEvent.click(screen.getByRole('button', { name: 'Open Near-Circle' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Select Coleen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View walking route' }));
    expect(
      await screen.findByRole('application', { name: 'Walking route map to Coleen' }),
    ).toBeInTheDocument();
    expect(screen.getByText('341 m')).toBeInTheDocument();
    expect(screen.getByText('4 min')).toBeInTheDocument();
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

  it('shows a retry state instead of loading forever when visibility cannot load', async () => {
    // Broken /api path (e.g. a proxy pointing at container localhost):
    // visibility stays null, the loading text must resolve into an honest
    // error with a retry affordance, and no toggle is rendered.
    installFetch({ failUrls: ['/near-circle/visibility'] });
    render(<App />);
    expect(
      await screen.findByText('Could not load Near-Circle status. Check the API connection, then retry.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Near-Circle visibility' })).not.toBeInTheDocument();
    expect(screen.queryByText('Loading Near-Circle status…')).not.toBeInTheDocument();
  });

  it('recovers the visibility toggle after a retry', async () => {
    const routes: MockRoutes = { failUrls: ['/near-circle/visibility'] };
    installFetch(routes);
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
    routes.failUrls = [];
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('switch', { name: 'Near-Circle visibility' })).toBeInTheDocument();
  });

  it('resolves the loading state once visibility loads', async () => {
    installFetch();
    render(<App />);
    expect(await screen.findByRole('switch', { name: 'Near-Circle visibility' })).toBeInTheDocument();
    expect(screen.queryByText('Loading Near-Circle status…')).not.toBeInTheDocument();
  });

  it('opens Reconnect today from the radar and asks for meetup advice', async () => {
    installFetch();
    render(<App />);
    await screen.findByText('Chats');
    fireEvent.click(screen.getByRole('button', { name: 'Open Near-Circle' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reconnect today' }));
    expect(await screen.findByRole('heading', { name: 'Reconnect today' })).toBeInTheDocument();
    expect(screen.getByText('Coleen', { selector: 'h3' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ask Meta AI' }));
    expect(await screen.findByText('Worth asking today')).toBeInTheDocument();
    expect(screen.getByText('Demo suggestion')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Hey Coleen! Coffee today/)).toBeInTheDocument();
  });

  it('shows circle insight on the friend card', async () => {
    installFetch();
    render(<App />);
    await screen.findByText('Chats');
    fireEvent.click(screen.getByRole('button', { name: 'Open Near-Circle' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Select Coleen' }));
    expect(await screen.findByText('Your Circle with Coleen')).toBeInTheDocument();
    expect(screen.getByText('Close Friend')).toBeInTheDocument();
    expect(screen.getByText('Demo profile')).toBeInTheDocument();
  });

  it('asks Meta AI for a recommendation directly from the friend card', async () => {
    const requested: string[] = [];
    installFetch({}, requested);
    render(<App />);
    await screen.findByText('Chats');
    fireEvent.click(screen.getByRole('button', { name: 'Open Near-Circle' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Select Coleen' }));
    expect(await screen.findByText('✨ Fancy catching up today?')).toBeInTheDocument();
    expect(requested.some((entry) => entry.includes('/advise'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Ask Meta AI' }));
    expect(await screen.findByText('Worth asking today')).toBeInTheDocument();
    expect(screen.getByText('Demo suggestion')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Hey Coleen! Coffee today/)).toBeInTheDocument();
    expect(requested.some((entry) => entry.includes('/advise'))).toBe(true);
  });

  it('explains gracefully when meetup advice is unavailable on the friend card', async () => {
    installFetch({
      detail: { ...DEFAULT_DETAIL, discoverable: false, distance_m: null, bearing_deg: null },
    });
    render(<App />);
    await screen.findByText('Chats');
    fireEvent.click(screen.getByRole('button', { name: 'Open Near-Circle' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Select Coleen' }));
    expect(await screen.findByText('✨ Fancy catching up today?')).toBeInTheDocument();
    expect(
      screen.getByText("AI suggestions aren't available for Coleen right now."),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ask Meta AI' })).not.toBeInTheDocument();
  });

  it('opens AI settings and saves a consent change', async () => {
    const requested: string[] = [];
    installFetch({}, requested);
    render(<App />);
    await screen.findByText('Chats');
    fireEvent.click(screen.getByRole('button', { name: 'Open Near-Circle' }));
    fireEvent.click(await screen.findByRole('button', { name: 'AI Circle settings' }));
    expect(await screen.findByRole('heading', { name: 'AI Circle settings' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Meetup suggestions' }));
    await waitFor(() => {
      expect(requested.some((entry) => entry.startsWith('PUT /api/ai-circle/settings'))).toBe(true);
    });
  });
});
