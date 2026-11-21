# 00 — Index: Visual Identity Evolution & Character Art Direction Overhaul

**Project**: LITTLE SOMEWHERE
**Audit family**: Visual art-direction audit & implementation blueprint (Clash of Clans–inspired visual elevation, identity-preserving)
**Date**: 2026-11-21
**Status**: `DOCUMENTED RECOMMENDATION` — no gameplay, simulation, save-schema, or asset-replacement changes are proposed by this audit itself.

---

## 1. What this directory is

This directory is the complete response to the *Visual Identity Evolution & Character Art Direction Overhaul* brief: an evidence-based audit of the game's current visuals, a disciplined analysis of the external references (Clash of Clans, Tiny Glade, The Wild at Heart), a concrete visual identity specification, design bibles for characters and environments, a technical-art specification, a visual-progression specification, a dependency-ordered implementation roadmap, and a visual validation set.

**The thesis in one sentence:** *Clash of Clans' excellence is not a medieval style — it is an information-design system (silhouette primaries, material contrast, eye-guiding gradients); Tiny Glade's warmth is not detail density — it is visible evidence of craft; The Wild at Heart's charm is illustrated nostalgia. LITTLE SOMEWHERE can absorb all three as techniques while remaining unmistakably itself.*

## 2. Documents

| # | Document | Question it answers |
| :--- | :--- | :--- |
| **01** | [Current Visual Identity Audit](01-current-visual-identity-audit.md) | What does LITTLE SOMEWHERE actually look like today, file by file, and what is confirmed working vs. lagging? |
| **02** | [Reference Game Visual Analysis](02-reference-game-visual-analysis.md) | Which exact techniques from Clash of Clans, Tiny Glade, and The Wild at Heart are worth adopting — and what must never be copied? |
| **03** | [Visual Identity Specification](03-visual-identity-specification.md) | What is the final art direction ("Storybook Diorama v2 — Readable Form, Evident Craft, Living Warmth") and its measurable standards? |
| **04** | [Character Design Bible](04-character-design-bible.md) | How do our ten residents become as expressive and readable as Clash-style figurines without losing who they are? |
| **05** | [Environment & Asset Design Bible](05-environment-asset-design-bible.md) | How do buildings, furniture, props, vegetation and interiors reach the same craft bar? |
| **06** | [Rendering & Technical Art Specification](06-rendering-technical-art-specification.md) | Which material, lighting, shadow, camera and performance changes carry the look within the existing pipeline and budgets? |
| **07** | [Visual Progression Specification](07-visual-progression-specification.md) | How does gameplay progression become visible without timers, currencies, or schema changes? |
| **08** | [Visual Upgrade Implementation Roadmap](08-visual-upgrade-implementation-roadmap.md) | In what dependency-ordered phases, with which risks and acceptance criteria, is this delivered? |
| **09** | [Visual Validation Set](09-visual-validation-set.md) | Which six representative artifacts prove the direction before mass production? |

## 3. Non-negotiable boundaries (restated, binding for every document here)

1. LITTLE SOMEWHERE remains its original **cozy isometric 3D life-simulation community game** (`GAME_DESIGN.md` is authoritative).
2. No combat, armies, troops, defensive structures, magic, medieval factions, fantasy RPG mechanics, Town Hall progression, upgrade timers, or real-world waiting mechanics.
3. Clash of Clans is a **visual design reference only** — techniques, not content, systems, or theme.
4. Existing world, setting, narrative identity, NPC autonomy, relationships, personalities, routines, gameplay loops, economy-free progression philosophy, buildings, locations, interiors, and player experience are preserved.
5. This audit modifies **no gameplay code, no simulation systems, no assets, no dependencies, no save schemas**. It only adds documentation under `docs/art-direction/`.
6. Implementation (per Doc 08) must respect the engineering constitution in `AGENTS.md` — the three-layer separation, mobile/software-WebGL discipline, test gates, and documentation sync rules.

## 4. Relationship to existing art-direction governance

This directory **extends, and does not replace**, the existing source-of-truth documents:

- `docs/art-direction/VISUAL_IDENTITY.md` — **Premium Handcrafted Storybook Diorama** remains the official direction; Doc 03 of this audit proposes its *v2 elevation layer*, to be merged into that document only after the validation set (Doc 09) passes.
- `docs/art-direction/VISUAL_QUALITY_STANDARDS.md` — its checklist remains the review gate; Docs 04–06 add measurable sub-standards beneath it.
- `docs/art-direction/VISUAL_AUDIT.md` (2026-11-18) — audited the pre-polish build; every P0 it listed has since been remediated (verified in Doc 01, §10). This audit supersedes it as the current-state record.
- `docs/art-direction/REFERENCE_GUIDELINES.md` — its "distill qualities, never clone IP" discipline is exactly the doctrine Docs 02–03 formalize for the new references.
- `docs/art-direction/building-architecture-audit.md`, `docs/audits/09-comprehensive-asset-visual-audit.md`, `docs/production/*` — the remediation trail this audit builds upon; their remaining open items are folded into Doc 08.

## 5. How to read the audit's claim taxonomy

Every recommendation across Docs 01–09 is tagged:

- **[CONFIRMED]** — directly verified in code (`file:line`), tests, or committed QA screenshots (`download/asset-qa/pass26/*`).
- **[ARTISTIC OPPORTUNITY]** — a genuine elevation opportunity implied by the evidence; not a defect.
- **[OPTIONAL SUGGESTION]** — a taste-level option; explicitly safe to decline.

Nothing in this audit assumes "every asset needs rebuilding." The opposite is true: Doc 01 catalogs substantial existing excellence that must be preserved, and Doc 08's roadmap upgrades targeted weaknesses surgically.

The `[CONFIRMED]` / `[ARTISTIC OPPORTUNITY]` / `[OPTIONAL SUGGESTION]` tags above are used directly in Docs 01–04; the registers in Docs 05, 07 and 08 inherit them — their priority levels (P1–P3) schedule artistic-opportunity items whose *source findings* are all `[CONFIRMED]` in Doc 01.
