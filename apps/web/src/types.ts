export type FriendStatus = 'online' | 'recent' | 'available';

export interface Friend {
  id: string;
  name: string;
  initial: string;
  status: FriendStatus;
  statusLabel: string;
  preview: string;
}

export type Screen = 'inbox' | 'radar' | 'friend' | 'route';
