# Everyday Life Visual Direction — Willow Step Cottage & Feedback Language

**Date**: 2026-11-20
**Scope**: the interior presentation target for the Milestone 2C polish pass. Extends, does not replace, `docs/art-direction/VISUAL_IDENTITY.md` (Premium Handcrafted Storybook Diorama).

---

## 1. Lighting hierarchy (back to front)

1. **Key — daylight through windows**: cool-warm `#FFE9C2` sun + emissive glass; visible **light shafts** angled from the west sill and north windows, strongest in morning, softening through golden, nearly gone at dusk. Shafts are the room's clock — players should sense the hour without the HUD.
2. **Focus — the hearth**: warm `#FFB46B` PointLight (no shadows) flickering gently with `hearthLit`. At dusk the hearth becomes the dominant light so the room visibly "moves" toward the fire as evening comes. Ember emissive and banker's-lamp amber already follow this curve.
3. **Fill — warm ambient**: hemisphere + environment scaled per phase; dusk floor raised so plaster, wainscot, and floor seams stay readable. No corner of the room may fall into undifferentiated brown.
4. **Atmosphere — dust motes** inside the shaft volume, additive, slow, sparse (~34). They exist to make light feel volumetric, not to become particles of interest.

Rules: zero new shadow-casting lights; the interior stays a 2-variant lighting program (indoor/outdoor) with no per-frame recompiles; all flicker is sine-driven math in the existing `rig.update` (zero allocation).

## 2. Composition rules

- **Anchors**: hearth wall (north-west) = activity anchor; bed corner (south-west) = rest anchor with the dusk floor lamp; table center-south = tea anchor with two stools; shelf/desk (north-east/south-east) = memory anchor. The mid-east corridor stays clear — it is the room's breathing space and navigation lane.
- **Props live on surfaces or against walls**; nothing placed in the walk band. New floor items must sit inside existing `COTTAGE_INTERIOR_OBSTACLES` footprints.
- **Silhouette check**: each anchor reads in one glance — chimney breast, headboard+quilt, round table+stools, bracket shelf+clock.
- **Storytelling props** (firewood basket, teacup, book stack, scarf, umbrella, dried herbs) are small, muted, and never compete with interactive stations; interactive stations stay the most saturated objects in their corner.

## 3. Material & palette continuity

Everything reuses `STORYBOOK_PALETTE` cached materials: plaster walls, cedar warm/dark woods, terracotta, ceramic cream, aged brass, wrought iron, linen, sage. New materials are limited to: curtain linen (existing `linenMat`), frame woods (existing cedars), muted print pigments (`sage`/`terracotta`/`ceramic`), and one additive shaft material (per-phase opacity, shared by both shafts). Rug gains a stitched border in `linenMat`. No texture map changes; no new dependencies.

## 4. Feedback presentation language (UI + SFX)

- **Activity overlays** (hearth): 3 steps, ~0.6 s each, soft linen card with progress dots; completion card names the item and the time spent; the reducer commits once, at the end. Language is concrete and sensory ("Filling the kettle…", "Steeping chamomile…", "Warming the cup…").
- **Item chips**: `+1 Chamomile Blossoms` style chips with the item label in display casing, count in mono numerals; chips sit above prose, prose keeps the atmospheric sentence.
- **Veil transitions**: 420 ms soft linen-cream fade (door enter/exit, bed rest). No spinners, no black flash.
- **Sound hooks**: kettle steam swell on brew start, soft wooden tick on arrange/shelf, existing memory chime reserved for milestone beats. All procedural Web Audio, all under the existing mute switch.
- **Restraint check**: an effect ships only if it reinforces the specific action (steam for brewing, chips for gathering, veil for scene changes). No global confetti, no screenshake, no new permanent HUD elements.

## 5. Non-goals

No exterior art overhaul, no new furniture categories with gameplay claims, no decoration mode, no currency/economy surfaces, no real-time day progression, no new residents or districts, no heavy imports into the deferred chunk.

---

## 6. Round-2 additions — tea table, hearth wall, entry (Passes 5–7)

**Tea-table ritual presentation** (Pass 5):
- Seat targets are offered only via the two existing stool meshes; the seated character uses the shared sit pose at `computeSitGroundY(0.46)` — no bespoke animation.
- While seated on a cottage seat, a **stoneware teacup + thin steam wisp** fades in on the table (visual-only, derived from `playerPosture`/`playerSeatId` — zero persisted state, zero allocation). It disappears the moment the player stands.
- Sip feedback: gentle porcelain SFX + a prose card in the existing prop-card language ("The cup warms your hands…"); time advances +8m; first-ever sip per drink writes a Pocket Journal memory. No overlays, no progress bars — sipping should feel like resting, not like crafting.

**Hearth-wall life** (Pass 6): mantel objects stay below y 1.9 and in front of the chimney breast plane; candle flame is a single emissive dot (dusk-emissive, sine flicker shared with the ember curve). Counter props read as *use*, not clutter: crock + spoons upright at the wall end, board + slice toward the firebox end, folded cloth centered. Entry boots sit against the east curb inside the door recess; pegs + hat live on the north wall plane. All statics reuse cached `STORYBOOK_PALETTE` materials.

**Sound** (Pass 7): the crackle room-tone is a *floor* (≈0.02 gain), never a feature — if the player notices it as "a sound", it is too loud. It stops immediately on mute, exit, extinguished hearth, or pause. Sit = one soft wooden settle; sip = two tiny breaths + one porcelain tick. Restraint check unchanged: every effect reinforces exactly the action that triggered it.

---

## 7. Round-3 additions — a room that knows the weather (Passes 8–12)

**Weather is an interior material** (Pass 8): the west window is the room's weather gauge. Rain = ten shared-geometry streaks sliding the glass span + a translucent cool veil (~0.2 opacity) + pane emissive dimmed ×0.55; mist fogs softly (~0.13) without streaks and lifts after 10:30; the sun shaft drops to ×0.22 in rain and ×0.40 in mist, and dust motes hush ×0.5 — no floating dust in a downpour. Curtains stir only in a breeze (±0.02 rad sine, easing back to their dressed tilt). Winter feathers the sill and glass corners with linen-white frost. Effective-weather resolution mirrors `composeEnvironmentState` exactly — one rule, two consumers, no drift.

**The clock tells the truth** (Pass 8): the shelf clock is the room's analog HUD — hour and minute hands are pivot groups driven by `minuteOfDay` every frame. If the HUD says 6:40 PM, the clock says 6:40.

**The chimney advertises the hearth** (Pass 10): exterior smoke strength is pure state mapping (0 cold / 1 lit / 1.3 kettle-warm). The puff material is never mutated — visibility and scale only.

**Rain is heard, not seen-only** (Pass 9): a rainy interior gains a low rumble bed (0.016) + faint patter hiss (0.007) — a *floor* like the crackle, layered under it, evaluated on transitions only, stopped on mute/exit.

**Restraint check additions**: weather effects never animate furniture positions or add lights; the frost, streaks, and veil live inside the existing wall/glass planes; every new observable is derived from `WorldState` at update time (zero persisted state, zero schema impact).
