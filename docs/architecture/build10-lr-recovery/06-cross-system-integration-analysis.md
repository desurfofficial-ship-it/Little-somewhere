# 06 — Cross-System Integration Analysis

## 1. Integration with the actual latest main (`eb95d77`)

Strategy: **branch from the target** (`fix/build10-lr-reconciliation` cut at `eb95d77`) rather than merging an older branch — the original corrective branch was lost (doc 13 §1), and re-execution on top of the target eliminates the entire conflict class. Verified:

- `4ad2e5f..eb95d77` (PR #4 visual identity + 2 seatPos fixes) = 97 files: scene builders, materials, textures, characters, QA scripts, `WORKLOG.md`, and **`src/game/copperwheel.ts` only** inside `src/game` (seatPos constants). Zero overlap with the corrective surface (`simulation.ts`, `exploration.ts`, `dialogue/**`, `invitations.ts`, `activities.ts`, `storage.ts`, `migrations.ts`, `occupancy*`, `bookNook*`).
- Copperwheel seatPos changes are interior-furniture coordinates; they share no state with invitations/occupancy (occupancy is Nook-only: `SHARED_ACTIVITIES` has a single `nook_interior` entry) and no discovery zone lies in Copperwheel Cottage. No hidden dependency (main-integration overlap verified by name-diff and by the full main suite remaining green inside the 425).
- **Semantic conflicts: none.** Git's conflict detector never fired (no merge happened); the semantic check is the stronger one — every main-only commit was name-scanned against the corrective surface, and the main suite (401 tests) passes unchanged on the candidate.

## 2. System interaction map after restoration

| System | Interaction with the restored surface | Evidence |
|---|---|---|
| NPC schedules | Unaffected — discovery reads only player position slices; the occupant skip (LR-2) excludes only the seated host from autonomy/encounters | architecture audit §1 |
| Encounters | Encounter expiry (step-1) unchanged; discovery (step-0) precedes it exactly as at 9cde87d; occupant can't be pulled into encounters (LRTL-05) | simulation.ts order audit |
| Dialogue | Registry 85 topics; wilds conditions gate on `explored_*` sideFlags granted by step-0; invitation topics gate on `requireLive` sharing the unified strict predicate | doc 04 §4 |
| Relationships / memories | Discovery grants journal memories through the same append path as before; affinity/reliability flows untouched; H-1 refusal grants nothing | doc 05 §4 tests |
| Occupancy | Strict predicate changes only *when* expiry fires; occupancy set exclusively by the enter reducer; cleared by tick/load/exit — all pinned | lr-tick-load.test.ts |
| Save/load | Sanitizer and tick now agree for every reachable state; round-trip fixed point verified at 11 boundary minutes + a 36 KB soaked world | doc 10 §2 |
| Day/season cycle | `advanceToNextDay` archives leftovers (`day_end`), clears occupancy/activity; discovery grants fresh on the new day (BD10-06b); season recompute note pre-existing | doc 10 §1 |
| Scene/rendering | Zero scene files touched; dist +5.3 KB (+0.30%) from game logic only | doc 10 §5 |

## 3. WORKLOG/HANDOVER collision status

Main's Entries 048 (LR-1/LR-2), 049 (visual audit), 050 (visual BUILD 01) are preserved verbatim. The feared 049 collision (old corrective branch vs main) does not exist on this branch — corrective records continue at **051** (restoration) and **052** (recovery engineering). HANDOVER gains the recovery pointer without touching existing sections. Cross-references: doc 21's "Entry 049" wording refers to the PR #3 branch's own WORKLOG numbering and is preserved verbatim as an archival decision record (its provenance is documented in doc 11 §2 — no history rewritten).

## 4. Build-10 QA infrastructure compatibility

`scripts/qa_wilds.sh` + `scripts/make_wilds_qa_save.ts` (committed at `9cde87d`, present on main) assert: wilds scene shots, lore-sheet interactions, **discovery persistence end-to-end** (zone wait → autosave → `localStorage.sideFlags.explored_foxglove_rise === true` + `mem_explored_foxglove_rise`), mobile overflow, console errors. The restoration satisfies every assertion (doc 08 §4); the script's hardcoded main-repo path is handled by running the worktree build/preview for this initiative's browser QA (doc 09).
