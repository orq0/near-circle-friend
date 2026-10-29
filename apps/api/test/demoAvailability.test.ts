import { describe, expect, it } from 'vitest';
import {
  DEMO_AVAILABILITY_NOTE,
  DEMO_AVAILABILITY_TZ,
  getDemoAvailability,
} from '../src/ai/demoAvailability.js';

describe('demo availability', () => {
  it('stays disabled by default, even for roster targets', () => {
    expect(getDemoAvailability(false, 'alex', new Date())).toBeNull();
    expect(getDemoAvailability(false, 'coleen', new Date())).toBeNull();
  });

  it('covers only the fictional roster, never other users', () => {
    const now = new Date('2026-06-01T06:00:00.000Z');
    // Every other seeded demo identity stays untouched, whether the requester
    // is the demo operator or a real user id.
    for (const friend of ['sam', 'marco', 'rhea', 'liza', 'jose', 'nina', 'paolo', 'jamie', 'taylor']) {
      expect(getDemoAvailability(true, friend, now)).toBeNull();
    }
    expect(getDemoAvailability(true, 'you', now)).toBeNull();
    expect(getDemoAvailability(true, '550e8400-e29b-41d4-a716-446655440000', now)).toBeNull();
  });

  it('gives Alex a two-hour target window and nothing requester-side', () => {
    const facts = getDemoAvailability(true, 'alex', new Date('2026-06-01T06:00:00.000Z'));
    expect(facts).not.toBeNull();
    expect(facts?.target_interests).toEqual(['coffee', 'casual conversation', 'walking']);
    expect(facts?.requester_window).toBeNull();
    expect(facts?.requester_interests).toEqual([]);
    expect(facts?.overlap_minutes).toBeNull();
  });

  it('gives Coleen the enriched target-only judge context', () => {
    const facts = getDemoAvailability(true, 'coleen', new Date('2026-06-01T06:00:00.000Z'));
    expect(facts).not.toBeNull();
    expect(facts?.target_interests).toEqual(['coffee', 'casual conversations', 'fitness', 'walking']);
    // Never fabricate the current user's availability: no requester window,
    // no requester interests, no computed overlap.
    expect(facts?.requester_window).toBeNull();
    expect(facts?.requester_interests).toEqual([]);
    expect(facts?.overlap_minutes).toBeNull();
    // Synthetic data is labeled internally on every payload.
    expect(facts?.usage_note).toBe(DEMO_AVAILABILITY_NOTE);
    expect(facts?.usage_note).toMatch(/synthetic/i);
    expect(facts?.usage_note).toMatch(/tentative/i);
  });

  it('labels windows in Asia/Manila wall-clock time', () => {
    // 06:00 UTC == 14:00 Asia/Manila.
    expect(DEMO_AVAILABILITY_TZ).toBe('Asia/Manila');
    const alex = getDemoAvailability(true, 'alex', new Date('2026-06-01T06:00:00.000Z'));
    expect(alex?.target_window).toBe('Jun 1, 15:00–17:00 (Asia/Manila)');
    const coleen = getDemoAvailability(true, 'coleen', new Date('2026-06-01T06:00:00.000Z'));
    expect(coleen?.target_window).toBe('Jun 1, 16:00–18:00 (Asia/Manila)');
  });

  it('handles midnight and date transitions in Manila time', () => {
    // 15:20 UTC == 23:20 Asia/Manila; the target window crosses midnight.
    const facts = getDemoAvailability(true, 'alex', new Date('2026-06-01T15:20:00.000Z'));
    expect(facts?.target_window).toBe('Jun 2, 00:20–02:20 (Asia/Manila)');
  });

  it('is stateless: repeated calls never accumulate or duplicate data', () => {
    const now = new Date('2026-06-01T06:00:00.000Z');
    expect(getDemoAvailability(true, 'coleen', now)).toEqual(getDemoAvailability(true, 'coleen', now));
  });
});
