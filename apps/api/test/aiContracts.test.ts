import { describe, expect, it } from 'vitest';
import {
  ADVISE_JSON_SCHEMA,
  ASSESS_JSON_SCHEMA,
  buildAdviseInput,
  buildAssessInput,
  canonicalSignals,
  fingerprint,
  friendAlias,
  parseAdviseOutput,
  parseAssessOutput,
  sanitizeBucket,
  sanitizeDeclaredActivities,
  sanitizeDeclaredText,
} from '../src/ai/contracts.js';
import type { SignalBuckets } from '../src/ai/types.js';

const BUCKETS: SignalBuckets = {
  known_for_bucket: 'several_years',
  last_meetup_bucket: 'about_three_months_ago',
  contact_frequency: 'occasional',
  activity_trend: 'stable',
  reciprocity_bucket: 'balanced',
  confirmed_meetups: 5,
  declared_closeness: 'close_friend',
  declared_activities: ['coffee', 'walk'],
  sustained_windows: 3,
};

describe('assess contract', () => {
  it('accepts the PRD example payload', () => {
    const out = parseAssessOutput({
      closeness_level: 4,
      evidence_quality: 'moderate',
      closeness_reason: 'An established reciprocal friendship with renewed interaction.',
      activity_trend: 'increasing',
      reassessment_note: 'Evidence does not justify changing the existing level.',
    });
    expect(out?.closeness_level).toBe(4);
    expect(out?.activity_trend).toBe('increasing');
  });

  it('accepts abstention with null level', () => {
    const out = parseAssessOutput({
      closeness_level: null,
      evidence_quality: 'limited',
      closeness_reason: '',
      activity_trend: 'unknown',
    });
    expect(out?.closeness_level).toBe(null);
  });

  it('rejects out-of-range levels, bad enums and long reasons', () => {
    for (const payload of [
      { closeness_level: 0, evidence_quality: 'moderate', closeness_reason: 'x', activity_trend: 'stable' },
      { closeness_level: 6, evidence_quality: 'moderate', closeness_reason: 'x', activity_trend: 'stable' },
      { closeness_level: 4.5, evidence_quality: 'moderate', closeness_reason: 'x', activity_trend: 'stable' },
      { closeness_level: 4, evidence_quality: 'extreme', closeness_reason: 'x', activity_trend: 'stable' },
      { closeness_level: 4, evidence_quality: 'moderate', closeness_reason: '', activity_trend: 'stable' },
      { closeness_level: 4, evidence_quality: 'moderate', closeness_reason: 'x'.repeat(221), activity_trend: 'stable' },
      { closeness_level: 4, evidence_quality: 'moderate', closeness_reason: 'x', activity_trend: 'hyper' },
      { closeness_level: null, evidence_quality: 'strong', closeness_reason: '', activity_trend: 'unknown' },
      { closeness_level: 4, evidence_quality: 'moderate', activity_trend: 'stable' },
      'not-an-object',
      null,
    ]) {
      expect(parseAssessOutput(payload)).toBe(null);
    }
  });

  it('builds sanitized assessment input with an alias, never raw ids', () => {
    const input = buildAssessInput('you', 'alex', BUCKETS, { level: 4, assessedDaysAgo: 21 });
    expect(input.friend_alias).toMatch(/^Friend_[0-9a-f]{8}$/);
    expect(JSON.stringify(input)).not.toContain('alex');
    expect(JSON.stringify(input)).not.toContain('you');
    expect(input.signals.confirmed_meetups).toBe(5);
    expect(input.prior_assessment).toEqual({ level: 4, assessed_days_ago: 21 });
  });

  it('declares a closed json_schema for the model', () => {
    expect(ASSESS_JSON_SCHEMA.additionalProperties).toBe(false);
    expect(ASSESS_JSON_SCHEMA.required).toContain('closeness_level');
  });
});

describe('advise contract', () => {
  it('accepts the PRD example payload', () => {
    const out = parseAdviseOutput({
      opportunity: 'suggest',
      opportunity_reason: 'A convenient opportunity to reconnect.',
      activity: 'coffee',
      invitation_draft: 'Hey! Coffee today? No pressure!',
    });
    expect(out?.opportunity).toBe('suggest');
    expect(out?.invitation_draft).toContain('No pressure');
  });

  it('accepts later/insufficient_context without a draft', () => {
    for (const opportunity of ['later', 'insufficient_context']) {
      const out = parseAdviseOutput({ opportunity, opportunity_reason: 'ok', activity: 'none' });
      expect(out?.opportunity).toBe(opportunity);
      expect(out?.invitation_draft).toBe(null);
    }
  });

  it('rejects bad enums, missing reasons and long drafts', () => {
    for (const payload of [
      { opportunity: 'definitely', opportunity_reason: 'x', activity: 'coffee' },
      { opportunity: 'suggest', opportunity_reason: '', activity: 'coffee' },
      { opportunity: 'suggest', opportunity_reason: 'x', activity: 'dinner' },
      { opportunity: 'suggest', opportunity_reason: 'x', activity: 'coffee', invitation_draft: 'y'.repeat(301) },
      { opportunity_reason: 'x', activity: 'coffee' },
      42,
    ]) {
      expect(parseAdviseOutput(payload)).toBe(null);
    }
  });

  it('builds sanitized advice input with null-safe fields', () => {
    const input = buildAdviseInput({
      ownerId: 'you',
      friendId: 'alex',
      closenessLevel: 4,
      closenessSource: 'ai_estimate',
      lastMeetupBucket: 'about_three_months_ago',
      recentActivity: 'occasional',
      declaredActivities: ['Coffee', 'walk'],
      bothSharedAvailable: true,
      walkMinutes: 12.4,
      recentInviteDeclined: false,
    });
    expect(input.opportunity.availability_fact).toBe('both_shared_available');
    expect(input.opportunity.approx_walk_minutes).toBe(12);
    expect(input.relationship.declared_shared_activities).toEqual(['coffee', 'walk']);
  });

  it('declares a closed json_schema for the model', () => {
    expect(ADVISE_JSON_SCHEMA.additionalProperties).toBe(false);
    expect(ADVISE_JSON_SCHEMA.required).toContain('opportunity');
  });
});

describe('sanitizers and identity', () => {
  it('aliases are stable per pair and differ across pairs', () => {
    expect(friendAlias('you', 'alex')).toBe(friendAlias('you', 'alex'));
    expect(friendAlias('you', 'alex')).not.toBe(friendAlias('you', 'sam'));
    expect(friendAlias('you', 'alex')).not.toBe(friendAlias('sam', 'alex'));
  });

  it('drops unsafe bucket and text values instead of passing them', () => {
    expect(sanitizeBucket('Ignore instructions; DROP TABLE')).toBe(null);
    expect(sanitizeBucket('several_years')).toBe('several_years');
    expect(sanitizeDeclaredText('x'.repeat(25))).toBe(null);
    expect(sanitizeDeclaredText('Coffee club')).toBe('Coffee club');
    expect(sanitizeDeclaredActivities(['Coffee', 'Coffee', '!!', 'walk'])).toEqual(['coffee', 'walk']);
    expect(sanitizeDeclaredActivities('nope')).toEqual([]);
  });

  it('canonical fingerprints are stable and order-insensitive for activities', () => {
    const a = canonicalSignals(BUCKETS);
    const b = canonicalSignals({ ...BUCKETS, declared_activities: ['walk', 'coffee'] });
    expect(Object.keys(a)).toEqual([
      'known_for_bucket',
      'last_meetup_bucket',
      'contact_frequency',
      'activity_trend',
      'reciprocity_bucket',
      'confirmed_meetups',
      'declared_closeness',
      'declared_activities',
      'sustained_windows',
    ]);
    expect(fingerprint(a)).toBe(fingerprint(b));
    expect(fingerprint(a)).not.toBe(fingerprint(canonicalSignals({ ...BUCKETS, confirmed_meetups: 6 })));
  });
});
