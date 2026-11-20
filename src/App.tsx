import { Component, ErrorInfo, lazy, ReactNode, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Clock,
  MessageCircle,
  Pause,
  ShoppingBag,
  Sparkles,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  CarryableItemId,
  CottageInteractableId,
  DialogueChoice,
  DialogueSession,
  GameScreenState,
  BakeryInteractableId,
  GreenhouseInteractableId,
  NookInteractableId,
  CopperwheelInteractableId,
  InteractiveTarget,
  PersonalItemId,
  PlayerLocation,
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
import { buildMorningWakeLine, buildResidentDialogue } from './game/narrative';
import {
  composeEnvironmentState,
  getSeasonLabel,
  getWeatherLabel,
} from './game/environment';
import {
  PropInteractionResult,
  applyDialogueChoice,
  cookRecipeAction,
  enterCottageAction,
  exitCottageAction,
  enterBakeryAction,
  enterGreenhouseAction,
  enterNookAction,
  enterCopperwheelAction,
  exitBakeryAction,
  exitGreenhouseAction,
  exitNookAction,
  exitCopperwheelAction,
  giveInventoryItemAction,
  harvestPlotAction,
  interactWithCottageProp,
  interactWithBakeryProp,
  interactWithGreenhouseProp,
  interactWithNookProp,
  interactWithCopperwheelProp,
  interactWithProp,
  markResidentMet,
  performFountainWishAction,
  performNextDayRest,
  performPondStoneSkipAction,
  performRingBellAction,
  pickupWorldPropAction,
  placeFlowerInVaseAction,
  placeWorldPropAction,
  plantSeedAtPlotAction,
  toggleDisplayedKeepsakeAction,
  togglePlayerSitAction,
  sipBeverageAtTableAction,
  waterGreenhousePlotsAction,
} from './game/actions';
import { interruptSocialEncounter } from './game/simulation';
import {
  SUBJECT_IMAGE_KEYS,
  subjectKeyForBakeryProp,
  subjectKeyForCopperwheelProp,
  subjectKeyForCottageProp,
  subjectKeyForGreenhouseProp,
  subjectKeyForNookProp,
  subjectKeyForPropId,
} from './game/dialogue/assets';
import { getLandmarkAt, getPropInteractionMetrics } from './game/worldMap';
import { cozyAudio } from './game/audio';
import type { HudBubbleSnapshot, PlayerActionPulse } from './scene/NeighborhoodCanvas';
import { TitleOverlay } from './components/TitleOverlay';
import { VirtualJoystick } from './components/VirtualJoystick';
import { DialogueSheet } from './components/DialogueSheet';
import { JournalDrawer } from './components/JournalDrawer';
import { CottageStationMode, InventoryDrawer } from './components/InventoryDrawer';
import { CottageStationModal } from './components/CottageStationModal';
import { GreenhousePanel, GreenhousePanelMode } from './components/GreenhousePanel';
import { PauseModal } from './components/PauseModal';

const CHUNK_RELOAD_KEY = 'ls_scene_chunk_reload_v1';

function isModuleImportError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return (
    /importing a module script failed/i.test(msg) ||
    /failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /loading chunk/i.test(msg)
  );
}

// R-09: the whole Three.js scene stack (~1 MB) is code-split behind a dynamic import so
// first paint (title screen shell) only parses React + game logic. Includes stale-hash
// recovery so Vite dev restarts / deployments cannot leave the page in a failed lazy cache.
const NeighborhoodCanvas = lazy(async () => {
  try {
    const mod = await import('./scene/NeighborhoodCanvas');
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      } catch {
        // Ignore private-browsing storage restrictions
      }
    }
    return { default: mod.NeighborhoodCanvas };
  } catch (err) {
    if (typeof window !== 'undefined' && isModuleImportError(err)) {
      let alreadyReloaded = false;
      try {
        alreadyReloaded = window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1';
        if (!alreadyReloaded) {
          window.sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
        }
      } catch {
        // Ignore storage restrictions
      }
      if (!alreadyReloaded) {
        window.location.reload();
        // Keep Suspense fallback mounted while the reload navigates
        return new Promise<{ default: typeof import('./scene/NeighborhoodCanvas').NeighborhoodCanvas }>(
          () => {},
        );
      }
    }
    throw err;
  }
});

interface SceneErrorBoundaryProps {
  children: ReactNode;
}

interface SceneErrorBoundaryState {
  hasError: boolean;
}

class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, SceneErrorBoundaryState> {
  state: SceneErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('NeighborhoodCanvas failed to load:', error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 bg-[#DCEBF2] flex items-center justify-center p-6">
          <div className="bg-[#FAF5EC] border border-[#D4C4AE] rounded-2xl p-6 max-w-sm text-center shadow-[0_12px_32px_rgba(45,36,30,0.14)]">
            <h2 className="font-display text-lg font-semibold text-[#2D241E] mb-2">
              Willow Lane Needs a Fresh Breeze
            </h2>
            <p className="text-sm text-[#6A5B50] mb-4">
              The 3D neighborhood view couldn’t finish loading. Reload to reconnect cleanly.
            </p>
            <button
              type="button"
              onClick={() => {
                try {
                  window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
                } catch {
                  // Ignore storage restrictions
                }
                window.location.reload();
              }}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#C86446] hover:bg-[#B45539] text-[#FAF5EC] text-sm font-semibold cursor-pointer transition-colors"
            >
              Reload Neighborhood
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const [playerLocation, setPlayerLocation] = useState<PlayerLocation>(
    initialLoaded.playerLocation ?? 'exterior',
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
  const [inventoryOpen, setInventoryOpen] = useState<boolean>(false);
  const [cottageStationMode, setCottageStationMode] = useState<CottageStationMode | null>(null);
  const [greenhousePanelMode, setGreenhousePanelMode] = useState<GreenhousePanelMode | null>(null);
  const [muted, setMuted] = useState<boolean>(false);
  const [bellRingCounter, setBellRingCounter] = useState<number>(0);
  const [fountainWishCounter, setFountainWishCounter] = useState<number>(0);
  const [pondSkipCounter, setPondSkipCounter] = useState<number>(0);
  const [toastText, setToastText] = useState<string | null>(null);
  const [playerActionPulse, setPlayerActionPulse] = useState<PlayerActionPulse | null>(null);
  // Soft storybook veil for scene-level transitions (door enter/exit, bed rest).
  const [veilActive, setVeilActive] = useState<boolean>(false);
  const veilTimersRef = useRef<number[]>([]);
  const pulseSeqRef = useRef(0);
  const spawnPosRef = useRef<Vec2>(initialLoaded.playerPos);
  // R-03: touch-only thumbstick — the on-screen joystick is a touch affordance and must not
  // render on mouse-first desktop viewports (primary pointer = fine, no touch digitizer).
  const [hasTouchInput] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      ((typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches) ||
        (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)),
  );

  const hasSavedProgress =
    worldSnapshot.day > 1 ||
    worldSnapshot.memories.length > 1 ||
    worldSnapshot.dailyLettersRead.length > 0 ||
    worldSnapshot.bellRungCount > 0 ||
    Object.values(worldSnapshot.residents).some((r) => r.met) ||
    Object.entries(worldSnapshot.flags).some(([k, v]) =>
      k === 'mediationStyle' ? v !== 'none' : v === true,
    );

  const [introTipDismissed, setIntroTipDismissed] = useState<boolean>(() =>
    initialLoaded.day > 1 ||
    initialLoaded.memories.length > 1 ||
    initialLoaded.dailyLettersRead.length > 0 ||
    initialLoaded.bellRungCount > 0 ||
    Object.values(initialLoaded.residents).some((r) => r.met),
  );

  const triggerPlayerPulse = useCallback((kind: PlayerActionPulse['kind'], focusPos?: Vec2) => {
    pulseSeqRef.current += 1;
    setPlayerActionPulse({ kind, seq: pulseSeqRef.current, focusPos });
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastText(msg);
  }, []);

  // Fade to a warm linen veil, run the transition at the covered midpoint, then release.
  const playSceneVeil = useCallback((midpoint: () => void) => {
    for (const t of veilTimersRef.current) window.clearTimeout(t);
    veilTimersRef.current = [];
    setVeilActive(true);
    veilTimersRef.current.push(window.setTimeout(midpoint, 250));
    veilTimersRef.current.push(window.setTimeout(() => setVeilActive(false), 640));
  }, []);

  useEffect(() => {
    if (!toastText) return;
    const t = window.setTimeout(() => setToastText(null), 3400);
    return () => window.clearTimeout(t);
  }, [toastText]);

  // Brief intro tip auto-dismisses so the play screen never holds an idle box forever
  useEffect(() => {
    if (screenState !== 'playing' || introTipDismissed) return;
    const timer = window.setTimeout(() => setIntroTipDismissed(true), 5000);
    return () => window.clearTimeout(timer);
  }, [screenState, introTipDismissed]);

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
    setPlayerLocation(next.playerLocation ?? 'exterior');
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
    spawnPosRef.current = fresh.playerPos;
    setWorldSnapshot(fresh);
    setHudClock(fresh.minuteOfDay);
    setHudWeather(composed.weather.effective);
    setHudSeason(composed.season.season);
    setPlayerPos(fresh.playerPos);
    setPlayerLocation(fresh.playerLocation ?? 'exterior');
    setPlayerHeldItem(fresh.playerHeldItem ?? null);
    setNearbyBubble(null);
    lastSavedStampRef.current = getSaveStamp(fresh);
    setDialogueSession(null);
    setActivePropId(null);
    setPropCard(null);
    setJournalOpen(false);
    setInventoryOpen(false);
    setCottageStationMode(null);
    setGreenhousePanelMode(null);
    setIntroTipDismissed(false);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    document.body.dataset.state = 'playing';
    setScreenState('playing');
    showToast('Started a fresh morning at Willow Step Cottage');
  }, [showToast]);

  const openTargetInteraction = useCallback(
    (target: InteractiveTarget) => {
      setIntroTipDismissed(true);
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
        // Pass 5: seated at a cottage seat with a brewed drink → primary action is the sip ritual
        if (target.sipItemId && current.playerPosture === 'sitting') {
          const sipRes = sipBeverageAtTableAction(current, target.sipItemId);
          if (sipRes.ok) {
            commitWorld(sipRes.nextWorld);
            triggerPlayerPulse('interact', target.worldPos);
            cozyAudio.playSip();
            if (sipRes.memoryUnlockedTitle) {
              cozyAudio.playMemoryChime();
              showToast(`Memory saved: ${sipRes.memoryUnlockedTitle}`);
            } else if (sipRes.toast) {
              showToast(sipRes.toast);
            }
            setDialogueSession(null);
            setActivePropId(null);
            setPropCard({
              nextWorld: sipRes.nextWorld,
              title: sipRes.title,
              body: sipRes.body,
              subjectImageKey: SUBJECT_IMAGE_KEYS.teacup,
            });
          } else {
            cozyAudio.playUiTap(0.92);
          }
          return;
        }
        const res = togglePlayerSitAction(current, target.seatId ?? target.id);
        if (res.nextWorld !== current) {
          commitWorld(res.nextWorld);
        }
        if (res.sat) {
          cozyAudio.playSitDown();
        } else {
          cozyAudio.playUiTap(0.96);
        }
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
      } else if (target.kind === 'cottage_prop') {
        const cid = target.cottagePropId ?? (target.id as CottageInteractableId);
        const res = interactWithCottageProp(current, cid);
        if (res.actionType === 'exit_cottage') {
          playSceneVeil(() => {
            commitWorld(res.nextWorld);
            cozyAudio.playUiTap(0.98);
            showToast('Stepped out onto Willow Step Porch.');
          });
          return;
        }
        if (res.actionType === 'hearth_panel') {
          cozyAudio.playUiTap(1.06);
          setDialogueSession(null);
          setPropCard(null);
          setCottageStationMode('hearth');
          return;
        }
        if (res.actionType === 'vase_panel') {
          cozyAudio.playUiTap(1.06);
          setDialogueSession(null);
          setPropCard(null);
          setCottageStationMode('vase');
          return;
        }
        if (res.actionType === 'shelf_panel') {
          cozyAudio.playUiTap(1.06);
          setDialogueSession(null);
          setPropCard(null);
          setCottageStationMode('shelf');
          return;
        }
        if (res.nextWorld !== current) {
          commitWorld(res.nextWorld);
        }
        triggerPlayerPulse('interact', target.worldPos);
        cozyAudio.playUiTap(1.04);
        setDialogueSession(null);
        setActivePropId(null);
        setPropCard({ ...res, subjectImageKey: subjectKeyForCottageProp(cid) });
      } else if (target.kind === 'greenhouse_prop') {
        const gid = target.greenhousePropId ?? (target.id as GreenhouseInteractableId);
        const res = interactWithGreenhouseProp(current, gid);
        if (res.actionType === 'exit_greenhouse') {
          playSceneVeil(() => {
            commitWorld(res.nextWorld);
            cozyAudio.playUiTap(0.98);
            showToast('Stepped out beside Sunbeam Greenhouse.');
          });
          return;
        }
        if (res.actionType === 'greenhouse_planting_panel') {
          cozyAudio.playUiTap(1.06);
          setDialogueSession(null);
          setPropCard(null);
          setGreenhousePanelMode('planting');
          return;
        }
        if (res.actionType === 'greenhouse_harvest_panel') {
          cozyAudio.playUiTap(1.06);
          setDialogueSession(null);
          setPropCard(null);
          setGreenhousePanelMode('harvest');
          return;
        }
        if (res.nextWorld !== current) {
          commitWorld(res.nextWorld);
        }
        triggerPlayerPulse('interact', target.worldPos);
        cozyAudio.playUiTap(1.04);
        setDialogueSession(null);
        setActivePropId(null);
        setPropCard({ ...res, subjectImageKey: subjectKeyForGreenhouseProp(gid) });
      } else if (target.kind === 'nook_prop') {
        const nid = target.nookPropId ?? (target.id as NookInteractableId);
        const res = interactWithNookProp(current, nid);
        if (res.actionType === 'exit_nook') {
          playSceneVeil(() => {
            commitWorld(res.nextWorld);
            cozyAudio.playUiTap(0.98);
            showToast('Stepped out beside Linden Book Nook.');
          });
          return;
        }
        if (res.nextWorld !== current) {
          commitWorld(res.nextWorld);
        }
        triggerPlayerPulse('interact', target.worldPos);
        cozyAudio.playUiTap(1.04);
        setDialogueSession(null);
        setActivePropId(null);
        setPropCard({ ...res, subjectImageKey: subjectKeyForNookProp(nid) });
        if (res.memoryUnlockedTitle) {
          cozyAudio.playMemoryChime();
          showToast(`Memory saved: ${res.memoryUnlockedTitle}`);
        }
      } else if (target.kind === 'copperwheel_prop') {
        const wid = target.copperwheelPropId ?? (target.id as CopperwheelInteractableId);
        const res = interactWithCopperwheelProp(current, wid);
        if (res.actionType === 'exit_copperwheel') {
          playSceneVeil(() => {
            commitWorld(res.nextWorld);
            cozyAudio.playUiTap(0.98);
            showToast('Stepped out beside Copperwheel Cottage.');
          });
          return;
        }
        if (res.nextWorld !== current) {
          commitWorld(res.nextWorld);
        }
        triggerPlayerPulse('interact', target.worldPos);
        cozyAudio.playUiTap(1.04);
        setDialogueSession(null);
        setActivePropId(null);
        setPropCard({ ...res, subjectImageKey: subjectKeyForCopperwheelProp(wid) });
        if (res.memoryUnlockedTitle) {
          cozyAudio.playMemoryChime();
          showToast(`Memory saved: ${res.memoryUnlockedTitle}`);
        }
      } else if (target.kind === 'bakery_prop') {
        const bid = target.bakeryPropId ?? (target.id as BakeryInteractableId);
        const res = interactWithBakeryProp(current, bid);
        if (res.actionType === 'exit_bakery') {
          playSceneVeil(() => {
            commitWorld(res.nextWorld);
            cozyAudio.playUiTap(0.98);
            showToast('Stepped out beside Hearth & Crumb Bakery.');
          });
          return;
        }
        if (res.nextWorld !== current) {
          commitWorld(res.nextWorld);
        }
        triggerPlayerPulse('interact', target.worldPos);
        cozyAudio.playUiTap(1.04);
        setDialogueSession(null);
        setActivePropId(null);
        setPropCard({ ...res, subjectImageKey: subjectKeyForBakeryProp(bid) });
        if (res.memoryUnlockedTitle) {
          cozyAudio.playMemoryChime();
          showToast(`Memory saved: ${res.memoryUnlockedTitle}`);
        }
      } else {
        const pid = target.id as PropInteractableId;
        if (pid === 'player_door') {
          playSceneVeil(() => {
            const enteredNow = enterCottageAction(worldRef.current);
            commitWorld(enteredNow.nextWorld);
            cozyAudio.playUiTap(1.06);
            if (enteredNow.toast) {
              showToast(enteredNow.toast);
            }
          });
          return;
        }
        if (pid === 'greenhouse_door') {
          playSceneVeil(() => {
            const enteredNow = enterGreenhouseAction(worldRef.current);
            commitWorld(enteredNow.nextWorld);
            cozyAudio.playUiTap(1.06);
            if (enteredNow.toast) {
              showToast(enteredNow.toast);
            }
          });
          return;
        }
        if (pid === 'bakery_door') {
          playSceneVeil(() => {
            const enteredNow = enterBakeryAction(worldRef.current);
            commitWorld(enteredNow.nextWorld);
            cozyAudio.playUiTap(1.06);
            if (enteredNow.toast) {
              showToast(enteredNow.toast);
            }
          });
          return;
        }
        if (pid === 'nook_door') {
          playSceneVeil(() => {
            const enteredNow = enterNookAction(worldRef.current);
            commitWorld(enteredNow.nextWorld);
            cozyAudio.playUiTap(1.06);
            if (enteredNow.toast) {
              showToast(enteredNow.toast);
            }
          });
          return;
        }
        if (pid === 'copperwheel_door') {
          playSceneVeil(() => {
            const enteredNow = enterCopperwheelAction(worldRef.current);
            commitWorld(enteredNow.nextWorld);
            cozyAudio.playUiTap(1.06);
            if (enteredNow.toast) {
              showToast(enteredNow.toast);
            }
          });
          return;
        }
        const res = interactWithProp(current, pid);
        if (res.nextWorld !== current) {
          commitWorld(res.nextWorld);
        }
        const metrics = getPropInteractionMetrics(pid, current.playerPos);
        triggerPlayerPulse('interact', metrics.focusPos);
        if (res.memoryUnlockedTitle) {
          cozyAudio.playMemoryChime();
          showToast(`Memory saved: ${res.memoryUnlockedTitle}`);
        } else if (res.nextWorld !== current) {
          cozyAudio.playUiTap(1.1);
        }
        setDialogueSession(null);
        setActivePropId(pid);
        setPropCard({ ...res, subjectImageKey: subjectKeyForPropId(pid) });
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

  const handleGiveGift = useCallback(
    (itemId: PersonalItemId) => {
      if (!dialogueSession) return;
      const res = giveInventoryItemAction(
        worldRef.current,
        dialogueSession.residentId,
        itemId,
        dialogueSession,
      );
      if (res.ok) {
        commitWorld(res.nextWorld);
        setDialogueSession(res.nextSession);
        triggerPlayerPulse('talk');
        if (res.keepsakeAwardedId) {
          cozyAudio.playMemoryChime();
        } else {
          cozyAudio.playUiTap(1.14);
        }
      } else {
        cozyAudio.playUiTap(0.92);
      }
      if (res.toast) {
        showToast(res.toast);
      }
    },
    [commitWorld, dialogueSession, showToast, triggerPlayerPulse],
  );

  const handleCookRecipe = useCallback(
    (recipeId: string) => {
      const res = cookRecipeAction(worldRef.current, recipeId);
      if (res.ok) {
        commitWorld(res.nextWorld);
        triggerPlayerPulse('interact');
        if (res.memoryUnlockedTitle) {
          cozyAudio.playMemoryChime();
        } else {
          cozyAudio.playUiTap(1.12);
        }
      }
      if (res.toast) {
        showToast(res.toast);
      }
    },
    [commitWorld, showToast, triggerPlayerPulse],
  );

  const handlePlaceFlower = useCallback(
    (flowerId: PersonalItemId | null) => {
      const res = placeFlowerInVaseAction(worldRef.current, flowerId);
      if (res.ok) {
        commitWorld(res.nextWorld);
        triggerPlayerPulse('interact');
        cozyAudio.playArrangePop();
      }
      if (res.toast) {
        showToast(res.toast);
      }
    },
    [commitWorld, showToast, triggerPlayerPulse],
  );

  const handleToggleKeepsake = useCallback(
    (keepsakeId: PersonalItemId) => {
      const res = toggleDisplayedKeepsakeAction(worldRef.current, keepsakeId);
      if (res.ok) {
        commitWorld(res.nextWorld);
        triggerPlayerPulse('interact');
        cozyAudio.playArrangePop();
      }
      if (res.toast) {
        showToast(res.toast);
      }
    },
    [commitWorld, showToast, triggerPlayerPulse, playSceneVeil],
  );

  // M3 Build 6 — Sunbeam Greenhouse shared growing-corner handlers
  const handlePlantSeed = useCallback(
    (seedItemId: 'chamomile_seeds' | 'lavender_seeds' | 'thyme_seeds', plotIndex: number) => {
      const res = plantSeedAtPlotAction(worldRef.current, seedItemId, plotIndex);
      if (res.ok) {
        commitWorld(res.nextWorld);
        triggerPlayerPulse('interact');
        if (res.memoryUnlockedTitle) {
          cozyAudio.playMemoryChime();
        } else {
          cozyAudio.playArrangePop();
        }
      } else {
        cozyAudio.playUiTap(0.9);
      }
      if (res.toast) {
        showToast(res.toast);
      }
    },
    [commitWorld, showToast, triggerPlayerPulse],
  );

  const handleHarvestPlot = useCallback(
    (plotIndex: number) => {
      const res = harvestPlotAction(worldRef.current, plotIndex);
      if (res.ok) {
        commitWorld(res.nextWorld);
        triggerPlayerPulse('interact');
        if (res.memoryUnlockedTitle) {
          cozyAudio.playMemoryChime();
        } else {
          cozyAudio.playUiTap(1.14);
        }
      } else {
        cozyAudio.playUiTap(0.9);
      }
      if (res.toast) {
        showToast(res.toast);
      }
    },
    [commitWorld, showToast, triggerPlayerPulse],
  );

  const handleWaterAll = useCallback(() => {
    const res = waterGreenhousePlotsAction(worldRef.current);
    if (res.nextWorld !== worldRef.current) {
      commitWorld(res.nextWorld);
      triggerPlayerPulse('interact');
      cozyAudio.playWaterSplash();
    } else {
      cozyAudio.playUiTap(0.9);
    }
    showToast(res.body);
  }, [commitWorld, showToast, triggerPlayerPulse]);

  const handlePropAction = useCallback(
    (actionType: NonNullable<PropInteractionResult['actionType']>) => {
      if (actionType === 'rest_next_day') {
        playSceneVeil(() => {
          const nextDayWorld = performNextDayRest(worldRef.current);
          commitWorld(nextDayWorld);
          setActivePropId(null);
          setPropCard(null);
          cozyAudio.playMemoryChime();
          // Pass 12: the wake toast names the weather & season the new day rolled.
          const wakeLine = buildMorningWakeLine(
            nextDayWorld.weather ?? 'sunlit',
            nextDayWorld.season ?? 'spring',
          );
          showToast(
            `Good morning! Day ${nextDayWorld.day} begins in Little Somewhere. ${wakeLine}`,
          );
        });
      } else if (actionType === 'enter_cottage') {
        playSceneVeil(() => {
          const entered = enterCottageAction(worldRef.current);
          commitWorld(entered.nextWorld);
          setActivePropId(null);
          setPropCard(null);
          cozyAudio.playUiTap(1.06);
          showToast(entered.toast);
        });
      } else if (actionType === 'exit_cottage') {
        playSceneVeil(() => {
          const exited = exitCottageAction(worldRef.current);
          commitWorld(exited.nextWorld);
          setActivePropId(null);
          setPropCard(null);
          cozyAudio.playUiTap(0.98);
          showToast(exited.toast);
        });
      } else if (actionType === 'hearth_panel') {
        setActivePropId(null);
        setPropCard(null);
        setCottageStationMode('hearth');
      } else if (actionType === 'vase_panel') {
        setActivePropId(null);
        setPropCard(null);
        setCottageStationMode('vase');
      } else if (actionType === 'shelf_panel') {
        setActivePropId(null);
        setPropCard(null);
        setCottageStationMode('shelf');
      } else if (actionType === 'enter_greenhouse') {
        playSceneVeil(() => {
          const entered = enterGreenhouseAction(worldRef.current);
          commitWorld(entered.nextWorld);
          setActivePropId(null);
          setPropCard(null);
          cozyAudio.playUiTap(1.06);
          showToast(entered.toast);
        });
      } else if (actionType === 'enter_nook') {
        playSceneVeil(() => {
          const entered = enterNookAction(worldRef.current);
          commitWorld(entered.nextWorld);
          setActivePropId(null);
          setPropCard(null);
          cozyAudio.playUiTap(1.06);
          showToast(entered.toast);
        });
      } else if (actionType === 'exit_nook') {
        playSceneVeil(() => {
          const exited = exitNookAction(worldRef.current);
          commitWorld(exited.nextWorld);
          setActivePropId(null);
          setPropCard(null);
          cozyAudio.playUiTap(0.98);
          showToast(exited.toast);
        });
      } else if (actionType === 'enter_copperwheel') {
        playSceneVeil(() => {
          const entered = enterCopperwheelAction(worldRef.current);
          commitWorld(entered.nextWorld);
          setActivePropId(null);
          setPropCard(null);
          cozyAudio.playUiTap(1.06);
          showToast(entered.toast);
        });
      } else if (actionType === 'exit_copperwheel') {
        playSceneVeil(() => {
          const exited = exitCopperwheelAction(worldRef.current);
          commitWorld(exited.nextWorld);
          setActivePropId(null);
          setPropCard(null);
          cozyAudio.playUiTap(0.98);
          showToast(exited.toast);
        });
      } else if (actionType === 'enter_bakery') {
        playSceneVeil(() => {
          const entered = enterBakeryAction(worldRef.current);
          commitWorld(entered.nextWorld);
          setActivePropId(null);
          setPropCard(null);
          cozyAudio.playUiTap(1.06);
          showToast(entered.toast);
        });
      } else if (actionType === 'exit_bakery') {
        playSceneVeil(() => {
          const exited = exitBakeryAction(worldRef.current);
          commitWorld(exited.nextWorld);
          setActivePropId(null);
          setPropCard(null);
          cozyAudio.playUiTap(0.98);
          showToast(exited.toast);
        });
      } else if (actionType === 'exit_greenhouse') {
        playSceneVeil(() => {
          const exited = exitGreenhouseAction(worldRef.current);
          commitWorld(exited.nextWorld);
          setActivePropId(null);
          setPropCard(null);
          cozyAudio.playUiTap(0.98);
          showToast(exited.toast);
        });
      } else if (actionType === 'greenhouse_planting_panel') {
        setActivePropId(null);
        setPropCard(null);
        setGreenhousePanelMode('planting');
      } else if (actionType === 'greenhouse_harvest_panel') {
        setActivePropId(null);
        setPropCard(null);
        setGreenhousePanelMode('harvest');
      } else if (actionType === 'ring_bell') {
        const res = performRingBellAction(worldRef.current);
        commitWorld(res.nextWorld);
        setBellRingCounter((c) => c + 1);
        const bellMetrics = getPropInteractionMetrics('gazebo_bell', res.nextWorld.playerPos);
        triggerPlayerPulse('interact', bellMetrics.focusPos);
        setActivePropId(null);
        setPropCard(null);
        showToast(res.toast);
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
    [commitWorld, showToast, triggerPlayerPulse, playSceneVeil],
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
        if (cottageStationMode) {
          setCottageStationMode(null);
          return;
        }
        if (greenhousePanelMode) {
          setGreenhousePanelMode(null);
          return;
        }
        if (inventoryOpen) {
          setInventoryOpen(false);
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
        setInventoryOpen(false);
        setCottageStationMode(null);
        setGreenhousePanelMode(null);
        setJournalOpen((o) => !o);
        return;
      }

      if (e.code === 'KeyI') {
        e.preventDefault();
        setJournalOpen(false);
        setCottageStationMode(null);
        setGreenhousePanelMode(null);
        setInventoryOpen((o) => !o);
        return;
      }

      if (
        e.code === 'KeyE' &&
        nearestTarget &&
        !dialogueSession &&
        !propCard &&
        !journalOpen &&
        !inventoryOpen &&
        !cottageStationMode &&
        !greenhousePanelMode
      ) {
        e.preventDefault();
        openTargetInteraction(nearestTarget);
        return;
      }

      if (
        e.code === 'KeyG' &&
        worldRef.current.playerHeldItem &&
        !dialogueSession &&
        !propCard &&
        !journalOpen &&
        !inventoryOpen &&
        !cottageStationMode &&
        !greenhousePanelMode
      ) {
        e.preventDefault();
        handlePlaceHeldItem();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    cottageStationMode,
    dialogueSession,
    greenhousePanelMode,
    handlePlaceHeldItem,
    handleStartGame,
    handleToggleMute,
    inventoryOpen,
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
      playerLocation: PlayerLocation;
      nearestTarget: InteractiveTarget | null;
      nearbyBubble: HudBubbleSnapshot | null;
      weather: WeatherType;
      season: SeasonType;
    }) => {
      setHudClock(snap.minuteOfDay);
      setPlayerPos(snap.playerPos);
      setPlayerLocation(snap.playerLocation);
      setPlayerHeldItem(snap.playerHeldItem);
      setNearestTarget(snap.nearestTarget);
      setNearbyBubble(snap.nearbyBubble);
      setHudWeather(snap.weather);
      setHudSeason(snap.season);
      if (!introTipDismissed) {
        const moved = Math.hypot(
          snap.playerPos.x - spawnPosRef.current.x,
          snap.playerPos.z - spawnPosRef.current.z,
        );
        if (moved > 0.35 || snap.nearestTarget) {
          setIntroTipDismissed(true);
        }
      }
    },
    [introTipDismissed],
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
  const isIndoors = playerLocation !== 'exterior';
  const locationLabel =
    playerLocation === 'cottage_interior'
      ? 'Willow Step Cottage'
      : playerLocation === 'greenhouse_interior'
      ? 'Sunbeam Greenhouse'
      : playerLocation === 'bakery_interior'
      ? 'Hearth & Crumb Bakery'
      : playerLocation === 'nook_interior'
      ? 'Linden Book Nook'
      : playerLocation === 'copperwheel_interior'
      ? 'Copperwheel Cottage'
      : landmark.name;
  const isSheetOpen = Boolean(dialogueSession || propCard);
  const anyModalOpen =
    isSheetOpen ||
    journalOpen ||
    inventoryOpen ||
    Boolean(cottageStationMode) ||
    Boolean(greenhousePanelMode);

  return (
    <main className="relative w-full h-full overflow-hidden">
      {/* Persistent 3D Isometric World Viewport (lazy chunk, R-09) */}
      <SceneErrorBoundary>
        <Suspense fallback={<div className="absolute inset-0 bg-[#DCEBF2]" aria-hidden="true" />}>
          <NeighborhoodCanvas
            screenState={screenState}
            worldRef={worldRef}
            joystickVectorRef={joystickVectorRef}
            zoomRef={zoomRef}
            bellRingCounter={bellRingCounter}
            fountainWishCounter={fountainWishCounter}
            pondSkipCounter={pondSkipCounter}
            isDialogueOpen={anyModalOpen}
            activeDialogueResidentId={dialogueSession?.residentId ?? null}
            activePropId={propCard ? activePropId : null}
            playerActionPulse={playerActionPulse}
            onHudSync={handleHudSync}
            onSelectTarget={openTargetInteraction}
          />
        </Suspense>
      </SceneErrorBoundary>

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
            <div className="bg-[#FAF5EC]/95 border border-[#D4C4AE] rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-[0_6px_20px_rgba(45,36,30,0.12)] pointer-events-auto min-w-0 max-w-[172px] sm:max-w-md">
              <div className="font-display text-sm sm:text-lg font-semibold text-[#2D241E] truncate">
                {locationLabel}
              </div>
              <div className="text-[11px] sm:text-xs text-[#6A5B50] flex items-center gap-1 sm:gap-1.5 font-mono-nums whitespace-nowrap truncate">
                <span>Day {worldSnapshot.day}</span>
                <span aria-hidden="true">·</span>
                <span>{formatClock(hudClock)}</span>
                <span className="hidden sm:inline" aria-hidden="true">·</span>
                <span className="hidden sm:inline font-sans">
                  {isIndoors ? 'Indoors' : phaseLabel}
                </span>
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
                  setJournalOpen(false);
                  setCottageStationMode(null);
                  setGreenhousePanelMode(null);
                  setInventoryOpen(true);
                }}
                aria-label="Open Satchel"
                title="Satchel & Keepsakes [I]"
                className="min-h-[44px] min-w-[44px] px-2.5 sm:px-3.5 py-2 rounded-xl bg-[#FAF5EC]/95 hover:bg-[#F1E8D9] border border-[#D4C4AE] text-[#2D241E] text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                <ShoppingBag className="w-4 h-4 text-[#5E8062] shrink-0" />
                <span className="hidden sm:inline">Satchel</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  cozyAudio.playUiTap(1.05);
                  setInventoryOpen(false);
                  setCottageStationMode(null);
                  setGreenhousePanelMode(null);
                  setJournalOpen(true);
                }}
                aria-label="Open Pocket Journal"
                title="Pocket Journal [J]"
                className="min-h-[44px] min-w-[44px] px-2.5 sm:px-3.5 py-2 rounded-xl bg-[#FAF5EC]/95 hover:bg-[#F1E8D9] border border-[#D4C4AE] text-[#2D241E] text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4 text-[#C86446] shrink-0" />
                <span className="hidden sm:inline">Journal</span>
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

          {/* Gentle Memory / Story Toast or Lightweight Nearby Neighbor Whisper */}
          {toastText ? (
            <div className="self-center mt-1.5 bg-[#FAF5EC]/95 border border-[#C86446]/40 rounded-xl px-3.5 py-1.5 shadow-[0_6px_18px_rgba(45,36,30,0.16)] flex items-center gap-2 text-xs sm:text-sm font-medium text-[#2D241E]">
              <Sparkles className="w-3.5 h-3.5 text-[#C86446] shrink-0" />
              <span>{toastText}</span>
            </div>
          ) : (
            nearbyBubble &&
            !anyModalOpen &&
            screenState === 'playing' && (
              <div className="self-center mt-1.5 max-w-[300px] sm:max-w-sm bg-[#FAF5EC]/88 border border-[#D4C4AE]/80 rounded-xl px-3 py-1 shadow-sm text-[11px] sm:text-xs text-[#2D241E] text-center">
                <span className="font-display font-semibold text-[#C86446]">
                  {nearbyBubble.name}:
                </span>{' '}
                <span>“{nearbyBubble.text}”</span>
              </div>
            )
          )}

          {/* Bottom Controls: Left Thumbstick (touch devices only) + Contextual Interact & Held Item CTA */}
          {!anyModalOpen && screenState === 'playing' && (
            <div className="flex items-end justify-between gap-3 sm:gap-4 pb-1">
              {hasTouchInput ? (
                <VirtualJoystick vectorRef={joystickVectorRef} />
              ) : (
                <div className="hidden" aria-hidden="true" />
              )}

              <div className="ml-auto flex flex-col items-end gap-2 pointer-events-auto min-w-0 max-w-[240px] sm:max-w-none">
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
                  !introTipDismissed && (
                    <button
                      type="button"
                      data-testid="intro-control-tip"
                      onClick={() => setIntroTipDismissed(true)}
                      className="min-h-[44px] bg-[#FAF5EC]/90 hover:bg-[#FAF5EC] border border-[#D4C4AE] rounded-xl px-3.5 py-2 text-[11px] sm:text-xs text-[#5E5046] shadow-sm text-right leading-snug cursor-pointer transition-opacity"
                    >
                      <span>Walk or tap neighbors to talk</span>
                      <span className="hidden sm:inline"> · Shift sprints</span>
                    </button>
                  )
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
        onGiveGift={handleGiveGift}
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

      {/* Personal Satchel Drawer */}
      <InventoryDrawer
        open={inventoryOpen}
        world={worldSnapshot}
        playerLocation={playerLocation}
        onClose={() => setInventoryOpen(false)}
        onOpenCottageStation={(mode) => setCottageStationMode(mode)}
      />

      {/* Willow Step Cottage Home Stations (Hearth, Table Vase, Keepsake Shelf) */}
      <CottageStationModal
        mode={cottageStationMode}
        world={worldSnapshot}
        onChangeMode={(mode) => setCottageStationMode(mode)}
        onClose={() => setCottageStationMode(null)}
        onCookRecipe={handleCookRecipe}
        onPlaceFlower={handlePlaceFlower}
        onToggleKeepsake={handleToggleKeepsake}
      />

      {/* Sunbeam Greenhouse Station Panels (M3 Build 6) */}
      <GreenhousePanel
        mode={greenhousePanelMode}
        world={worldSnapshot}
        onClose={() => setGreenhousePanelMode(null)}
        onPlantSeed={handlePlantSeed}
        onHarvestPlot={handleHarvestPlot}
        onWaterAll={handleWaterAll}
      />

      {/* Pocket Journal Drawer */}
      <JournalDrawer
        open={journalOpen}
        world={worldSnapshot}
        onClose={() => setJournalOpen(false)}
        onAdvanceTime={handleAdvanceTwoHours}
      />

      {/* Soft storybook veil for door / rest scene transitions */}
      <div
        aria-hidden="true"
        data-testid="scene-veil"
        className={`fixed inset-0 z-[45] pointer-events-none bg-[#F6EEDF] transition-opacity duration-300 ${
          veilActive ? 'opacity-100' : 'opacity-0'
        }`}
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
          setInventoryOpen(false);
          setCottageStationMode(null);
          setGreenhousePanelMode(null);
          setScreenState('title');
        }}
      />
    </main>
  );
}

// Keep fresh world helper accessible if needed
export { createFreshWorldState };
