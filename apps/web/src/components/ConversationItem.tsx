import type { Friend } from '../types';

const AVATAR_HUES: Record<string, number> = {
  coleen: 210,
  alex: 150,
  sam: 32,
};

export function ConversationItem({ friend }: { friend: Friend }) {
  const hue = AVATAR_HUES[friend.id] ?? 220;
  return (
    <li className="convo">
      <span
        className="avatar"
        aria-hidden="true"
        style={{ backgroundColor: `hsl(${hue} 55% 88%)`, color: `hsl(${hue} 60% 28%)` }}
      >
        {friend.initial}
        {friend.status === 'online' && <span className="presence-dot" />}
      </span>
      <span className="convo-body">
        <span className="convo-top">
          <span className="convo-name">{friend.name}</span>
          <span className={`status status-${friend.status}`}>{friend.statusLabel}</span>
        </span>
        <span className="convo-preview">{friend.preview}</span>
      </span>
    </li>
  );
}
