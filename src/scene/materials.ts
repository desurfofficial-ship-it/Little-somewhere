import * as THREE from 'three';
import {
  createWoodGrainMaps,
  createPlasterToothMaps,
  createStoneCourseMaps,
  createFabricAlbedoMaps,
  createNoiseRoughnessTexture,
  type ProceduralMapBundle,
} from './textures';

export interface StandardMaterialSpec {
  color: string;
  roughness: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  depthWrite?: boolean;
  side?: THREE.Side;
  /**
   * Procedural map family to attach (the "evident craft" program, Doc 06 §2.1).
   * Map textures multiply the material color (albedo stays near-white) and
   * modulate scalar roughness (green channel), so hue/value authority remains
   * with the palette constant.
   */
  mapSet?: MapSetId;
  /**
   * Per-material environment-map response (Doc 06 §2.2): brass 1.0, glass 0.9,
   * ceramics 0.6, masonry 0.35, foliage 0.2. First-class palette field.
   */
  envMapIntensity?: number;
  /** Height in meters over which the ground-contact luminance ramp runs (§3.3). */
  groundGradient?: number;
}

/**
 * Procedural map families (Doc 03 §5.1 roughness tiers → Doc 06 §2.1 generators).
 * Each family carries a coherent surface story:
 *  - 'timber-light' / 'timber-dark': wood grain albedo + directional roughness (T3)
 *  - 'plaster': hand-troweled tooth (T1)
 *  - 'stone': course mortar-vs-face roughness split (T1)
 *  - 'fabric': near-white thread-row albedo + crosshatch weave roughness (T2)
 *  - 'foliage': shared scalar-noise roughness break-up (T1–T3 universal)
 */
export type MapSetId =
  | 'timber-light'
  | 'timber-dark'
  | 'plaster'
  | 'stone'
  | 'fabric'
  | 'foliage';

type MapBundleOrNull = ProceduralMapBundle | null;

/**
 * Hand-painted ground-contact shading (Doc 03 §2.3 "gradients guide the eye";
 * brief Part 3.3): a subtle top-to-bottom luminance ramp — the lowest band of
 * an object eases ~10% darker toward the ground — so standing props and walls
 * settle into their contact shadow instead of floating over it. Injected per
 * material via onBeforeCompile (world-height varying + one uniform); no new
 * shader source files, no post-processing, software-GL safe (same program on
 * all GPUs), zero per-frame cost.
 */
const GRADIENT_VARYING_DECL = 'varying float vObjectGroundY;';
const GRADIENT_VERTEX_CHUNK = `
  #include <begin_vertex>
  vObjectGroundY = (modelMatrix * vec4(transformed, 1.0)).y;
`;
function makeGradientFragmentChunk(height: number): string {
  // Height is baked as a compile-time literal: identical ramps share one
  // program variant per define-combo (cache key below), no uniform plumbing.
  const h = Math.max(0.05, height).toFixed(2);
  return `
  #include <color_fragment>
  // Hand-painted ground-contact ramp: 0.90 at the ground → 1.0 at ${h} m.
  diffuseColor.rgb *= (0.90 + 0.10 * clamp(vObjectGroundY / ${h}, 0.0, 1.0));
`;
}

export interface StandardMaterialOpts {
  mapSet?: MapSetId;
  envMapIntensity?: number;
  /** Height in meters over which the ground-contact luminance ramp runs. */
  groundGradient?: number;
}
/**
 * Shared palette material registry for scene & diorama builders.
 * Reduces redundant shader programs and uniform uploads across mobile/WebGL2.
 */
export class MaterialPalette {
  private readonly cache = new Map<string, THREE.MeshStandardMaterial>();
  private readonly ownedTextures: THREE.Texture[] = [];
  /** Lazily-built procedural map sets, cached per family (null = unavailable). */
  private readonly mapSets = new Map<MapSetId, MapBundleOrNull>();

  get(key: string, spec: StandardMaterialSpec): THREE.MeshStandardMaterial {
    const existing = this.cache.get(key);
    if (existing) return existing;

    const params: THREE.MeshStandardMaterialParameters = {
      color: spec.color,
      roughness: spec.roughness,
      metalness: spec.metalness ?? 0.02,
      transparent: spec.transparent ?? false,
      opacity: spec.opacity ?? 1,
      depthWrite: spec.depthWrite ?? true,
      side: spec.side ?? THREE.FrontSide,
    };
    if (spec.emissive) {
      params.emissive = new THREE.Color(spec.emissive);
      params.emissiveIntensity = spec.emissiveIntensity ?? 0;
    }
    const mat = new THREE.MeshStandardMaterial(params);
    if (spec.envMapIntensity !== undefined) {
      mat.envMapIntensity = spec.envMapIntensity;
    }
    if (spec.groundGradient !== undefined) {
      const gradientHeight = spec.groundGradient;
      mat.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>\n  ${GRADIENT_VARYING_DECL}`)
          .replace('#include <begin_vertex>', GRADIENT_VERTEX_CHUNK);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>\n  ${GRADIENT_VARYING_DECL}`)
          .replace('#include <color_fragment>', makeGradientFragmentChunk(gradientHeight));
      };
      mat.customProgramCacheKey = () => `ls-ground-gradient-${gradientHeight.toFixed(2)}`;
    }
    if (spec.mapSet) {
      const bundle = this.getMapSet(spec.mapSet);
      if (bundle) {
        mat.map = bundle.map ?? null;
        mat.roughnessMap = bundle.roughnessMap ?? null;
        mat.needsUpdate = true;
      }
    }
    this.cache.set(key, mat);
    return mat;
  }

  /**
   * Shared standard material. The optional `opts` extend (never replace) the
   * historical signature: existing 2–3 argument call sites keep working and
   * share the same cache family as before (empty map/env segments).
   */
  standard(
    color: string,
    roughness: number,
    metalness = 0.02,
    opts?: StandardMaterialOpts,
  ): THREE.MeshStandardMaterial {
    const key = `std:${color}:${roughness.toFixed(2)}:${metalness.toFixed(2)}:${opts?.mapSet ?? ''}:${opts?.envMapIntensity ?? ''}:${opts?.groundGradient ?? ''}`;
    return this.get(key, {
      color,
      roughness,
      metalness,
      mapSet: opts?.mapSet,
      envMapIntensity: opts?.envMapIntensity,
      groundGradient: opts?.groundGradient,
    });
  }

  /**
   * Resolve (and lazily build) one procedural map family. Returns null when
   * no DOM is available (pure-Node unit tests) so geometry/identity suites can
   * construct rigs with plain materials — map composition is a renderer-side
   * concern and is validated by the capture harness instead.
   */
  private getMapSet(id: MapSetId): ProceduralMapBundle | null {
    const cached = this.mapSets.get(id);
    if (cached !== undefined) return cached;
    if (typeof document === 'undefined') {
      this.mapSets.set(id, null);
      return null;
    }
    let bundle: ProceduralMapBundle | null;
    switch (id) {
      case 'timber-light':
        bundle = createWoodGrainMaps('light');
        break;
      case 'timber-dark':
        bundle = createWoodGrainMaps('dark');
        break;
      case 'plaster':
        bundle = createPlasterToothMaps();
        break;
      case 'stone':
        bundle = createStoneCourseMaps('cobble');
        break;
      case 'fabric':
        // BUILD 02 (§8.1): albedo weave + roughness weave — near-white thread
        // rows let garments read as stitched fibre; hue stays palette-owned.
        bundle = createFabricAlbedoMaps();
        break;
      case 'foliage':
        bundle = { roughnessMap: createNoiseRoughnessTexture() };
        break;
      default:
        bundle = null;
    }
    if (bundle) {
      if (bundle.map) this.ownedTextures.push(bundle.map);
      if (bundle.roughnessMap) this.ownedTextures.push(bundle.roughnessMap);
    }
    this.mapSets.set(id, bundle);
    return bundle;
  }

  /**
   * Public read-only access to one procedural map family — for materials built
   * outside the cache (e.g. the plaza cobble material which carries its own
   * identity albedo map but joins the stone-course roughness story). Returns
   * null in pure-Node test environments (same contract as `getMapSet`).
   */
  mapBundle(id: MapSetId): ProceduralMapBundle | null {
    return this.getMapSet(id);
  }

  registerTexture(tex: THREE.Texture): void {
    this.ownedTextures.push(tex);
  }

  disposeAll(): void {
    for (const mat of this.cache.values()) {
      mat.dispose();
    }
    this.cache.clear();
    for (const tex of this.ownedTextures) {
      tex.dispose();
    }
    this.ownedTextures.length = 0;
    this.mapSets.clear();
  }
}

/**
 * Shared calibrated storybook palette constants (tuned for ACESFilmicToneMapping).
 */
export const STORYBOOK_PALETTE = {
  // Architectural masonry & plaster
  limestone: '#A89E8E',
  fieldstoneDark: '#877E70',
  limestoneCurb: '#B5AA98',
  warmPlaster: '#EDE0C9',
  creamTrim: '#F2E7D3',
  // Carpentry & roofs
  cedarDark: '#6B4834',
  cedarWarm: '#865A3E',
  doorCedar: '#75462D',
  shingleTerracotta: '#C05E42',
  sageShutter: '#5B7D5D',
  sageRoof: '#587A5C',
  // Pottery, metals & glass
  terracottaPot: '#BD6446',
  ceramicCream: '#ECE3D0',
  agedBrass: '#D7A041',
  wroughtIron: '#3E3C3E',
  lanternGlass: '#FFE8AD',
  // Botanical tones
  foliageDeep: '#4F7747',
  foliageMid: '#638C54',
  foliageSun: '#79A15E',
  foliageSage: '#6E9162',
  moss: '#557A45',
  birchBark: '#E2D8C7',
  oakBark: '#6B4B36',
  // Florals
  petalRose: '#DF7E7A',
  petalMarigold: '#E8B84B',
  petalLavender: '#A08CD6',
  petalCream: '#F2E7CA',
  petalCornflower: '#6F92C4',
} as const;
