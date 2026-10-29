// Synthetic demo context for the Coleen judge scenario ONLY. Applies solely
// to the hardcoded dummy-user roster below, and ONLY when the
// AI_CIRCLE_DEMO_AVAILABILITY flag is enabled (default off). Real users are
// never affected: unknown IDs always yield null.
//
// The window is computed relative to the demonstration time in Asia/Manila so
// the scenario works on any calendar date; epoch arithmetic keeps midnight
// and date transitions correct. The requester's own availability is
// deliberately NEVER provided (requester_window is always null and no overlap
// is computed), so the model may propose at most a TENTATIVE meetup inside
// the target's window, subject to the current user's confirmation. This data
// is input context for genuine Muse Spark inference only — never a simulated
// recommendation.
import type { DemoAvailabilityFacts } from './contracts.js';

export const DEMO_AVAILABILITY_TZ = 'Asia/Manila';

/**
 * Fixed guidance attached to every demo payload. Labels the data as synthetic
 * demo context and forbids the model from claiming mutual availability.
 */
export const DEMO_AVAILABILITY_NOTE =
  'Demo-only synthetic context: the target window and interests below are demonstration data. ' +
  'The current user provided no availability, so propose at most a TENTATIVE meetup inside the ' +
  "target's window for the user to confirm, and never claim both sides are available or overlap.";

interface RosterEntry {
  interests: string[];
  /** Minutes after the demonstration request when the window starts. */
  startOffsetMin: number;
  durationMin: number;
}

// Demo targets only. No entry describes the requesting user: requester-side
// facts always stay null. coleen carries the judge-scenario enrichment
// (coffee, casual conversations, fitness, walking); alex is unchanged.
const DEMO_ROSTER: Record<string, RosterEntry> = {
  alex: {
    interests: ['coffee', 'casual conversation', 'walking'],
    startOffsetMin: 60,
    durationMin: 120,
  },
  coleen: {
    interests: ['coffee', 'casual conversations', 'fitness', 'walking'],
    startOffsetMin: 120,
    durationMin: 120,
  },
};

const dayFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: DEMO_AVAILABILITY_TZ,
  month: 'short',
  day: 'numeric',
});
const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: DEMO_AVAILABILITY_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function windowLabel(startMs: number, endMs: number): string {
  const startDay = dayFmt.format(startMs);
  const endDay = dayFmt.format(endMs);
  const range =
    startDay === endDay
      ? `${startDay}, ${timeFmt.format(startMs)}–${timeFmt.format(endMs)}`
      : `${startDay}, ${timeFmt.format(startMs)} – ${endDay}, ${timeFmt.format(endMs)}`;
  return `${range} (${DEMO_AVAILABILITY_TZ})`;
}

export function getDemoAvailability(
  enabled: boolean,
  friendId: string,
  now: Date,
): DemoAvailabilityFacts | null {
  if (!enabled) return null;
  const target = DEMO_ROSTER[friendId];
  if (target === undefined) return null;
  const targetStart = now.getTime() + target.startOffsetMin * 60000;
  const targetEnd = targetStart + target.durationMin * 60000;
  return {
    // Requester-side facts stay null by design: the current user's
    // availability is never fabricated, so no mutual overlap is computed.
    requester_window: null,
    target_window: windowLabel(targetStart, targetEnd),
    overlap_minutes: null,
    requester_interests: [],
    target_interests: [...target.interests],
    usage_note: DEMO_AVAILABILITY_NOTE,
  };
}
