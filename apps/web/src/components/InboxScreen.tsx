import { useState } from 'react';
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
  visibilityLoadError: boolean;
  onRetryVisibility: () => void;
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
  visibilityLoadError,
  onRetryVisibility,
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
  const showLoadError = visibility === null && visibilityLoadError;
  const [search, setSearch] = useState('');
  const visibleFriends = friends.filter((friend) => {
    const needle = search.trim().toLowerCase();
    return (
      needle === '' ||
      friend.name.toLowerCase().includes(needle) ||
      friend.preview.toLowerCase().includes(needle)
    );
  });
  return (
    <section className="screen messenger" aria-label="Messenger-style inbox">
      <PrototypeBanner />
      <div className={chatOpen ? 'messenger-grid chat-open' : 'messenger-grid'}>
        <div className="pane-list">
          <header className="inbox-header">
            <h1>Chats</h1>
            <div className="header-actions">
              <button
                type="button"
                className="nc-header-btn"
                onClick={onOpenNearCircle}
                aria-label="Near-Circle"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                  <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                  <circle cx="16.5" cy="8.5" r="1.6" fill="#f02849" />
                </svg>
                Near-Circle
              </button>
              <ApiStatus healthy={apiHealthy} />
            </div>
          </header>
          <div className="search-box">
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">
              <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M15.3 15.3 20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              aria-label="Search conversations"
              placeholder="Search Messenger"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <ul className="convo-list">
            {visibleFriends.map((friend) => (
              <ConversationItem
                key={friend.id}
                friend={friend}
                selected={friend.id === selected?.id}
                nearCircleOn={statusById.get(friend.id)?.near_circle_enabled ?? null}
                onSelect={onSelectConversation}
              />
            ))}
          </ul>
          {visibleFriends.length === 0 && (
            <p className="radar-state" role="status">
              No conversations match your search.
            </p>
          )}
          <button
            type="button"
            className="primary-cta"
            onClick={onOpenNearCircle}
          >
            Open Near-Circle
          </button>
          {visibility === null && showLoadError ? (
            <p className="toggle-error" role="alert">
              Could not load Near-Circle status. Check the API connection, then retry.
            </p>
          ) : visibility === null ? (
            <p className="radar-state" role="status">
              Loading Near-Circle status…
            </p>
          ) : (
            <VisibilityToggle enabled={visibility.enabled} onChange={onVisibilityChange} />
          )}
          {showLoadError && (
            <button type="button" className="secondary-cta" onClick={onRetryVisibility}>
              Retry
            </button>
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
