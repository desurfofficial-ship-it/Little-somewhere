# 04 — Character Design Bible

**Scope**: the ten residents (Clara, Arthur, Mina, Jun, Barnaby, Sora, Toby, Nora, Pip, Rowan) and the player avatar. All current-state numbers are `[CONFIRMED]` from `src/scene/builders/characters.ts`, `src/scene/prototypes/willowLaneDiorama.ts`, `src/game/residents.ts`, `src/game/simulation.ts` and their tests. Proposed numbers are **validation-gated targets** — they ship only if the Doc 09 validation set passes and the test contracts in §9 stay green.

**Prime directive**: our characters are *ordinary inhabitants* of an established cozy world — a baker, a clockmaker, a botanist, a letter carrier, a carpenter, a violinist, an artist, a bookseller, a child, an orchard keeper. They are not warriors, troops, or fantasy heroes. All Clash of Clans techniques (Doc 02 §1) are filtered through clay-storybook warmth.

---

## 1. Why the current cast reads "same body, different clothes"

`[CONFIRMED]` Every resident shares one core skeleton: identical torso cylinders (coatChest 0.23→0.26 r, coatSkirt 0.24→0.34/0.37 r), identical limb radii (pant r 0.105→0.092, sleeve r 0.074→0.094), identical head radius 0.285 and arm/leg pivot positions (`characters.ts:197-231,435-456`). Differentiation currently arrives via `heightScale` (0.78 Pip → 1.08 Barnaby), coat colors, hats, and named accessories.

That is exactly the pattern Doc 02 §1.1.2 flags in Clash of Clans' *opposite*: CoC characters differ by **skeletal proportions and massing first**, clothing second. Our fix is therefore structural, not cosmetic: introduce a small archetype layer *under* the existing builder.

## 2. Proportion guidelines (v2 targets)

### 2.1 The proportion ladder

| Measure | Current (s=1.0) | v2 target | Rationale |
| :--- | :--- | :--- | :--- |
| Standing height | ≈ 1.64 u | ≈ 1.66 u (unchanged span, per-resident) | Height stays; mass redistributes |
| Head radius | 0.285 | **0.310** (+8.8%) | Pushes head:height from ~1:2.9 to ~1:2.6 — "chunky chibi" without breaking envelopes |
| Head:height ratio | 1 : 2.9 | **1 : 2.6** | CoC-grade readability, still soft/clay (not CoC's 1:2 aggression) |
| Eye sphere r | 0.036 (12.6% of head r) | **0.052** (~16.8%) | Sized to resolve at ~30 m / 28° FOV (≈4 px today, ≈6 px after, ≈8 px at dialogue zoom 0.72) |
| Eye spread | ±0.105 | **±0.120** | Wider set reads friendlier and survives foreshortening from the elevated camera |
| Catchlight r | 0.013 | **0.020** | The "alive dot" must survive DPR-1 mobile |
| Mouth arc r / tube | 0.06 / 0.0125 | **0.070 / 0.018** | Emotion readable at gameplay distance; arc constants stay test-compatible |
| Brow size | 0.074×0.02×0.024 | **0.096×0.024×0.030** | Brows carry emotion from behind/side (current faces vanish off-angle — QA `rowan_plaza_face.png`) |
| Nose r | 0.04 | **0.052** (+ forward 0.275→0.283) | Stronger facial silhouette from the isometric 3/4 view |
| Blush r | 0.05 | **0.062** | Warmth read at distance |
| Hand r | 0.07 sphere | **mitten ≈ 0.095 equiv.** (§4) | Hands become a readability asset, not a liability |
| Boot | r 0.095 capsule | **0.105 with toe cap** | Grounded stance, CoC-style boot mass |

### 2.2 Invariants (do not touch)

- `heightScale` span 0.78–1.08 and per-resident values (`residents.ts`) — unchanged.
- Joint pivots (hip y 0.42, torso 0.45, shoulder 0.53, neck 0.90) — unchanged, so **every existing animation target remains valid**.
- Player silhouette envelope contract (width ≤ NPC baseline + 0.03, front reach < 0.42, grounded ≥ −0.01 — `playerAvatar.test.ts:67-95`) — head/hand growth is applied to *both* player and NPC baselines so the contract's *relationship* holds; the test constants are re-derived, not deleted.
- Seated-clearance contract (`environmentRenderer.test.ts:179-250`, bench `backrestFrontZ + 0.015`) — archetype massing must keep seated `bodyGroup` min.z clear; the Barrel archetype (§3) is validated against this first.

## 3. Body types — the archetype system

### 3.1 Five archetypes (the whole vocabulary)

| Archetype | Massing signature | Parameters (vs current base) |
| :--- | :--- | :--- |
| **Hearth-Round** | Soft, wider lower mass; welcoming | coatSkirt flare 0.34→**0.40**; coatChest bottom 0.26→**0.275**; baked posture lean 0.02 fwd |
| **Barrel** | Broad chest, sturdy arms; monumental calm | coatChest top 0.26→**0.295**; shoulder pivots ±0.30→**±0.325**; sleeve r +12%; pant r 0.105→**0.118**; head r ×**0.96** (slightly smaller relative head) |
| **Slender** | Narrow, precise, vertical | coatChest top 0.26→**0.235**; skirt flare 0.34→**0.315**; sleeve r −8% |
| **Bean (child)** | Big head, short compact limbs | heightScale 0.78 (existing) + head r ×**1.05**; sleeve/pant r −10%; boot r −10% |
| **Standard** | The house baseline | current values |

### 3.2 Cast assignment (identity-safe; pairs with existing `residents.ts` personalities)

| Resident | Archetype | Height (existing) | Why it deepens the character |
| :--- | :--- | :--- | :--- |
| Clara (baker) | Hearth-Round | 1.00 | The warm hearth of the town gains the silhouette of warmth |
| Arthur (clockmaker) | Slender | 1.03 | Precision rendered as form |
| Mina (botanist) | Standard | 0.98 | — |
| Jun (letter carrier) | Standard | 0.99 | Bespoke builder already differentiates; archetype keeps parity |
| Barnaby (carpenter) | Barrel | 1.08 | Gruff monumentality; his "checks every beam" mass |
| Sora (violinist) | Slender | 0.97 | Airy, dreamy verticality |
| Toby (artist) | Standard | 0.94 | — |
| Nora (bookseller) | Standard | 0.96 | — |
| Pip (child) | Bean | 0.78 | Child reads as child from *any* angle, not just scale |
| Rowan (orchard keeper) | Standard | 1.06 | — |
| Player | Standard | 1.00 | Relatable every-person |

**[ARTISTIC OPPORTUNITY]** Archetype parameters are additive configuration under `buildStorybookCharacter`'s per-character tailoring branch (`characters.ts:253-427`) — the existing mechanism extended, not a new system. Jun's bespoke builder receives the same face/head v2 numbers to close the duplication drift (Doc 01 §4.1.11).

## 4. Hands, feet & grip

1. **Mitten hands**: palm = squashed sphere pair (two-lobe, ≈0.095 equiv. volume) or rounded box + thumb capsule r 0.028; wrist cuff ring stays. Chunky, cute, zero rigging cost — the single cheapest character-quality win.
2. **`handAnchor`**: expose a hand-anchored attach point on `CharacterRig` (optional, additive). Props with visible grip narratives re-parent one level down: watering can (Mina), book (Nora), loaf basket (Clara), sketchbook (Toby), apple basket (Rowan). Two-handed props (violin) stay torso-mounted.
3. **Boots**: toe-cap massing + heel block; ground contact unchanged (contact shadow disc already handles grounding).
4. **Carry variants**: cradle-carry (tray, basket, loaf — current pose) vs side-carry (book, sketchbook — one-arm bent, other relaxed) vs two-hand front (pail — slight lean back). Three variants replace the one-size cradle (`characters.ts:1063-1068`).

## 5. Facial design

### 5.1 Construction (current parts, v2 sizes — §2.1)

Eyes (dark bead + catchlight), lids, brows, nose, blush, smile-arc + surprise-"o" — the current part list is preserved **exactly** (names and test contract unchanged, `residentIdentity.test.ts:68-112`); v2 changes *scale and placement only*, plus two upgrades:

1. **Lids become curved caps** (hemispheres over the eye spheres) instead of skin boxes — blink becomes a lid slide/rotate rather than a scale pop; same 4.3 s deterministic cycle.
2. **Talk mouth-flap**: during `talk`/`converse`, the smile arc's scale.y oscillates ±25% at ~9 Hz (subtle, clay-friendly); the "o" mouth pulses already and gains the same drive. Speech has a face at dialogue zoom.

### 5.2 Emotion at three distances (the acceptance lens)

| Distance | Must read via | Target |
| :--- | :--- | :--- |
| Gameplay ~33 m | Posture + head pitch + brow/eye *blocks* + coat color | "happy vs sad" distinguishable |
| Zoom-in 23.8 m | Full face parts | All 10 emotions distinguishable |
| Dialogue sheet (procedural portrait) | Portrait painter | Unchanged — already excellent |

`emotionIntensity` (0.55–0.85, `simulation.ts:369-396`) is plumbed through `CharacterAnimationOptions` as a multiplier on face-amplitude and pose-amplitude; emotions *arrive*, they don't snap.

### 5.3 Age & personality in faces

- Pip (child): eyes ×1.1 further, freckles stay, brows thinner.
- Barnaby/Rowan (elders): brow mass up, beard parts unchanged, nose +10%.
- Nora: glasses rims scale with eye spread.
- Arthur: loupe re-centered to the new eye spread.
(All named facial accents keep their test names.)

## 6. Clothing & silhouette guidelines

1. **Two-tone garment panels** (evident craft on characters): apron bibs, coat fronts, scarves and hats gain a slightly lighter/darker face panel or trim strip (procedural canvas tint, no new textures required) so front/back reads instantly from the isometric camera.
2. **Trim-band discipline**: garment trim (collars, cuffs, hems, apron strings) stays in the 0.12–0.40 m visual band; embroidery-level detail is forbidden at gameplay distance.
3. **Coat physics language** (preserved & extended): scarf/shawl tail pivots already respond to stride and banking (`characters.ts:1166-1178,1235-1249`); winter knits tint per recipe (`winterKnits.test.ts`). v2 adds nothing structural here.
4. **Occupation legibility**: each costume keeps its current signature prop story (Jun's peeking postcard, Clara's loaf, Mina's can, Sora's violin, Toby's rolled canvas, Nora's book, Rowan's basket, Barnaby's apron, Arthur's watch chain, Pip's chalk-stained dungarees). These are the "distinctive accessories" the brief asks for — they exist and are protected.

## 7. Character differentiation checklist (the anti-"same NPC" gate)

Every resident must differ in **at least six** of these nine channels (current cast already clears 5–7; archetype + face v2 pushes everyone to 7+):

1. Body archetype massing (new) — 2. Height (existing) — 3. Face accents (existing) — 4. Hair/hat silhouette (existing) — 5. Coat silhouette & color (existing) — 6. Signature prop (existing) — 7. Idle animation flavor (existing glance/admire variants) — 8. Gait feel (bank/stride params — existing `residentFeel.ts`) — 9. Winter-knit tint (existing).

## 8. Animation principles (preserve, then deepen)

### 8.1 Preserved as law (these are the house strength)

Joint-pivoted poses; squash & stretch with exact math; arm follow-through ×0.82; stride-locked NPC walking; continuous player stride-frequency curve; banking with dead-zone; launch lean / brake squash; cloth secondary motion; deterministic blink; clamped look-at; dust language; zero-GC runtime.

### 8.2 Deepening phases (dependency-ordered; see Doc 08 Phase 6)

1. **Phase A — face & feel (cheap, high impact)**: v2 face scales; talk mouth-flap; emotion-intensity plumbing; carry variants.
2. **Phase B — two-segment arms**: forearms gain an elbow pivot with clamped rotation; driver contract unchanged (damped targets); wave gains forearm snap, `work` gains elbow articulation, `music` gains bow-wrist. Legs stay single-pivot; **knee articulation is explicitly deferred** (risk/benefit does not yet justify touching stride-sync tests).
3. **Phase C — pre-bent leg geometry**: knee bend baked into pant/boot geometry (visual bend without new DOF) — runs read as gait, not scissor.
4. **Phase D — optional gait color** [OPTIONAL SUGGESTION]: high-curiosity residents (Pip `curiosity` 0.96, Jun) get a subtle hurried-gait multiplier in `RESIDENT_EXTRA_ACTIVITIES` transitions. Requires a sim-side read-only constant — flag for design approval (touches `simulation.ts` constants, hence out of audit scope).

### 8.3 Anti-cartoonish guardrails

Squash amplitude cap stays (existing); no stretch-and-smear, no bug-eyes, no rubber limbs; exaggeration lives in *poses and silhouettes*, never in deformation. "Expressive and polished without becoming excessively cartoonish" is enforced by keeping every new amplitude within the existing damping/lerp discipline.

## 9. Compatibility contract (the evolve-don't-break list)

Every item is currently test-locked; visual upgrades must either keep these green or extend them *additively* with the same review discipline:

1. `mouthSmile` / `mouthO` names, visibility rules, arc constants (`residentIdentity.test.ts:68-112`).
2. Named identity-part table per resident (`residentIdentity.test.ts:125-153`) — additions allowed, renames forbidden.
3. Pip freckle count/placement and knee-patch parentage (`residentIdentity.test.ts:155-170`).
4. Player-exclusive scarf/satchel (`playerAvatar.test.ts:24-65`).
5. Silhouette envelope + seated clearance (`playerAvatar.test.ts:67-95`, `environmentRenderer.test.ts:179-250`) — re-derive constants when archetypes land; document deltas in the PR.
6. Squash math exactness (`playerAvatar.test.ts:97-114`).
7. Scarf trail / banking / lean / glance behaviors (`playerAvatar.test.ts:116-167`, `residentFeel.test.ts`).
8. Winter knit tint recipe + per-rig clone discipline (`winterKnits.test.ts:41-153`).
9. No visible mesh below y −0.02; positive scale (`residentIdentity.test.ts:197-213`).
10. Zero per-frame allocations in `tick()`; `CharacterAnimationOptions` pre-allocation pattern preserved.

## 10. Validation hooks (see Doc 09 for the full protocol)

- **V1 Clara**: Hearth-Round archetype + v2 face — before/after at zoom 0.72 / 1.0 / dialogue; 4 phases; software-GL parity.
- **V2 Rowan**: Standard archetype + basket grip (mitten hand holding lathe basket).
- Portrait painter (`DialogueVisuals.tsx`) must be re-synced to any *color* change (none proposed in v2) — geometry changes don't affect it; verify anyway.
