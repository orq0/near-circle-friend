import { useCallback, useEffect, useState } from 'react';
import {
  fetchApiHealth,
  fetchCircleSettings,
  fetchCloseness,
  fetchFriendDetail,
  fetchFriends,
  fetchNearby,
  fetchOpportunities,
  fetchRoute,
  fetchUsage,
  fetchVisibility,
  recordAiFeedback,
  requestAdvice,
  requestAssessment,
  saveCircleSettings,
  saveClosenessOverride,
  setVisibilityRemote,
} from './api';
import { FRIENDS } from './mockData';
import type {
  AskPanelState,
  CircleInsight,
  CircleSettings,
  Friend,
  FriendDetail,
  FriendRouteInfo,
  FriendStatusInfo,
  NearbyFriend,
  OpportunityCandidate,
  RadarStatus,
  RouteStatus,
  Screen,
  UsageCounters,
  VisibilityState,
} from './types';
import { AiSettingsScreen } from './components/AiSettingsScreen';
import { FriendScreen } from './components/FriendScreen';
import { InboxScreen } from './components/InboxScreen';
import { RadarScreen } from './components/RadarScreen';
import { RouteScreen } from './components/RouteScreen';
import { ReconnectTodayScreen, type CandidateAdvice } from './components/ReconnectTodayScreen';

export function App() {
  const [screen, setScreen] = useState<Screen>('inbox');
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const [visibility, setVisibility] = useState<VisibilityState | null>(null);
  const [visibilityError, setVisibilityError] = useState(false);
  const [visibilityLoadError, setVisibilityLoadError] = useState(false);
  const [visibilityNonce, setVisibilityNonce] = useState(0);
  const [friendStatus, setFriendStatus] = useState<FriendStatusInfo[] | null>(null);

  const [radiusM, setRadiusM] = useState(1000);
  const [radarStatus, setRadarStatus] = useState<RadarStatus>('loading');
  const [nearby, setNearby] = useState<NearbyFriend[]>([]);
  const [radarNonce, setRadarNonce] = useState(0);

  const [selectedNearby, setSelectedNearby] = useState<NearbyFriend | null>(null);
  const [detail, setDetail] = useState<FriendDetail | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [detailNonce, setDetailNonce] = useState(0);

  const [routeStatus, setRouteStatus] = useState<RouteStatus>('loading');
  const [routeInfo, setRouteInfo] = useState<FriendRouteInfo | null>(null);
  const [routeNonce, setRouteNonce] = useState(0);

  const [selectedConvoId, setSelectedConvoId] = useState(FRIENDS[0]?.id ?? '');
  const [chatOpen, setChatOpen] = useState(false);

  // AI Circle Intelligence state. Every AI view keeps its own error/retry
  // state; AI failures never block map, radar, or walking routes.
  const [insight, setInsight] = useState<CircleInsight | null>(null);
  const [insightError, setInsightError] = useState(false);
  const [insightNonce, setInsightNonce] = useState(0);
  const [reassessmentPending, setReassessmentPending] = useState(false);
  const [overrideSaving, setOverrideSaving] = useState(false);

  const [candidates, setCandidates] = useState<OpportunityCandidate[] | null>(null);
  const [candidatesError, setCandidatesError] = useState(false);
  const [candidatesNonce, setCandidatesNonce] = useState(0);
  const [adviceById, setAdviceById] = useState<Record<string, CandidateAdvice>>({});

  const [circleSettings, setCircleSettings] = useState<CircleSettings | null>(null);
  const [settingsError, setSettingsError] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState(false);
  const [settingsNonce, setSettingsNonce] = useState(0);
  const [usage, setUsage] = useState<UsageCounters | null>(null);

  // Backend-backed activation state + sidebar status, loaded once.
  useEffect(() => {
    let cancelled = false;
    fetchApiHealth().then((ok) => {
      if (!cancelled) setApiHealthy(ok);
    });
    fetchVisibility().then((state) => {
      if (cancelled) return;
      if (state !== null) {
        setVisibilityLoadError(false);
        setVisibility(state);
        setRadiusM(state.radius_m);
      } else {
        // Loading must never be indefinite: surface the failure and let the
        // user retry instead of spinning on "Loading Near-Circle status…".
        setVisibilityLoadError(true);
      }
    });
    fetchFriends().then((list) => {
      if (!cancelled && list !== null) setFriendStatus(list);
    });
    return () => {
      cancelled = true;
    };
  }, [visibilityNonce]);

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

  // Pedestrian route for the selected dot. Geometry always comes from the
  // backend router; failures render as honest unavailable/error states.
  useEffect(() => {
    if (screen !== 'route' || selectedNearby === null) return;
    let cancelled = false;
    setRouteStatus('loading');
    setRouteInfo(null);
    fetchRoute(selectedNearby.id, radiusM).then((result) => {
      if (cancelled) return;
      if (result.kind === 'route') {
        setRouteInfo(result.route);
        setRouteStatus('ready');
      } else if (result.kind === 'unavailable') {
        setRouteStatus('unavailable');
      } else {
        setRouteStatus('error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [screen, selectedNearby, radiusM, routeNonce]);

  // Circle Insight for the selected friend card; reads only, no inference.
  useEffect(() => {
    if (screen !== 'friend' || selectedNearby === null) return;
    let cancelled = false;
    setInsight(null);
    setInsightError(false);
    fetchCloseness(selectedNearby.id).then((view) => {
      if (cancelled) return;
      if (view === null) setInsightError(true);
      else setInsight(view);
    });
    return () => {
      cancelled = true;
    };
  }, [screen, selectedNearby, insightNonce]);

  // Deterministic reconnect candidates; browsing never triggers inference.
  useEffect(() => {
    if (screen !== 'reconnect') return;
    let cancelled = false;
    setCandidates(null);
    setCandidatesError(false);
    fetchOpportunities(radiusM).then((list) => {
      if (cancelled) return;
      if (list === null) setCandidatesError(true);
      else setCandidates(list);
    });
    return () => {
      cancelled = true;
    };
  }, [screen, radiusM, candidatesNonce]);

  // AI settings + usage counters.
  useEffect(() => {
    if (screen !== 'ai-settings') return;
    let cancelled = false;
    setCircleSettings(null);
    setSettingsError(false);
    fetchCircleSettings().then((loaded) => {
      if (cancelled) return;
      if (loaded === null) setSettingsError(true);
      else setCircleSettings(loaded);
    });
    fetchUsage().then((loaded) => {
      if (!cancelled && loaded !== null) setUsage(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [screen, settingsNonce]);

  const handleVisibilityChange = useCallback(async (next: boolean) => {
    setVisibilityError(false);
    const saved = await setVisibilityRemote(next);
    if (saved === null) {
      setVisibilityError(true);
      return;
    }
    setVisibility(saved);
  }, []);

  const handleRequestReassessment = useCallback(async () => {
    if (selectedNearby === null) return;
    setReassessmentPending(true);
    const ok = await requestAssessment(selectedNearby.id);
    setReassessmentPending(false);
    if (ok) {
      // The job runs server-side; refresh insight shortly after.
      setTimeout(() => setInsightNonce((n) => n + 1), 1500);
    } else {
      setInsightError(true);
    }
  }, [selectedNearby]);

  const handleSaveOverride = useCallback(
    async (level: number | null) => {
      if (selectedNearby === null) return;
      setOverrideSaving(true);
      const saved = await saveClosenessOverride(selectedNearby.id, level);
      setOverrideSaving(false);
      if (saved === null) setInsightError(true);
      else {
        setInsightError(false);
        setInsight(saved);
      }
    },
    [selectedNearby],
  );

  const setAdviceSlot = useCallback((id: string, slot: CandidateAdvice) => {
    setAdviceById((prev) => ({ ...prev, [id]: slot }));
  }, []);

  const handleAsk = useCallback(
    async (candidate: OpportunityCandidate) => {
      setAdviceSlot(candidate.id, { state: 'consulting', advice: null, notice: null });
      const result = await requestAdvice(candidate.id, candidate.display_name, radiusM);
      if (result.kind === 'advice') {
        const state: AskPanelState =
          result.advice.outcome === 'suggest'
            ? 'suggest'
            : result.advice.outcome === 'later'
              ? 'later'
              : 'insufficient';
        setAdviceSlot(candidate.id, { state, advice: result.advice, notice: null });
        return;
      }
      if (result.kind === 'unavailable') {
        setAdviceSlot(candidate.id, {
          state: 'unavailable',
          advice: null,
          notice: 'AI is unavailable right now. Map, radar and walking routes still work.',
        });
        return;
      }
      const notice =
        result.kind === 'forbidden'
          ? 'This friend is not eligible for advice, or consent is missing.'
          : result.kind === 'suppressed'
            ? 'Suggestions are paused for this friend (snoozed or quiet hours).'
            : result.kind === 'pair_limited'
              ? 'Already suggested for this friend recently — try again after the cooldown.'
              : result.kind === 'rate_limited'
                ? 'AI budget reached for now — try again later.'
                : 'Could not load meetup advice.';
      setAdviceSlot(candidate.id, { state: 'error', advice: null, notice });
    },
    [radiusM, setAdviceSlot],
  );

  const handleDismissCandidate = useCallback(
    async (candidate: OpportunityCandidate) => {
      if (await recordAiFeedback(candidate.id, 'dismiss')) {
        setCandidates((prev) => (prev === null ? prev : prev.filter((c) => c.id !== candidate.id)));
      }
    },
    [],
  );

  const handleSnoozeCandidate = useCallback(
    async (candidate: OpportunityCandidate) => {
      if (await recordAiFeedback(candidate.id, 'snooze', 24 * 60)) {
        setCandidates((prev) => (prev === null ? prev : prev.filter((c) => c.id !== candidate.id)));
      }
    },
    [],
  );

  const handleDeclineInvite = useCallback(async (candidate: OpportunityCandidate) => {
    if (await recordAiFeedback(candidate.id, 'declined')) {
      // Keep the suggestion context visible; the composer retreats.
      setAdviceById((prev) => {
        const slot = prev[candidate.id];
        if (slot === undefined || slot.advice === null) return prev;
        return { ...prev, [candidate.id]: { state: 'later', advice: slot.advice, notice: null } };
      });
    }
  }, []);

  const handleOpenRouteFromCandidate = useCallback(
    (candidate: OpportunityCandidate) => {
      setSelectedNearby({
        id: candidate.id,
        display_name: candidate.display_name,
        distance_m: candidate.distance_m,
        bearing_deg: candidate.bearing_deg,
      });
      setRouteInfo(null);
      setRouteStatus('loading');
      setScreen('route');
    },
    [],
  );

  const handleSaveCircleSettings = useCallback(async (patch: Partial<CircleSettings>) => {
    setSettingsSaving(true);
    setSettingsSaveError(false);
    const saved = await saveCircleSettings(patch);
    setSettingsSaving(false);
    if (saved === null) setSettingsSaveError(true);
    else setCircleSettings(saved);
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

  // Friend Detail reuses the on-demand advisor through the same candidate
  // shape and advice slots as Reconnect Today. The candidate is synthesized
  // locally from data already on screen, so viewing a friend never triggers
  // inference; only the Ask action calls the backend, which stays
  // authoritative on consent, eligibility, cooldowns, and budgets.
  const friendAskCandidate: OpportunityCandidate | null =
    detail !== null && detail.discoverable && detail.distance_m !== null && detail.bearing_deg !== null
      ? {
          id: detail.id,
          display_name: detail.display_name,
          distance_m: detail.distance_m,
          bearing_deg: detail.bearing_deg,
          walk_minutes: null,
          closeness:
            insight !== null && insight.level_source !== 'none'
              ? { level: insight.level, level_source: insight.level_source }
              : null,
          context: 'Nearby and available for discovery',
        }
      : null;
  const friendAskAdvice: CandidateAdvice =
    detail !== null
      ? (adviceById[detail.id] ?? { state: 'not_requested', advice: null, notice: null })
      : { state: 'not_requested', advice: null, notice: null };

  return (
    <div className="app">
      <main className={screen === 'inbox' ? 'shell shell-wide' : 'shell'}>
        {screen === 'inbox' && (
          <InboxScreen
            friends={FRIENDS}
            selectedId={selectedConvoId}
            visibility={visibility}
            visibilityError={visibilityError}
            visibilityLoadError={visibilityLoadError}
            onRetryVisibility={() => setVisibilityNonce((n) => n + 1)}
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
            onOpenReconnect={() => setScreen('reconnect')}
            onOpenAiSettings={() => setScreen('ai-settings')}
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
            insight={insight}
            insightError={insightError}
            reassessmentPending={reassessmentPending}
            overrideSaving={overrideSaving}
            onRetryInsight={() => setInsightNonce((n) => n + 1)}
            onRequestReassessment={handleRequestReassessment}
            onSaveOverride={handleSaveOverride}
            askCandidate={friendAskCandidate}
            askAdvice={friendAskAdvice}
            onAskAdvice={handleAsk}
            onDismissAdvice={handleDismissCandidate}
            onSnoozeAdvice={handleSnoozeCandidate}
            onDeclineAdviceInvite={handleDeclineInvite}
            onOpenAdviceRoute={() => setScreen('route')}
          />
        )}
        {screen === 'reconnect' && (
          <ReconnectTodayScreen
            candidates={candidates}
            loadError={candidatesError}
            radiusM={radiusM}
            adviceById={adviceById}
            onRadiusChange={setRadiusM}
            onRetry={() => setCandidatesNonce((n) => n + 1)}
            onAsk={handleAsk}
            onDismiss={handleDismissCandidate}
            onSnooze={handleSnoozeCandidate}
            onDeclineInvite={handleDeclineInvite}
            onOpenRoute={handleOpenRouteFromCandidate}
            onBack={() => setScreen('radar')}
          />
        )}
        {screen === 'ai-settings' && (
          <AiSettingsScreen
            settings={circleSettings}
            loadError={settingsError}
            saveError={settingsSaveError}
            saving={settingsSaving}
            usage={usage}
            onRetry={() => setSettingsNonce((n) => n + 1)}
            onSave={handleSaveCircleSettings}
            onBack={() => setScreen('radar')}
          />
        )}
        {screen === 'route' && selectedNearby !== null && (
          <RouteScreen
            displayName={selectedNearby.display_name}
            status={routeStatus}
            route={routeInfo}
            onRetry={() => setRouteNonce((n) => n + 1)}
            onBack={() => setScreen('friend')}
          />
        )}
      </main>
    </div>
  );
}
