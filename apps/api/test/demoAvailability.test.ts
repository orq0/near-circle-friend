import { describe, expect, it } from 'vitest';
import { DEMO_AVAILABILITY_TZ, getDemoAvailability } from '../src/ai/demoAvailability.js';

describe('demo availability', () => {
  it('stays disabled by default, even for roster users', () => {
    expect(getDemoAvailability(false, 'you', 'alex', new Date())).toBeNull();
    expect(getDemoAvailability(false, 'you', 'coleen', new Date())).toBeNull();
  });

  it('covers only the fictional roster, never other users', () => {
    const now = new Date('2026-06-01T06:00:00.000Z');
    for (const [owner, friend] of [
      ['you', 'sam'],
      ['you', 'marco'],
      ['you', 'jamie'],
      ['you', 'rhea'],
      ['mallory', 'alex'],
    ]) {
      expect(getDemoAvailability(true, owner, friend, now)).toBeNull();
    }
  });

  it('gives Alex a two-hour window overlapping the operator', () => {
    const facts = getDemoAvailability(true, 'you', 'alex', new Date('2026-06-01T06:00:00.000Z'));
    expect(facts).not.toBeNull();
    expect(facts?.overlap_minutes).toBe(90);
    expect(facts?.target_interests).toEqual(['coffee', 'casual conversation', 'walking']);
    expect(facts?.requester_interests).toEqual(['coffee', 'walking']);
  });

  it('gives Coleen a partially overlapping window', () => {
    const facts = getDemoAvailability(true, 'you', 'coleen', new Date('2026-06-01T06:00:00.000Z'));
    expect(facts?.overlap_minutes).toBe(30);
    expect(facts?.target_interests).toEqual(['coffee', 'socializing']);
  });

  it('labels windows in Asia/Manila wall-clock time', () => {
    // 06:00 UTC == 14:00 Asia/Manila.
    const facts = getDemoAvailability(true, 'you', 'alex', new Date('2026-06-01T06:00:00.000Z'));
    expect(DEMO_AVAILABILITY_TZ).toBe('Asia/Manila');
    expect(facts?.requester_window).toBe('Jun 1, 14:30–16:30 (Asia/Manila)');
    expect(facts?.target_window).toBe('Jun 1, 15:00–17:00 (Asia/Manila)');
  });

  it('handles midnight and date transitions in Manila time', () => {
    // 15:20 UTC == 23:20 Asia/Manila; both windows cross midnight.
    const facts = getDemoAvailability(true, 'you', 'alex', new Date('2026-06-01T15:20:00.000Z'));
    expect(facts?.requester_window).toBe('Jun 1, 23:50 – Jun 2, 01:50 (Asia/Manila)');
    expect(facts?.target_window).toBe('Jun 2, 00:20–02:20 (Asia/Manila)');
    expect(facts?.overlap_minutes).toBe(90);
  });
});
