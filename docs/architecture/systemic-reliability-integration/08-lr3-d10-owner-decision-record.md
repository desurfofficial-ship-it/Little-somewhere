# 08 — LR-3 D10 Owner-Decision Record

**Decision ID**: D10 (LR-3 design-decision register, PR #8 stack).
**Status**: **USER APPROVED — recorded before feature implementation. NOT implemented in this initiative.**

## 1. The decision, exactly as approved

The user has explicitly approved:

> `offerPhases: ['morning']`

for Clara's bakery invitation in LR-3 — i.e. the `share_morning_pastry` offer is gated to morning-only offer phases, using the `offerPhases` mechanism as designed in the LR-3 advanced-design record.

## 2. Provenance

- Approval given by the repository owner in the initiative directive (2026-11-21), explicitly listed among the owner decisions: "LR-3 D10: approve morning-only Clara bakery offers using `offerPhases: ['morning']`."
- Recorded here because the authoritative LR-3 decision register lives on the LR-3 design branch (`docs/lr3-design`, PR #8), which this initiative is forbidden to modify ("Do not rewrite the LR-3 branch"; PR #8 must remain an untouched historical/design record).

## 3. Boundary (verified at the pre-publication gate)

This approval is a **recorded owner decision only**. The following remain unimplemented on this branch and in the merged result: the `offerPhases` field, Clara's invitation definition, `share_morning_pastry` production implementation, bakery station guards, bakery dialogue quartet, bakery interior occupancy/anchor changes, `summaryCompose` for the bakery, LR-3 golden snapshot regeneration, LR-3 production tests. No schema change was introduced (the persistence contract stays `WorldState v11`).

## 4. Exact follow-up action

When the LR-3 implementation initiative opens: apply this approval to the existing decision register on the LR-3 design stack (`docs/architecture/lr3/07-design-decision-register.md`, entry D10 on the `docs/lr3-design` branch / PR #8) — mark D10 **USER APPROVED** with the exact approved value `offerPhases: ['morning']`, the approval date, and a pointer to this record — as part of that initiative's own authorized work on that stack. Do not edit PR #8's branch for this purpose before then.
