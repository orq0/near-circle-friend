import type { Friend } from './types';

// Seeded demo identities for the Phase 1 prototype. SIMULATED DATA ONLY:
// no Meta Graph API is involved and no real accounts are represented.
export const CURRENT_USER = { id: 'you', name: 'You', initial: 'Y' } as const;

export const DEMO_NOTICE =
  'Simulated demo data — unofficial prototype, not real Messenger accounts.';

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
