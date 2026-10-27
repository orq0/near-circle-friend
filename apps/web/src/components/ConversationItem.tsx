import type { Friend } from '../types';
import { Avatar } from './Avatar';

const AVATAR_HUES: Record<string, number> = {
  coleen: 210,
  alex: 150,
  sam: 32,
};

interface ConversationItemProps {
  friend: Friend;
  selected: boolean;
  nearCircleOn: boolean | null;
  onSelect: (friend: Friend) => void;
}

export function ConversationItem({ friend, selected, nearCircleOn, onSelect }: ConversationItemProps) {
  const hue = AVATAR_HUES[friend.id] ?? 220;
  return (
    <li className={selected ? 'convo selected' : 'convo'}>
      <button
        type="button"
        className="convo-btn"
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(friend)}
      >
        <Avatar
          userId={friend.id}
          label={friend.initial}
          style={{ backgroundColor: `hsl(${hue} 55% 88%)`, color: `hsl(${hue} 60% 28%)` }}
        >
          {friend.status === 'online' && <span className="presence-dot" />}
        </Avatar>
        <span className="convo-body">
          <span className="convo-top">
            <span className="convo-name">{friend.name}</span>
            {friend.time !== undefined && <span className="convo-time">{friend.time}</span>}
          </span>
          <span className="convo-preview-row">
            <span className="convo-preview">{friend.preview}</span>
            {friend.unread !== undefined && friend.unread > 0 && (
              <span className="unread-badge" aria-label={`${friend.unread} unread messages`}>
                {friend.unread}
              </span>
            )}
          </span>
          <span className={`status status-${friend.status}`}>{friend.statusLabel}</span>
        </span>
        {nearCircleOn === true && (
          <span className="nc-dot" title="Near-Circle enabled" aria-label={`${friend.name} has Near-Circle enabled`} />
        )}
      </button>
    </li>
  );
}
