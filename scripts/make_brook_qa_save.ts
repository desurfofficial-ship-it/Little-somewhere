/**
 * West Brook QA save (Stage 3 fishing v1.1): a clean spring-morning world on
 * day 3 with no fishing history, so the injected cast resolves fresh at either
 * quiet water. Teleport targets are applied by the QA shell (qa_brook_v11.sh).
 *
 * Usage: npx tsx scripts/make_brook_qa_save.ts > /tmp/brook_base.json
 */
import { createFreshWorldState, serializeWorldState } from '../src/game/storage';

const world = createFreshWorldState();
world.day = 3; // spring (days 1-14 in the season cycle), fresh daily gates
world.season = 'spring';
world.weather = 'sunlit';
world.minuteOfDay = 510; // 8:30 AM — morning phase, no evening clamp risk
// No fishing state to clear: sideFlags carries no fishingLastDay/fishingCatchesCount
// in a fresh world, so the first injected cast at either quiet water resolves fresh.

process.stdout.write(serializeWorldState(world));
