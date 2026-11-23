# Social Foundation — Post-Integration Adversarial Audit
# 10 — LR-4/LR-5 Documentation Authority

**Subject:** `docs/architecture/living-relationships/23-lr4-teaching-specification.md` and `24-lr5-arthur-copperwheel-specification.md` (added by `8b715fc`), assessed for provenance and authority per brief §12.

## 1. Provenance

Both documents were authored in the same commit, by the same agent identity, as the code they describe — like docs 00-04 and 22. All "status" labels (READY / implementation-ready / READY-WITH-EXPLICIT-DECISIONS) are therefore **agent self-assessments**. No owner sign-off exists anywhere in the repository for these two documents.

## 2. False-approval scan

**No false approval claims found.** Neither doc claims user/owner approval. Doc 23 frames its decision table (D-4A..D-4D) as "Design decisions **to settle before code**" with a Recommendation column; doc 24 likewise ("pending the decision register §5"). The only user-approved decision referenced anywhere is LR-3's D10 — correctly attributed to its own record, not claimed for LR-4/LR-5. No WORKLOG/HANDOVER claim asserts approval for the specs either.

## 3. Roadmap conflict (acknowledged, not hidden)

Docs 23/24 re-assert the doc 14 §10 numbering (LR-3 bakery → LR-4 teaching → LR-5 Arthur/Copperwheel) and declare doc 10's older numbering (LR-3 teaching + second host → LR-4 Copperwheel → LR-5 breadth) "historical". Doc 10 itself is **not edited** — it silently conflicts. Appropriate correction (reported, not applied): add a superseded-numbering banner to doc 10 pointing at doc 14/23/24.

## 4. Claim-by-claim taxonomy (labels: 1 established contract · 2 user-approved decision · 3 agent recommendation · 4 speculative design · 5 future milestone proposal)

| Claim | Label |
|---|---|
| Doc 14 §10 rows define LR-4 ("Teaching flag on the nook or bakery activity, one knowledge id") and LR-5 ("Arthur / Copperwheel only after Build 9 has merged"); Build 9 merged | **1** (rows verified verbatim in doc 14; Build 9 in tree) |
| "Settled chain of record"; doc 10's numbering historical | **3** (agent-declared; the chain exists in doc 14, the retirement of doc 10's numbering is the agent's call) |
| Seam tables ("verified file:line @ a80a220" — types.ts:627-629, storage.ts:489-491, migrations.ts:2407, simulation.ts:1116, dialogueEngine.ts:506-511; copperwheel bounds/obstacles, `cw_seat_armchair` with no occupant anchor, actions.ts line refs, Arthur schedule distances 0.22/11.6/5.69/0.0 m recomputed) | **1** (every line ref re-verified — all exact) |
| Doc 23 "implementation-ready on integrated main (`a80a220`)" | **3** (self-assessment) + **stale base** (actual integrated main was `e3f86b8` at commit time) |
| Scope sections L4-S1..S5, L5-S1..S7 (including new ids `share_workbench_hour`, `mem_lr_arthur_workbench_hour`, `arthur_escapement_basics`) | **5** + **4** (unregistered ids are proposals, not reserved-by-approval — unlike the LR-3 map, which traces to approved docs) |
| Decision tables D-4A..D-4D / D-5A..E ("Recommendation: (b) registry set…", "golden slot must NOT offer…", "keep raw for the offer gate…") | **3** (honestly labeled as pre-code decisions) |
| Acceptance batteries LR4-01..07 / LR5-01..14 | **5** (concrete, red-test-first, testable — e.g. sanitizer strip with warning; schedule matrix; byte-identical counters) |
| Sequencing §7 (LR-4 → LR-3 → Build 9; LR-5 hard-depends on LR-4's `knowledgeGranted`) | **3/5** (honest dependency graph) |

## 5. Answers to the required questions

- **Supersede any existing roadmap?** No — they re-assert doc 14's numbering; doc 10 conflicts silently (banner correction recommended).
- **Assumptions conflict with established decisions?** None found; inherited chassis contracts (strict predicate, occupancy ownership, golden workflow) are correctly re-asserted as binding.
- **Acceptance criteria testable?** Yes — both batteries are per-file observables with verified prerequisites in code.
- **Imply approval never given?** No; the only risk is the **status labels themselves** ("implementation-ready"), which read as gate-clearance but are agent self-assessments; §5 decision tables contradict "ready" and correctly wait for owner decisions.
- **Dependencies that should be deferred?** None implemented (no code shipped); doc 24 §7 sequences honestly; LR-5's knowledge id correctly hard-depends on LR-4 mechanics.
- **Implementation-ready or design proposals?** **Design specifications with implementation plans.** "Implementation-ready" ≠ approved-to-implement.

## 6. Recommended labels/corrections (for a separate documentation task; nothing rewritten here)

1. Doc 23 line 4: replace the `a80a220` base with the actual base (or drop the SHA); add a header note: "Status labels are author self-assessments; no owner sign-off recorded; D-4A..D / D-5A..E require owner decisions before code."
2. Docs 23/24 line 5: qualify "settled chain of record" as *per doc 14 §10 (agent-maintained spec of record)*; add the superseded-numbering banner to doc 10.
3. Doc 24 §2.1: mark L5-S1's ids as **proposed, not reserved**.
4. Doc 24 line 5: "implementation-ready" → "specification-complete pending §5 decisions".

## 7. Verdict

The LR-4/LR-5 documents are honestly-framed future-milestone specifications with testable acceptance criteria and no fabricated authority. Their self-assigned "implementation-ready" labels need the four softening/correction edits above before any implementation planning treats them as gates. No silent proposal-to-requirement conversion has occurred.
