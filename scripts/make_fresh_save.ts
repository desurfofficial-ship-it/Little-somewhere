/**
 * Fresh-save generator — QA parity baseline (overhaul Phase 8 perf campaign).
 *
 * Serializes `createFreshWorldState()` exactly as the game would on first run,
 * so perf rows comparing fresh-save draw calls are byte-comparable across
 * branches (Entry 054 doctrine: fresh 1704 = 1704 parity).
 *
 * Usage: npx tsx scripts/make_fresh_save.ts > /tmp/fresh_save.json
 */
import { createFreshWorldState, serializeWorldState } from '../src/game/storage';

console.log(serializeWorldState(createFreshWorldState()));
