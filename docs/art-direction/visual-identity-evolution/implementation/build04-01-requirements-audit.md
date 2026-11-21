# BUILD 04 — LIFE IN MOTION · Stage 0/1: Requirements Audit & Design Lock

**Milestone**: BUILD 04 — character animation depth (roadmap Phase 6) + UI iconography & tactile polish (roadmap Phase 7) + identity-mandated ambient motion.
**Basis**: `docs/art-direction/visual-identity-evolution/08-visual-upgrade-implementation-roadmap.md` Phases 6–7 (verified text), Doc 03 §9, Doc 04 §5.1.2 / §8.2, Doc 06, Doc 07.
**Rules of engagement** (Doc 08 header, binding): gameplay untouched; simulation untouched; schemas untouched; no new dependencies; every stage keeps `npm test` green; draw-call offsets named.

---

## 0. Repository verification (Stage 0 — exact state at BUILD 04 start)

| Fact | Value |
| :--- | :--- |
| Local repo | `/home/z/my-project/little-somewhere` |
| Branch at start | `feat/visual-identity-evolution-build-04`, cut from `origin/main` |
| origin/main tip | `12389ac` — "Merge pull request #9 from desurfofficial-ship-it/feat/visual-identity-evolution-build-03" |
| BUILD 03 status | **MERGED** via PR #9 (branch tip `893ea12`; commits `c845413`, `4d2f107`, `fb0f7df`, `893ea12` all contained in `origin/main`) |
| BUILD 02 status | Merged via PR #6 (`78d7d00`) |
| BUILD 01 status | Merged (main history; branch `origin/feat/visual-identity-evolution-build-01` retained) |
| Working tree | clean at branch creation |
| WORKLOG latest | Entry 054 (BUILD 03) → BUILD 04 will be Entry 055 |

### 0.1 Baseline re-run (this tree, measured 2026-11-22)

| Gate | Result |
| :--- | :--- |
| `npm install` | OK (lockfile-satisfied) |
| `npx tsc --noEmit` | 0 errors |
| `npm test` | **480/480 pass, 0 fail** (re-run, not historical reuse) |
| `npm run build` | OK (used by the baseline perf capture below) |
| Perf row (pre-change, 20 s veteran golden-hour, plaza hero framing, SwiftShader) | **drawCalls 2304**, triangles 150,707, geometries 2196, textures 22, programs 35, pageErrors 0 — `download/asset-qa/build04-validation/baseline-perf.jsonl` |
| Budget law | net draw calls ≤ **2304** (measured baseline; every addition must name its offset — VISUAL_IDENTITY §10 reconciliation rule) |

Note: the build03 published row measured 2268 on its own capture session; the 2304 row here is the honest same-tree re-measure that BUILD 04 holds itself against (session-to-session SwiftShader variance documented, threshold applied to the stricter 2304).

---

## 1. Roadmap traceability matrix

### Phase 6 — Animation Depth (Doc 08 lines 93–102)

| Req | Existing implementation (audited) | Gap | Proposed solution | Dependencies | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 6.1 Talk mouth-flap (P2, Doc 04 §5.1.2: smile arc scale.y ±25 % @ ~9 Hz during talk/converse) | Mouth block `characters.ts:1573-1626` is emotion-only: `setScalar` (uniform), rotation lerp `SMILE_RZ`↔`FROWN_RZ`, `mouthO` pulse for surprised. No speech oscillation | **MISSING** | Derive flap energy inside `animateCharacterRig` from `animState ∈ {talk, converse}` (driver already receives the state at `NeighborhoodCanvas.tsx:2029/2114/2571`; no canvas change). `scale.y` oscillation composed with existing emotion scale + `faceAmp`; uniform scale restored when not talking; deterministic phase via existing seed pattern; fix the stale-`emotionIntensity` quirk for the nook occupant (`:2106-2114`) while there | Phase 2 shipped (BUILD 01): face v2 + `emotionIntensity` plumbing exist (`characters.ts:1255-1257`) | New unit tests (flap active in talk, restored otherwise, intensity-modulated, SMILE_RZ contract intact); `residentIdentity.test.ts:68-112` stays green; dialogue-zoom capture |
| 6.2 Two-segment arms — elbows (P3, Doc 04 §8.2.2: forearm elbow pivot, clamped; wave forearm snap, work articulation, music bow-wrist; knees stay deferred) | `makeArm` `characters.ts:701-748`: single `armPivot`, sleeve+cuff+hand children; 1-DOF pose chain `:1274-1423`; Jun duplicate `willowLaneDiorama.ts:1412-1448` | **MISSING** | Insert elbow `Group` in `makeArm` + Jun copy; hand/handAnchor re-parent under elbow; per-state elbow targets (idle/walk/run/sprint/interact/talk/listen/wave/work/sketch/music/converse/admire/sit/carry variants) with damping right after `:1544`; clamped ranges | Phase 2 (shipped) | `characterEvolution` hand/hand_anchor/mitten/envelope contracts stay green (traverse-by-name preserved); new elbow tests (bend on wave/work/music, straight rest, clamp); silhouette envelope `max.z < 0.42`; seated clearance `environmentRenderer.test.ts:183-250`; fountain clearance `:347-411` |
| 6.3 Pre-bent leg geometry (P3, Doc 04 §8.2.3: knee bend **baked into pant/boot geometry**, visual bend without new DOF) | `makeLeg` `characters.ts:343-365`: straight pant cylinder + merged boot under hip pivot y 0.42; Jun `:1344-1358` | **MISSING** | Reshape pant/boot merge geometry with a baked forward knee curve (two-segment merged lathe/cylinders at slight angle), keeping merged `'boot'` name, `knee_patch` parented to `rightLeg`, ground contact & envelope unchanged | none (geometry-local) | `characterEvolution:197-212` boot contract, `residentIdentity:155-173` knee-patch parent, no mesh below −0.02, sit clearance test, walk capture reads as gait |
| 6.4 Hurried gait (P3, **OPTIONAL — needs design approval** per Doc 08 line 100) | Residents always `walk` at fixed cadence (`simulation.ts:776-777`, `walkPhase += movedDist*5.2`); run/sprint rig poses exist but are unused by NPCs | PARTIAL (driver ready) | **DEFERRED — documented, not silently dropped.** Doc 04 §8.2 Phase D itself says it "requires a sim-side read-only constant — flag for design approval (touches `simulation.ts`, hence out of audit scope)" and Doc 08's risk note defers stride-sync interplay with knees. BUILD 04's rules of engagement forbid simulation changes | Design approval for a `simulation.ts` constant | n/a (deferred; noted in implementation report §Deferred) |

### Phase 7 — UI Iconography & Tactile Polish (Doc 08 lines 104–114)

| Req | Existing implementation (audited) | Gap | Proposed solution | Verification |
| :--- | :--- | :--- | :--- | :--- |
| 7.1 Token adoption (P2, Doc 03 §9.1: palette tokens adopted + spacing/elevation/shadow scales; hex literals migrate) | 10 CSS vars defined (`index.css:4-15`) but **zero** component adoption; ~600 hex literals across 11 component files; ~9 one-off arbitrary shadows | **PARTIAL → wire-up** | Tailwind v4 `@theme` semantic color aliases (7 palette colors + espresso-muted + border/card shades) + font tokens; 3-step shadow scale (`--shadow-drawer/-sheet/-card`); migrate the repeated palette literals in components to token classes; add a Node regression test that bans re-introduction of the migrated palette literals outside `index.css`/assets.ts | Visual parity is *by construction* (token values == old literals); capture pair before/after at HUD/dialogue/journal; suite + tsc green; new literal-ban test green |
| 7.2 Bespoke icon family (P2, Doc 03 §9.2: weather/season/tier/cozy-domain SVGs in storybook voice; lucide stays functional) | 31 lucide glyphs; exactly 1 bespoke inline SVG (TitleOverlay crest) | **MISSING** | New `src/components/icons.tsx`: one consistent 24-viewBox stroke family, hand-drawn storybook voice — weather ×4 (sun, breeze, mist, rain), season ×4 (spring/summer/autumn/winter), cozy-domain ×5 (satchel, sprout, gift/keepsake, heart-string, craftsmanship) — semantic inventory documented; deployed in HUD weather/season line, satchel category glyphs, journal storylines status glyphs | Icons render at 16/20/24 px; aria-hidden with text labels retained; no new dependency |
| 7.3 Item thumbnails (P2, Doc 03 §9.3: reuse `SubjectCanvas` painter for the 25-item catalog — "no new systems") | `SubjectCanvas`/`paintSubject` (`DialogueVisuals.tsx:957-982`, `:470-955`, 34 scenes + yarn fallback) used only in dialogue prop card; inventory/gift picker text-only; no item→subject mapping | **MISSING** | Extend `assets.ts` `SubjectScene` union + `paintSubject` cases (~11 tinted painter cases covering the 25 items: seed pouches, blossom/posy sprigs, tea cups, tart/loaf bake goods, river glass, feather, fern, zine, bell, wreath, music box); `subjectForItem(itemId)` map; render `SubjectCanvas` thumbnails in InventoryDrawer cards + DialogueSheet gift picker | Unit test: every `PERSONAL_ITEMS` id maps to a defined subject scene; thumbnails render in captures; painter reuse keeps zero new systems |
| 7.4 Portrait unification (P3, Doc 03 §9.4: Journal People reuse `PortraitCanvas`) | Journal People cards render initials circles (`JournalDrawer.tsx:596-602`); `PortraitCanvas` + `resolvePortrait` + `buildResidentPortraitRecipe` already exist and are pure data + canvas | **MISSING (drop-in)** | Replace initials div with `<PortraitCanvas descriptor={resolvePortrait(undefined, person.id)} size={40}/>` (fallback path retained for unknown ids) | People cards show procedural knit busts; trust hearts unchanged; capture |
| 7.5 A11y floor (P2, Doc 08 line 112: focus-visible everywhere; 44px zoom buttons; toast `role="status"`; tone styles ×5; viewport zoom unblock; favicon) | Missing global `:focus-visible`; toast/whisper lack live-region semantics (`App.tsx:1357-1372`); zoom buttons 40 px and `hidden md:flex` (none on touch); `user-scalable=no` in `index.html:5`; no favicon/theme-color; no safe-area insets; choice tones styled? (verify at implementation) | **PARTIAL → floor complete** | Global `:focus-visible` rule (terracotta 2px, espresso offset); toast + whisper `role="status" aria-live="polite"`; zoom buttons → 44 px and visible on touch; viewport zoom unblocked (`user-scalable` removed, maximum-scale dropped); favicon = inline SVG storybook crest (data URI, reuses TitleOverlay crest voice) + `theme-color`; HUD safe-area padding via `env(safe-area-inset-*)`; five `DialogueChoice.tone` styles verified/completed | Focus ring visible in capture; `role` assertions via DOM test; zoom button geometry; favicon present in build; suite green |

### Identity-mandated ambient motion (BUILD 04 brief Workstream C, justified by VISUAL_IDENTITY §7 "Subtle Living Motion" — budgeted, restrained)

| Item | Existing | Gap | Solution | Cost |
| :--- | :--- | :--- | :--- | :--- |
| AM-1 Grove/ornament tree crown breeze sway | 46 grove trees + wilds crowns fully static (`vegetation.ts:46-155`, `wilds.ts:109-115`); waterShaders `onBeforeCompile` pattern exists and is the sanctioned shader hook | Largest static mass in frame | Shared-material vertex sway via `onBeforeCompile` (uniform `uTime`/`uWind` bound by reference, `customProgramCacheKey`), driven per-frame from `environmentRenderer.ts` section 4; orchard crowns excluded via cloned material (they already have JS instance sway) | **0 draw calls, 0 per-frame JS** |
| AM-2 Meadow grass/flower tuft sway | `botanicalDressing.ts` tufts static; blade geometry already tapered/leaned | Meadows read as sculpted plastic | Same shader hook on `dressing_grass`/`dressing_stem` cache entries, phase-varied | **0 draw calls, 0 per-frame JS** |
| AM-3 Hanging-sign swing | 3 shop signs + courtyard planks rigid | Signs read as painted-on | Small pivot rotation about bracket axis, `sin(elapsed·k+phase)·wind`, from environmentRenderer section 4 | 6 scalar writes/frame |
| AM-4 Lantern glow breathe + dusk-lag fix | `lanternMat.emissiveIntensity` revision-gated (`environmentRenderer.ts:303-310`) while the identical phase-lag bug was already fixed per-frame for windows (`:379-399`) | Real visual bug (lanterns lag golden→dusk) + no glow life | Move lantern/festoon emissive into the per-frame glow block + `sin(elapsed·2.6)·0.06` dusk shimmer | scalar writes/frame (bug fix) |
| AM-5 Exterior ambient gating indoors | `envController.update()` runs pond/rain/petal/koi/orchard updates while the exterior root is hidden (`NeighborhoodCanvas.tsx:1770` before interior branch) | Invisible per-frame work (CPU) | Gate exterior-only sections on `!isIndoors`; per-frame glow writes stay (cheap + used by interiors' porch views) | pure CPU win, zero visual change |

### Deliberately out of scope (documented, not silently dropped)

- **6.4 hurried gait** — needs sim-side constant; design-approval gate per Doc 04 §8.2.4 (see matrix).
- **Interaction-presentation overhaul** (brief Workstream D): audit found prompts/feedback functional (proximity rings, HUD CTA, gesture pulses, veil transitions, completion toasts). Weakest points (no in-world highlight for static props/seats, no hover cursor, no directional cue for off-screen targets) are **documented in the report**; Doc 03 §8.10/§9 scope no Phase 7 interaction system, and a new highlight layer would add draw calls + regression surface mid-milestone. Furniture/carrying regression safety is covered by existing suites + verification below.
- **UI exit animations / `motion` dependency**: `motion@12` is installed but unused; adoption would be a new UI-architecture pattern without roadmap mandate. Left as-is (documented).

---

## 2. Architecture & file ownership (Stage 1 design lock)

**No new animation engine.** Doc 04 §8.1 laws (joint-pivoted poses, damping discipline, zero-GC, stride-lock) remain the architecture; Phase 6 items *extend the existing driver*. AM items extend the existing numbered-section `EnvironmentVisualController` and the sanctioned `waterShaders`-style shader hook.

| File (owner: main agent) | Changes |
| :--- | :--- |
| `src/scene/builders/characters.ts` | 6.1 flap in mouth block; 6.2 elbow group + targets + damping; 6.3 baked knee geometry in `makeLeg` |
| `src/scene/builders/willowLaneDiorama.ts` | Jun mirror of arm/leg changes (mouth is returned to the shared driver) |
| `src/scene/characterEvolution.test.ts`, `src/scene/residentIdentity.test.ts` | additive locks for flap/elbow/pre-bend (renames forbidden) |
| `src/scene/environmentRenderer.ts` | AM-1/2 uniform updates (new numbered section 4.x), AM-3 sign swing, AM-4 lantern per-frame, AM-5 indoor gating |
| `src/scene/builders/vegetation.ts`, `wilds.ts`, `botanicalDressing.ts` | AM-1/2 shader hooks on cached materials (+ orchard-exclusion clone) |
| `src/index.css` | 7.1 `@theme` tokens + shadow scale + focus-visible + reduced-motion additions |
| `src/App.tsx`, `src/components/*.tsx` | 7.1 literal migration; 7.2 icon deployment; 7.3 thumbnails; 7.4 portraits; 7.5 a11y |
| `src/components/icons.tsx` (new) | 7.2 bespoke icon family |
| `src/game/dialogue/assets.ts`, `src/components/DialogueVisuals.tsx` | 7.3 item subject scenes + `subjectForItem` |
| `index.html` | 7.5 favicon + viewport zoom unblock |
| `scripts/qa_build04_baseline_perf.sh`, `scripts/qa_build04_evidence.sh` | QA harness (Stage 6) |
| Tests (new/extended) | character animation locks; item-subject mapping; UI token literal ban; a11y DOM checks |

**Adversarial design review (self-challenge, Stage 1 gate):**
1. *Elbow re-parent breaks tests?* — Tests traverse by name (`hand`, `hand_anchor`, `'boot'`); re-parenting preserves names; envelope/seated/clearance suites re-run per edit (they lock max.z/min.y/backrest margins).
2. *Flap fights emotion scale?* — Flap composes multiplicatively with the existing emotion `scaleT` and restores uniform scale when state leaves talk/converse; `SMILE_RZ`/`FROWN_RZ`/`mouthO` visibility semantics untouched.
3. *Shader sway on shared materials mutates orchard/wilds unexpectedly?* — Hook is material-keyed; orchard crowns share the cache key, so orchard gets the **clone-without-hook** treatment to keep its existing JS sway authoritative; wilds crowns have separate keys. Vertex displacement is wind-scaled and height-attenuated so trunks/ground contact stay planted.
4. *Token migration changes rendering?* — Values are byte-identical to the literals they replace; the literal-ban test enforces the migration stays migrated; captures pair-verify.
5. *Thumbnails introduce new "system"?* — No: same painter, same descriptor data-flow; only a mapping table + tinted scenes.
6. *Draw budget?* — AM-1/2/4/5 are zero-draw; AM-3 zero-draw; UI work is DOM-side. Final row must be ≤ 2304 net (name any offset).

**Stage plan**: S2 character animation → S3 ambient motion → S4 tokens → S5 icons/thumbnails/portraits/a11y → S6 evidence → S7 docs/WORKLOG → S8 commit+push. Each stage: implement → `tsc`+`npm test` → commit.
