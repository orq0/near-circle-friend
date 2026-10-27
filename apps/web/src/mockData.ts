import type { ChatMessage, Friend } from './types';

// Seeded demo identities for the Phase 1 prototype. SIMULATED DATA ONLY:
// no Meta Graph API is involved and no real accounts are represented.
export const CURRENT_USER = { id: 'you', name: 'You', initial: 'Y' } as const;

export const DEMO_NOTICE =
  'Simulated demo data — unofficial prototype, not real Messenger accounts.';

// Simulated conversation threads for the messaging shell. Display-only mock
// content; the demo sends nothing anywhere.
export const MOCK_THREADS: Record<string, ChatMessage[]> = {
  coleen: [
    { from: 'them', text: 'Hey! Are we still on for Saturday?', time: '2:41 PM' },
    { from: 'you', text: 'Yes! Meeting at the park entrance at 4.', time: '2:43 PM' },
    { from: 'them', text: 'Perfect, see you there!', time: '2:45 PM' },
  ],
  alex: [
    { from: 'them', text: 'Sent you a photo from the park.', time: '1:12 PM' },
    { from: 'you', text: 'Great shot! The light is perfect today.', time: '1:15 PM' },
    { from: 'them', text: 'Right? We should walk here this weekend.', time: '1:16 PM' },
  ],
  sam: [
    { from: 'them', text: 'Let me know when you are nearby!', time: '11:02 AM' },
    { from: 'you', text: 'Will do — I enabled Near-Circle.', time: '11:04 AM' },
    { from: 'them', text: 'Nice, I will keep an eye on the radar.', time: '11:05 AM' },
  ],
};

export const FRIENDS: Friend[] = [
  {
    id: 'coleen',
    name: 'Coleen',
    initial: 'C',
    status: 'online',
    statusLabel: 'Online',
    preview: 'Are we still on for Saturday?',
    time: '2:45 PM',
    unread: 2,
  },
  {
    id: 'alex',
    name: 'Alex',
    initial: 'A',
    status: 'recent',
    statusLabel: 'Last seen recently',
    preview: 'Sent you a photo from the park.',
    time: '1:16 PM',
    unread: 1,
  },
  {
    id: 'sam',
    name: 'Sam',
    initial: 'S',
    status: 'available',
    statusLabel: 'Chat available',
    preview: 'Let me know when you are nearby!',
    time: '11:05 AM',
  },
];
