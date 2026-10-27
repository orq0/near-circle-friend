import type { Friend } from '../types';
import { MOCK_THREADS } from '../mockData';

interface ConversationPanelProps {
  friend: Friend;
  onBack: () => void;
}

export function ConversationPanel({ friend, onBack }: ConversationPanelProps) {
  const thread = MOCK_THREADS[friend.id] ?? [];
  return (
    <div className="chat-panel">
      <header className="chat-header">
        <button type="button" className="back-link chat-back" onClick={onBack}>
          ← Chats
        </button>
        <span className="avatar small" aria-hidden="true">
          {friend.initial}
        </span>
        <div className="chat-identity">
          <span className="chat-name">{friend.name}</span>
          <span className="chat-status">{friend.statusLabel}</span>
        </div>
      </header>
      <div className="thread" aria-label={`Simulated conversation with ${friend.name}`}>
        <p className="thread-separator">Today</p>
        {thread.map((msg, index) => (
          <div key={index} className={msg.from === 'you' ? 'bubble-row out' : 'bubble-row in'}>
            <p className={msg.from === 'you' ? 'bubble out' : 'bubble in'}>{msg.text}</p>
            {msg.time !== undefined && <span className="bubble-time">{msg.time}</span>}
          </div>
        ))}
      </div>
      <p className="thread-note">Messaging is simulated in this prototype.</p>
      <form
        className="composer"
        onSubmit={(event) => event.preventDefault()}
      >
        <input type="text" placeholder="Write a message…" disabled aria-label="Message input (disabled demo)" />
        <button type="submit" disabled>
          Send
        </button>
      </form>
    </div>
  );
}
