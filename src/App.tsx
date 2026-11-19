import { useCallback, useEffect, useRef, useState } from 'react';
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
  DialogueChoice,
  DialogueSession,
  GameScreenState,
  InteractiveTarget,
  PropInteractableId,
  ResidentId,
  ScreenVec2,
  SeasonType,
  Vec2,
  WeatherType,
  WorldState,
} from './game/types';
import {
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
  performNextDayRest,
} from './game/actions';
import { interruptSocialEncounter } from './game/simulation';
import { getLandmarkAt } from './game/worldMap';
import { cozyAudio } from './game/audio';
import { NeighborhoodCanvas } from './scene/NeighborhoodCanvas';
import { TitleOverlay } from './components/TitleOverlay';
import { VirtualJoystick } from './components/VirtualJoystick';
import { DialogueSheet } from './components/DialogueSheet';
import { JournalDrawer } from './components/JournalDrawer';
import { PauseModal } from './components/PauseModal';

const getSaveStamp = (w: WorldState): string =>
  `${w.day}:${Math.floor(w.minuteOfDay)}:${Math.round(w.playerPos.x * 10)},${Math.round(
    w.playerPos.z * 10,
  )}:${w.memories.length}:${w.bellRungCount}:${w.worldEvents?.length ?? 0}:${w.weather}:${w.season}`;

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
  const [nearestTarget, setNearestTarget] = useState<InteractiveTarget | null>(null);
  const [dialogueSession, setDialogueSession] = useState<DialogueSession | null>(null);
  const [propCard, setPropCard] = useState<PropInteractionResult | null>(null);
  const [journalOpen, setJournalOpen] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [bellRingCounter, setBellRingCounter] = useState<number>(0);
  const [toastText, setToastText] = useState<string | null>(null);

  const hasSavedProgress =
    worldSnapshot.day > 1 ||
    worldSnapshot.memories.length > 1 ||
    Object.values(worldSnapshot.residents).some((r) => r.met);

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
    lastSavedStampRef.current = getSaveStamp(fresh);
    setDialogueSession(null);
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
        setPropCard(null);
        setDialogueSession(session);
      } else {
        const pid = target.id as PropInteractableId;
        const res = interactWithProp(current, pid);
        if (res.nextWorld !== current) {
          commitWorld(res.nextWorld);
        }
        if (res.actionType === 'ring_bell') {
          setBellRingCounter((c) => c + 1);
          showToast('The restored brass bell echoes across Little Somewhere!');
        }
        setDialogueSession(null);
        setPropCard(res);
      }
    },
    [commitWorld, showToast],
  );

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
    [commitWorld, dialogueSession, showToast],
  );

  const handlePropAction = useCallback(
    (actionType: 'rest_next_day' | 'ring_bell') => {
      if (actionType === 'rest_next_day') {
        const nextDayWorld = performNextDayRest(worldRef.current);
        commitWorld(nextDayWorld);
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
        setPropCard(null);
        showToast('The brass bell rings out over the sunlit plaza!');
      }
    },
    [commitWorld, showToast],
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
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    dialogueSession,
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
      if (document.visibilityState === 'hidden' && screenState === 'playing') {
        flushIfDirty();
      }
    };

    const handlePageHide = () => {
      if (screenState === 'playing') {
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
      nearestTarget: InteractiveTarget | null;
      weather: WeatherType;
      season: SeasonType;
    }) => {
      setHudClock(snap.minuteOfDay);
      setPlayerPos(snap.playerPos);
      setNearestTarget(snap.nearestTarget);
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
      {/* Persistent 3D Isometric World Viewport */}
      <NeighborhoodCanvas
        screenState={screenState}
        worldRef={worldRef}
        joystickVectorRef={joystickVectorRef}
        zoomRef={zoomRef}
        bellRingCounter={bellRingCounter}
        isDialogueOpen={isSheetOpen || journalOpen}
        onHudSync={handleHudSync}
        onSelectTarget={openTargetInteraction}
      />

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

          {/* Gentle Memory / Story Toast */}
          {toastText && (
            <div className="self-center mt-2 bg-[#FAF5EC] border border-[#C86446]/40 rounded-xl px-4 py-2 shadow-[0_8px_24px_rgba(45,36,30,0.18)] flex items-center gap-2 text-xs sm:text-sm font-medium text-[#2D241E]">
              <Sparkles className="w-4 h-4 text-[#C86446] shrink-0" />
              <span>{toastText}</span>
            </div>
          )}

          {/* Bottom Controls: Left Thumbstick + Center/Right Contextual Interact CTA */}
          {!isSheetOpen && !journalOpen && screenState === 'playing' && (
            <div className="flex items-end justify-between gap-4 pb-1">
              <VirtualJoystick vectorRef={joystickVectorRef} />

              <div className="flex flex-col items-end gap-2 pointer-events-auto">
                {nearestTarget ? (
                  <button
                    type="button"
                    onClick={() => openTargetInteraction(nearestTarget)}
                    className="min-h-[48px] px-5 py-3 rounded-2xl bg-[#C86446] hover:bg-[#B45539] active:scale-[0.98] text-[#FAF5EC] font-semibold text-sm sm:text-base shadow-[0_8px_24px_rgba(45,36,30,0.25)] flex items-center gap-2.5 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span>{nearestTarget.actionLabel}</span>
                    <span className="hidden sm:inline text-xs opacity-80 font-mono-nums">[E]</span>
                  </button>
                ) : (
                  <div className="bg-[#FAF5EC]/90 border border-[#D4C4AE] rounded-xl px-3.5 py-2 text-xs text-[#5E5046] shadow-sm">
                    {hudClock >= 1260
                      ? 'Lanterns are glowing low — rest on your porch anytime'
                      : 'Walk up to a neighbor or cottage to interact'}
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
        flags={worldSnapshot.flags}
        onSelectChoice={handleSelectChoice}
        onClose={() => {
          setDialogueSession(null);
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
