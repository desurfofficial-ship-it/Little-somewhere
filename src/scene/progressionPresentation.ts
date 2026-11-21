/**
 * BUILD 03 — Progression presentation rigs (scene layer).
 *
 * Builds every Doc 07 §5 world prop ONCE at mount, all hidden, and toggles them
 * from the pure derived state (src/game/progressionVisuals.ts) inside the
 * renderer's revision-gated static block. Contract mirrors builders/reactiveProps.ts:
 * { group, apply(state), dispose() }, zero per-frame allocation, palette-owned
 * materials (never mutated — tinted variants use per-group clones), isSoftwareGl
 * respected.
 *
 * Design lock: docs/art-direction/visual-identity-evolution/implementation/
 * build03-02-progression-visual-specification.md rev 2 (anchors review-verified:
 * H3/H4/L6/L7; see the audit doc §5 for the full placement table).
 *
 * Visibility/batching contract: every ground-contact toggling group carries a
 * static contact disc registered BEFORE the canvas flush and is marked
 * `userData.contactBatchRoot = true` so its disc batch follows its visibility
 * (contactShadows.ts:89-96). Elevated/tiny props (herb crate, watch charm,
 * resident tokens) carry no disc at all.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { addStaticContactShadow } from './contactShadows';
import { MaterialPalette, STORYBOOK_PALETTE } from './materials';
import type { LanternOutcome, ProgressionVisualState, ZineTheme } from '../game/progressionVisuals';
import type { ResidentId } from '../game/types';

export interface ProgressionPresentationDeps {
  palette: MaterialPalette;
  shadowTex: THREE.Texture;
  isSoftwareGl: boolean;
}

export interface ProgressionPresentationRigs {
  group: THREE.Group;
  /** Revision-gated by the caller (renderer static block). Allocation-free. */
  apply(state: ProgressionVisualState): void;
  dispose(): void;
}

// --- outcome tint tables (authored once; cited in the design lock §3.1) -------------

const ZINE_THEME_TINTS: Record<ZineTheme, string> = {
  art_edition: '#9FB8D8', // carp-and-lantern pond blue chalk
  kitchen_edition: '#C9A265', // rosemary-crust warm
  classic_edition: '#B8B2A6', // first-chalk stone grey
};

const SCONCE_AMBER = '#FFAA3B'; // the arc's hooded amber compromise
const SCONCE_SOFT = '#FFC46A'; // shared dusk candle walk

// --- small helpers -------------------------------------------------------------------

function boxAt(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

function cylinderAt(
  rt: number,
  rb: number,
  h: number,
  seg: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

// =====================================================================================
// Main builder
// =====================================================================================

export function buildProgressionPresentation(
  deps: ProgressionPresentationDeps,
): ProgressionPresentationRigs {
  const { palette, shadowTex, isSoftwareGl } = deps;
  const group = new THREE.Group();
  group.name = 'progression_presentation';
  const ownedGeos: THREE.BufferGeometry[] = [];
  const ownedMats: THREE.Material[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    ownedGeos.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    ownedMats.push(m);
    return m;
  };

  // Shared materials — palette-cached (never mutated); per-instance clones tracked for tinting.
  const cedarMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.75, 0.04);
  const cedarDarkMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.78, 0.04);
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.24, 0.86);
  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.42, 0.72);
  const stoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.9, 0.02);
  const chalkMat = palette.standard('#F7F1E3', 0.92, 0.0);
  const foliageMat = palette.standard(STORYBOOK_PALETTE.foliageMid, 0.8, 0.0);
  const marigoldMat = palette.standard(STORYBOOK_PALETTE.petalMarigold, 0.72, 0.0);
  const paperMat = palette.standard('#FAF2E1', 0.9, 0.0);

  // ===================================================================================
  // 5.1a — Willow Lane Zine: chalk cover on the noticeboard side rail + chalk caddy
  // Noticeboard at (4.4, 0, -3.2); cedar posts at local x ±0.58 (world ±: 3.82 / 4.98).
  // The chalk cover pins beside the west post; the caddy sits at the board's foot on
  // the non-approach side (review M7: fixed offset, walkability-tested).
  // ===================================================================================
  const zineGroup = new THREE.Group();
  zineGroup.name = 'prog_zine_board';
  let cover: THREE.Mesh;
  {
    const chalkCoverMat = trackMat(
      new THREE.MeshStandardMaterial({ color: '#B8B2A6', roughness: 0.94, metalness: 0.0 }),
    );
    cover = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.26, 0.34, 0.02)), chalkCoverMat);
    cover.position.set(-0.86, 1.28, 0.075); // beside the west post, on the cork face plane
    cover.rotation.z = 0.05;
    const pin = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.02, 6, 6)), brassMat);
    pin.position.set(-0.86, 1.43, 0.09);
    // Edition motifs (tiny chalk strokes, one visible per outcome)
    const motifMat = trackMat(
      new THREE.MeshBasicMaterial({ color: '#5A5248', transparent: true, opacity: 0.85 }),
    );
    const motifGeosArt = [
      trackGeo(boxAt(0.12, 0.012, 0.004, 0, 0.05, 0, 0, 0, 0.12)), // carp stroke
      trackGeo(boxAt(0.09, 0.012, 0.004, 0.01, -0.01, 0, 0, 0, -0.3)), // lantern stroke
      trackGeo(boxAt(0.05, 0.012, 0.004, 0, -0.07, 0)),
    ];
    const motifGeosKitchen = [
      trackGeo(boxAt(0.11, 0.012, 0.004, 0, 0.04, 0, 0, 0, 0.5)), // rosemary sprig
      trackGeo(boxAt(0.08, 0.012, 0.004, -0.01, -0.02, 0, 0, 0, -0.7)),
      trackGeo(boxAt(0.06, 0.012, 0.004, 0, -0.08, 0)),
    ];
    const motifGeosClassic = [
      trackGeo(boxAt(0.13, 0.012, 0.004, 0, 0.05, 0)), // fountain doodle: tiers
      trackGeo(boxAt(0.09, 0.012, 0.004, 0, -0.01, 0)),
      trackGeo(boxAt(0.05, 0.012, 0.004, 0, -0.07, 0)),
    ];
    const makeMotif = (geos: THREE.BufferGeometry[], y: number) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(trackGeo(mergeGeometries(geos, false)!), motifMat));
      g.position.set(0, y, 0.012);
      g.visible = false;
      return g;
    };
    const motifArt = makeMotif(motifGeosArt, 0);
    const motifKitchen = makeMotif(motifGeosKitchen, 0);
    const motifClassic = makeMotif(motifGeosClassic, 0);
    cover.add(motifArt, motifKitchen, motifClassic);
    zineGroup.add(cover, pin);

    // Chalk caddy at the board foot — west side, clear of the r 0.75 obstacle circle
    const caddyMat = cedarMat;
    const caddyGeos = [
      trackGeo(boxAt(0.24, 0.09, 0.16, 0, 0.05, 0)), // box
      trackGeo(boxAt(0.26, 0.02, 0.18, 0, 0.1, 0)), // lip
    ];
    const caddy = new THREE.Mesh(mergeGeometries(caddyGeos, false)!, caddyMat);
    caddy.castShadow = true;
    const chalks = new THREE.Mesh(
      trackGeo(mergeGeometries(
        [boxAt(0.09, 0.024, 0.024, -0.05, 0.115, 0), boxAt(0.07, 0.024, 0.024, 0.06, 0.115, 0.02, 0, 0.4, 0.2)],
        false,
      )!),
      chalkMat,
    );
    const caddyGroup = new THREE.Group();
    caddyGroup.add(caddy, chalks);
    caddyGroup.position.set(-1.2, 0, 0.5); // group-local; world ≈ (3.2, 0, -2.7) —
    // walkable spot beside the board's west post (board obstacle r 0.75 + actor
    // radius 0.48 pushes the ground spot this far out; walkability-tested)
    zineGroup.add(caddyGroup);
    zineGroup.position.set(4.4, 0, -3.2); // match the noticeboard anchor
    zineGroup.userData.contactBatchRoot = true;
    addStaticContactShadow(zineGroup, shadowTex, 0.5, 0.45, 0.36, 0.018);
    group.add(zineGroup);
  }

  // ===================================================================================
  // 5.1b — Lemon-Thyme Sourdough: herb-strung crate UNDER the bakery display ledge
  // Bakery at (-12.4, 0, -10.8); ledge shelf local (-2.05, 1.38, 2.76); corbels at
  // x -2.55/-1.55. Crate hangs below the lip (world y ≈ 1.16), clear of the loaves,
  // rolls and price card (review H4 no-overlap list). Elevated → no contact disc.
  // ===================================================================================
  const herbGroup = new THREE.Group();
  herbGroup.name = 'prog_herb_crate';
  {
    const crateMat = trackMat(
      new THREE.MeshStandardMaterial({ color: '#9A7B55', roughness: 0.82, metalness: 0.02 }),
    );
    const crateGeos = [
      trackGeo(boxAt(0.5, 0.015, 0.2, 0, 0.1, 0)),
      trackGeo(boxAt(0.5, 0.015, 0.2, 0, -0.02, 0)),
      trackGeo(boxAt(0.015, 0.13, 0.2, -0.24, 0.04, 0)),
      trackGeo(boxAt(0.015, 0.13, 0.2, 0.24, 0.04, 0)),
      trackGeo(boxAt(0.5, 0.13, 0.015, 0, 0.04, -0.09)),
      trackGeo(boxAt(0.5, 0.13, 0.015, 0, 0.04, 0.09)),
      // hanging cords from the ledge lip
      trackGeo(cylinderAt(0.006, 0.006, 0.1, 4, -0.18, 0.17, 0)),
      trackGeo(cylinderAt(0.006, 0.006, 0.1, 4, 0.18, 0.17, 0)),
    ];
    const crate = new THREE.Mesh(mergeGeometries(crateGeos, false)!, crateMat);
    herbGroup.add(crate);
    // Hanging bunch variants (one visible per outcome)
    const bunchMarigold = new THREE.Group(); // plaza_table: marigold + thyme
    const bunchTea = new THREE.Group(); // tea_basket: chamomile + rosemary
    const makeBunch = (mats: THREE.Material[], x: number): THREE.Group => {
      const g = new THREE.Group();
      const stemL = cylinderAt(0.008, 0.008, 0.12, 4, x - 0.1, -0.07, 0, 0, 0, 0.18);
      const stemR = cylinderAt(0.008, 0.008, 0.12, 4, x + 0.1, -0.07, 0, 0, 0, -0.18);
      g.add(new THREE.Mesh(trackGeo(mergeGeometries([stemL, stemR], false)!), foliageMat));
      for (let i = 0; i < 2; i++) {
        const headGeo = trackGeo(new THREE.SphereGeometry(0.035, 6, 5));
        headGeo.translate(x + (i === 0 ? -0.12 : 0.12), -0.14, 0);
        g.add(new THREE.Mesh(headGeo, mats[i % mats.length]));
      }
      return g;
    };
    bunchMarigold.add(makeBunch([marigoldMat, foliageMat], 0));
    bunchTea.add(makeBunch([palette.standard(STORYBOOK_PALETTE.petalCream, 0.75, 0.0), palette.standard(STORYBOOK_PALETTE.foliageSage, 0.8, 0.0)], 0));
    bunchMarigold.name = 'bunch_plaza_table';
    bunchTea.name = 'bunch_tea_basket';
    herbGroup.add(bunchMarigold, bunchTea);
    herbGroup.position.set(-14.45, 1.16, -8.04);
    group.add(herbGroup);
  }

  // ===================================================================================
  // 5.1c — Cedar Music Stand: Mirror Pond south bank beside seat_pond_south (1.8, 19.3).
  // Off the bench volumes and nav edges (walkability-tested). Ground contact → disc
  // + batch root.
  // ===================================================================================
  const standGroup = new THREE.Group();
  standGroup.name = 'prog_music_stand';
  {
    const standGeos = [
      trackGeo(cylinderAt(0.035, 0.05, 0.06, 8, 0, 0.03, 0)), // foot
      trackGeo(cylinderAt(0.028, 0.028, 1.0, 6, 0, 0.5, 0)), // shaft
      trackGeo(boxAt(0.34, 0.42, 0.03, 0, 1.08, 0.02, -0.22)), // notched board
      trackGeo(boxAt(0.36, 0.03, 0.05, 0, 0.9, 0.06, -0.22)), // ledge lip
    ];
    const standBody = new THREE.Mesh(mergeGeometries(standGeos, false)!, cedarMat);
    standBody.castShadow = true;
    standGroup.add(standBody);
    // Sheet music resting on the board
    const sheet = new THREE.Mesh(trackGeo(boxAt(0.26, 0.3, 0.012, 0, 1.1, 0.05, -0.22)), paperMat);
    standGroup.add(sheet);
    // Outcome variants
    const clefMat = brassMat;
    const clef = new THREE.Mesh(trackGeo(boxAt(0.05, 0.22, 0.012, -0.11, 1.12, 0.062, -0.22)), clefMat);
    clef.name = 'variant_carved_clef';
    clef.visible = false;
    const braceMat = palette.standard(STORYBOOK_PALETTE.oakBark, 0.8, 0.03);
    const brace = new THREE.Mesh(
      mergeGeometries(
        [
          trackGeo(boxAt(0.4, 0.05, 0.04, 0, 1.24, 0.07, -0.22)), // oak brace across the back top
          trackGeo(boxAt(0.05, 0.3, 0.04, 0.15, 1.05, 0.075, -0.22)), // wind clip
        ],
        false,
      )!,
      braceMat,
    );
    brace.name = 'variant_weatherproof_oak';
    brace.visible = false;
    standGroup.add(clef, brace);
    standGroup.position.set(2.9, 0, 19.4);
    standGroup.userData.contactBatchRoot = true;
    addStaticContactShadow(standGroup, shadowTex, 0.62, 0.62, 0.4, 0.018);
    group.add(standGroup);
  }

  // ===================================================================================
  // 5.1d — True on the Route: brass pendulum charm under the Copperwheel porch lantern.
  // Lantern base ring at world (14.05, 1.55, -8.42) (reactiveProps.ts:241-291); the
  // charm hangs just below it, as an INDEPENDENT world-space group (review L7 — never
  // inside a seasonal porch sub-group). No ground contact → no disc.
  // ===================================================================================
  const charmGroup = new THREE.Group();
  charmGroup.name = 'prog_watch_charm';
  {
    const cord = new THREE.Mesh(trackGeo(cylinderAt(0.008, 0.008, 0.1, 4, 0, 0.05, 0)), ironMat);
    const charmBodyMat = brassMat;
    const charmBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 8)), charmBodyMat);
    charmBody.position.y = -0.03;
    const tagGeo = trackGeo(boxAt(0.05, 0.06, 0.014, 0, -0.1, 0, 0, 0, 0.1));
    const tag = new THREE.Mesh(tagGeo, palette.standard('#EFE3C8', 0.9, 0.0));
    tag.name = 'variant_steady_route';
    tag.visible = false;
    const beadGeo = trackGeo(new THREE.SphereGeometry(0.032, 6, 6));
    beadGeo.translate(0, -0.1, 0);
    const bead = new THREE.Mesh(beadGeo, palette.standard(STORYBOOK_PALETTE.ceramicCream, 0.6, 0.05));
    bead.name = 'variant_patient_repair';
    bead.visible = false;
    charmGroup.add(cord, charmBody, tag, bead);
    charmGroup.position.set(14.05, 1.5, -8.42);
    group.add(charmGroup);
  }

  // ===================================================================================
  // 5.1e — Lanterns Over Mirror Pond: two NEW short hooded sconce posts at the shore
  // step / pier head edges (review H3 — the stub pilings cannot carry them; the
  // existing pier lantern is untouched). Pier group world (2.22, 0, 15.84); sconces
  // flank the shore step on the land side (z 16.46). Ground contact → disc + batch
  // root (one group, two posts; the disc covers both).
  // ===================================================================================
  const sconceGroup = new THREE.Group();
  sconceGroup.name = 'prog_pier_sconces';
  let sconceGlassMat: THREE.MeshStandardMaterial;
  let sconceFlameA: THREE.Mesh;
  let sconceFlameB: THREE.Mesh;
  {
    const postGeos: THREE.BufferGeometry[] = [];
    for (const px of [-0.75, 0.75]) {
      postGeos.push(trackGeo(cylinderAt(0.045, 0.055, 0.56, 6, px, 0.28, 0)));
      postGeos.push(trackGeo(boxAt(0.16, 0.05, 0.16, px, 0.03, 0))); // stone pad
      postGeos.push(trackGeo(cylinderAt(0.012, 0.012, 0.14, 4, px, 0.62, 0.05, Math.PI / 2.4))); // arm
    }
    const posts = new THREE.Mesh(mergeGeometries(postGeos, false)!, cedarDarkMat);
    posts.castShadow = true;
    sconceGroup.add(posts);
    // Hooded heads: brass cap + hood + glass body (downward hood per the compromise)
    sconceGlassMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#FFE6A3',
        emissive: new THREE.Color(SCONCE_AMBER),
        emissiveIntensity: 0.0,
        roughness: 0.2,
        metalness: 0.05,
      }),
    );
    const capMat = brassMat;
    const hoodL = new THREE.ConeGeometry(0.09, 0.08, 6);
    hoodL.translate(-0.75, 0.76, 0.05);
    const hoodR = new THREE.ConeGeometry(0.09, 0.08, 6);
    hoodR.translate(0.75, 0.76, 0.05);
    sconceGroup.add(new THREE.Mesh(trackGeo(mergeGeometries([hoodL, hoodR], false)!), capMat));
    const glassL = new THREE.CylinderGeometry(0.05, 0.065, 0.1, 6);
    glassL.translate(-0.75, 0.68, 0.05);
    const glassR = new THREE.CylinderGeometry(0.05, 0.065, 0.1, 6);
    glassR.translate(0.75, 0.68, 0.05);
    const glassMesh = new THREE.Mesh(trackGeo(mergeGeometries([glassL, glassR], false)!), sconceGlassMat);
    glassMesh.name = 'sconce_glass';
    sconceGroup.add(glassMesh);
    const flameMat = trackMat(
      new THREE.MeshBasicMaterial({ color: '#FFD27A', transparent: true, opacity: 0.9 }),
    );
    const flameL = new THREE.SphereGeometry(0.022, 5, 4);
    flameL.translate(-0.75, 0.68, 0.05);
    const flameR = new THREE.SphereGeometry(0.022, 5, 4);
    flameR.translate(0.75, 0.68, 0.05);
    const flameMesh = new THREE.Mesh(trackGeo(mergeGeometries([flameL, flameR], false)!), flameMat);
    flameMesh.name = 'sconce_flames';
    flameMesh.visible = false;
    sconceGroup.add(flameMesh);
    sconceFlameA = flameMesh;
    sconceFlameB = flameMesh;
    sconceGroup.position.set(2.22, 0, 17.3); // south of the pond_water obstacle box
    // (maxZ 16.65 + actor radius) — flanking the shore approach on the bank
    sconceGroup.userData.contactBatchRoot = true;
    addStaticContactShadow(sconceGroup, shadowTex, 1.7, 0.5, 0.4, 0.018);
    group.add(sconceGroup);
  }

  // ===================================================================================
  // 5.2 — resident tokens: friend charms + kindred ribbons (review L6/L7 anchors)
  // ===================================================================================
  const tokenGroups = new Map<ResidentId, { group: THREE.Group; charm: THREE.Group; ribbon: THREE.Group }>();
  const RIBBON_MAT = trackMat(
    new THREE.MeshStandardMaterial({ color: STORYBOOK_PALETTE.petalMarigold, roughness: 0.72, metalness: 0.0 }),
  );
  // BUILD 03 perf discipline: the whole knot merges into ONE mesh (1 draw per ribbon).
  const buildRibbon = (): THREE.Group => {
    const g = new THREE.Group();
    const loopA = new THREE.TorusGeometry(0.05, 0.018, 5, 10);
    loopA.rotateY(0.6);
    loopA.translate(-0.045, 0, 0);
    const loopB = new THREE.TorusGeometry(0.05, 0.018, 5, 10);
    loopB.rotateY(-0.6);
    loopB.translate(0.045, 0, 0);
    const knot = new THREE.SphereGeometry(0.028, 6, 6);
    const tailA = boxAt(0.024, 0.1, 0.012, -0.02, -0.08, 0, 0, 0, 0.25);
    const tailB = boxAt(0.024, 0.1, 0.012, 0.03, -0.08, 0, 0, 0, -0.3);
    const merged = new THREE.Mesh(trackGeo(mergeGeometries([loopA, loopB, knot, tailA, tailB], false)!), RIBBON_MAT);
    g.add(merged);
    g.visible = false;
    return g;
  };
  const buildCharm = (id: ResidentId): THREE.Group => {
    const g = new THREE.Group();
    switch (id) {
      case 'clara': {
        // flour-dusted rolling-pin hook
        const pin = new THREE.Mesh(trackGeo(cylinderAt(0.022, 0.022, 0.13, 6, 0, 0, 0, 0, 0, Math.PI / 2)), cedarMat);
        const dust = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.026, 6, 5)), chalkMat);
        dust.position.set(0.04, 0.01, 0);
        dust.scale.set(1.1, 0.7, 0.9);
        g.add(pin, dust);
        break;
      }
      case 'pip': {
        // chalk stub
        g.add(new THREE.Mesh(trackGeo(boxAt(0.07, 0.028, 0.028, 0, 0, 0)), chalkMat));
        break;
      }
      case 'arthur': {
        // tiny brass gear — wheel + teeth merged (1 draw)
        const wheel = new THREE.CylinderGeometry(0.045, 0.045, 0.016, 8);
        wheel.rotateX(Math.PI / 2);
        const teeth = new THREE.TorusGeometry(0.05, 0.01, 4, 8);
        teeth.rotateX(Math.PI / 2);
        g.add(new THREE.Mesh(trackGeo(mergeGeometries([wheel, teeth], false)!), brassMat));
        break;
      }
      case 'mina': {
        // pressed-flower glass disc
        const disc = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 8)), palette.standard(STORYBOOK_PALETTE.lanternGlass, 0.25, 0.05));
        disc.rotation.x = Math.PI / 2;
        const flower = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.018, 5, 4)), marigoldMat);
        flower.scale.set(1.4, 0.4, 1.0);
        flower.position.z = 0.008;
        g.add(disc, flower);
        break;
      }
      case 'nora': {
        // ribbon book thong — merged (1 draw)
        g.add(new THREE.Mesh(
          trackGeo(mergeGeometries([boxAt(0.016, 0.14, 0.01, 0, 0, 0), boxAt(0.045, 0.02, 0.012, 0, 0.05, 0)], false)!),
          RIBBON_MAT,
        ));
        break;
      }
      case 'barnaby': {
        // carved wood bead string — cedar beads merged (1 draw), marigold bead accent
        const beadA = new THREE.SphereGeometry(0.022, 6, 5);
        beadA.translate(0, 0.04, 0);
        const beadC = new THREE.SphereGeometry(0.022, 6, 5);
        beadC.translate(0, -0.05, 0);
        g.add(new THREE.Mesh(trackGeo(mergeGeometries([beadA, beadC], false)!), cedarWarmHelper()));
        const beadB = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.022, 6, 5)), marigoldMat);
        beadB.position.set(0, -0.005, 0);
        g.add(beadB);
        break;
      }
      case 'rowan': {
        // cedar apple
        const apple = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.038, 7, 6)), palette.standard('#C77B4F', 0.8, 0.0));
        const leaf = new THREE.Mesh(trackGeo(boxAt(0.05, 0.012, 0.02, 0.03, 0.04, 0, 0, 0, 0.6)), foliageMat);
        g.add(apple, leaf);
        break;
      }
      case 'sora': {
        // tiny jingle bell on cord
        const bell = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.03, 6, 6, 0, Math.PI * 2, 0, Math.PI * 0.62)), brassMat);
        bell.rotation.x = Math.PI;
        bell.position.y = -0.02;
        const cordM = new THREE.Mesh(trackGeo(cylinderAt(0.006, 0.006, 0.05, 4, 0, 0.03, 0)), ironMat);
        g.add(bell, cordM);
        break;
      }
      case 'toby': {
        // paint-brush tuft
        const handle = new THREE.Mesh(trackGeo(cylinderAt(0.014, 0.014, 0.1, 5, 0, 0, 0, 0, 0, Math.PI / 2.2)), cedarMat);
        const tuft = new THREE.Mesh(trackGeo(boxAt(0.035, 0.03, 0.02, 0.05, 0.02, 0)), palette.standard('#D8A24C', 0.85, 0.0));
        g.add(handle, tuft);
        break;
      }
      case 'jun': {
        // mail-tag charm
        g.add(new THREE.Mesh(trackGeo(boxAt(0.07, 0.045, 0.012, 0, 0, 0, 0, 0, 0.2)), paperMat));
        g.add(new THREE.Mesh(trackGeo(cylinderAt(0.006, 0.006, 0.04, 4, 0, 0.045, 0)), ironMat));
        break;
      }
    }
    g.visible = false;
    return g;
    function cedarWarmHelper(): THREE.Material {
      return palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.78, 0.0);
    }
  };
  {
    const TOKEN_ANCHORS: Record<ResidentId, [number, number, number]> = {
      clara: [-9.05, 1.42, -8.13], // bakery SE corner post (world -9.2, y, -8.2), proud of the post face
      arthur: [14.05, 2.32, -8.56], // workshop porch lamp bracket zone (proud of the wall plate)
      mina: [10.66, 1.5, 3.2], // greenhouse porch finial side (west face)
      jun: [-9.8, 1.04, 7.2], // Willow mailbox POST top (never the animated flagMesh — review L6)
      barnaby: [13.2, 1.02, 15.52], // woodshop lumber stack top rail
      sora: [-4.78, 0.52, -3.05], // tea cart east frame, clear of proxies
      toby: [2.75, 0.88, 19.3], // pond bench east end top rail, outside the seat volume
      nora: [-12.68, 0.85, -2.48], // book nook serving cart corner
      pip: [-9.15, 1.42, -10.68], // bakery east window sill
      rowan: [-6.09, 1.72, -20.35], // orchard harvest ladder rail top
    };
    for (const id of Object.keys(TOKEN_ANCHORS) as ResidentId[]) {
      const g = new THREE.Group();
      g.name = `prog_token_${id}`;
      const charm = buildCharm(id);
      const ribbon = buildRibbon();
      g.add(charm, ribbon);
      const [x, y, z] = TOKEN_ANCHORS[id];
      g.position.set(x, y, z);
      g.visible = false;
      tokenGroups.set(id, { group: g, charm, ribbon });
      group.add(g);
    }
  }

  // ===================================================================================
  // 5.2c — keepsake echoes, EXTERIOR ones (interior echoes are built by the interior
  // rigs themselves): Toby's watercolor card on the pond driftwood; Barnaby's cedar
  // dish on the lumber stack beside his charm.
  // ===================================================================================
  const tobyCardGroup = new THREE.Group();
  tobyCardGroup.name = 'prog_echo_toby_card';
  {
    const card = new THREE.Mesh(trackGeo(boxAt(0.16, 0.2, 0.012, 0, 0.1, 0, 0, 0, 0.06)), paperMat);
    const paintMat = trackMat(
      new THREE.MeshStandardMaterial({ color: '#7FA8C9', roughness: 0.85, metalness: 0.0 }),
    );
    const paintStroke = new THREE.Mesh(trackGeo(boxAt(0.1, 0.05, 0.004, 0, 0.12, 0.008)), paintMat);
    const easelRail = new THREE.Mesh(trackGeo(cylinderAt(0.012, 0.012, 0.22, 5, 0, 0.11, -0.02, 0.15)), cedarDarkMat);
    tobyCardGroup.add(card, paintStroke, easelRail);
    tobyCardGroup.position.set(5.85, 0.2, 13.72); // pond driftwood log (canvas :765)
    tobyCardGroup.visible = false;
    group.add(tobyCardGroup);
  }
  const barnabyDishGroup = new THREE.Group();
  barnabyDishGroup.name = 'prog_echo_barnaby_dish';
  {
    const dish = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.1, 0.075, 0.045, 8)), cedarMat);
    const beeswax = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.075, 0.06, 0.012, 8)), palette.standard('#E9C97E', 0.5, 0.05));
    beeswax.position.y = 0.024;
    barnabyDishGroup.add(dish, beeswax);
    barnabyDishGroup.position.set(13.45, 1.06, 15.6);
    barnabyDishGroup.visible = false;
    group.add(barnabyDishGroup);
  }

  // ===================================================================================
  // 5.4 — exploration marks (builder-constant coordinates; review M3)
  // ===================================================================================
  const wellRibbonGroup = new THREE.Group();
  wellRibbonGroup.name = 'prog_mark_well_ribbon';
  {
    // tied to the Old Stone Well lip (well at (-21.4, 0, 19.0), lip y 0.73 r 0.74)
    const ribbon = buildRibbon();
    ribbon.visible = true;
    const streamer = new THREE.Mesh(trackGeo(boxAt(0.03, 0.16, 0.01, 0, -0.1, 0, 0, 0, 0.15)), RIBBON_MAT);
    wellRibbonGroup.add(ribbon, streamer);
    wellRibbonGroup.position.set(-20.72, 0.8, 19.32);
    wellRibbonGroup.visible = false;
    group.add(wellRibbonGroup);
  }
  const riseCairnGroup = new THREE.Group();
  riseCairnGroup.name = 'prog_mark_rise_cairn';
  {
    // stacked stones + survey ribbon tie, deliberately distinct from the Bee Line cairn
    const stoneGeos: THREE.BufferGeometry[] = [];
    let cy = 0;
    for (let i = 0; i < 3; i++) {
      const r = 0.16 - i * 0.04;
      const g = trackGeo(new THREE.DodecahedronGeometry(r, 0));
      g.scale(1.15, 0.72, 1.0);
      g.translate((i % 2 === 0 ? 0.02 : -0.03), cy + r * 0.4, 0);
      cy += r * 0.62;
      stoneGeos.push(g);
    }
    const stones = new THREE.Mesh(mergeGeometries(stoneGeos, false)!, stoneMat);
    stones.castShadow = true;
    const ribbon = buildRibbon();
    ribbon.visible = true;
    ribbon.scale.setScalar(0.8);
    ribbon.position.set(0.14, cy - 0.05, 0.04);
    riseCairnGroup.add(stones, ribbon);
    riseCairnGroup.position.set(20.6, 0, 16.0); // Foxglove Rise stair approach —
    // south of the rise_mound_* obstacle boxes (with actor-radius margin), inside
    // the discovery zone's approach path (walkability-tested)
    riseCairnGroup.userData.contactBatchRoot = true;
    addStaticContactShadow(riseCairnGroup, shadowTex, 0.6, 0.6, 0.4, 0.018);
    riseCairnGroup.visible = false;
    group.add(riseCairnGroup);
  }
  const laneArrowGroup = new THREE.Group();
  laneArrowGroup.name = 'prog_mark_lane_arrow';
  {
    // chalk arrow on the Marigold Lane signpost board (21.5, 0.8, board y 1.0, rot -0.5)
    const chalkArrowMat = trackMat(
      new THREE.MeshBasicMaterial({ color: '#5A5248', transparent: true, opacity: 0.8 }),
    );
    const arrowGeos = [
      trackGeo(boxAt(0.16, 0.014, 0.004, 0, 0, 0)),
      trackGeo(boxAt(0.05, 0.014, 0.004, 0.06, 0.03, 0, 0, 0, 0.5)),
      trackGeo(boxAt(0.05, 0.014, 0.004, 0.06, -0.03, 0, 0, 0, -0.5)),
    ];
    const arrow = new THREE.Mesh(mergeGeometries(arrowGeos, false)!, chalkArrowMat);
    const holder = new THREE.Group();
    holder.add(arrow);
    holder.position.set(0.02, 0, 0.045); // just proud of the board face
    holder.rotation.y = -0.5;
    laneArrowGroup.add(holder);
    laneArrowGroup.position.set(21.66, 1.0, 0.8);
    laneArrowGroup.visible = false;
    group.add(laneArrowGroup);
  }
  const hiveWreathGroup = new THREE.Group();
  hiveWreathGroup.name = 'prog_mark_hive_wreath';
  {
    // sprig wreath on the wild bee log face (log face local (-0.72, 0.32, 0.06), rot y 0.25)
    const wreath = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.09, 0.02, 5, 10)), foliageMat);
    const berries: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const g = trackGeo(new THREE.SphereGeometry(0.016, 5, 4));
      g.translate(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0.012);
      berries.push(g);
    }
    const berryMesh = new THREE.Mesh(mergeGeometries(berries, false)!, marigoldMat);
    const wreathHolder = new THREE.Group();
    wreathHolder.add(wreath, berryMesh);
    wreathHolder.position.set(-0.86, 0.34, 0.11);
    wreathHolder.rotation.y = 0.25;
    hiveWreathGroup.add(wreathHolder);
    hiveWreathGroup.position.set(11.0, 0, -19.7);
    hiveWreathGroup.visible = false;
    group.add(hiveWreathGroup);
  }

  // ===================================================================================
  // apply — revision-gated by the caller. Zero allocation.
  // ===================================================================================
  let lastAppliedRevision = -1;
  const apply = (state: ProgressionVisualState): void => {
    if (state.revision === lastAppliedRevision) return;
    lastAppliedRevision = state.revision;

    const sp = state.storylineProps;
    zineGroup.visible = sp.zineChalkboard;
    if (sp.zineChalkboard) {
      const chalkFace = (cover as THREE.Mesh).material as THREE.MeshStandardMaterial;
      chalkFace.color.set(ZINE_THEME_TINTS[sp.zineTheme ?? 'classic_edition']);
      motifVisibility(sp.zineTheme ?? 'classic_edition');
    }
    herbGroup.visible = sp.herbWindowCrate;
    if (sp.herbWindowCrate) {
      const plaza = (sp.herbStyle ?? 'plaza_table') === 'plaza_table';
      (herbGroup.children.find((c) => c.name === 'bunch_plaza_table') as THREE.Group).visible = plaza;
      (herbGroup.children.find((c) => c.name === 'bunch_tea_basket') as THREE.Group).visible = !plaza;
    }
    standGroup.visible = sp.musicStand;
    if (sp.musicStand) {
      const clef = standGroup.children.find((c) => c.name === 'variant_carved_clef') as THREE.Mesh;
      const brace = standGroup.children.find((c) => c.name === 'variant_weatherproof_oak') as THREE.Mesh;
      const carved = (sp.standStyle ?? 'carved_clef') === 'carved_clef';
      clef.visible = carved;
      brace.visible = !carved;
    }
    charmGroup.visible = sp.watchCharm;
    if (sp.watchCharm) {
      const tag = charmGroup.children.find((c) => c.name === 'variant_steady_route') as THREE.Mesh;
      const bead = charmGroup.children.find((c) => c.name === 'variant_patient_repair') as THREE.Mesh;
      const steady = (sp.watchStyle ?? 'steady_route') === 'steady_route';
      tag.visible = steady;
      bead.visible = !steady;
    }
    applySconceOutcome(sp.pierSconces, sp.sconceOutcome);

    const tokenKinds = new Map<ResidentId, 'friend_charm' | 'kindred_ribbon'>();
    for (const t of state.residentTokens) tokenKinds.set(t.residentId, t.kind);
    for (const [id, rig] of tokenGroups) {
      const kind = tokenKinds.get(id);
      rig.group.visible = kind !== undefined;
      rig.charm.visible = kind === 'friend_charm';
      rig.ribbon.visible = kind === 'kindred_ribbon';
    }

    const echoResidents = new Set<ResidentId>();
    for (const e of state.keepsakeEchoes) echoResidents.add(e.residentId);
    tobyCardGroup.visible = echoResidents.has('toby');
    barnabyDishGroup.visible = echoResidents.has('barnaby');

    wellRibbonGroup.visible = state.explorationMarks.wellRibbon;
    riseCairnGroup.visible = state.explorationMarks.riseCairn;
    laneArrowGroup.visible = state.explorationMarks.laneArrow;
    hiveWreathGroup.visible = state.explorationMarks.hiveWreath;
  };

  function motifVisibility(theme: ZineTheme): void {
    const coverChildren = (cover as THREE.Mesh).children;
    for (const child of coverChildren) {
      (child as THREE.Group).visible =
        (theme === 'art_edition' && child === coverChildren[0]) ||
        (theme === 'kitchen_edition' && child === coverChildren[1]) ||
        (theme === 'classic_edition' && child === coverChildren[2]);
    }
  }

  function applySconceOutcome(visible: boolean, outcome: LanternOutcome | null): void {
    sconceGroup.visible = visible;
    if (!visible) return;
    const mode = outcome ?? 'bridge_compromise';
    if (mode === 'gentle_space') {
      // the NEW sconces stay dark; the existing pier lantern is never touched
      sconceGlassMat.emissiveIntensity = 0;
      sconceGlassMat.emissive.set(SCONCE_AMBER);
      sconceFlameA.visible = false;
    } else if (mode === 'public_harmony') {
      sconceGlassMat.emissive.set(SCONCE_SOFT);
      sconceGlassMat.emissiveIntensity = 0.55;
      sconceFlameA.visible = true;
    } else {
      sconceGlassMat.emissive.set(SCONCE_AMBER);
      sconceGlassMat.emissiveIntensity = 0.8;
      sconceFlameA.visible = true;
    }
  }

  const dispose = (): void => {
    for (const g of ownedGeos) g.dispose();
    for (const m of ownedMats) m.dispose();
    ownedGeos.length = 0;
    ownedMats.length = 0;
  };

  return { group, apply, dispose };
}
