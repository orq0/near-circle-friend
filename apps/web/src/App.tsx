import { useEffect, useState } from 'react';
import { fetchApiHealth } from './api';
import { FRIENDS } from './mockData';
import type { Friend, Screen } from './types';
import { FriendScreen } from './components/FriendScreen';
import { InboxScreen } from './components/InboxScreen';
import { RadarScreen } from './components/RadarScreen';
import { RouteScreen } from './components/RouteScreen';

const VISIBILITY_KEY = 'nc-visibility';

function readStoredVisibility(): boolean {
  try {
    return window.localStorage.getItem(VISIBILITY_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function App() {
  const [screen, setScreen] = useState<Screen>('inbox');
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [visibilityEnabled, setVisibilityEnabled] = useState<boolean>(readStoredVisibility);
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchApiHealth().then((ok) => {
      if (!cancelled) setApiHealthy(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleVisibilityChange = (next: boolean) => {
    setVisibilityEnabled(next);
    try {
      window.localStorage.setItem(VISIBILITY_KEY, next ? 'on' : 'off');
    } catch {
      // Private-mode storage failure must not break the toggle UI.
    }
  };

  const handleSelectFriend = (friend: Friend) => {
    setSelectedFriend(friend);
    setScreen('friend');
  };

  return (
    <div className="app">
      <main className="shell">
        {screen === 'inbox' && (
          <InboxScreen
            friends={FRIENDS}
            visibilityEnabled={visibilityEnabled}
            apiHealthy={apiHealthy}
            onVisibilityChange={handleVisibilityChange}
            onOpenNearCircle={() => setScreen('radar')}
          />
        )}
        {screen === 'radar' && (
          <RadarScreen
            friends={FRIENDS}
            onSelectFriend={handleSelectFriend}
            onBack={() => setScreen('inbox')}
          />
        )}
        {screen === 'friend' && selectedFriend !== null && (
          <FriendScreen
            friend={selectedFriend}
            onViewRoute={() => setScreen('route')}
            onBack={() => setScreen('radar')}
          />
        )}
        {screen === 'route' && selectedFriend !== null && (
          <RouteScreen friend={selectedFriend} onBack={() => setScreen('friend')} />
        )}
      </main>
    </div>
  );
}
