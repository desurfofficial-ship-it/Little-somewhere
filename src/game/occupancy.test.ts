/**
 * LR-1 acceptance test — load invariant (doc 16 §3 LR1-15; doc 14 §4.3).
 *
 * Spec of record: docs/architecture/living-relationships/14-revised-architecture.md
 * Test plan:      docs/architecture/living-relationships/16-lr1-lr2-acceptance-test-plan.md
 *
 * Scope of this change (LR-1 test authoring only):
 *  - This file hosts the LR-1 load-invariant case assigned here by doc 16 §5. The
 *    LR-2 occupancy cases (LR2-01 – LR2-04b, LR2-15, LR2-16) are out of scope for
 *    this change and are intentionally NOT implemented here.
 *  - The case exercises ONLY the existing production load path
 *    (deserializeWorldState → migrateWorldState → sanitizeWorldState). No proposed
 *    helper is called, and no production code is implemented in this change.
 *  - The proposed occupancy/invitations slices (doc 14 §4.1, doc 16 §0.1) are staged
 *    through raw save payloads; no WorldState schema or migration code is modified.
 *
 * Why Step A exists (failure attribution): sanitizeWorldState today silently drops
 * every unknown field, so the negative case alone ("inconsistent occupancy is
 * cleared") would pass trivially before production implements the invariant — the
 * occupant would be "cleared" for the wrong reason. Step A therefore first requires
 * the sanitizer to PRESERVE a consistent (location, occupant, live invite) triple —
 * the same observable doc 16 LR2-15 checks — so that LR1-15 fails for the expected
 * missing LR-1 production behavior instead of passing vacuously. Once production
 * lands, both steps run and the invariant is discriminated properly.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreshWorldState, deserializeWorldState } from './storage';

const LR_INVITE_ID = 'lr_test_invite_1';
const LR_ACTIVITY_ID = 'share_featured_reading';

/** Tolerant to the plausible doc 14 §4.1 container shapes (null, single record,
 *  { occupant }, or a list) — the doc-16 observable is "no occupant record". */
function occupancyIsEmpty(occupancy: unknown): boolean {
  if (occupancy === null || occupancy === undefined) return true;
  if (Array.isArray(occupancy)) return occupancy.length === 0;
  if (typeof occupancy === 'object') {
    const o = occupancy as Record<string, unknown>;
    if ('occupant' in o) return o.occupant === null || o.occupant === undefined;
    return o.residentId === null || o.residentId === undefined;
  }
  return false;
}

function occupancyIsPresent(occupancy: unknown): boolean {
  return !occupancyIsEmpty(occupancy);
}

test('LR1-15: load clears occupancy inconsistent with playerLocation (doc 14 §4.3)', () => {
  const base = createFreshWorldState();
  const day = base.day;
  const liveAccepted = {
    id: LR_INVITE_ID,
    status: 'accepted',
    hostId: 'nora',
    activityId: LR_ACTIVITY_ID,
    offeredDay: day,
    expiresDay: day,
    windowStartMinute: 600,
    windowEndMinute: 780,
  };
  const occupant = {
    residentId: 'nora',
    location: 'nook_interior',
    stationId: 'nook_chair',
    localPos: { x: -10.8, z: -0.6 },
    facing: 0,
    invitationId: LR_INVITE_ID,
  };

  // Step A — discriminating gate: the sanitizer must PRESERVE the consistent triple
  // (playerLocation, occupant, live accepted invite). Fails today with the expected
  // missing-production report; see the file header for the rationale.
  const consistent = deserializeWorldState(
    JSON.stringify({
      ...base,
      minuteOfDay: 700, // inside [600, 780]
      playerLocation: 'nook_interior',
      invitations: { active: liveAccepted, history: [], lastOfferDayByHost: { nora: day } },
      occupancy: occupant,
    }),
  );
  const restored = (consistent.state as unknown as { occupancy?: unknown }).occupancy;
  assert.ok(
    occupancyIsPresent(restored),
    'MISSING LR-1 PRODUCTION: the load sanitizer drops the proposed occupancy slice ' +
      'entirely (doc 14 §4.3 load invariant not implemented), so LR1-15 fails by design ' +
      'until the invariant lands — a consistent occupant must survive load first',
  );
  const restoredRecord = restored as { residentId?: string; invitationId?: string };
  assert.equal(restoredRecord.residentId, 'nora', 'occupant resident restored');
  assert.equal(restoredRecord.invitationId, LR_INVITE_ID, 'occupant invite link restored');

  // Step B — the case itself: occupancy set for nook_interior while playerLocation is
  // 'exterior' → the invariant must clear the occupant without throwing.
  const inconsistent = deserializeWorldState(
    JSON.stringify({
      ...base,
      minuteOfDay: 700,
      playerLocation: 'exterior',
      invitations: { active: liveAccepted, history: [], lastOfferDayByHost: { nora: day } },
      occupancy: occupant,
    }),
  );
  const cleared = (inconsistent.state as unknown as { occupancy?: unknown }).occupancy;
  assert.ok(occupancyIsEmpty(cleared), 'no occupant while the player is outside (doc 16 LR1-15)');
  // Rest of world intact apart from the invariant:
  assert.equal(inconsistent.state.day, base.day, 'day intact');
  assert.ok(inconsistent.state.nookState, 'nook slice intact');
  assert.equal(
    inconsistent.state.playerRelations.nora.affinity,
    base.playerRelations.nora.affinity,
    'relations intact',
  );
});
