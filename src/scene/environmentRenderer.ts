import * as THREE from 'three';
import { ComposedEnvironmentState } from '../game/environment';
import { SeasonType, Vec2, WorldState } from '../game/types';
import { GazeboRig, FountainRig, MirrorPondRig } from './models';
import { NoticeboardRig } from './builders/landmarks';
import { GroveTreesRig } from './builders/vegetation';
import { getWaterShaderUniforms } from './waterShaders';

// Pre-allocated scratch helpers (zero per-frame heap allocations)
const _skyMorning = new THREE.Color('#DCEBF2');
const _skyAfternoon = new THREE.Color('#D9ECF5');
const _skyGolden = new THREE.Color('#F5CFA0');
const _skyDusk = new THREE.Color('#6F7FA8');
const _skyRain = new THREE.Color('#BAC9D4');
const _skyMist = new THREE.Color('#E3ECEF');
const _skyWork = new THREE.Color();

const _sunMorning = new THREE.Color('#FFF1D0');
const _sunAfternoon = new THREE.Color('#FFF6DF');
const _sunGolden = new THREE.Color('#FFB266');
const _sunDusk = new THREE.Color('#97AEE0');
const _sunRain = new THREE.Color('#D8E0E8');
const _sunWork = new THREE.Color();

const _hemiSkyMorning = new THREE.Color('#B5D7EB');
const _hemiSkyDusk = new THREE.Color('#5B71A8');
const _hemiGroundMorning = new THREE.Color('#7A664E');
const _hemiGroundDusk = new THREE.Color('#3F3D52');

const _seasonTint = new THREE.Color();
const _dummy = new THREE.Object3D();

export interface EnvironmentRendererDeps {
  scene: THREE.Scene;
  groundMat: THREE.MeshStandardMaterial;
  groveRig: GroveTreesRig;
  hemiLight: THREE.HemisphereLight;
  sunLight: THREE.DirectionalLight;
  windowMaterials: THREE.MeshStandardMaterial[];
  lanternMat: THREE.MeshStandardMaterial;
  prototypeLanternMats: THREE.MeshStandardMaterial[];
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
}

export class EnvironmentVisualController {
  private lastStaticRevision = -1;
  private lastMailboxUnread: boolean | null = null;
  private lastSeason: SeasonType | null = null;
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
    deps.scene.add(this.rainMesh);

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
    deps.scene.add(this.petalMesh);

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
  }

  update(
    composed: ComposedEnvironmentState,
    world: WorldState,
    focusPos: Vec2,
    elapsed: number,
    dt: number,
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
      _seasonTint.set(composed.season.groveBaseTintHex);
      groveRig.crownBaseMat.color.copy(_seasonTint);
      _seasonTint.set(composed.season.groveTopTintHex);
      groveRig.crownTopMat.color.copy(_seasonTint);

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
      world.mailboxUnread !== this.lastMailboxUnread
    ) {
      this.lastStaticRevision = composed.revision;
      this.lastMailboxUnread = world.mailboxUnread;

      const env = composed.playerChanges;
      for (let i = 0; i < flowerGroups.length; i++) {
        const bloomActive = i % 3 < env.plantersBloomed;
        flowerGroups[i].scale.setScalar(bloomActive ? 1.15 : 0.55);
      }

      gazeboRig.ivyGroup.visible = !env.ivyCleared;
      gazeboRig.clapperMesh.visible = env.bellGleaming;
      gazeboRig.ribbonMesh.visible = env.reconciledTogether;
      bakeryTablesGroup.visible = env.bakeryTablesOpen;
      festoonGroup.visible = env.festoonLanterns || composed.timeOfDay.phase === 'dusk';
      oakGlint.visible = !world.flags.foundBrassClapper;
      mbFlag.rotation.z = world.mailboxUnread ? 0 : -1.2;
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

      const phase = composed.timeOfDay.phase;
      const windowGlow =
        phase === 'dusk'
          ? 1.75
          : phase === 'golden'
          ? 0.78
          : composed.weather.effective === 'light_rain'
          ? 0.45
          : 0.22;
      for (let i = 0; i < windowMaterials.length; i++) {
        windowMaterials[i].emissiveIntensity = windowGlow;
      }
      lanternMat.emissiveIntensity =
        phase === 'dusk' ? 1.85 : composed.timeOfDay.lanternScheduleActive ? 0.95 : 0.15;
      const protoGlow =
        phase === 'dusk' ? 2.1 : composed.timeOfDay.lanternScheduleActive ? 0.95 : 0.22;
      for (let i = 0; i < prototypeLanternMats.length; i++) {
        prototypeLanternMats[i].emissiveIntensity = protoGlow;
      }
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
    hemiLight.groundColor.copy(_hemiGroundMorning).lerp(_hemiGroundDusk, duskFactor);
    hemiLight.intensity = THREE.MathUtils.lerp(0.54, 0.34, duskFactor);
    scene.environmentIntensity = THREE.MathUtils.lerp(0.68, 0.24, duskFactor);
    const rainSunScale = effWeather === 'light_rain' ? 0.78 : 1.0;
    sunLight.intensity =
      THREE.MathUtils.lerp(1.52, 0.58, Math.max(0, (tNorm - 0.62) / 0.38)) * rainSunScale;

    const sunAngle = THREE.MathUtils.lerp(0.5, 2.4, tNorm);
    sunLight.position.set(Math.cos(sunAngle) * 26, 26 - Math.abs(tNorm - 0.5) * 10, 16);

    // 4. Continuous Ambient Motion (Oak Glint, Fountain Cascades & Droplets, Mirror Pond Life, Bell Swing, Weather)
    this.fountainSplashAge = Math.min(99, this.fountainSplashAge + dt);
    this.pondSplashAge = Math.min(99, this.pondSplashAge + dt);

    const isWinter = composed.season.season === 'winter' ? 1 : 0;
    const isRain = effWeather === 'light_rain' ? 1 : 0;
    const windStrength = effWeather === 'breezy' ? 1 : effWeather === 'light_rain' ? 0.65 : 0.25;

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
          const r = ph * 0.58;
          const arcY = 2.86 + Math.sin(ph * Math.PI) * 0.4 - ph * 0.84;
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
          const arcY = 2.15 + Math.sin(ph * Math.PI) * 0.65 - ph * 1.5;
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
    const showPetals =
      effWeather === 'breezy' ||
      (effWeather === 'sunlit' && composed.season.season === 'spring');
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

  dispose(): void {
    this.rainMesh.geometry.dispose();
    (this.rainMesh.material as THREE.Material).dispose();
    this.petalMesh.geometry.dispose();
    (this.petalMesh.material as THREE.Material).dispose();
  }
}
