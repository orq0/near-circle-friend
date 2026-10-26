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
    { from: 'them', text: 'Hey! Are we still on for Saturday?' },
    { from: 'you', text: 'Yes! Meeting at the park entrance at 4.' },
    { from: 'them', text: 'Perfect, see you there!' },
  ],
  alex: [
    { from: 'them', text: 'Sent you a photo from the park.' },
    { from: 'you', text: 'Great shot! The light is perfect today.' },
    { from: 'them', text: 'Right? We should walk here this weekend.' },
  ],
  sam: [
    { from: 'them', text: 'Let me know when you are nearby!' },
    { from: 'you', text: 'Will do — I enabled Near-Circle.' },
    { from: 'them', text: 'Nice, I will keep an eye on the radar.' },
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
  },
  {
    id: 'alex',
    name: 'Alex',
    initial: 'A',
    status: 'recent',
    statusLabel: 'Last seen recently',
    preview: 'Sent you a photo from the park.',
  },
  {
    id: 'sam',
    name: 'Sam',
    initial: 'S',
    status: 'available',
    statusLabel: 'Chat available',
    preview: 'Let me know when you are nearby!',
  },
];
