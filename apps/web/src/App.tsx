import { useCallback, useEffect, useState } from 'react';
import {
  fetchApiHealth,
  fetchFriendDetail,
  fetchFriends,
  fetchNearby,
  fetchVisibility,
  setVisibilityRemote,
} from './api';
import { FRIENDS } from './mockData';
import type {
  Friend,
  FriendDetail,
  FriendStatusInfo,
  NearbyFriend,
  RadarStatus,
  Screen,
  VisibilityState,
} from './types';
import { FriendScreen } from './components/FriendScreen';
import { InboxScreen } from './components/InboxScreen';
import { RadarScreen } from './components/RadarScreen';
import { RouteScreen } from './components/RouteScreen';

export function App() {
  const [screen, setScreen] = useState<Screen>('inbox');
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const [visibility, setVisibility] = useState<VisibilityState | null>(null);
  const [visibilityError, setVisibilityError] = useState(false);
  const [friendStatus, setFriendStatus] = useState<FriendStatusInfo[] | null>(null);

  const [radiusM, setRadiusM] = useState(1000);
  const [radarStatus, setRadarStatus] = useState<RadarStatus>('loading');
  const [nearby, setNearby] = useState<NearbyFriend[]>([]);
  const [radarNonce, setRadarNonce] = useState(0);

  const [selectedNearby, setSelectedNearby] = useState<NearbyFriend | null>(null);
  const [detail, setDetail] = useState<FriendDetail | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [detailNonce, setDetailNonce] = useState(0);

  const [selectedConvoId, setSelectedConvoId] = useState(FRIENDS[0]?.id ?? '');
  const [chatOpen, setChatOpen] = useState(false);

  // Backend-backed activation state + sidebar status, loaded once.
  useEffect(() => {
    let cancelled = false;
    fetchApiHealth().then((ok) => {
      if (!cancelled) setApiHealthy(ok);
    });
    fetchVisibility().then((state) => {
      if (cancelled) return;
      if (state !== null) {
        setVisibility(state);
        setRadiusM(state.radius_m);
      }
    });
    fetchFriends().then((list) => {
      if (!cancelled && list !== null) setFriendStatus(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Live radar results whenever the radar is visible, the radius changes,
  // discovery is toggled, or the user retries.
  useEffect(() => {
    if (screen !== 'radar') return;
    if (visibility !== null && !visibility.enabled) {
      setRadarStatus('disabled');
      setNearby([]);
      return;
    }
    let cancelled = false;
    setRadarStatus('loading');
    fetchNearby(radiusM).then((result) => {
      if (cancelled) return;
      if (result === null) {
        setNearby([]);
        setRadarStatus('error');
      } else if (result.friends.length === 0) {
        setNearby([]);
        setRadarStatus('empty');
      } else {
        setNearby(result.friends);
        setRadarStatus('ready');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [screen, radiusM, visibility, radarNonce]);

  // Friend detail for the selected dot.
  useEffect(() => {
    if (screen !== 'friend' || selectedNearby === null) return;
    let cancelled = false;
    setDetail(null);
    setDetailError(false);
    fetchFriendDetail(selectedNearby.id, radiusM).then((loaded) => {
      if (cancelled) return;
      if (loaded === null) setDetailError(true);
      else setDetail(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [screen, selectedNearby, radiusM, detailNonce]);

  const handleVisibilityChange = useCallback(async (next: boolean) => {
    setVisibilityError(false);
    const saved = await setVisibilityRemote(next);
    if (saved === null) {
      setVisibilityError(true);
      return;
    }
    setVisibility(saved);
  }, []);

  const handleSelectFriend = useCallback((friend: NearbyFriend) => {
    setSelectedNearby(friend);
    setDetail(null);
    setDetailError(false);
    setScreen('friend');
  }, []);

  const handleSelectConversation = useCallback((friend: Friend) => {
    setSelectedConvoId(friend.id);
    setChatOpen(true);
  }, []);

  return (
    <div className="app">
      <main className={screen === 'inbox' ? 'shell shell-wide' : 'shell'}>
        {screen === 'inbox' && (
          <InboxScreen
            friends={FRIENDS}
            selectedId={selectedConvoId}
            visibility={visibility}
            visibilityError={visibilityError}
            apiHealthy={apiHealthy}
            friendStatus={friendStatus}
            chatOpen={chatOpen}
            onSelectConversation={handleSelectConversation}
            onBackToList={() => setChatOpen(false)}
            onVisibilityChange={handleVisibilityChange}
            onOpenNearCircle={() => setScreen('radar')}
          />
        )}
        {screen === 'radar' && (
          <RadarScreen
            status={radarStatus}
            friends={nearby}
            radiusM={radiusM}
            onRadiusChange={setRadiusM}
            onSelectFriend={handleSelectFriend}
            onRetry={() => setRadarNonce((n) => n + 1)}
            onEnable={() => handleVisibilityChange(true)}
            onBack={() => setScreen('inbox')}
          />
        )}
        {screen === 'friend' && (
          <FriendScreen
            detail={detail}
            loadError={detailError}
            onViewRoute={() => setScreen('route')}
            onBack={() => setScreen('radar')}
            onRetry={() => setDetailNonce((n) => n + 1)}
          />
        )}
        {screen === 'route' && selectedNearby !== null && (
          <RouteScreen displayName={selectedNearby.display_name} onBack={() => setScreen('friend')} />
        )}
      </main>
    </div>
  );
}
