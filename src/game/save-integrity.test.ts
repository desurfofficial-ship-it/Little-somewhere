import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_SCHEMA_VERSION, migrateWorldState } from './migrations';
import {
  createFreshWorldState,
  deserializeWorldState,
  loadWorldState,
  serializeWorldState,
  STORAGE_BACKUP_KEY,
  STORAGE_KEY,
  computeWorldSaveRevision,
} from './storage';

import { acceptInvitation, offerInvitation } from './invitations';
import { enterNookAction } from './actions';
import { loadJournalReadKeys, JOURNAL_READ_STORAGE_KEY } from './journal';
import { getSeasonForDay } from './time';
import { createStarterInventory } from './inventory';
import { PLAYER_SPAWN, isPointWalkable } from './worldMap';
import type { WorldState } from './types';

// The target cap for the journal-memory projection (doc 03 §1 J-1: headroom
// above the ≈58-row production content ceiling). Asserted as a literal so the
// regression suite stays independent of the implementation constant.
const JOURNAL_MEMORY_CAP = 96;

// ---------------------------------------------------------------------------
// Fixture helpers — every corrupted save is derived from a REAL serialized
// pipeline payload, then hand-mutated like an untrusted persisted input.
// ---------------------------------------------------------------------------

function worldWithAcceptedLiveInvitation(): WorldState {
  const base = createFreshWorldState();
  const social = {
    ...base,
    playerRelations: {
      ...base.playerRelations,
      nora: { ...base.playerRelations.nora, affinity: 60 },
    },
  };
  const offered = offerInvitation(social, 'nora', 'share_featured_reading').world;
  const accepted = acceptInvitation(offered).world;
  return enterNookAction(accepted).nextWorld;
}

function loadMutated(
  base: WorldState,
  mutate: (raw: Record<string, unknown>) => void,
): ReturnType<typeof deserializeWorldState> {
  const raw = JSON.parse(serializeWorldState(base)) as Record<string, unknown>;
  mutate(raw);
  return deserializeWorldState(JSON.stringify(raw));
}

function journalMemoryRows(count: number, idPrefix: string): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, i) => ({
    id: `${idPrefix}_${String(i).padStart(3, '0')}`,
    day: 1,
    phase: 'morning',
    title: `Row ${i}`,
    summary: `Synthetic journal row ${i}`,
  }));
}

function encounterSpots(): Array<{ x: number; z: number }> {
  // Encounter spots must be genuinely walkable or the sanitizer's walkability
  // gate drops the encounter before dedup ever applies.
  const spots: Array<{ x: number; z: number }> = [];
  outer: for (let dx = -4; dx <= 4; dx++) {
    for (let dz = -4; dz <= 4; dz++) {
      const x = PLAYER_SPAWN.x + dx * 0.5;
      const z = PLAYER_SPAWN.z + dz * 0.5;
      if (isPointWalkable(x, z, 0.35)) {
        spots.push({ x, z });
        if (spots.length === 2) break outer;
      }
    }
  }
  assert.equal(spots.length, 2, 'fixture requires two walkable spots near spawn');
  return spots;
}

function validEncounter(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    participants: ['clara', 'arthur'],
    topicTag: 'neighbor_chat',
    summary: 'Sharing a quiet chat in the lane',
    spots: encounterSpots(),
    startedMinute: 480,
    endsMinute: 495,
    ...overrides,
  };
}

function withMockLocalStorage(fn: (store: Map<string, string>) => void): void {
  const prevWindow = (globalThis as { window?: unknown }).window;
  const store = new Map<string, string>();
  const mockWindow = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => {
        store.set(key, String(val));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  };
  (globalThis as { window?: unknown }).window = mockWindow;
  try {
    fn(store);
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = prevWindow;
    }
  }
}

// ---------------------------------------------------------------------------
// Guard tests — valid production-shaped saves must load UNCHANGED, warning-free
// ---------------------------------------------------------------------------

test('GUARD: a live accepted invitation with occupancy + activeActivity loads warning-free and unchanged', () => {
  const res = loadMutated(worldWithAcceptedLiveInvitation(), () => {});
  assert.deepEqual(res.warnings, []);
  const active = res.state.invitations.active;
  assert.ok(active, 'live accepted invitation survives the load boundary');
  assert.equal(active.status, 'accepted');
  assert.ok(res.state.occupancy, 'occupancy survives');
  assert.ok(res.state.activeActivity, 'activeActivity survives');
  assert.equal(res.state.occupancy?.invitationId, active.id);
});

test('GUARD: fresh world round-trips byte-stably through three serialize/load cycles', () => {
  let payload = serializeWorldState(createFreshWorldState());
  for (let i = 0; i < 3; i++) {
    const next = serializeWorldState(deserializeWorldState(payload).state);
    assert.equal(next, payload, `cycle ${i + 1} must be a fixed point`);
    payload = next;
  }
});

test('GUARD: played world (offer/accept/enter) round-trips byte-stably through three cycles', () => {
  let payload = serializeWorldState(worldWithAcceptedLiveInvitation());
  for (let i = 0; i < 3; i++) {
    const next = serializeWorldState(deserializeWorldState(payload).state);
    assert.equal(next, payload, `cycle ${i + 1} must be a fixed point`);
    payload = next;
  }
});

// ---------------------------------------------------------------------------
// Invitation window domain (register F-SAVE-1 / SR-6)
// ---------------------------------------------------------------------------

test('F-SAVE-1: out-of-domain invitation window minutes are clamped to the daily offer domain with a warning', () => {
  const res = loadMutated(worldWithAcceptedLiveInvitation(), (raw) => {
    const inv = raw.invitations as Record<string, unknown>;
    const active = inv.active as Record<string, unknown>;
    active.windowStartMinute = -50;
    active.windowEndMinute = 1400;
  });
  const active = res.state.invitations.active;
  assert.ok(active, 'clamping must not destroy a structurally valid invitation');
  assert.equal(active.windowStartMinute, 360);
  assert.equal(active.windowEndMinute, 1290);
  assert.ok(
    res.warnings.some((w) => w.includes('window')),
    `expected a window clamp warning, got: ${JSON.stringify(res.warnings)}`,
  );
});

// ---------------------------------------------------------------------------
// expiresDay invariant (register F-SAVE-2 / SR-5)
// ---------------------------------------------------------------------------

test('F-SAVE-2: an immortal expiresDay is re-pinned to offeredDay with a warning', () => {
  const res = loadMutated(worldWithAcceptedLiveInvitation(), (raw) => {
    const active = (raw.invitations as Record<string, unknown>).active as Record<string, unknown>;
    active.expiresDay = (active.offeredDay as number) + 500;
  });
  const active = res.state.invitations.active;
  assert.ok(active, 're-pinning must not destroy a structurally valid invitation');
  assert.equal(active.expiresDay, active.offeredDay, 'expiresDay must equal offeredDay');
  assert.ok(
    res.warnings.some((w) => w.includes('expiresDay')),
    `expected an expiresDay warning, got: ${JSON.stringify(res.warnings)}`,
  );
});

// ---------------------------------------------------------------------------
// Occupancy / activeActivity unit rule (SR-2)
// ---------------------------------------------------------------------------

test('SR-2a: activeActivity survives load without occupancy (contract of record: doc 14 §4.3 / LR1-15b)', () => {
  // The recovery contract anchors activeActivity to the LIVE ACTIVE INVITATION,
  // not to occupancy: a mid-visit activeActivity must survive load. The
  // sanitizer-recommended unit-clear from the adversarial audit was REJECTED
  // against this documented decision (adversarial loop, doc 09).
  const res = loadMutated(worldWithAcceptedLiveInvitation(), (raw) => {
    raw.occupancy = null;
  });
  assert.equal(res.state.occupancy, null, 'occupancy stays cleared');
  const active = res.state.invitations.active;
  assert.ok(active);
  assert.deepEqual(
    res.state.activeActivity,
    { activityId: active.activityId, invitationId: active.id },
    'invitation-anchored activeActivity survives load (doc 16 §3)',
  );
});

test('SR-2c: activeActivity without ANY live invitation is still cleared (the actual orphan rule)', () => {
  const res = loadMutated(worldWithAcceptedLiveInvitation(), (raw) => {
    raw.invitations = { active: null, history: [], lastOfferDayByHost: {} };
  });
  assert.equal(res.state.activeActivity, null, 'orphan activeActivity is cleared');
  assert.ok(
    res.warnings.some((w) => w.includes('activeActivity') || w.includes('archived')),
    `expected a warning for the orphan slice, got: ${JSON.stringify(res.warnings)}`,
  );
});

test('SR-2b: occupancy without activeActivity derives the unit deterministically with a warning', () => {
  const res = loadMutated(worldWithAcceptedLiveInvitation(), (raw) => {
    raw.activeActivity = null;
  });
  assert.ok(res.state.occupancy, 'valid occupancy survives');
  const active = res.state.invitations.active;
  assert.ok(active);
  assert.deepEqual(
    res.state.activeActivity,
    { activityId: active.activityId, invitationId: active.id },
    'activeActivity is derived exactly as the production writer would have written it',
  );
  assert.ok(
    res.warnings.some((w) => w.includes('activeActivity')),
    `expected a unit-restore warning, got: ${JSON.stringify(res.warnings)}`,
  );
});

test('SR-7: an occupancy stationId that does not resolve to the activity station clears the occupancy only', () => {
  const res = loadMutated(worldWithAcceptedLiveInvitation(), (raw) => {
    const occ = raw.occupancy as Record<string, unknown>;
    occ.stationId = 'bogus_station_id';
  });
  assert.equal(res.state.occupancy, null, 'bogus station must not survive');
  const active = res.state.invitations.active;
  assert.ok(active);
  assert.deepEqual(
    res.state.activeActivity,
    { activityId: active.activityId, invitationId: active.id },
    'invitation-anchored activeActivity is unaffected (doc 14 §4.3)',
  );
  assert.ok(res.warnings.length > 0, 'expected a warning for the cleared occupancy');
});

// ---------------------------------------------------------------------------
// Reference resolution (SR-3, SR-4)
// ---------------------------------------------------------------------------

test('SR-3: an unknown npcRelations pair is dropped with a warning, never fabricated', () => {
  const res = loadMutated(createFreshWorldState(), (raw) => {
    const rels = raw.npcRelations as Record<string, unknown>;
    rels['zed:clara'] = { affinity: 99, tension: 0, sharedTags: [] };
  });
  assert.equal(
    (res.state.npcRelations as Record<string, unknown>)['zed:clara'],
    undefined,
    'unknown pair must not enter runtime state',
  );
  assert.ok(
    res.warnings.some((w) => w.includes('npcRelations')),
    `expected an npcRelations warning, got: ${JSON.stringify(res.warnings)}`,
  );
});

test('SR-4: an unknown storyline key is dropped with a warning, never minted as progress', () => {
  const res = loadMutated(createFreshWorldState(), (raw) => {
    const storylines = raw.storylines as Record<string, unknown>;
    storylines['made_up_storyline'] = { stage: 5, status: 'active' };
  });
  assert.equal(
    (res.state.storylines as Record<string, unknown>)['made_up_storyline'],
    undefined,
    'unknown storyline must not enter runtime state',
  );
  assert.ok(
    res.warnings.some((w) => w.includes('made_up_storyline')),
    `expected a storyline warning, got: ${JSON.stringify(res.warnings)}`,
  );
});

// ---------------------------------------------------------------------------
// Temporal sanity (SR-5)
// ---------------------------------------------------------------------------

test('SR-5: a future-dated active invitation is cleared without fabricating history', () => {
  const res = loadMutated(worldWithAcceptedLiveInvitation(), (raw) => {
    const active = (raw.invitations as Record<string, unknown>).active as Record<string, unknown>;
    active.offeredDay = (active.offeredDay as number) + 3;
  });
  assert.equal(res.state.invitations.active, null, 'future-dated invitation must not load as active');
  assert.equal(
    res.state.invitations.history.length,
    0,
    'repair must never invent records (no synthetic expired entry)',
  );
  assert.ok(res.warnings.length > 0, 'expected a warning for the cleared invitation');
});

// ---------------------------------------------------------------------------
// Duplicate ids (SR-8)
// ---------------------------------------------------------------------------

test('SR-8a: duplicate worldEvents ids are deduped keep-first with a warning', () => {
  const res = loadMutated(createFreshWorldState(), (raw) => {
    const event = {
      id: 'evt_dup_test',
      day: 1,
      phase: 'morning',
      minuteOfDay: 480,
      kind: 'npc_social',
      actors: ['clara'],
      summary: 'A quiet hello',
      summaryTag: 'greeting',
    };
    raw.worldEvents = [event, { ...event, summary: 'A quiet hello (again)' }];
  });
  assert.equal(res.state.worldEvents.length, 1, 'duplicate ids must collapse');
  assert.equal(res.state.worldEvents[0].summary, 'A quiet hello', 'keep-first');
  assert.ok(
    res.warnings.some((w) => w.includes('worldEvents')),
    `expected a dedup warning, got: ${JSON.stringify(res.warnings)}`,
  );
});

test('SR-8b: duplicate activeEncounters ids are deduped keep-first with a warning', () => {
  const res = loadMutated(createFreshWorldState(), (raw) => {
    const encounter = validEncounter('enc_dup_test');
    raw.activeEncounters = [encounter, { ...encounter, summary: 'Copy' }];
  });
  assert.equal(res.state.activeEncounters.length, 1, 'duplicate ids must collapse');
  assert.ok(
    res.warnings.some((w) => w.includes('activeEncounters')),
    `expected a dedup warning, got: ${JSON.stringify(res.warnings)}`,
  );
});

test('SR-8c: duplicate invitation history rows collapse keep-first with a warning', () => {
  const res = loadMutated(worldWithAcceptedLiveInvitation(), (raw) => {
    const inv = raw.invitations as Record<string, unknown>;
    inv.history = [
      { invitationId: 'inv_hist_1', hostId: 'nora', activityId: 'share_featured_reading', day: 1, outcome: 'completed' },
      { invitationId: 'inv_hist_1', hostId: 'nora', activityId: 'share_featured_reading', day: 2, outcome: 'declined' },
    ];
  });
  assert.equal(res.state.invitations.history.length, 1, 'duplicate invitationIds must collapse');
  assert.equal(res.state.invitations.history[0].day, 1, 'keep-first');
  assert.ok(
    res.warnings.some((w) => w.includes('invitation history')),
    `expected a dedup warning, got: ${JSON.stringify(res.warnings)}`,
  );
});

// ---------------------------------------------------------------------------
// Encounter sanity + silent normalization observability (SR-9)
// ---------------------------------------------------------------------------

test('SR-9a: an encounter ending before it starts is dropped with a warning', () => {
  const res = loadMutated(createFreshWorldState(), (raw) => {
    raw.activeEncounters = [
      validEncounter('enc_backwards', { startedMinute: 900, endsMinute: 600, summary: 'Time-traveling chat' }),
    ];
  });
  assert.equal(res.state.activeEncounters.length, 0, 'backwards encounter must not load');
  assert.ok(
    res.warnings.some((w) => w.includes('activeEncounters')),
    `expected a warning, got: ${JSON.stringify(res.warnings)}`,
  );
});

test('SR-9b: a negative schema version is rejected to a fresh state, not loaded silently', () => {
  const res = loadMutated(createFreshWorldState(), (raw) => {
    raw.schemaVersion = -3;
  });
  assert.equal(res.migratedFromVersion, null, 'unrepresentable versions must not report a source version');
  assert.ok(
    res.warnings.some((w) => w.includes('unrecognized')),
    `expected a rejection warning, got: ${JSON.stringify(res.warnings)}`,
  );
});

test('SR-9c: a null inventory is normalized to the starter kit with a warning', () => {
  const res = loadMutated(createFreshWorldState(), (raw) => {
    raw.inventory = null;
  });
  assert.deepEqual(res.state.inventory, createStarterInventory());
  assert.ok(
    res.warnings.some((w) => w.includes('inventory')),
    `expected an inventory warning, got: ${JSON.stringify(res.warnings)}`,
  );
});

test('SR-9d: a season disagreement with the day-derived season warns and re-derives', () => {
  const res = loadMutated(createFreshWorldState(), (raw) => {
    raw.season = 'summer'; // day 1 derives 'spring'
  });
  assert.equal(res.state.season, getSeasonForDay(1).season, 'derived season wins');
  assert.ok(
    res.warnings.some((w) => w.includes('season')),
    `expected a season warning, got: ${JSON.stringify(res.warnings)}`,
  );
});

test('SR-9e: a future schema version still loads conservatively (documented forward-compat)', () => {
  const res = loadMutated(createFreshWorldState(), (raw) => {
    raw.schemaVersion = CURRENT_SCHEMA_VERSION + 88;
  });
  assert.equal(res.migratedFromVersion, CURRENT_SCHEMA_VERSION + 88);
  assert.ok(
    res.warnings.some((w) => w.includes('newer than runtime')),
    `expected a future-version warning, got: ${JSON.stringify(res.warnings)}`,
  );
});

// ---------------------------------------------------------------------------
// Journal memory bounded retention (SR-1) + read-key symmetry (SR-13)
// ---------------------------------------------------------------------------

test('SR-1: world.memories is trimmed to JOURNAL_MEMORY_CAP newest-first with a warning', () => {
  const res = loadMutated(createFreshWorldState(), (raw) => {
    raw.memories = journalMemoryRows(120, 'mem_test');
  });
  assert.equal(res.state.memories.length, JOURNAL_MEMORY_CAP, 'cap must engage on load');
  assert.equal(res.state.memories[0].id, 'mem_test_000', 'newest-first: head of the array is kept');
  assert.equal(
    res.state.memories[JOURNAL_MEMORY_CAP - 1].id,
    `mem_test_${String(JOURNAL_MEMORY_CAP - 1).padStart(3, '0')}`,
  );
  assert.ok(
    res.warnings.some((w) => w.includes('memories')),
    `expected a trim warning, got: ${JSON.stringify(res.warnings)}`,
  );
});

test('SR-1: the cap also engages through the save path (hand-edited state converges on first save)', () => {
  const res = loadMutated(createFreshWorldState(), (raw) => {
    raw.memories = journalMemoryRows(120, 'mem_test');
  });
  const resaved = deserializeWorldState(serializeWorldState(res.state));
  assert.equal(resaved.state.memories.length, JOURNAL_MEMORY_CAP);
  assert.deepEqual(
    resaved.warnings.filter((w) => w.includes('memories')),
    [],
    'converged state must not re-trigger the trim warning',
  );
});

test('SR-13: journal read keys are trimmed to the write-path cap on load too', () => {
  withMockLocalStorage((store) => {
    // Persist an over-cap payload directly, bypassing the write-path trim,
    // so this exercises the LOAD path specifically (hand-edited state).
    const raw = JSON.stringify(Array.from({ length: 300 }, (_, i) => `jr_key_${i}`));
    store.set(JOURNAL_READ_STORAGE_KEY, raw);
    const loaded = loadJournalReadKeys();
    assert.equal(loaded.size, 240, 'load path must enforce the same 240-key cap');
    assert.ok(loaded.has('jr_key_299'), 'most recent keys are kept');
    assert.ok(!loaded.has('jr_key_0'), 'oldest keys are trimmed');
  });
});

// ---------------------------------------------------------------------------
// Storage-level self-heal + tombstone behavior
// ---------------------------------------------------------------------------

test('storage: a same-version load that repaired state gets a backup + rewrite (self-heal)', () => {
  withMockLocalStorage((store) => {
    const raw = (() => {
      const payload = JSON.parse(serializeWorldState(createFreshWorldState())) as Record<string, unknown>;
      payload.memories = journalMemoryRows(120, 'mem_test');
      return JSON.stringify(payload);
    })();
    store.set(STORAGE_KEY, raw);
    const loaded = loadWorldState();
    assert.equal(loaded.memories.length, JOURNAL_MEMORY_CAP);
    assert.equal(store.get(STORAGE_BACKUP_KEY), raw, 'raw payload is tombstoned before rewrite');
    assert.equal(store.get(STORAGE_KEY), serializeWorldState(loaded), 'sanitized state is re-persisted');
    // Convergence: reloading the rewritten payload produces no further repair warnings.
    const second = deserializeWorldState(store.get(STORAGE_KEY) as string);
    assert.deepEqual(second.warnings, []);
  });
});

test('storage: a future-version payload is backed up (tombstoned) but never rewritten', () => {
  withMockLocalStorage((store) => {
    const raw = (() => {
      const payload = JSON.parse(serializeWorldState(createFreshWorldState())) as Record<string, unknown>;
      payload.schemaVersion = CURRENT_SCHEMA_VERSION + 1;
      return JSON.stringify(payload);
    })();
    store.set(STORAGE_KEY, raw);
    loadWorldState();
    assert.equal(store.get(STORAGE_BACKUP_KEY), raw, 'future payload is preserved in the backup slot');
    assert.equal(store.get(STORAGE_KEY), raw, 'the persisted payload itself is left untouched');
  });
});

// ---------------------------------------------------------------------------
// Determinism / purity of the pipeline itself
// ---------------------------------------------------------------------------

test('sanitize + load do not mutate their inputs', () => {
  const base = worldWithAcceptedLiveInvitation();
  const snapshot = JSON.stringify(base);
  const payload = serializeWorldState(base);
  const raw = JSON.parse(payload) as Record<string, unknown>;
  const before = JSON.stringify(raw);
  migrateWorldState(raw);
  assert.equal(JSON.stringify(raw), before, 'migration must not mutate the parsed payload');
  assert.equal(JSON.stringify(base), snapshot, 'serialize must not mutate the live world');
});

test('save revision stays stable across load for a healthy save', () => {
  // "Healthy" = already sanitized once, so the sanitizer's documented one-time
  // repairs (trust re-derived from affinity, discovered-from-inventory) have
  // converged; the invariant under test is that a converged save keeps its
  // fingerprint across further loads.
  const healthy = deserializeWorldState(serializeWorldState(worldWithAcceptedLiveInvitation())).state;
  const before = computeWorldSaveRevision(healthy);
  const after = deserializeWorldState(serializeWorldState(healthy)).state;
  assert.equal(computeWorldSaveRevision(after), before, 'repair-free loads keep the save fingerprint');
});

// ---------------------------------------------------------------------------
// Adversarial-review round (doc 09): warning parity, re-key collisions,
// counter-domain dispositions, save-path observability. Each test pins a
// finding from the independent adversarial review of the initiative diff.
// ---------------------------------------------------------------------------

test('AR-1: occupancy dropped for lack of a live accepted invitation warns (no silent drop)', () => {
  // A persisted occupancy the load path cannot anchor (no active invitation)
  // is dropped — the adversarial review caught that this outer drop was
  // silent while the inner inconsistency drop warned. Every drop warns now.
  const res = loadMutated(worldWithAcceptedLiveInvitation(), (raw) => {
    raw.invitations = { ...(raw.invitations as Record<string, unknown>), active: null };
    raw.occupancy = {
      residentId: 'nora',
      location: 'nook_interior',
      stationId: 'nook_table',
      localPos: { x: 1, z: 1 },
      facing: 0,
      invitationId: 'whatever',
    };
  });
  assert.equal(res.state.occupancy, null, 'unanchorable occupancy is cleared');
  assert.ok(
    res.warnings.some((w) => w.includes('occupancy') && w.includes('cleared')),
    `expected an occupancy-drop warning, got: ${JSON.stringify(res.warnings)}`,
  );
});

test('AR-1b: occupancy dropped because the player is exterior warns (no silent drop)', () => {
  const res = loadMutated(worldWithAcceptedLiveInvitation(), (raw) => {
    raw.playerLocation = 'exterior';
  });
  assert.equal(res.state.occupancy, null);
  assert.ok(
    res.warnings.some((w) => w.includes('occupancy') && w.includes('cleared')),
    `expected an occupancy-drop warning, got: ${JSON.stringify(res.warnings)}`,
  );
});

test('AR-2: a re-keyed npcRelations duplicate collapses keep-first with a warning', () => {
  // 'jun:clara' is a reversed (non-canonical) spelling of 'clara:jun' —
  // getNpcPairKey re-keys both to the same canonical key; the adversarial
  // review found the last-processed entry silently overrode the first.
  // The collapse must be keep-first + warned, mirroring SR-8 semantics.
  const res = loadMutated(createFreshWorldState(), (raw) => {
    raw.npcRelations = {
      ...(raw.npcRelations as Record<string, unknown>),
      'clara:jun': { affinity: 42, tension: 9 },
      'jun:clara': { affinity: 31, tension: 4 },
    };
  });
  const rel = (res.state.npcRelations as Record<string, { affinity: number }>)['clara:jun'];
  assert.equal(rel.affinity, 42, 'keep-first: the first entry in document order wins');
  assert.ok(
    res.warnings.some((w) => w.includes('duplicate npcRelations')),
    `expected a duplicate-collapse warning, got: ${JSON.stringify(res.warnings)}`,
  );
});

test('AR-3: legacy v1 migrations surface their per-step warnings (memories trim is observable)', () => {
  // migrateV1ToV2/migrateV3ToV4 previously kept local warning arrays that
  // never reached the load result — an over-cap memories array in a v1 save
  // was trimmed silently. The warnings must merge into the load result.
  const raw = JSON.parse(serializeWorldState(createFreshWorldState())) as Record<string, unknown>;
  raw.schemaVersion = 1;
  raw.memories = journalMemoryRows(120, 'mem_v1');
  const res = deserializeWorldState(JSON.stringify(raw));
  assert.equal(res.state.memories.length, JOURNAL_MEMORY_CAP, 'cap engages through the v1 path');
  assert.ok(
    res.warnings.some((w) => w.includes('memories')),
    `expected the v1 trim warning to surface, got: ${JSON.stringify(res.warnings)}`,
  );
});

test('AR-4: extreme-but-domain-valid counters load unchanged (no invented ceilings)', () => {
  // Adversarial-review disposition for SR-5: the sanitizer enforces ceilings
  // exactly where production writers have them (affinity -50..100,
  // reliability 0..100, tension 0..100, dailyAffinityGained 0..20);
  // day / familiarity / bellRungCount are legitimately unbounded in
  // production, so clamping them here would corrupt legitimate long saves.
  // This pins the acceptance behavior (day chosen inside the spring season
  // band so the season cross-check does not fire).
  const res = loadMutated(createFreshWorldState(), (raw) => {
    raw.day = 1 + 4 * 100000; // spring again: 1 + k * (DAYS_PER_SEASON * SEASON_ORDER.length)
    raw.bellRungCount = 500000;
    const rel = raw.playerRelations as Record<string, Record<string, unknown>>;
    rel.nora = { ...rel.nora, familiarity: 250 };
  });
  assert.equal(res.state.day, 400001, 'unbounded-by-design day is accepted unchanged');
  assert.equal(res.state.bellRungCount, 500000);
  assert.equal(res.state.playerRelations.nora.familiarity, 250);
  assert.deepEqual(res.warnings, [], 'accept-unchanged must not warn');
});

test('AR-5: the save path surfaces sanitizer repairs (sink param + console.warn parity)', (t) => {
  // The same sanitizer runs per save; repairs it made on the save path were
  // constructed and discarded. The save path now emits the same classified
  // warnings as the load path: an explicit sink collects them, and without
  // one they surface on console.warn with the shared prefix.
  const dirty = createFreshWorldState();
  dirty.memories = journalMemoryRows(120, 'mem_save') as unknown as WorldState['memories'];
  const sink: string[] = [];
  const json = serializeWorldState(dirty, sink);
  const parsed = JSON.parse(json) as { memories: unknown[] };
  assert.equal(parsed.memories.length, JOURNAL_MEMORY_CAP, 'save path still converges to the cap');
  assert.ok(
    sink.some((w) => w.includes('memories')),
    `expected the sink to receive the trim warning, got: ${JSON.stringify(sink)}`,
  );
  // Without an explicit sink the same warnings surface on console.warn.
  const capture = t.mock.method(console, 'warn', () => {});
  try {
    serializeWorldState(dirty);
    assert.ok(
      capture.mock.calls.some((c) => String(c.arguments[0]).includes('[little-somewhere save]')),
      `expected a save-path console warning, got: ${JSON.stringify(capture.mock.calls.map((c) => c.arguments))}`,
    );
  } finally {
    capture.mock.restore();
  }
  // And a healthy save stays silent.
  const quiet = t.mock.method(console, 'warn', () => {});
  try {
    serializeWorldState(createFreshWorldState());
    assert.equal(quiet.mock.calls.length, 0, 'healthy saves must not warn');
  } finally {
    quiet.mock.restore();
  }
});
