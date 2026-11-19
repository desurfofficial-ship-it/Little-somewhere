import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Clock,
  MessageCircle,
  Pause,
  Sparkles,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  CarryableItemId,
  DialogueChoice,
  DialogueSession,
  GameScreenState,
  InteractiveTarget,
  PlayerPosture,
  PropInteractableId,
  ResidentId,
  ScreenVec2,
  SeasonType,
  Vec2,
  WeatherType,
  WorldState,
} from './game/types';
import {
  computeWorldSaveRevision,
  createFreshWorldState,
  loadWorldState,
  resetWorldState,
  saveWorldState,
} from './game/storage';
import { formatClock, getTimePhase } from './game/residents';
import { advanceSimulationClock } from './game/time';
import { buildResidentDialogue } from './game/narrative';
import {
  composeEnvironmentState,
  getSeasonLabel,
  getWeatherLabel,
} from './game/environment';
import {
  PropInteractionResult,
  applyDialogueChoice,
  interactWithProp,
  markResidentMet,
  performFountainWishAction,
  performNextDayRest,
  performPondStoneSkipAction,
  pickupWorldPropAction,
  placeWorldPropAction,
  togglePlayerSitAction,
} from './game/actions';
import { interruptSocialEncounter } from './game/simulation';
import { getLandmarkAt, getPropInteractionMetrics } from './game/worldMap';
import { cozyAudio } from './game/audio';
// R-09: the whole Three.js scene stack (~1 MB) is code-split behind a dynamic import so
// first paint (title screen shell) only parses React + game logic. The canvas keeps its
// single-mount lifecycle — Suspense merely defers the first mount until the chunk arrives.
const NeighborhoodCanvas = lazy(() =>
  import('./scene/NeighborhoodCanvas').then((m) => ({ default: m.NeighborhoodCanvas })),
);
import type { HudBubbleSnapshot, PlayerActionPulse } from './scene/NeighborhoodCanvas';
import { TitleOverlay } from './components/TitleOverlay';
import { VirtualJoystick } from './components/VirtualJoystick';
import { DialogueSheet } from './components/DialogueSheet';
import { JournalDrawer } from './components/JournalDrawer';
import { PauseModal } from './components/PauseModal';

const getSaveStamp = computeWorldSaveRevision;

export default function App() {
  const initialAutostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [initialLoaded] = useState<WorldState>(() => loadWorldState());
  const [initialComposed] = useState(() => composeEnvironmentState(initialLoaded));
  const worldRef = useRef<WorldState>(initialLoaded);
  const joystickVectorRef = useRef<ScreenVec2>({ x: 0, y: 0 });
  const zoomRef = useRef<number>(1.0);
  const lastSavedStampRef = useRef<string>(getSaveStamp(initialLoaded));

  const [screenState, setScreenState] = useState<GameScreenState>(
    initialAutostart ? 'playing' : 'title',
  );
  const [worldSnapshot, setWorldSnapshot] = useState<WorldState>(initialLoaded);
  const [hudClock, setHudClock] = useState<number>(initialLoaded.minuteOfDay);
  const [hudWeather, setHudWeather] = useState<WeatherType>(initialComposed.weather.effective);
  const [hudSeason, setHudSeason] = useState<SeasonType>(initialComposed.season.season);
  const [playerPos, setPlayerPos] = useState<Vec2>(initialLoaded.playerPos);
  const [playerPosture, setPlayerPosture] = useState<PlayerPosture>(
    initialLoaded.playerPosture ?? 'standing',
  );
  const [playerHeldItem, setPlayerHeldItem] = useState<CarryableItemId | null>(
    initialLoaded.playerHeldItem ?? null,
  );
  const [nearestTarget, setNearestTarget] = useState<InteractiveTarget | null>(null);
  const [nearbyBubble, setNearbyBubble] = useState<HudBubbleSnapshot | null>(null);
  const [dialogueSession, setDialogueSession] = useState<DialogueSession | null>(null);
  const [propCard, setPropCard] = useState<PropInteractionResult | null>(null);
  const [activePropId, setActivePropId] = useState<PropInteractableId | null>(null);
  const [journalOpen, setJournalOpen] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [bellRingCounter, setBellRingCounter] = useState<number>(0);
  const [fountainWishCounter, setFountainWishCounter] = useState<number>(0);
  const [pondSkipCounter, setPondSkipCounter] = useState<number>(0);
  const [toastText, setToastText] = useState<string | null>(null);
  const [playerActionPulse, setPlayerActionPulse] = useState<PlayerActionPulse | null>(null);
  const pulseSeqRef = useRef(0);
  // R-03: touch-only thumbstick — the on-screen joystick is a touch affordance and must not
  // render on mouse-first desktop viewports (primary pointer = fine, no touch digitizer).
  const [hasTouchInput] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      ((typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches) ||
        (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)),
  );

  const triggerPlayerPulse = useCallback((kind: PlayerActionPulse['kind'], focusPos?: Vec2) => {
    pulseSeqRef.current += 1;
    setPlayerActionPulse({ kind, seq: pulseSeqRef.current, focusPos });
  }, []);

  const hasSavedProgress =
    worldSnapshot.day > 1 ||
    worldSnapshot.memories.length > 1 ||
    worldSnapshot.dailyLettersRead.length > 0 ||
    worldSnapshot.bellRungCount > 0 ||
    Object.values(worldSnapshot.residents).some((r) => r.met) ||
    Object.entries(worldSnapshot.flags).some(([k, v]) =>
      k === 'mediationStyle' ? v !== 'none' : v === true,
    );

  const showToast = useCallback((msg: string) => {
    setToastText(msg);
  }, []);

  useEffect(() => {
    if (!toastText) return;
    const t = window.setTimeout(() => setToastText(null), 3400);
    return () => window.clearTimeout(t);
  }, [toastText]);

  // Keep document.body.dataset.state in sync
  useEffect(() => {
    document.body.dataset.state = screenState;
  }, [screenState]);

  const commitWorld = useCallback((next: WorldState) => {
    const composed = composeEnvironmentState(next);
    worldRef.current = next;
    setWorldSnapshot(next);
    setHudClock(next.minuteOfDay);
    setHudWeather(composed.weather.effective);
    setHudSeason(composed.season.season);
    setPlayerPos(next.playerPos);
    setPlayerPosture(next.playerPosture ?? 'standing');
    setPlayerHeldItem(next.playerHeldItem ?? null);
    lastSavedStampRef.current = getSaveStamp(next);
    saveWorldState(next);
  }, []);

  const handleStartGame = useCallback(() => {
    cozyAudio.playUiTap(1.0);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    document.body.dataset.state = 'playing';
    setScreenState('playing');
  }, []);

  const handleResetAndStart = useCallback(() => {
    cozyAudio.playUiTap(0.95);
    const fresh: WorldState = resetWorldState();
    const composed = composeEnvironmentState(fresh);
    worldRef.current = fresh;
    setWorldSnapshot(fresh);
    setHudClock(fresh.minuteOfDay);
    setHudWeather(composed.weather.effective);
    setHudSeason(composed.season.season);
    setPlayerPos(fresh.playerPos);
    setPlayerPosture(fresh.playerPosture ?? 'standing');
    setPlayerHeldItem(fresh.playerHeldItem ?? null);
    setNearbyBubble(null);
    lastSavedStampRef.current = getSaveStamp(fresh);
    setDialogueSession(null);
    setActivePropId(null);
    setPropCard(null);
    setJournalOpen(false);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    document.body.dataset.state = 'playing';
    setScreenState('playing');
    showToast('Started a fresh morning at Willow Step Cottage');
  }, [showToast]);

  const openTargetInteraction = useCallback(
    (target: InteractiveTarget) => {
      const current = worldRef.current;
      if (target.kind === 'resident') {
        const rid = target.id as ResidentId;
        const interrupted = interruptSocialEncounter(current, rid);
        const metWorld = markResidentMet(interrupted, rid);
        if (metWorld !== current) {
          commitWorld(metWorld);
        }
        const phase = getTimePhase(metWorld.minuteOfDay);
        const session = buildResidentDialogue(rid, metWorld, phase);
        cozyAudio.playDialogueVoice(rid.charCodeAt(0));
        setActivePropId(null);
        setPropCard(null);
        setDialogueSession(session);
      } else if (target.kind === 'seat') {
        const res = togglePlayerSitAction(current, target.seatId ?? target.id);
        if (res.nextWorld !== current) {
          commitWorld(res.nextWorld);
        }
        cozyAudio.playUiTap(res.sat ? 1.02 : 0.96);
        if (res.toast) {
          showToast(res.toast);
        }
      } else if (target.kind === 'carryable') {
        const cid = target.carryableId ?? (target.id as CarryableItemId);
        const res = pickupWorldPropAction(current, cid);
        if (res.nextWorld !== current) {
          commitWorld(res.nextWorld);
          triggerPlayerPulse('interact', target.worldPos);
        }
        cozyAudio.playUiTap(1.12);
        if (res.toast) {
          showToast(res.toast);
        }
      } else {
        const pid = target.id as PropInteractableId;
        const res = interactWithProp(current, pid);
        if (res.nextWorld !== current) {
          commitWorld(res.nextWorld);
        }
        const metrics = getPropInteractionMetrics(pid, current.playerPos);
        triggerPlayerPulse('interact', metrics.focusPos);
        if (res.actionType === 'ring_bell') {
          setBellRingCounter((c) => c + 1);
          showToast('The restored brass bell echoes across Little Somewhere!');
        }
        setDialogueSession(null);
        setActivePropId(pid);
        setPropCard(res);
      }
    },
    [commitWorld, showToast, triggerPlayerPulse],
  );

  const handlePlaceHeldItem = useCallback(() => {
    const res = placeWorldPropAction(worldRef.current);
    if (res.nextWorld !== worldRef.current) {
      commitWorld(res.nextWorld);
      triggerPlayerPulse('interact');
      cozyAudio.playUiTap(0.95);
    }
    if (res.toast) {
      showToast(res.toast);
    }
  }, [commitWorld, showToast, triggerPlayerPulse]);

  const handleSelectChoice = useCallback(
    (choice: DialogueChoice) => {
      if (!dialogueSession) return;
      const { nextWorld, nextSession, memoryUnlockedTitle } = applyDialogueChoice(
        worldRef.current,
        dialogueSession,
        choice,
      );
      commitWorld(nextWorld);
      setDialogueSession(nextSession);
      triggerPlayerPulse('talk');
      if (memoryUnlockedTitle) {
        cozyAudio.playMemoryChime();
        showToast(`Memory saved: ${memoryUnlockedTitle}`);
      } else {
        cozyAudio.playUiTap(1.08);
      }
      if (choice.setFlags?.bellRestored) {
        setBellRingCounter((c) => c + 1);
      }
    },
    [commitWorld, dialogueSession, showToast, triggerPlayerPulse],
  );

  const handlePropAction = useCallback(
    (actionType: 'rest_next_day' | 'ring_bell' | 'fountain_wish' | 'skip_stone') => {
      if (actionType === 'rest_next_day') {
        const nextDayWorld = performNextDayRest(worldRef.current);
        commitWorld(nextDayWorld);
        setActivePropId(null);
        setPropCard(null);
        cozyAudio.playMemoryChime();
        showToast(`Good morning! Day ${nextDayWorld.day} begins in Little Somewhere.`);
      } else if (actionType === 'ring_bell') {
        const next = {
          ...worldRef.current,
          bellRungCount: worldRef.current.bellRungCount + 1,
        };
        commitWorld(next);
        setBellRingCounter((c) => c + 1);
        const bellMetrics = getPropInteractionMetrics('gazebo_bell', next.playerPos);
        triggerPlayerPulse('interact', bellMetrics.focusPos);
        setActivePropId(null);
        setPropCard(null);
        showToast('The brass bell rings out over the sunlit plaza!');
      } else if (actionType === 'fountain_wish') {
        const res = performFountainWishAction(worldRef.current);
        commitWorld(res.nextWorld);
        setFountainWishCounter((c) => c + 1);
        const wishMetrics = getPropInteractionMetrics('fountain_plaza', res.nextWorld.playerPos);
        triggerPlayerPulse('interact', wishMetrics.focusPos);
        cozyAudio.playWaterSplash();
        if (res.memoryUnlockedTitle) {
          cozyAudio.playMemoryChime();
        }
        setActivePropId(null);
        setPropCard(null);
        showToast(res.toast);
      } else if (actionType === 'skip_stone') {
        const res = performPondStoneSkipAction(worldRef.current);
        commitWorld(res.nextWorld);
        setPondSkipCounter((c) => c + 1);
        const skipMetrics = getPropInteractionMetrics('mirror_pond', res.nextWorld.playerPos);
        triggerPlayerPulse('interact', skipMetrics.focusPos);
        cozyAudio.playWaterSplash();
        if (res.memoryUnlockedTitle) {
          cozyAudio.playMemoryChime();
        }
        setActivePropId(null);
        setPropCard(null);
        showToast(res.toast);
      }
    },
    [commitWorld, showToast, triggerPlayerPulse],
  );

  const handleAdvanceTwoHours = useCallback(() => {
    cozyAudio.playUiTap(1.02);
    const current = worldRef.current;
    const nextMin = advanceSimulationClock(current.minuteOfDay, 120);
    const next = { ...current, minuteOfDay: nextMin };
    commitWorld(next);
    const nextPhase = getTimePhase(nextMin);
    showToast(`Time drifted forward to ${formatClock(nextMin)} (${nextPhase})`);
  }, [commitWorld, showToast]);

  const handleToggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    cozyAudio.setMuted(next);
  }, [muted]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (screenState === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartGame();
        }
        return;
      }

      if (e.code === 'KeyM') {
        handleToggleMute();
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        if (dialogueSession || propCard) {
          setDialogueSession(null);
          setActivePropId(null);
          setPropCard(null);
          return;
        }
        if (journalOpen) {
          setJournalOpen(false);
          return;
        }
        setScreenState((prev) => (prev === 'playing' ? 'paused' : 'playing'));
        return;
      }

      if (screenState !== 'playing') return;

      if (e.code === 'KeyJ') {
        e.preventDefault();
        setJournalOpen((o) => !o);
        return;
      }

      if (e.code === 'KeyE' && nearestTarget && !dialogueSession && !propCard && !journalOpen) {
        e.preventDefault();
        openTargetInteraction(nearestTarget);
        return;
      }

      if (e.code === 'KeyG' && worldRef.current.playerHeldItem && !dialogueSession && !propCard && !journalOpen) {
        e.preventDefault();
        handlePlaceHeldItem();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    dialogueSession,
    handlePlaceHeldItem,
    handleStartGame,
    handleToggleMute,
    journalOpen,
    nearestTarget,
    openTargetInteraction,
    propCard,
    screenState,
  ]);

  // Dirty-flagged periodic background auto-save + pagehide/visibilitychange flush
  useEffect(() => {
    const flushIfDirty = () => {
      const current = worldRef.current;
      const stamp = getSaveStamp(current);
      if (stamp !== lastSavedStampRef.current) {
        lastSavedStampRef.current = stamp;
        saveWorldState(current);
      }
    };

    const interval = window.setInterval(() => {
      if (screenState === 'playing') {
        flushIfDirty();
      }
    }, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && screenState !== 'title') {
        flushIfDirty();
      }
    };

    const handlePageHide = () => {
      if (screenState !== 'title') {
        flushIfDirty();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [screenState]);

  const handleHudSync = useCallback(
    (snap: {
      minuteOfDay: number;
      playerPos: Vec2;
      playerFacing: number;
      playerPosture: PlayerPosture;
      playerHeldItem: CarryableItemId | null;
      nearestTarget: InteractiveTarget | null;
      nearbyBubble: HudBubbleSnapshot | null;
      weather: WeatherType;
      season: SeasonType;
    }) => {
      setHudClock(snap.minuteOfDay);
      setPlayerPos(snap.playerPos);
      setPlayerPosture(snap.playerPosture);
      setPlayerHeldItem(snap.playerHeldItem);
      setNearestTarget(snap.nearestTarget);
      setNearbyBubble(snap.nearbyBubble);
      setHudWeather(snap.weather);
      setHudSeason(snap.season);
    },
    [],
  );

  const phase = getTimePhase(hudClock);
  const phaseLabel =
    phase === 'morning'
      ? 'Morning'
      : phase === 'afternoon'
      ? 'Afternoon'
      : phase === 'golden'
      ? 'Golden Hour'
      : 'Lantern Dusk';
  const landmark = getLandmarkAt(playerPos);
  const isSheetOpen = Boolean(dialogueSession || propCard);

  return (
    <main className="relative w-full h-full overflow-hidden">
      {/* Persistent 3D Isometric World Viewport (lazy chunk, R-09) */}
      <Suspense fallback={<div className="absolute inset-0 bg-[#DCEBF2]" aria-hidden="true" />}>
        <NeighborhoodCanvas
          screenState={screenState}
          worldRef={worldRef}
          joystickVectorRef={joystickVectorRef}
          zoomRef={zoomRef}
          bellRingCounter={bellRingCounter}
          fountainWishCounter={fountainWishCounter}
          pondSkipCounter={pondSkipCounter}
          isDialogueOpen={isSheetOpen || journalOpen}
          activeDialogueResidentId={dialogueSession?.residentId ?? null}
          activePropId={propCard ? activePropId : null}
          playerActionPulse={playerActionPulse}
          onHudSync={handleHudSync}
          onSelectTarget={openTargetInteraction}
        />
      </Suspense>

      {/* Title Screen */}
      {screenState === 'title' && (
        <TitleOverlay
          hasSavedProgress={hasSavedProgress}
          savedDay={worldSnapshot.day}
          onStart={handleStartGame}
          onResetAndStart={handleResetAndStart}
        />
      )}

      {/* Playing HUD (World-matched, >= 85% unobstructed center) */}
      {screenState !== 'title' && (
        <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
          {/* Top Bar: Left Location & Clock | Right Compact Utility Buttons */}
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="bg-[#FAF5EC]/95 border border-[#D4C4AE] rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-[0_6px_20px_rgba(45,36,30,0.12)] pointer-events-auto min-w-0 max-w-[195px] sm:max-w-md">
              <div className="font-display text-sm sm:text-lg font-semibold text-[#2D241E] truncate">
                {landmark.name}
              </div>
              <div className="text-[11px] sm:text-xs text-[#6A5B50] flex items-center gap-1 sm:gap-1.5 font-mono-nums whitespace-nowrap truncate">
                <span>Day {worldSnapshot.day}</span>
                <span aria-hidden="true">·</span>
                <span>{formatClock(hudClock)}</span>
                <span className="hidden sm:inline" aria-hidden="true">·</span>
                <span className="hidden sm:inline font-sans">{phaseLabel}</span>
                <span className="hidden md:inline" aria-hidden="true">·</span>
                <span className="hidden md:inline font-sans">
                  {getSeasonLabel(hudSeason)} · {getWeatherLabel(hudWeather)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto flex-nowrap shrink-0">
              <button
                type="button"
                onClick={handleAdvanceTwoHours}
                aria-label="Advance time 2 hours"
                title="Advance time 2 hours"
                className="hidden sm:flex min-h-[44px] px-3 py-2 rounded-xl bg-[#FAF5EC]/95 hover:bg-[#F1E8D9] border border-[#D4C4AE] text-[#2D241E] text-xs font-semibold items-center gap-1.5 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                <Clock className="w-4 h-4 text-[#C86446]" />
                <span>+2h</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  cozyAudio.playUiTap(1.05);
                  setJournalOpen(true);
                }}
                aria-label="Open Pocket Journal"
                className="min-h-[44px] px-3 sm:px-3.5 py-2 rounded-xl bg-[#FAF5EC]/95 hover:bg-[#F1E8D9] border border-[#D4C4AE] text-[#2D241E] text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4 text-[#C86446]" />
                <span>Journal</span>
              </button>

              <div className="hidden md:flex items-center gap-1 bg-[#FAF5EC]/95 border border-[#D4C4AE] rounded-xl p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => {
                    zoomRef.current = Math.min(1.45, zoomRef.current + 0.14);
                  }}
                  aria-label="Zoom out"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-[#F1E8D9] text-[#2D241E] transition-colors cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    zoomRef.current = Math.max(0.72, zoomRef.current - 0.14);
                  }}
                  aria-label="Zoom in"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-[#F1E8D9] text-[#2D241E] transition-colors cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#FAF5EC]/95 hover:bg-[#F1E8D9] border border-[#D4C4AE] text-[#2D241E] shadow-sm transition-colors cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => setScreenState('paused')}
                aria-label="Pause game"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#FAF5EC]/95 hover:bg-[#F1E8D9] border border-[#D4C4AE] text-[#2D241E] shadow-sm transition-colors cursor-pointer"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Gentle Memory / Story Toast or Nearby Neighbor Greeting Whisper */}
          {toastText ? (
            <div className="self-center mt-2 bg-[#FAF5EC] border border-[#C86446]/40 rounded-xl px-4 py-2 shadow-[0_8px_24px_rgba(45,36,30,0.18)] flex items-center gap-2 text-xs sm:text-sm font-medium text-[#2D241E]">
              <Sparkles className="w-4 h-4 text-[#C86446] shrink-0" />
              <span>{toastText}</span>
            </div>
          ) : (
            nearbyBubble &&
            !isSheetOpen &&
            !journalOpen &&
            screenState === 'playing' && (
              <div className="self-center mt-2 max-w-md bg-[#FAF5EC]/95 border border-[#D4C4AE] rounded-2xl px-4 py-2 shadow-[0_6px_20px_rgba(45,36,30,0.14)] text-xs sm:text-sm text-[#2D241E] text-center">
                <span className="font-display font-semibold text-[#C86446]">
                  {nearbyBubble.name}:
                </span>{' '}
                <span>“{nearbyBubble.text}”</span>
              </div>
            )
          )}

          {/* Bottom Controls: Left Thumbstick (touch devices only) + Center/Right Contextual Interact & Held Item CTA */}
          {!isSheetOpen && !journalOpen && screenState === 'playing' && (
            <div className="flex items-end justify-between gap-3 sm:gap-4 pb-1">
              {hasTouchInput ? (
                <VirtualJoystick vectorRef={joystickVectorRef} />
              ) : (
                <div className="hidden" aria-hidden="true" />
              )}

              <div className="flex flex-col items-end gap-2 pointer-events-auto min-w-0 max-w-[240px] sm:max-w-none">
                {playerHeldItem && worldSnapshot.worldProps?.[playerHeldItem] && (
                  <button
                    type="button"
                    onClick={handlePlaceHeldItem}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#FAF5EC]/95 hover:bg-[#F1E8D9] border border-[#D4C4AE] text-[#2D241E] text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span className="hidden sm:inline">
                      Carrying {worldSnapshot.worldProps[playerHeldItem].label} ·
                    </span>
                    <span className="text-[#C86446]">Set Down</span>
                    <span className="hidden sm:inline text-xs text-[#6A5B50] font-mono-nums">[G]</span>
                  </button>
                )}

                {nearestTarget ? (
                  <button
                    type="button"
                    onClick={() => openTargetInteraction(nearestTarget)}
                    className="min-h-[48px] max-w-full px-4 sm:px-5 py-3 rounded-2xl bg-[#C86446] hover:bg-[#B45539] active:scale-[0.98] text-[#FAF5EC] font-semibold text-sm sm:text-base shadow-[0_8px_24px_rgba(45,36,30,0.25)] flex items-center gap-2 sm:gap-2.5 transition-all cursor-pointer"
                  >
                    {nearestTarget.kind === 'resident' ? (
                      <MessageCircle className="w-4 h-4 shrink-0" />
                    ) : (
                      <Sparkles className="w-4 h-4 shrink-0" />
                    )}
                    <span className="truncate">{nearestTarget.actionLabel}</span>
                    <span className="hidden sm:inline text-xs opacity-80 font-mono-nums shrink-0">[E]</span>
                  </button>
                ) : (
                  <div className="bg-[#FAF5EC]/90 border border-[#D4C4AE] rounded-xl px-3.5 py-2.5 text-[11px] sm:text-xs text-[#5E5046] shadow-sm text-right leading-relaxed">
                    {playerPosture === 'sitting'
                      ? 'Resting on bench — move or tap Stand Up'
                      : hudClock >= 1260
                      ? 'Lanterns are glowing low — rest on your porch anytime'
                      : (
                        <>
                          <span>Tap or walk to neighbors &amp; benches</span>
                          <span className="hidden sm:inline"> (Hold Shift to sprint)</span>
                        </>
                      )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Storybook Dialogue & Prop Inspection Bottom Sheet */}
      <DialogueSheet
        session={dialogueSession}
        propCard={propCard}
        residentProgress={
          dialogueSession ? worldSnapshot.residents[dialogueSession.residentId] : null
        }
        playerRelation={
          dialogueSession ? worldSnapshot.playerRelations?.[dialogueSession.residentId] ?? null : null
        }
        emotion={
          dialogueSession
            ? worldSnapshot.npcRuntime?.[dialogueSession.residentId]?.emotion ??
              dialogueSession.emotion
            : undefined
        }
        flags={worldSnapshot.flags}
        sideFlags={worldSnapshot.sideFlags}
        world={worldSnapshot}
        onSelectChoice={handleSelectChoice}
        onClose={() => {
          if (dialogueSession) {
            triggerPlayerPulse('wave');
          }
          setDialogueSession(null);
          setActivePropId(null);
          setPropCard(null);
        }}
        onPropAction={handlePropAction}
      />

      {/* Pocket Journal Drawer */}
      <JournalDrawer
        open={journalOpen}
        world={worldSnapshot}
        onClose={() => setJournalOpen(false)}
        onAdvanceTime={handleAdvanceTwoHours}
      />

      {/* Pause Modal */}
      <PauseModal
        open={screenState === 'paused'}
        world={worldSnapshot}
        onResume={() => setScreenState('playing')}
        onResetWorld={handleResetAndStart}
        onReturnToTitle={() => {
          setDialogueSession(null);
          setActivePropId(null);
          setPropCard(null);
          setJournalOpen(false);
          setScreenState('title');
        }}
      />
    </main>
  );
}

// Keep fresh world helper accessible if needed
export { createFreshWorldState };
