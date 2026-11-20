# 11 — Testing Strategy

## 11.1 Principles

- Pure game-layer tests first (no Three.js required for logic).
- One paired scene test per interior that gains an occupant anchor (mirror position / visibility contract).
- Migration tests extended, never replaced.
- Existing dialogue, bakery, nook, greenhouse, and simulation tests must remain green.

## 11.2 New Test Files (Proposed)

| File | Focus |
|------|--------|
| `src/game/invitations.test.ts` | Eligibility, accept/decline/expire, single-active rule, day stamps |
| `src/game/activities.test.ts` | Start/complete, knowledge grant once, memory append, affinity bounds |
| `src/game/occupancy.test.ts` | Set/clear occupant, window checks, exterior skip flag, invalid-data sanitizer |
| `src/scene/bakeryInterior.test.ts` (extend) | Occupant anchor present only when occupancy says so |
| Migration section in `storage.test.ts` or `migrations` tests | v9 → v10 defaults and preservation |

## 11.3 Critical Cases

1. **No double offer** — Second host cannot offer while one invitation is active.  
2. **No penalty** — Decline and expire leave affinity unchanged.  
3. **Window edges** — Minute before start and minute after end do not show occupant.  
4. **Interior isolation** — While player is in bakery with Clara present, other residents still simulate outdoors; Clara does not.  
5. **Reload** — Save mid-visit, load, either restore valid occupancy or clear it safely; no crash, no duplicate memory.  
6. **Knowledge idempotence** — Second completion does not push a second identical teaching memory.  
7. **Dialogue gating** — Offer topic hidden below minimum tier; after-knowledge topic hidden before grant.  
8. **Schema** — v8 and v9 fixtures migrate to v10 with bakery/nook/greenhouse state intact.

## 11.4 Regression Net

- Full `npm test` (currently 206 tests at Build 8) plus new files.  
- `tsc --noEmit`.  
- Production build (existing chunk warning acceptable).  
- One headless smoke path (pattern already used in Build 7/8 scripts): accept invite → enter → complete activity → journal line → reload.

## 11.5 What Not to Test in v1

- Multi-NPC indoor movement.  
- Frame-rate or GC of the occupant anchor beyond “no obvious per-frame allocation” review.  
- Real-time calendar notifications.
