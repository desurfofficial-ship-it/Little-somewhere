import * as THREE from 'three';
import { ComposedEnvironmentState } from '../game/environment';
import { SeasonType, Vec2, WorldState } from '../game/types';
import { GazeboRig, FountainRig, MirrorPondRig } from './models';
import { STORYBOOK_FOUNTAIN_SPEC, type NoticeboardRig } from './builders/landmarks';
import { OrchardRig } from './builders/orchard';
import {
  OrchardAmbientExtrasRig,
  OrchardMicroLifeRig,
} from './builders/orchardMicroLife';
import { GroveTreesRig } from './builders/vegetation';
import { WildsRig } from './builders/wilds';
import { ReactiveVisualRigs } from './builders/reactiveProps';
import { getWaterShaderUniforms } from './waterShaders';
import { buildFishingBankRig, FISHING_BANK_RIG_PLACEMENTS } from './fishingRigs';
import { updateAmbientMotion } from './ambientSway';
import { snapDirectionalLightToShadowTexels } from './shadowStability';
import { computeChimneySmokeStrength } from '../game/cottage';
import { CANOPY_DRIFT_TARGETS } from '../game/progressionVisuals';
import type { ProgressionPresentationRigs } from './progressionPresentation';
import type { MeadowDressingRig } from './builders/botanicalDressing';

// ---------------------------------------------------------------------------
// WP-2 (world-environment initiative, audit-1d): pure weather/sun visual
// contracts, exported for deterministic headless tests. The composer's
// timeOfDay.sunElevation / sunAzimuth outputs are the declared source of truth
// for the sun arc; the petal/flurry rule owns the "when does ambient drift
// fall" decision including the previously-missing calm-winter snowfall.
// ---------------------------------------------------------------------------

/**
 * Resolves the sun light placement from the composed time-of-day outputs.
 * - azimuth sweeps 0.5 -> 2.4 across the sunlit day (the R-01 contract).
 * - elevation (radians, 0.18 floor) maps onto the light rig's height with an
 *   8-unit floor so golden hour keeps raking shadows and dusk stays twilight.
 */
export function computeSunPlacement(
  sunElevation: number,
  sunAzimuth: number,
): { x: number; y: number; z: number } {
  const sunHeight = Math.max(8, Math.sin(Math.max(0, sunElevation)) * 30);
  return { x: Math.cos(sunAzimuth) * 26, y: sunHeight, z: 16 };
}

/**
 * When does the ambient drift mesh (petals / leaves / flurries) fall?
 * - breezy: always (wind-borne drift)
 * - sunlit spring: the signature petal drift
 * - winter (WP-2): gentle flurries on ANY calm weather — snow was previously
 *   gated on `breezy` only, so a calm winter day had no snowfall at all.
 *   Rain stays exclusive to the rain streaks (no double precipitation).
 */
export function shouldShowAmbientDrift(
  effectiveWeather: 'sunlit' | 'breezy' | 'misty_morning' | 'light_rain',
  season: 'spring' | 'summer' | 'autumn' | 'winter',
): boolean {
  if (effectiveWeather === 'light_rain') return false;
  if (season === 'winter') return true;
  return effectiveWeather === 'breezy' || (effectiveWeather === 'sunlit' && season === 'spring');
}

// Pre-allocated scratch helpers (zero per-frame heap allocations)
const _skyMorning = new THREE.Color('#DCEBF2');
const _skyAfternoon = new THREE.Color('#D9ECF5');
const _skyGolden = new THREE.Color('#F2C28C');
const _skyDusk = new THREE.Color('#4C5B8F');
const _skyRain = new THREE.Color('#BAC9D4');
const _skyMist = new THREE.Color('#E3ECEF');
const _skyWork = new THREE.Color();

const _sunMorning = new THREE.Color('#FFF1D0');
const _sunAfternoon = new THREE.Color('#FFF6DF');
const _sunGolden = new THREE.Color('#FF9D4A');
const _sunDusk = new THREE.Color('#8099D8');
const _sunRain = new THREE.Color('#D8E0E8');
const _sunWork = new THREE.Color();

const _hemiSkyMorning = new THREE.Color('#B5D7EB');
const _hemiSkyDusk = new THREE.Color('#47568C');
const _hemiGroundMorning = new THREE.Color('#7A664E');
const _hemiGroundDusk = new THREE.Color('#34324A');

// Season-aware hemisphere ground moods (Doc 06 §3.2): spring dew-sage, summer
// honey earth, autumn umber, winter blue-gray hush. Dusk settles into the same
// shared twilight ground as before — the identity dusk curve is preserved.
const _hemiGroundSpring = new THREE.Color('#7A8A5E');
const _hemiGroundSummer = new THREE.Color('#8A744E');
const _hemiGroundAutumn = new THREE.Color('#7E5C3E');
const _hemiGroundWinter = new THREE.Color('#4E5560');
const _hemiGroundSeasonWork = new THREE.Color();

// Dusk rim curve (Doc 06 §3.3): twilight sculpts instead of flattening — the
// rim light keeps its cool daylight color and intensity through golden hour,
// then eases down and warms toward indigo as the sun drops.
const _rimDay = new THREE.Color('#C8DCF2');
const _rimDusk = new THREE.Color('#9FA8D8');
const _rimWork = new THREE.Color();

// Winter cobble value recalibration (Doc 03 §2.2): the winter phase's wash
// toward cream is counteracted by DEEPENING the cobble value band (cool, not
// re-saturated). Other seasons keep the neutral identity tint.
const _cobbleWinter = new THREE.Color('#C9CFD8');
const _cobbleNeutral = new THREE.Color('#FFFFFF');

const _seasonTint = new THREE.Color();
const _dummy = new THREE.Object3D();

export interface EnvironmentRendererDeps {
  scene: THREE.Scene;
  groundMat: THREE.MeshStandardMaterial;
  /** Plaza/lane cobble material — winter value recalibration target (Doc 03 §2.2). */
  cobbleMat?: THREE.MeshStandardMaterial;
  groveRig: GroveTreesRig;
  hemiLight: THREE.HemisphereLight;
  sunLight: THREE.DirectionalLight;
  /** Optional cool rim light — driven by the dusk curve when provided (Doc 06 §3.3). */
  rimLight?: THREE.DirectionalLight;
  windowMaterials: THREE.MeshStandardMaterial[];
  lanternMat: THREE.MeshStandardMaterial;
  prototypeLanternMats: THREE.MeshStandardMaterial[];
  /**
   * R5 Pass 17: the Willow Step Cottage's own window/door-glass materials.
   * Optional so existing mock constructions keep compiling. When present,
   * they receive a hearth-truth glow instead of the neighborhood-uniform
   * windowGlow: bright while the fire is lit, dark home when it is cold.
   */
  willowWindowMaterials?: THREE.MeshStandardMaterial[];
  flowerGroups: THREE.Group[];
  gazeboRig: GazeboRig;
  fountainRig: FountainRig;
  pondRig?: MirrorPondRig;
  bakeryTablesGroup: THREE.Group;
  festoonGroup: THREE.Group;
  noticeboardRig: NoticeboardRig;
  oakGlint: THREE.Mesh;
  mbFlag: THREE.Mesh;
  bellSwingVelRef: { current: number };
  isSoftwareGl: boolean;
  /** Optional reactive micro-props & pooled ambient life (see builders/reactiveProps.ts). */
  reactiveRigs?: ReactiveVisualRigs;
  /** Optional parent group for exterior-only meshes (rain/petals) when toggling interior rooms. */
  exteriorRoot?: THREE.Group;
  /** Optional Fern Hollow Orchard rig for wind-driven crown & fruit sway. */
  orchardRig?: OrchardRig;
  /** Optional Fern Hollow Orchard micro-life rig (blossom butterflies & skep bees). */
  orchardMicroLife?: OrchardMicroLifeRig;
  /** Optional Fern Hollow Orchard extras rig (songbirds & seasonal blossom/leaf drift). */
  orchardAmbientExtras?: OrchardAmbientExtrasRig;
  /** Optional Wild Hollows rig (Build 10) for seasonal crown/knoll tints. */
  wildsRig?: WildsRig;
  /** Stage 2: Plaza Garlands progressive visual rig. */
  garlandRig?: { setGarlandStage(stage: number): void };
  /** BUILD 03: progression presentation rigs (Doc 07 §5 props; revision-gated toggles). */
  progressionRigs?: ProgressionPresentationRigs;
  /** BUILD 03: meadow dressing rig for the within-season drift (5.3b instance re-tint). */
  meadowDressing?: MeadowDressingRig;
}

export class EnvironmentVisualController {
  private lastStaticRevision = -1;
  private lastProgressionRevision = -1;
  private lastMailboxUnread: boolean | null = null;
  private lastSeason: SeasonType | null = null;
  private lastGreenhouseStage = -1;
  private fountainSplashAge = 99;
  private readonly fountainSplashPos = new THREE.Vector3(0, 0, 1.1);
  private pondSplashAge = 99;
  private readonly pondSplashPos = new THREE.Vector3(0.2, 0, -0.4);

  private readonly rainCount: number;
  private readonly petalCount: number;
  private readonly rainMesh: THREE.InstancedMesh;
  private readonly petalMesh: THREE.InstancedMesh;
  private readonly rainSeeds: Float32Array;
  private readonly petalSeeds: Float32Array;
  /** Reusable chimney activity mask (zero per-frame allocation). */
  private readonly wispMask: boolean[] = [false, false, false];

  constructor(private readonly deps: EnvironmentRendererDeps) {
    // Software-WebGL capped particle budgets
    this.rainCount = deps.isSoftwareGl ? 24 : 48;
    this.petalCount = deps.isSoftwareGl ? 12 : 24;

    const rainGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.56, 4);
    const rainMat = new THREE.MeshBasicMaterial({
      color: '#D8ECF4',
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    this.rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, this.rainCount);
    this.rainMesh.frustumCulled = false;
    this.rainMesh.visible = false;
    (deps.exteriorRoot ?? deps.scene).add(this.rainMesh);

    const petalGeo = new THREE.DodecahedronGeometry(0.075, 0);
    petalGeo.scale(1.4, 0.35, 0.9);
    const petalMat = new THREE.MeshBasicMaterial({
      color: '#F5DCE0',
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });
    this.petalMesh = new THREE.InstancedMesh(petalGeo, petalMat, this.petalCount);
    this.petalMesh.frustumCulled = false;
    this.petalMesh.visible = false;
    (deps.exteriorRoot ?? deps.scene).add(this.petalMesh);

    this.rainSeeds = new Float32Array(this.rainCount * 3);
    for (let i = 0; i < this.rainCount; i++) {
      this.rainSeeds[i * 3 + 0] = (((i * 73) % 100) / 100 - 0.5) * 26;
      this.rainSeeds[i * 3 + 1] = ((i * 37) % 100) / 100;
      this.rainSeeds[i * 3 + 2] = (((i * 53) % 100) / 100 - 0.5) * 26;
    }

    this.petalSeeds = new Float32Array(this.petalCount * 3);
    for (let i = 0; i < this.petalCount; i++) {
      this.petalSeeds[i * 3 + 0] = (((i * 61) % 100) / 100 - 0.5) * 28;
      this.petalSeeds[i * 3 + 1] = ((i * 41) % 100) / 100;
      this.petalSeeds[i * 3 + 2] = (((i * 89) % 100) / 100 - 0.5) * 28;
    }
 
    // Stage 3 (+v1.1): quiet fishing spots -- small static creel-and-rod rigs on
    // Mirror Pond's south shore (worldMap prop 'willow_jetty') and at the west
    // brook culvert mouth (prop 'west_brook_bank'); logic in src/game/fishing.ts,
    // rig placement contract in src/scene/fishingRigs.ts (structurally tested).
    // Built once here (rain/petal constructor precedent): zero per-frame work,
    // +10 draw calls TOTAL on two shared color-only materials, no new shader
    // programs -- within the mobile budget (<=5 draws per rig, 0 programs).
    const jettyWoodMat = new THREE.MeshStandardMaterial({ color: '#8A6844', roughness: 0.88 });
    const jettyWickerMat = new THREE.MeshStandardMaterial({ color: '#A8845A', roughness: 0.92 });
    const exteriorParent = deps.exteriorRoot ?? deps.scene;
    for (const placement of FISHING_BANK_RIG_PLACEMENTS) {
      exteriorParent.add(buildFishingBankRig(placement, jettyWoodMat, jettyWickerMat));
    }
  }

  update(
    composed: ComposedEnvironmentState,
    world: WorldState,
    focusPos: Vec2,
    elapsed: number,
    dt: number,
    isIndoors = false,
  ): void {
    const {
      scene,
      groundMat,
      groveRig,
      hemiLight,
      sunLight,
      windowMaterials,
      lanternMat,
      prototypeLanternMats,
      flowerGroups,
      gazeboRig,
      fountainRig,
      bakeryTablesGroup,
      festoonGroup,
      noticeboardRig,
      oakGlint,
      mbFlag,
      bellSwingVelRef,
    } = this.deps;

    // 1. Seasonal Material Tints (updated ONLY on season change)
    if (composed.season.season !== this.lastSeason) {
      this.lastSeason = composed.season.season;
      _seasonTint.set(composed.season.meadowTintHex);
      groundMat.color.copy(_seasonTint);
      // Hemisphere ground mood follows the season (Doc 06 §3.2)
      switch (composed.season.season) {
        case 'spring': _hemiGroundSeasonWork.copy(_hemiGroundSpring); break;
        case 'summer': _hemiGroundSeasonWork.copy(_hemiGroundSummer); break;
        case 'autumn': _hemiGroundSeasonWork.copy(_hemiGroundAutumn); break;
        case 'winter': _hemiGroundSeasonWork.copy(_hemiGroundWinter); break;
      }
      // Winter cobble deepening (Doc 03 §2.2) — value band, not saturation
      if (this.deps.cobbleMat) {
        this.deps.cobbleMat.color.copy(
          composed.season.season === 'winter' ? _cobbleWinter : _cobbleNeutral,
        );
      }
      _seasonTint.set(composed.season.groveBaseTintHex);
      groveRig.crownBaseMat.color.copy(_seasonTint);
      _seasonTint.set(composed.season.groveTopTintHex);
      groveRig.crownTopMat.color.copy(_seasonTint);
      if (this.deps.wildsRig) {
        // The season hexes are near-white washes; untextured wilds materials must
        // compose base × wash (same result a textured material gets for free).
        const wilds = this.deps.wildsRig;
        _seasonTint.set(composed.season.meadowTintHex);
        wilds.moundMat.color.copy(wilds.baseColors.mound).multiply(_seasonTint);
        _seasonTint.set(composed.season.groveBaseTintHex);
        wilds.crownBaseMat.color.copy(wilds.baseColors.crownBase).multiply(_seasonTint);
        _seasonTint.set(composed.season.groveTopTintHex);
        wilds.crownTopMat.color.copy(wilds.baseColors.crownTop).multiply(_seasonTint);
      }

      const petalMat = this.petalMesh.material as THREE.MeshBasicMaterial;
      if (composed.season.season === 'autumn') {
        petalMat.color.set('#E39A4C');
      } else if (composed.season.season === 'winter') {
        petalMat.color.set('#EEF6FA');
      } else {
        petalMat.color.set('#F5DCE0');
      }
    }

    // 2. Dirty-Flagged Static Props, Planters, Gazebo, Bakery & Noticeboard Flyers
    if (
      composed.revision !== this.lastStaticRevision ||
      composed.progression.revision !== this.lastProgressionRevision ||
      world.mailboxUnread !== this.lastMailboxUnread
    ) {
      this.lastStaticRevision = composed.revision;
      this.lastProgressionRevision = composed.progression.revision;
      this.lastMailboxUnread = world.mailboxUnread;

      // BUILD 03 (Doc 07 §5): progression prop toggles run FIRST inside the static
      // block; the drift re-application below therefore always lands AFTER the
      // season block (section 1) wrote the anchor colors on season-change frames —
      // ordering pinned by environmentRenderer.test.ts.
      this.deps.progressionRigs?.apply(composed.progression);
      this.applySeasonDrift(composed);

      const env = composed.playerChanges;
      for (let i = 0; i < flowerGroups.length; i++) {
        const bloomActive = i % 3 < env.plantersBloomed;
        flowerGroups[i].scale.setScalar(bloomActive ? 1.15 : 0.55);
      }

      gazeboRig.ivyGroup.visible = !env.ivyCleared;
      gazeboRig.clapperMesh.visible = env.bellGleaming;
      gazeboRig.ribbonMesh.visible = env.reconciledTogether;
      bakeryTablesGroup.visible = env.bakeryTablesOpen;
      oakGlint.visible = !world.flags.foundBrassClapper;
      mbFlag.rotation.z = world.mailboxUnread ? 0 : -1.2;
      // WP-3 (audit-1d): counter→visual echoes — the well lip pebble stack grows
      // with each dropped pebble and the wildflower bank shows today's nosegay
      // stub until the next morning. The composer folds both into its revision
      // via a dedicated echo mask, so this reacts on the commit frame.
      if (this.deps.wildsRig) {
        this.deps.wildsRig.setWellPebbleStack(composed.worldEchoes.wellPebbleStack);
        this.deps.wildsRig.setPosyBankPickedToday(composed.worldEchoes.posyBankPickedToday);
        // WP-4 (Workstream E): the Sorrel garden's persistent community transformation.
        this.deps.wildsRig.setGardenStage(composed.worldEchoes.sorrelGardenStage);
        this.deps.garlandRig?.setGarlandStage(composed.worldEchoes.marigoldGarlandStage);
      }
      fountainRig.waterMesh.visible = env.fountainFlowing;
      fountainRig.spoutParticles.visible = env.fountainFlowing;
      if (fountainRig.clogDebrisGroup) {
        fountainRig.clogDebrisGroup.visible = !env.fountainFlowing;
      }
      if (fountainRig.submergedCoinsGroup) {
        fountainRig.submergedCoinsGroup.visible = env.fountainFlowing;
      }
      if (fountainRig.cascadeGroup) {
        fountainRig.cascadeGroup.visible = env.fountainFlowing;
      }

      const flyers = noticeboardRig.flyers;
      for (let i = 0; i < flyers.length; i++) {
        flyers[i].visible = i < composed.npcTouches.noticeboardFlyerCount;
      }

      // BUILD 03 5.6a — noticeboard glint (deviation A5): the newest visible flyer's
      // brass pin carries a subtle warm emissive while the board has news. Per-pin
      // cloned materials are ensured once (the shared brassMat has no emissive).
      this.applyNoticeboardGlint(flyers, composed.progression.housekeeping.noticeboardGlint);

      // Reactive NPC micro-props (revision-gated, see composeEnvironmentState npcTouches)
      const rigs = this.deps.reactiveRigs;
      if (rigs) {
        rigs.pastryBasket.group.visible = composed.npcTouches.claraPastryBasketVisible;

        const stage = composed.npcTouches.minaGreenhouseStage;
        if (stage !== this.lastGreenhouseStage) {
          this.lastGreenhouseStage = stage;
          rigs.greenhouseStage.group.visible = stage >= 2;
          rigs.greenhouseStage.stageBuds.visible = stage === 2;
          rigs.greenhouseStage.stageBloom.visible = stage >= 3;
        }

        const lampActive = composed.npcTouches.arthurEarlyPorchLamp;
        rigs.porchLamp.glassMat.emissiveIntensity = lampActive ? 1.55 : 0.15;
        rigs.porchLamp.haloMesh.visible = lampActive;
      }

      if (this.deps.orchardRig) {
        this.deps.orchardRig.setGatheringVisual(
          env.orchardGatheringOutcome ?? 'none',
          composed.timeOfDay.lanternScheduleActive || composed.timeOfDay.phase === 'golden',
        );
      }
    }

    // 2.5. Minute-sensitive weather dressing (puddles dry out mid-morning without a revision bump)
    const rigsNow = this.deps.reactiveRigs;
    if (rigsNow) {
      rigsNow.puddles.mesh.visible = composed.weather.puddlesActive;
    }

    // 2.6. R5 Pass 17: your windows answer the hearth — the player cottage's
    // glass glows with the fire's truth instead of the neighborhood-uniform
    // windowGlow. computeChimneySmokeStrength is the single source of hearth
    // state (0 = cold · 1 = lit · 1.3 = lit + kettle warm). Evaluated every
    // update (NOT revision-gated) because the kettle warms and expires with
    // the in-game clock, which carries no world revision. Daytime phases keep
    // neighborhood parity: fire glow cannot read through sunlit glass.
    {
      const willowWindows = this.deps.willowWindowMaterials;
      if (willowWindows && willowWindows.length > 0) {
        const phaseNow = composed.timeOfDay.phase;
        const baseGlow =
          phaseNow === 'dusk'
            ? 2.1
            : phaseNow === 'golden'
            ? 0.9
            : composed.weather.effective === 'light_rain'
            ? 0.45
            : 0.22;
        const smoke = computeChimneySmokeStrength(world);
        let willowGlow = baseGlow;
        if (phaseNow === 'dusk') {
          willowGlow = smoke === 0 ? 0.3 : smoke > 1 ? 2.85 : 2.5;
        } else if (phaseNow === 'golden') {
          willowGlow =
            smoke === 0 ? baseGlow * 0.55 : baseGlow * (smoke > 1 ? 1.78 : 1.39);
        } else if (composed.timeOfDay.lanternScheduleActive) {
          willowGlow = smoke === 0 ? baseGlow * 0.35 : baseGlow * 1.25;
        }
        for (let i = 0; i < willowWindows.length; i++) {
          willowWindows[i].emissiveIntensity = willowGlow;
        }
      }
    }

    // 2.7 BUILD 03 5.6b — neighborhood window glow now tracks the clock per-frame
    // (the write was revision-gated, but phase is not a revision bit, so golden->dusk
    // could previously lag until the next revision event) and gains the
    // cozyLateNightHint warm step at 21:00+ (Doc 07 §5.6). windowMaterials ONLY —
    // willowWindowMaterials stay exclusively owned by the hearth-truth section above.
    {
      const phase = composed.timeOfDay.phase;
      const baseGlow =
        phase === 'dusk'
          ? 2.1
          : phase === 'golden'
          ? 0.9
          : composed.weather.effective === 'light_rain'
          ? 0.45
          : 0.22;
      const lateStep = composed.timeOfDay.cozyLateNightHint ? 0.2 : 0;
      const glow = baseGlow + lateStep;
      for (let i = 0; i < windowMaterials.length; i++) {
        windowMaterials[i].emissiveIntensity = glow;
      }
    }

    // 2.8 BUILD 04 AM-4 — lantern & festoon glow now track the clock per-frame
    // (same phase-lag defect the window glow had until 2.7: the write was
    // revision-gated, so golden->dusk lagged until the next revision event) and
    // gain a gentle dusk breathe — a warm ±0.06 shimmer around the schedule
    // value, deterministic from the shared elapsed clock. Restraint: no flicker,
    // no cross-fade against the established day/night curves (Doc 06 §3.1).
    {
      const phase = composed.timeOfDay.phase;
      const breathe = phase === 'dusk' ? Math.sin(elapsed * 2.6) * 0.06 : 0;
      lanternMat.emissiveIntensity =
        (phase === 'dusk' ? 2.15 : composed.timeOfDay.lanternScheduleActive ? 0.95 : 0.15) + breathe;
      const protoGlow =
        (phase === 'dusk' ? 2.35 : composed.timeOfDay.lanternScheduleActive ? 0.95 : 0.22) + breathe;
      for (let i = 0; i < prototypeLanternMats.length; i++) {
        prototypeLanternMats[i].emissiveIntensity = protoGlow;
      }
      festoonGroup.visible =
        composed.playerChanges.festoonLanterns || phase === 'dusk';
    }

    // 3. Continuous Time-of-Day + Weather Atmosphere Curves (zero GC)
    const { tNorm } = composed.timeOfDay;
    if (tNorm < 0.35) {
      const k = tNorm / 0.35;
      _sunWork.copy(_sunMorning).lerp(_sunAfternoon, k);
      _skyWork.copy(_skyMorning).lerp(_skyAfternoon, k);
    } else if (tNorm < 0.72) {
      const k = (tNorm - 0.35) / 0.37;
      _sunWork.copy(_sunAfternoon).lerp(_sunGolden, k);
      _skyWork.copy(_skyAfternoon).lerp(_skyGolden, k);
    } else {
      const k = (tNorm - 0.72) / 0.28;
      _sunWork.copy(_sunGolden).lerp(_sunDusk, k);
      _skyWork.copy(_skyGolden).lerp(_skyDusk, k);
    }

    const effWeather = composed.weather.effective;
    if (effWeather === 'light_rain') {
      _skyWork.lerp(_skyRain, 0.45);
      _sunWork.lerp(_sunRain, 0.42);
    } else if (effWeather === 'misty_morning') {
      _skyWork.lerp(_skyMist, 0.42 * composed.weather.intensity);
    }

    sunLight.color.copy(_sunWork);
    (scene.background as THREE.Color).copy(_skyWork);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(_skyWork);
      if (effWeather === 'misty_morning') {
        scene.fog.near = 26;
        scene.fog.far = 68;
      } else if (effWeather === 'light_rain') {
        scene.fog.near = 32;
        scene.fog.far = 76;
      } else {
        scene.fog.near = 42;
        scene.fog.far = 86;
      }
    }

    const duskFactor = Math.max(0, (tNorm - 0.58) / 0.42);
    hemiLight.color.copy(_hemiSkyMorning).lerp(_hemiSkyDusk, duskFactor);
    // Season-aware ground: the season mood owns the daylight ground color and
    // the existing twilight ground remains the shared dusk destination.
    hemiLight.groundColor.copy(_hemiGroundSeasonWork).lerp(_hemiGroundDusk, duskFactor);
    hemiLight.intensity = THREE.MathUtils.lerp(0.54, 0.22, duskFactor);
    scene.environmentIntensity = THREE.MathUtils.lerp(0.68, 0.15, duskFactor);

    // Dusk rim curve (Doc 06 §3.3): intensity eases 0.45 → 0.18 and the color
    // shifts #C8DCF2 → #9FA8D8 so twilight sculpts silhouettes instead of
    // flattening them. Daylight values match the rig's identity defaults.
    if (this.deps.rimLight) {
      this.deps.rimLight.intensity = THREE.MathUtils.lerp(0.45, 0.18, duskFactor);
      this.deps.rimLight.color.copy(_rimWork.copy(_rimDay).lerp(_rimDusk, duskFactor));
    }
    const rainSunScale = effWeather === 'light_rain' ? 0.78 : 1.0;
    sunLight.intensity =
      THREE.MathUtils.lerp(1.52, 0.44, Math.max(0, (tNorm - 0.62) / 0.38)) * rainSunScale;

    // R-01: lengthened azimuth sweep + lower raking elevation so golden hour casts
    // long shadows and dusk settles into genuine twilight (was 0.5..2.4 / flat 26-height arc)
    const sunAngle = THREE.MathUtils.lerp(0.42, 2.6, tNorm);
    // FLICKER FIX S2b (investigation R2, peripheral): floor 8→10 keeps far-district
    // casters (Sorrel Hollow) in front of the shadow camera's near plane at the lowest
    // dusk sun instead of losing all their shadows late in the day.
    const sunHeight = Math.max(10, 24 - Math.abs(tNorm - 0.44) * 30);
    sunLight.position.set(Math.cos(sunAngle) * 26, sunHeight, 16);
    // FLICKER FIX S2a (investigation R2): the sun moves every frame; without snapping,
    // the shadow map's texel grid swims continuously and every shadow edge re-dithers
    // per frame. Snapping the light onto its own shadow-map texel grid keeps the grid
    // translationally stationary while the arc rotates (slow, smoothed by PCF radius).
    snapDirectionalLightToShadowTexels(sunLight);

    // BUILD 04 AM-5: the exterior ambient sections (4-6) skip their per-frame
    // work while the player is indoors — the exterior root is hidden, so pond
    // koi, rain/petal matrices and orchard sway previously executed invisibly.
    // Sections 1-3 and the per-frame glow writes above always run: they are
    // cheap scalar writes, and the season/revision state must stay consistent
    // for the frame the player steps back outside.
    if (isIndoors) {
      return;
    }

    // 4. Continuous Ambient Motion (Oak Glint, Fountain Cascades & Droplets, Mirror Pond Life, Bell Swing, Weather)
    this.fountainSplashAge = Math.min(99, this.fountainSplashAge + dt);
    this.pondSplashAge = Math.min(99, this.pondSplashAge + dt);

    const isWinter = composed.season.season === 'winter' ? 1 : 0;
    const isRain = effWeather === 'light_rain' ? 1 : 0;
    const windStrength = effWeather === 'breezy' ? 1 : effWeather === 'light_rain' ? 0.65 : 0.25;

    // BUILD 04 AM-1/2/3 — shared ambient motion driver: shader-sway uniforms
    // (grove/wilds crowns + meadow tufts) and hanging-sign swingers. ONE call,
    // two scalar writes per material + two per sign (see ambientSway.ts).
    updateAmbientMotion(elapsed, windStrength, isWinter);

    if (oakGlint.visible) {
      oakGlint.position.y = 0.36 + Math.sin(elapsed * 3.0) * 0.05;
      oakGlint.rotation.y = elapsed * 1.4;
    }

    if (composed.playerChanges.fountainFlowing) {
      const fWaterUniforms = getWaterShaderUniforms(fountainRig.waterMat);
      if (fWaterUniforms) {
        fWaterUniforms.uTime.value = elapsed;
        fWaterUniforms.uWinter.value = isWinter;
        fWaterUniforms.uDusk.value = duskFactor;
        fWaterUniforms.uSplashPos.value.copy(this.fountainSplashPos);
        fWaterUniforms.uSplashAge.value = this.fountainSplashAge;
      }
      const fStreamUniforms = getWaterShaderUniforms(fountainRig.streamMat);
      if (fStreamUniforms) {
        fStreamUniforms.uTime.value = elapsed;
        fStreamUniforms.uDusk.value = duskFactor;
      }

      if (fountainRig.splashRings) {
        for (let i = 0; i < fountainRig.splashRings.length; i++) {
          const ring = fountainRig.splashRings[i];
          const offset = Number(ring.userData.phaseOffset ?? i * 0.2);
          const ph = (elapsed * 0.9 + offset) % 1;
          const sc = 0.55 + ph * 1.35;
          ring.scale.set(sc, sc, 1);
          const rMat = ring.material as THREE.MeshBasicMaterial;
          rMat.opacity = (1 - ph) * 0.56;
        }
      }

      const drops = fountainRig.spoutParticles.children;
      for (let idx = 0; idx < drops.length; idx++) {
        const drop = drops[idx];
        const kind = drop.userData.kind;
        if (kind === 'crown') {
          const ph = (elapsed * 1.65 + idx / 8) % 1;
          const angle = (idx / 8) * Math.PI * 2;
          const r = ph * 0.62;
          // Slice F1: crown spray anchors read the SPEC (finial tip y 4.45) —
          // never re-hardcode the landmark height here.
          const arcY =
            STORYBOOK_FOUNTAIN_SPEC.finialTipY + Math.sin(ph * Math.PI) * 0.4 - ph * 0.9;
          drop.position.set(Math.cos(angle) * r, arcY, Math.sin(angle) * r);
        } else if (kind === 'basin') {
          const bIdx = idx - 8;
          const cardinalIdx = bIdx % 4;
          const subIdx = Math.floor(bIdx / 4);
          const ph = (elapsed * 2.1 + subIdx * 0.33 + cardinalIdx * 0.17) % 1;
          const angle = (cardinalIdx / 4) * Math.PI * 2 + (subIdx - 1) * 0.18;
          const r = 1.2 + (ph - 0.25) * 0.28;
          const arcY = 0.66 + Math.sin(ph * Math.PI) * 0.26;
          drop.position.set(Math.cos(angle) * r, arcY, Math.sin(angle) * r);
        } else {
          const ph = (elapsed * 1.8 + idx / 8) % 1;
          const angle = (idx / 8) * Math.PI * 2;
          const r = ph * 0.95;
          // Slice F1: upper-tier spray falls from the new tier rim into the
          // lower bowl (SPEC-derived; lands ≈ lowerBowlWaterY).
          const arcY =
            STORYBOOK_FOUNTAIN_SPEC.upperTierRimY - 0.12 + Math.sin(ph * Math.PI) * 0.65 - ph * 0.95;
          drop.position.set(Math.cos(angle) * r, arcY, Math.sin(angle) * r);
        }
      }
    }

    const pondRig = this.deps.pondRig;
    if (pondRig) {
      const pWaterUniforms = getWaterShaderUniforms(pondRig.waterMat);
      if (pWaterUniforms) {
        pWaterUniforms.uTime.value = elapsed;
        pWaterUniforms.uRain.value = isRain;
        pWaterUniforms.uWinter.value = isWinter;
        pWaterUniforms.uWind.value = windStrength;
        pWaterUniforms.uDusk.value = duskFactor;
        pWaterUniforms.uSplashPos.value.copy(this.pondSplashPos);
        pWaterUniforms.uSplashAge.value = this.pondSplashAge;
      }

      // Swimming koi fish along smooth figure-8 loops inside basin
      for (let i = 0; i < pondRig.koiFishes.length; i++) {
        const koi = pondRig.koiFishes[i];
        const spd = koi.speed * (isWinter ? 0.24 : 1.0);
        const theta = elapsed * spd + koi.phaseOffset;
        const kx = koi.centerX + Math.cos(theta) * koi.radiusX;
        const kz = koi.centerZ + Math.sin(theta * 2) * koi.radiusZ * 0.52;
        const vx = -Math.sin(theta) * koi.radiusX * spd;
        const vz = Math.cos(theta * 2) * koi.radiusZ * 1.04 * spd;
        koi.group.position.set(kx, 0.064 + Math.sin(elapsed * 2.1 + koi.phaseOffset) * 0.006, kz);
        koi.group.rotation.y = Math.atan2(vx, vz);
        koi.tailPivot.rotation.y =
          Math.sin(elapsed * (isWinter ? 3.2 : 8.4) + koi.phaseOffset) * 0.36;
      }

      // Gentle bobbing lily pads & seasonal blooms
      for (let i = 0; i < pondRig.lilyPadGroups.length; i++) {
        const pad = pondRig.lilyPadGroups[i];
        pad.position.y = 0.128 + Math.sin(elapsed * 1.5 + i * 1.1) * 0.005 * (1 - isWinter);
        pad.rotation.z = Math.sin(elapsed * 1.2 + i) * 0.025 * (1 - isWinter);
      }
      for (let i = 0; i < pondRig.lilyBlooms.length; i++) {
        pondRig.lilyBlooms[i].visible = isWinter < 0.5;
      }

      // Wind-driven cattail & iris reed sway
      for (let i = 0; i < pondRig.reedStalks.length; i++) {
        const clump = pondRig.reedStalks[i];
        clump.rotation.z =
          Math.sin(elapsed * (1.35 + windStrength * 1.5) + i * 1.7) * (0.03 + windStrength * 0.055);
      }

      // Dragonflies skimming above the lilies in warm/clear weather
      const showDragonflies = effWeather !== 'light_rain' && isWinter < 0.5;
      for (let i = 0; i < pondRig.dragonflies.length; i++) {
        const df = pondRig.dragonflies[i];
        df.visible = showDragonflies;
        if (showDragonflies) {
          const t = elapsed * (0.95 + i * 0.25) + i * 2.4;
          const cx = i === 0 ? -1.1 : 1.35;
          const cz = i === 0 ? -0.3 : 0.45;
          const dx = Math.sin(t) * 0.85;
          const dz = Math.sin(t * 2) * 0.42;
          df.position.set(cx + dx, 0.48 + Math.sin(elapsed * 3.4 + i) * 0.12, cz + dz);
          df.rotation.y = Math.atan2(Math.cos(t) * 0.85, Math.cos(t * 2) * 0.84);
        }
      }

      // Moored walnut toy sailboat gently rolling beside the pier
      pondRig.sailboat.position.y = 0.125 + Math.sin(elapsed * 1.8) * 0.012 * (1 - isWinter);
      pondRig.sailboat.rotation.z = Math.sin(elapsed * 1.35) * 0.07 * (1 - isWinter);
      pondRig.sailboat.rotation.x = Math.cos(elapsed * 1.1) * 0.04 * (1 - isWinter);
    }

    if (
      Math.abs(bellSwingVelRef.current) > 0.01 ||
      Math.abs(gazeboRig.bellPivot.rotation.z) > 0.005
    ) {
      const dtClamped = Math.min(dt, 0.032);
      const k = 18.0;
      const damping = 2.2;
      const acc = -k * gazeboRig.bellPivot.rotation.z - damping * bellSwingVelRef.current;
      bellSwingVelRef.current += acc * dtClamped;
      gazeboRig.bellPivot.rotation.z += bellSwingVelRef.current * dtClamped;
    }

    // Pooled instanced rain streaks
    if (effWeather === 'light_rain') {
      this.rainMesh.visible = true;
      for (let i = 0; i < this.rainCount; i++) {
        const ox = this.rainSeeds[i * 3 + 0];
        const phase = this.rainSeeds[i * 3 + 1];
        const oz = this.rainSeeds[i * 3 + 2];
        const fall = (elapsed * 1.45 + phase) % 1;
        _dummy.position.set(focusPos.x + ox, 11.5 - fall * 11.2, focusPos.z + oz);
        _dummy.rotation.set(0, 0, 0.14);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        this.rainMesh.setMatrixAt(i, _dummy.matrix);
      }
      this.rainMesh.instanceMatrix.needsUpdate = true;
    } else {
      this.rainMesh.visible = false;
    }

    // Pooled instanced drifting petals / autumn leaves / winter flurries
    const showPetals = shouldShowAmbientDrift(effWeather, composed.season.season);
    if (showPetals) {
      this.petalMesh.visible = true;
      const windSpeed = effWeather === 'breezy' ? 0.52 : 0.22;
      for (let i = 0; i < this.petalCount; i++) {
        const ox = this.petalSeeds[i * 3 + 0];
        const phase = this.petalSeeds[i * 3 + 1];
        const oz = this.petalSeeds[i * 3 + 2];
        const prog = (elapsed * windSpeed + phase) % 1;
        _dummy.position.set(
          focusPos.x + ox + Math.sin(elapsed * 1.3 + i) * 1.4 + prog * 4.5,
          6.8 - prog * 6.5,
          focusPos.z + oz + Math.cos(elapsed * 1.1 + i) * 0.9,
        );
        _dummy.rotation.set(elapsed * 1.4 + i, elapsed * 1.9, i);
        _dummy.scale.setScalar(1.0);
        _dummy.updateMatrix();
        this.petalMesh.setMatrixAt(i, _dummy.matrix);
      }
      this.petalMesh.instanceMatrix.needsUpdate = true;
    } else {
      this.petalMesh.visible = false;
    }

    // 5. Pooled Ambient Micro-Life (butterflies, dusk fireflies, pond shimmer, hearth wisps)
    const rigs = this.deps.reactiveRigs;
    if (rigs) {
      // Butterflies: warm & bright daytime weather only
      const showButterflies =
        (effWeather === 'sunlit' || effWeather === 'breezy') &&
        composed.timeOfDay.phase !== 'dusk' &&
        composed.season.season !== 'winter';
      if (showButterflies) {
        rigs.butterflies.update(elapsed);
        rigs.butterflies.wingsL.visible = true;
        rigs.butterflies.wingsR.visible = true;
        rigs.butterflies.bodies.visible = true;
      } else {
        rigs.butterflies.wingsL.visible = false;
        rigs.butterflies.wingsR.visible = false;
        rigs.butterflies.bodies.visible = false;
      }

      // Fireflies: gentle dusk only
      const showFireflies =
        composed.timeOfDay.phase === 'dusk' || composed.timeOfDay.tNorm > 0.84;
      if (showFireflies) {
        rigs.fireflies.update(elapsed);
        rigs.fireflies.mesh.visible = true;
      } else {
        rigs.fireflies.mesh.visible = false;
      }

      // Pond shimmer: always alive
      rigs.pondSparkles.update(elapsed);
      rigs.pondSparkles.mesh.visible = true;

      // Chimney wisps: per-resident daily work schedule mask
      const wispPhase = composed.timeOfDay.phase;
      for (let c = 0; c < rigs.chimneyWisps.chimneys.length; c++) {
        this.wispMask[c] = rigs.chimneyWisps.chimneys[c].phases.includes(wispPhase);
      }
      rigs.chimneyWisps.update(elapsed, this.wispMask);
      rigs.chimneyWisps.mesh.visible = true;
    }

    // 6. Fern Hollow Orchard wind sway & micro-life (butterflies & skep bees)
    if (this.deps.orchardRig) {
      this.deps.orchardRig.updateWind(elapsed, windStrength);
    }
    if (this.deps.orchardMicroLife) {
      const orchardButterfliesActive =
        (effWeather === 'sunlit' || effWeather === 'breezy') &&
        composed.timeOfDay.phase !== 'dusk' &&
        composed.season.season !== 'winter';
      const orchardBeesActive =
        effWeather !== 'light_rain' &&
        composed.timeOfDay.phase !== 'dusk' &&
        composed.season.season !== 'winter';
      this.deps.orchardMicroLife.update(elapsed, {
        butterfliesActive: orchardButterfliesActive,
        beesActive: orchardBeesActive,
        windStrength,
      });
    }
    if (this.deps.orchardAmbientExtras) {
      const songbirdsActive =
        effWeather !== 'light_rain' && composed.timeOfDay.phase !== 'dusk';
      const driftActive =
        effWeather !== 'light_rain' &&
        composed.season.season !== 'winter' &&
        composed.timeOfDay.phase !== 'dusk';
      this.deps.orchardAmbientExtras.update(elapsed, {
        songbirdsActive,
        driftActive,
        season: composed.season.season,
        windStrength,
      });
    }
  }

  triggerFountainWishRipple(worldX = 0, worldZ = 2.6): void {
    // Convert world XZ into fountainGroup-local XZ (fountain centered at 0, 0, 1.5)
    this.fountainSplashPos.set(worldX, 0, worldZ - 1.5);
    this.fountainSplashAge = 0;
  }

  triggerPondRipple(worldX: number, worldZ: number): void {
    // Convert world XZ into pondGroup-local XZ (pond centered at 1.6, 0, 14.0)
    this.pondSplashPos.set(worldX - 1.6, 0, worldZ - 14.0);
    this.pondSplashAge = 0;
  }

  /**
   * BUILD 03 5.6a — per-pin glint materials (ensured once). The pins originally
   * share one brass material with no emissive; each pin gets its own clone so the
   * glint can move to the newest visible flyer without touching the cache.
   */
  private glintPinsEnsured = false;
  private glintPinClones: THREE.MeshStandardMaterial[] = [];
  private applyNoticeboardGlint(flyers: THREE.Mesh[], glint: boolean): void {
    if (!this.glintPinsEnsured) {
      this.glintPinsEnsured = true;
      for (const flyer of flyers) {
        const pin = flyer.children[0] as THREE.Mesh | undefined;
        if (pin && pin.material instanceof THREE.MeshStandardMaterial) {
          const clone = pin.material.clone();
          clone.emissive = new THREE.Color('#F2C26B');
          clone.emissiveIntensity = 0;
          pin.material = clone;
          this.glintPinClones.push(clone);
        }
      }
    }
    let newest = -1;
    for (let i = 0; i < flyers.length; i++) {
      if (flyers[i].visible) newest = i;
    }
    for (let i = 0; i < flyers.length; i++) {
      const pin = flyers[i].children[0] as THREE.Mesh | undefined;
      if (pin && pin.material instanceof THREE.MeshStandardMaterial) {
        pin.material.emissiveIntensity = glint && i === newest ? 0.9 : 0;
      }
    }
  }

  /**
   * BUILD 03 5.3 — within-season drift (design lock rev 2 §3.3, review C1/M1):
   * dayOfSeason 1 is byte-equal to the season anchor (what the season block wrote);
   * drift departs from it toward the authored targets as the season ages. Grove AND
   * wilds crowns drift together. Runs in the revision-gated static block AFTER the
   * season block wrote the anchor colors (section order guarantees this), so the
   * operation is idempotent on every daily revision change.
   */
  private _driftBase = new THREE.Color();
  private _driftTarget = new THREE.Color();
  private _driftWildsTarget = new THREE.Color();
  private applySeasonDrift(composed: ComposedEnvironmentState): void {
    const drift = composed.progression.seasonDrift;
    const progress = drift.canopyProgress;
    const grove = this.deps.groveRig;
    this._driftBase.set(composed.season.groveBaseTintHex);
    grove.crownBaseMat.color.copy(this._driftBase);
    this._driftTarget.set(composed.season.groveTopTintHex);
    grove.crownTopMat.color.copy(this._driftTarget);
    if (progress > 0 && drift.season !== 'winter') {
      const target = CANOPY_DRIFT_TARGETS[drift.season];
      grove.crownBaseMat.color.lerp(this._driftTarget.set(target.base), progress);
      grove.crownTopMat.color.lerp(this._driftBase.set(target.top), progress);
    }
    const wilds = this.deps.wildsRig;
    if (wilds) {
      this._driftBase.set(composed.season.meadowTintHex);
      wilds.moundMat.color.copy(wilds.baseColors.mound).multiply(this._driftBase);
      this._driftTarget.set(composed.season.groveBaseTintHex);
      wilds.crownBaseMat.color.copy(wilds.baseColors.crownBase).multiply(this._driftTarget);
      this._driftBase.set(composed.season.groveTopTintHex);
      wilds.crownTopMat.color.copy(wilds.baseColors.crownTop).multiply(this._driftBase);
      if (progress > 0 && drift.season !== 'winter') {
        const target = CANOPY_DRIFT_TARGETS[drift.season];
        this._driftWildsTarget.set(target.base);
        wilds.crownBaseMat.color.lerp(
          this._driftBase.copy(wilds.baseColors.crownBase).multiply(this._driftWildsTarget),
          progress,
        );
        this._driftWildsTarget.set(target.top);
        wilds.crownTopMat.color.lerp(
          this._driftBase.copy(wilds.baseColors.crownTop).multiply(this._driftWildsTarget),
          progress,
        );
      }
    }
    this.deps.meadowDressing?.setSeasonDayProgress(drift.meadowProgress, drift.season);
  }

  dispose(): void {
    // BUILD 03 review LOW-8: the per-pin glint clones are the one renderer-owned
    // material set outside the palette cache — dispose them explicitly.
    for (const clone of this.glintPinClones) clone.dispose();
    this.glintPinClones.length = 0;
    this.rainMesh.geometry.dispose();
    (this.rainMesh.material as THREE.Material).dispose();
    this.petalMesh.geometry.dispose();
    (this.petalMesh.material as THREE.Material).dispose();
    this.deps.reactiveRigs?.disposeAll();
  }
}
