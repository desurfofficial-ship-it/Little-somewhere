import { Component, ErrorInfo, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { SeasonGlyph, WeatherGlyph } from './components/icons';
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
import { advanceClockAndReconcile } from './game/invitations';
import { completeSharedActivity } from './game/activities';
import { buildMorningWakeLine, buildResidentDialogue } from './game/narrative';
import { countJournalUnread, loadJournalReadKeys } from './game/journal';
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
import {
  COMMUNITY_REASON_LABELS,
  contributeToCommunityProject,
} from './game/community';
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
import {
  NeighborhoodCanvas,
  type HudBubbleSnapshot,
  type PlayerActionPulse,
} from './scene/NeighborhoodCanvas';
import { TitleOverlay } from './components/TitleOverlay';
import { VirtualJoystick } from './components/VirtualJoystick';
import { ZOOM_MAX, ZOOM_MIN } from './scene/roomFraming';
import { DialogueSheet } from './components/DialogueSheet';
import { JournalDrawer } from './components/JournalDrawer';
import { CottageStationMode, InventoryDrawer } from './components/InventoryDrawer';
import { CottageStationModal } from './components/CottageStationModal';
import { GreenhousePanel, GreenhousePanelMode } from './components/GreenhousePanel';
import { CommunityProjectsPanel } from './components/CommunityProjectsPanel';
import { PauseModal } from './components/PauseModal';

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
          {/* WP3: failures must be announced, not just drawn. */}
          <div
            role="alert"
            className="bg-linen border border-stone-line rounded-2xl p-6 max-w-sm text-center shadow-elevation-sheet"
          >
            <h2 className="font-display text-lg font-semibold text-espresso mb-2">
              Willow Lane Needs a Fresh Breeze
            </h2>
            <p className="text-sm text-espresso-muted mb-4">
              The 3D neighborhood view couldn’t finish loading. Reload to reconnect cleanly.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-terracotta-deep hover:bg-terracotta text-linen text-sm font-semibold cursor-pointer transition-colors"
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
  // Overhaul G-13: autosave failure surfaces once per session, not every 5 s.
  const saveFailureToastedRef = useRef(false);

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
  // Everyday Gameplay GA-5 — plaza noticeboard community contribution shelf.
  const [communityProjectsOpen, setCommunityProjectsOpen] = useState<boolean>(false);
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

  // WP4: two-deep toast queue — rapid chains (e.g. "Stepped inside…" +
  // "Memory saved: …") no longer clobber each other, identical strings restart
  // the timer, and every event gets its full confirmation window.
  const toastTextRef = useRef<string | null>(null);
  const pendingToastRef = useRef<string | null>(null);
  const [toastSeq, setToastSeq] = useState(0);

  const showToast = useCallback((msg: string) => {
    if (toastTextRef.current !== null) {
      pendingToastRef.current = msg;
      return;
    }
    toastTextRef.current = msg;
    setToastText(msg);
    setToastSeq((s) => s + 1);
  }, []);

  // WP-3 (audit-1e F-UX-1): sim-tick Wild Hollows discoveries now surface in the HUD.
  // The canvas owns the chime + sparkle burst; App owns the toast copy.
  const handleDiscoveryFound = useCallback(
    (discoveryName: string) => {
      showToast(`Discovered ${discoveryName}`);
    },
    [showToast],
  );

  // Fade to a warm linen veil, run the transition at the covered midpoint, then release.
  const playSceneVeil = useCallback((midpoint: () => void) => {
    for (const t of veilTimersRef.current) window.clearTimeout(t);
    veilTimersRef.current = [];
    setVeilActive(true);
    veilTimersRef.current.push(window.setTimeout(midpoint, 250));
    veilTimersRef.current.push(window.setTimeout(() => setVeilActive(false), 640));
  }, []);

  useEffect(() => {
    toastTextRef.current = toastText;
    if (!toastText) return;
    const t = window.setTimeout(() => {
      const next = pendingToastRef.current;
      pendingToastRef.current = null;
      if (next) {
        toastTextRef.current = next;
        setToastText(next);
        setToastSeq((s) => s + 1);
      } else {
        toastTextRef.current = null;
        setToastText(null);
      }
    }, 3400);
    return () => window.clearTimeout(t);
  }, [toastText, toastSeq]);

  // Brief intro tip auto-dismisses so the play screen never holds an idle box forever.
  // WP4: generous window — the tip now teaches the core surfaces, so it stays
  // until the player's first real interaction or 14s, never on mere movement.
  useEffect(() => {
    if (screenState !== 'playing' || introTipDismissed) return;
    const timer = window.setTimeout(() => setIntroTipDismissed(true), 14000);
    return () => window.clearTimeout(timer);
  }, [screenState, introTipDismissed]);

  // WP4: the tip has done its job once the player actually talks/inspects
  // something — opening any narrative surface is the strongest "they get it"
  // signal (movement is NOT a dismissal trigger; targets exist at spawn).
  useEffect(() => {
    if (dialogueSession || propCard) {
      setIntroTipDismissed(true);
    }
  }, [dialogueSession, propCard]);

  // WP1: reward/status toasts render above every modal layer, so recompute
  // the journal unread badge when the journal closes (the drawer persists its
  // read-state on close/tab-switch) and on each discrete world commit.
  const [journalReadVersion, setJournalReadVersion] = useState(0);
  useEffect(() => {
    if (!journalOpen) {
      setJournalReadVersion((v) => v + 1);
    }
  }, [journalOpen]);
  const journalUnreadCount = useMemo(() => {
    return countJournalUnread(worldSnapshot, loadJournalReadKeys());
    // journalReadVersion: re-read persisted read-state when the journal closes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldSnapshot, journalReadVersion]);

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
    setCommunityProjectsOpen(false);
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
        if (
          (target.seatId ?? target.id) === 'nook_seat_armchair' &&
          current.occupancy?.stationId === 'nook_chair'
        ) {
          const nookChairRes = interactWithNookProp(current, 'nook_chair');
          triggerPlayerPulse('interact', target.worldPos);
          cozyAudio.playUiTap(1.04);
          setDialogueSession(null);
          setActivePropId(null);
          setPropCard({ ...nookChairRes, subjectImageKey: subjectKeyForNookProp('nook_chair') });
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
      // Workstream D: a held-item delivery choice (the synthetic
      // 'gift_<item>_<resident>' choice from actions.deliverHeldItemAction and
      // the 'deliver_<item>_to_<resident>' choice from dialogueEngine's
      // buildDynamicGiftChoice both carry deliverHeldItem) gets the gift
      // hand-off pulse instead of the generic talk nod.
      triggerPlayerPulse(choice.deliverHeldItem ? 'gift' : 'talk');
      if (memoryUnlockedTitle) {
        cozyAudio.playMemoryChime();
        showToast(`Memory saved: ${memoryUnlockedTitle}`);
      } else {
        cozyAudio.playUiTap(1.08);
        if (nextSession?.recentToast) {
          showToast(nextSession.recentToast);
        }
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
        triggerPlayerPulse('gift');
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
    (
      seedItemId: 'chamomile_seeds' | 'lavender_seeds' | 'thyme_seeds' | 'foxglove_seeds',
      plotIndex: number,
    ) => {
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

  // Everyday Gameplay GA-1/GA-5 — plaza noticeboard contribution handler.
  // The CommunityProjectsPanel stays view-only; this callback owns the reducer,
  // world commit, toast, and memory chime. Panel stays open: state updates flow
  // through commitWorld.
  const handleContribute = useCallback(
    (projectId: string, itemId: PersonalItemId, amount: number) => {
      const res = contributeToCommunityProject(worldRef.current, projectId, itemId, amount);
      if (!res.ok) {
        cozyAudio.playUiTap(0.9);
        showToast(COMMUNITY_REASON_LABELS[res.reason!] ?? 'The basket holds still.');
        return;
      }
      commitWorld(res.world);
      triggerPlayerPulse('interact');
      if (res.memoryUnlockedTitle) {
        cozyAudio.playMemoryChime();
      } else {
        cozyAudio.playUiTap(1.12);
      }
      if (res.toast) {
        showToast(res.toast);
      }
    },
    [commitWorld, showToast, triggerPlayerPulse],
  );

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
      } else if (actionType === 'community_projects_panel') {
        setActivePropId(null);
        setPropCard(null);
        setCommunityProjectsOpen(true);
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
      } else if (actionType === 'share_featured_reading') {
        const res = completeSharedActivity(worldRef.current, 'share_featured_reading');
        if (res.ok) {
          commitWorld(res.world);
          triggerPlayerPulse('interact', { x: -0.9, z: 1.65 });
          cozyAudio.playMemoryChime();
        } else {
          cozyAudio.playUiTap(0.95);
        }
        setActivePropId(null);
        setPropCard(null);
        if (res.toast) {
          showToast(res.toast);
        }
      }
    },
    [commitWorld, showToast, triggerPlayerPulse, playSceneVeil],
  );

  const handleAdvanceTwoHours = useCallback(() => {
    cozyAudio.playUiTap(1.02);
    const current = worldRef.current;
    const res = advanceClockAndReconcile(current, 120);
    commitWorld(res.world);
    const nextPhase = getTimePhase(res.world.minuteOfDay);
    if (res.expired && res.toast) {
      showToast(res.toast);
    } else {
      showToast(`Time drifted forward to ${formatClock(res.world.minuteOfDay)} (${nextPhase})`);
    }
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
        // Overhaul G-14: mute follows the same modal gating as every other
        // gameplay shortcut instead of leaking through dialogue/panels.
        if (screenState === 'playing' && !dialogueSession && !propCard) {
          handleToggleMute();
        }
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        // WP1 (UI/UX program): unwind the visually top-most surface first.
        // Journal/satchel/station panels render above the dialogue sheet
        // (z-40 > z-30), so they close before a conversation underneath them.
        if (cottageStationMode) {
          setCottageStationMode(null);
          return;
        }
        if (greenhousePanelMode) {
          setGreenhousePanelMode(null);
          return;
        }
        if (communityProjectsOpen) {
          setCommunityProjectsOpen(false);
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
        if (dialogueSession || propCard) {
          setDialogueSession(null);
          setActivePropId(null);
          setPropCard(null);
          return;
        }
        setScreenState((prev) => (prev === 'playing' ? 'paused' : 'playing'));
        return;
      }

      if (screenState !== 'playing') return;

      // WP1: conversations are protected surfaces — the journal/satchel must
      // never stack a second role="dialog" over an active dialogue sheet or
      // prop inspection (keyboard users could otherwise act on hidden UI).
      if (e.code === 'KeyJ' && !dialogueSession && !propCard) {
        e.preventDefault();
        setInventoryOpen(false);
        setCottageStationMode(null);
        setGreenhousePanelMode(null);
        setCommunityProjectsOpen(false);
        setJournalOpen((o) => !o);
        return;
      }

      if (e.code === 'KeyI' && !dialogueSession && !propCard) {
        e.preventDefault();
        setJournalOpen(false);
        setCottageStationMode(null);
        setGreenhousePanelMode(null);
        setCommunityProjectsOpen(false);
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
        !greenhousePanelMode &&
        !communityProjectsOpen
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
        !greenhousePanelMode &&
        !communityProjectsOpen
      ) {
        e.preventDefault();
        handlePlaceHeldItem();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    communityProjectsOpen,
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
        const saveRes = saveWorldState(current);
        // Overhaul G-13: autosave failures are no longer swallowed — surface
        // them once so a silent no-persistence session cannot go unnoticed.
        if (!saveRes.ok && !saveFailureToastedRef.current) {
          saveFailureToastedRef.current = true;
          showToast(
            saveRes.error === 'future-schema save preserved; autosave skipped'
              ? 'A newer save was preserved — autosave paused for this session'
              : 'Autosave could not write — progress may not persist',
          );
        }
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
      // WP4: the intro tip is no longer movement/target-dismissed — targets
      // exist at spawn (cottage door), which previously erased onboarding for
      // 100% of fresh saves. Dismissal now happens on first interaction only.
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
    Boolean(greenhousePanelMode) ||
    communityProjectsOpen;

  return (
    <main className="relative w-full h-full overflow-hidden">
      {/* Persistent 3D Isometric World Viewport */}
      <SceneErrorBoundary>
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
          onDiscoveryFound={handleDiscoveryFound}
          onSelectTarget={openTargetInteraction}
        />
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
        <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between safe-area-pad">
          {/* Top Bar: Left Location & Clock | Right Compact Utility Buttons */}
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="bg-linen/95 border border-stone-line rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-elevation-card pointer-events-auto min-w-0 max-w-[172px] sm:max-w-md">
              <div className="font-display text-sm sm:text-lg font-semibold text-espresso truncate">
                {locationLabel}
              </div>
              <div className="text-[11px] sm:text-xs text-espresso-muted flex items-center gap-1 sm:gap-1.5 font-mono-nums whitespace-nowrap truncate">
                <span>Day {worldSnapshot.day}</span>
                <span aria-hidden="true">·</span>
                <span>{formatClock(hudClock)}</span>
                <span className="hidden sm:inline" aria-hidden="true">·</span>
                <span className="hidden sm:inline font-sans">
                  {isIndoors ? 'Indoors' : phaseLabel}
                </span>
                <span className="hidden md:inline" aria-hidden="true">·</span>
                <span className="hidden md:inline font-sans inline-flex items-center gap-1">
                  <SeasonGlyph season={hudSeason} className="w-3.5 h-3.5 text-sage shrink-0" />
                  {getSeasonLabel(hudSeason)}
                  <span aria-hidden="true">·</span>
                  <WeatherGlyph weather={hudWeather} className="w-3.5 h-3.5 text-terracotta shrink-0" />
                  {getWeatherLabel(hudWeather)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto flex-nowrap shrink-0">
              <button
                type="button"
                onClick={handleAdvanceTwoHours}
                aria-label="Advance time 2 hours"
                title="Advance time 2 hours"
                className="flex min-h-[44px] min-w-[44px] sm:min-w-0 px-3 py-2 justify-center rounded-xl bg-linen/95 hover:bg-linen-deep border border-stone-line text-espresso text-xs font-semibold items-center gap-1.5 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                <Clock className="w-4 h-4 text-terracotta" />
                <span className="hidden sm:inline">+2h</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  cozyAudio.playUiTap(1.05);
                  setJournalOpen(false);
                  setCottageStationMode(null);
                  setGreenhousePanelMode(null);
                  setCommunityProjectsOpen(false);
                  setInventoryOpen(true);
                }}
                aria-label="Open Satchel"
                title="Satchel & Keepsakes [I]"
                className="min-h-[44px] min-w-[44px] px-2.5 sm:px-3.5 py-2 rounded-xl bg-linen/95 hover:bg-linen-deep border border-stone-line text-espresso text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                <ShoppingBag className="w-4 h-4 text-sage shrink-0" />
                <span className="hidden sm:inline">Satchel</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  cozyAudio.playUiTap(1.05);
                  setInventoryOpen(false);
                  setCottageStationMode(null);
                  setGreenhousePanelMode(null);
                  setCommunityProjectsOpen(false);
                  setJournalOpen(true);
                }}
                aria-label={
                  journalUnreadCount > 0
                    ? `Open Pocket Journal — ${journalUnreadCount} new ${journalUnreadCount === 1 ? 'entry' : 'entries'}`
                    : 'Open Pocket Journal'
                }
                title="Pocket Journal [J]"
                className="relative min-h-[44px] min-w-[44px] px-2.5 sm:px-3.5 py-2 rounded-xl bg-linen/95 hover:bg-linen-deep border border-stone-line text-espresso text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4 text-terracotta shrink-0" />
                <span className="hidden sm:inline">Journal</span>
                {journalUnreadCount > 0 && (
                  <span
                    data-testid="journal-unread-badge"
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-terracotta-deep text-linen text-[10px] font-bold font-mono-nums flex items-center justify-center shadow-sm"
                  >
                    {journalUnreadCount > 99 ? '99+' : journalUnreadCount}
                  </span>
                )}
              </button>

              <div className="hidden sm:flex items-center gap-1 bg-linen/95 border border-stone-line rounded-xl p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => {
                    zoomRef.current = Math.min(ZOOM_MAX, zoomRef.current + 0.14);
                  }}
                  aria-label="Zoom out"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-linen-deep text-espresso transition-colors cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    zoomRef.current = Math.max(ZOOM_MIN, zoomRef.current - 0.14);
                  }}
                  aria-label="Zoom in"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-linen-deep text-espresso transition-colors cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-linen/95 hover:bg-linen-deep border border-stone-line text-espresso shadow-sm transition-colors cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  // WP1: pausing is a hard interrupt — deterministically unwind
                  // every open surface so Play always resumes into clean HUD.
                  setDialogueSession(null);
                  setActivePropId(null);
                  setPropCard(null);
                  setJournalOpen(false);
                  setInventoryOpen(false);
                  setCottageStationMode(null);
                  setGreenhousePanelMode(null);
                  setScreenState('paused');
                }}
                aria-label="Pause game"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-linen/95 hover:bg-linen-deep border border-stone-line text-espresso shadow-sm transition-colors cursor-pointer"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Gentle Memory / Story Toast (the nearby whisper bubble moved to the bottom controls to avoid obstructing the scene focal point) */}
          {toastText && (
            <div
              role="status"
              aria-live="polite"
              className="self-center mt-1.5 bg-linen/95 border border-terracotta/40 rounded-xl px-3.5 py-1.5 shadow-elevation-card flex items-center gap-2 text-xs sm:text-sm font-medium text-espresso"
            >
              <Sparkles className="w-3.5 h-3.5 text-terracotta shrink-0" />
              <span>{toastText}</span>
            </div>
          )}

          {/* Bottom Controls: Nearby Whisper Bubble (moved from mid-screen) + Left Thumbstick + Contextual Interact & Held Item CTA */}
          {!anyModalOpen && screenState === 'playing' && (
            <div className="flex flex-col items-center gap-1.5 sm:gap-2 pb-1">
              {/* Lightweight Nearby Neighbor Whisper — docked at the bottom to keep the scene focal point unobstructed */}
              {nearbyBubble && !toastText && (
                <div
                  role="status"
                  aria-live="polite"
                  className="max-w-[300px] sm:max-w-sm bg-linen/88 border border-stone-line/80 rounded-xl px-3 py-1 shadow-sm text-[11px] sm:text-xs text-espresso text-center"
                >
                  <span className="font-display font-semibold text-terracotta">
                    {nearbyBubble.name}:
                  </span>{' '}
                  <span>“{nearbyBubble.text}”</span>
                </div>
              )}
              <div className="flex items-end justify-between gap-3 sm:gap-4 w-full">
              {hasTouchInput ? (
                <VirtualJoystick vectorRef={joystickVectorRef} />
              ) : (
                <div className="hidden" aria-hidden="true" />
              )}

              <div className="ml-auto flex flex-col items-end gap-2 pointer-events-auto min-w-0 max-w-[240px] sm:max-w-none">
                {/* WP4: seated-with-a-drink no longer traps the HUD on one option —
                    an explicit Stand Up escape hatch always accompanies the sip CTA. */}
                {nearestTarget?.kind === 'seat' && nearestTarget.sipItemId && (
                  <button
                    type="button"
                    onClick={() =>
                      openTargetInteraction({ ...nearestTarget, sipItemId: undefined })
                    }
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-linen/95 hover:bg-linen-deep border border-stone-line text-espresso text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Stand Up
                  </button>
                )}
                {!introTipDismissed && (
                  <button
                    type="button"
                    data-testid="intro-control-tip"
                    onClick={() => setIntroTipDismissed(true)}
                    className="min-h-[44px] bg-linen/90 hover:bg-linen border border-stone-line rounded-xl px-3.5 py-2 text-[11px] sm:text-xs text-umber shadow-sm text-right leading-snug cursor-pointer transition-opacity"
                  >
                    <span>Walk or tap neighbors to talk</span>
                    <span className="hidden sm:inline"> · Shift sprints · Journal [J] · Satchel [I]</span>
                    <span className="sm:hidden"> · Your Journal & Satchel are up top</span>
                  </button>
                )}

                {playerHeldItem && worldSnapshot.worldProps?.[playerHeldItem] && (
                  <button
                    type="button"
                    onClick={handlePlaceHeldItem}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-linen/95 hover:bg-linen-deep border border-stone-line text-espresso text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span className="hidden sm:inline">
                      Carrying {worldSnapshot.worldProps[playerHeldItem].label} ·
                    </span>
                    <span className="text-terracotta">Set Down</span>
                    <span className="hidden sm:inline text-xs text-espresso-muted font-mono-nums">[G]</span>
                  </button>
                )}

                {nearestTarget ? (
                  <button
                    type="button"
                    onClick={() => openTargetInteraction(nearestTarget)}
                    className="min-h-[48px] max-w-full px-4 sm:px-5 py-3 rounded-2xl bg-terracotta-deep hover:bg-terracotta active:scale-[0.98] text-linen font-semibold text-sm sm:text-base shadow-elevation-sheet flex items-center gap-2 sm:gap-2.5 transition-all cursor-pointer"
                  >
                    {nearestTarget.kind === 'resident' ? (
                      <MessageCircle className="w-4 h-4 shrink-0" />
                    ) : (
                      <Sparkles className="w-4 h-4 shrink-0" />
                    )}
                    <span className="truncate">{nearestTarget.actionLabel}</span>
                    <span className="hidden sm:inline text-xs opacity-80 font-mono-nums shrink-0">[E]</span>
                  </button>
                ) : null}
              </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reward & status toasts — hoisted ABOVE every modal layer (UI/UX program WP1):
          the game's core reward signal ("Memory saved", gift results) must never be
          dimmed underneath an espresso backdrop. pointer-events-none keeps the world
          input path untouched. */}
      {screenState !== 'title' && toastText && (
        <div
          role="status"
          aria-live="polite"
          data-testid="hud-toast"
          className="fixed inset-x-0 top-16 sm:top-[78px] z-[60] pointer-events-none flex justify-center px-4"
        >
          <div className="bg-linen/95 border border-terracotta/40 rounded-xl px-3.5 py-1.5 shadow-elevation-card flex items-center gap-2 text-xs sm:text-sm font-medium text-espresso">
            <Sparkles className="w-3.5 h-3.5 text-terracotta shrink-0" />
            <span>{toastText}</span>
          </div>
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

      {/* Community Contribution Shelf — opened from the plaza noticeboard (GA-5) */}
      <CommunityProjectsPanel
        open={communityProjectsOpen}
        world={worldSnapshot}
        onClose={() => setCommunityProjectsOpen(false)}
        onContribute={handleContribute}
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
        data-scene-veil="true"
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
          setCommunityProjectsOpen(false);
          setScreenState('title');
        }}
      />
    </main>
  );
}

// Keep fresh world helper accessible if needed
export { createFreshWorldState };
