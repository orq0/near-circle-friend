import type { Friend, FriendStatusInfo, VisibilityState } from '../types';
import { DEMO_NOTICE } from '../mockData';
import { ApiStatus } from './ApiStatus';
import { ConversationItem } from './ConversationItem';
import { ConversationPanel } from './ConversationPanel';
import { PrototypeBanner } from './PrototypeBanner';
import { VisibilityToggle } from './VisibilityToggle';

interface InboxScreenProps {
  friends: Friend[];
  selectedId: string;
  visibility: VisibilityState | null;
  visibilityError: boolean;
  apiHealthy: boolean | null;
  friendStatus: FriendStatusInfo[] | null;
  chatOpen: boolean;
  onSelectConversation: (friend: Friend) => void;
  onBackToList: () => void;
  onVisibilityChange: (next: boolean) => void;
  onOpenNearCircle: () => void;
}

export function InboxScreen({
  friends,
  selectedId,
  visibility,
  visibilityError,
  apiHealthy,
  friendStatus,
  chatOpen,
  onSelectConversation,
  onBackToList,
  onVisibilityChange,
  onOpenNearCircle,
}: InboxScreenProps) {
  const selected = friends.find((friend) => friend.id === selectedId) ?? friends[0];
  const statusById = new Map((friendStatus ?? []).map((entry) => [entry.id, entry]));
  return (
    <section className="screen messenger" aria-label="Messenger-style inbox">
      <PrototypeBanner />
      <div className={chatOpen ? 'messenger-grid chat-open' : 'messenger-grid'}>
        <div className="pane-list">
          <header className="inbox-header">
            <h1>Chats</h1>
            <ApiStatus healthy={apiHealthy} />
          </header>
          <ul className="convo-list">
            {friends.map((friend) => (
              <ConversationItem
                key={friend.id}
                friend={friend}
                selected={friend.id === selected?.id}
                nearCircleOn={statusById.get(friend.id)?.near_circle_enabled ?? null}
                onSelect={onSelectConversation}
              />
            ))}
          </ul>
          <button
            type="button"
            className="primary-cta"
            onClick={onOpenNearCircle}
          >
            Open Near-Circle
          </button>
          {visibility === null ? (
            <p className="radar-state" role="status">
              Loading Near-Circle status…
            </p>
          ) : (
            <VisibilityToggle enabled={visibility.enabled} onChange={onVisibilityChange} />
          )}
          {visibilityError && (
            <p className="toggle-error" role="alert">
              Could not save visibility — check the API connection.
            </p>
          )}
          <p className="demo-footnote">{DEMO_NOTICE}</p>
        </div>
        <div className="pane-chat">
          {selected !== undefined && (
            <ConversationPanel friend={selected} onBack={onBackToList} />
          )}
        </div>
      </div>
    </section>
  );
}
