# 07 — WorldState and Persistence Design

## 7.1 Principles

- Additive schema change only (v9 → v10).
- All new collections are bounded.
- Day stamps preferred over nightly reset flags.
- Sanitizers must be defensive, matching existing interior state sanitizers.
- Old saves migrate cleanly; missing fields receive empty defaults.

## 7.2 Proposed WorldState Additions (v10)

```ts
interface WorldState {
  // ...existing fields...
  schemaVersion: number; // 10 after this initiative’s first persistence milestone

  invitations: InvitationState;
  occupancy: InteriorOccupancy;
  teaching: TeachingState;
  activeActivity: ActiveSharedActivity | null;
}
```

Exact shapes are defined in documents 03–06. No other systems need new top-level fields for v1.

## 7.3 Migration

- Add `migrateV9ToV10` in `migrations.ts`.
- Default values:
  - `invitations: { active: null, history: [], lastOfferDayByHost: {} }`
  - `occupancy: { byLocation: {} }`
  - `teaching: { known: [], taughtBy: {}, taughtDay: {} }`
  - `activeActivity: null`
- Bump `CURRENT_SCHEMA_VERSION` to 10.
- Existing v9 fields (`nookState`, `bakeryState`, `greenhouseState`, relations, memories, etc.) pass through unchanged.
- Sanitizers:
  - Drop unknown invitation/activity/knowledge IDs.
  - Clamp history length.
  - Clear occupancy if location or resident is invalid.
  - Clear `activeActivity` if host or activity id is unknown.

## 7.4 What Is Not Persisted

- Transient pathfinding waypoints (already runtime-only).
- Per-frame animation phase.
- UI open/closed state.

Occupancy **is** persisted so a reload during a visit restores the host at the station if the window is still valid; otherwise sanitizer or load-time validation clears it.

## 7.5 Save Compatibility

- All prior migration tests must be extended to assert the v10 result while preserving v6–v9 invariants.
- A fresh game starts at v10 with empty Living Relationships state.
- No change to the localStorage key is required if the existing versioned migration path is followed.

## 7.6 Explicit Exclusions

- No second save slot.
- No cloud sync.
- No compression or schema redesign beyond the additive slice.
