// Phase 1 demo seed. These identities are SIMULATED for the hackathon demo:
// no Meta Graph API is involved and no real friend data is fetched.
export interface DemoFriend {
  id: string;
  display_name: string;
  status: 'online' | 'recent' | 'available';
  status_label: string;
  conversation_preview: string;
}

export const DEMO_NOTICE =
  'Simulated demo data: unofficial prototype identities, not real Messenger accounts.';

export const DEMO_FRIENDS: DemoFriend[] = [
  {
    id: 'coleen',
    display_name: 'Coleen',
    status: 'online',
    status_label: 'Online',
    conversation_preview: 'Are we still on for Saturday?',
  },
  {
    id: 'alex',
    display_name: 'Alex',
    status: 'recent',
    status_label: 'Last seen recently',
    conversation_preview: 'Sent you a photo from the park.',
  },
  {
    id: 'sam',
    display_name: 'Sam',
    status: 'available',
    status_label: 'Chat available',
    conversation_preview: 'Let me know when you are nearby!',
  },
];
