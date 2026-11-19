import * as THREE from 'three';

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
}

/**
 * Shared palette material registry for scene & diorama builders.
 * Reduces redundant shader programs and uniform uploads across mobile/WebGL2.
 */
export class MaterialPalette {
  private readonly cache = new Map<string, THREE.MeshStandardMaterial>();
  private readonly ownedTextures: THREE.Texture[] = [];

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
    this.cache.set(key, mat);
    return mat;
  }

  standard(
    color: string,
    roughness: number,
    metalness = 0.02,
  ): THREE.MeshStandardMaterial {
    const key = `std:${color}:${roughness.toFixed(2)}:${metalness.toFixed(2)}`;
    return this.get(key, { color, roughness, metalness });
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
