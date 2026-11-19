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
