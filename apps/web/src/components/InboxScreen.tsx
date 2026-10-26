import type { Friend } from '../types';
import { DEMO_NOTICE } from '../mockData';
import { ApiStatus } from './ApiStatus';
import { ConversationItem } from './ConversationItem';
import { PrototypeBanner } from './PrototypeBanner';
import { VisibilityToggle } from './VisibilityToggle';

interface InboxScreenProps {
  friends: Friend[];
  visibilityEnabled: boolean;
  apiHealthy: boolean | null;
  onVisibilityChange: (next: boolean) => void;
  onOpenNearCircle: () => void;
}

export function InboxScreen({
  friends,
  visibilityEnabled,
  apiHealthy,
  onVisibilityChange,
  onOpenNearCircle,
}: InboxScreenProps) {
  return (
    <section className="screen" aria-label="Messenger-style inbox">
      <PrototypeBanner />
      <header className="inbox-header">
        <h1>Chats</h1>
        <ApiStatus healthy={apiHealthy} />
      </header>
      <ul className="convo-list">
        {friends.map((friend) => (
          <ConversationItem key={friend.id} friend={friend} />
        ))}
      </ul>
      <button
        type="button"
        className="primary-cta"
        onClick={onOpenNearCircle}
      >
        Open Near-Circle
      </button>
      <VisibilityToggle enabled={visibilityEnabled} onChange={onVisibilityChange} />
      <p className="demo-footnote">{DEMO_NOTICE}</p>
    </section>
  );
}
