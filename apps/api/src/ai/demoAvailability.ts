// Fictional demo availability for hackathon judging. Applies ONLY to the
// hardcoded dummy-user roster below, and ONLY when the
// AI_CIRCLE_DEMO_AVAILABILITY flag is enabled (default off). Real users are
// never affected: unknown IDs always yield null.
//
// Windows are computed relative to the demonstration time in Asia/Manila so
// the scenario works on any calendar date; epoch arithmetic keeps midnight
// and date transitions correct. This data is input context for genuine
// Muse Spark inference only — never a simulated recommendation.
import type { DemoAvailabilityFacts } from './contracts.js';

export const DEMO_AVAILABILITY_TZ = 'Asia/Manila';

interface RosterEntry {
  interests: string[];
  /** Minutes after the demonstration request when the window starts. */
  startOffsetMin: number;
  durationMin: number;
}

// 'you' is the demo operator requesting advice; alex is the primary demo
// target; coleen is the second eligible nearby target. alex's two-hour
// window overlaps the operator's by 90 minutes; coleen's overlaps by 30.
const DEMO_ROSTER: Record<string, RosterEntry> = {
  you: { interests: ['coffee', 'walking'], startOffsetMin: 30, durationMin: 120 },
  alex: {
    interests: ['coffee', 'casual conversation', 'walking'],
    startOffsetMin: 60,
    durationMin: 120,
  },
  coleen: { interests: ['coffee', 'socializing'], startOffsetMin: 120, durationMin: 120 },
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
  ownerId: string,
  friendId: string,
  now: Date,
): DemoAvailabilityFacts | null {
  if (!enabled) return null;
  const requester = DEMO_ROSTER[ownerId];
  const target = DEMO_ROSTER[friendId];
  if (requester === undefined || target === undefined) return null;
  const nowMs = now.getTime();
  const requesterStart = nowMs + requester.startOffsetMin * 60000;
  const requesterEnd = requesterStart + requester.durationMin * 60000;
  const targetStart = nowMs + target.startOffsetMin * 60000;
  const targetEnd = targetStart + target.durationMin * 60000;
  return {
    requester_window: windowLabel(requesterStart, requesterEnd),
    target_window: windowLabel(targetStart, targetEnd),
    overlap_minutes: Math.max(
      0,
      Math.floor((Math.min(requesterEnd, targetEnd) - Math.max(requesterStart, targetStart)) / 60000),
    ),
    requester_interests: [...requester.interests],
    target_interests: [...target.interests],
  };
}
