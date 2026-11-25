/**
 * Regenerates scripts/dialogue-topics-golden.json from the live DIALOGUE_TOPICS
 * registry (LR3-56 / LR3-98 procedure). Formatting is byte-compatible with the
 * hand-maintained snapshot: JSON.stringify(..., null, 1), no trailing newline,
 * topic fields in registry order (index, id, residentId, category, priority,
 * historyScope, condition).
 *
 * Run: npx tsx scripts/generate_dialogue_golden.ts
 */
import { writeFileSync } from 'node:fs';
import { DIALOGUE_TOPICS } from '../src/game/dialogue';

const topics = DIALOGUE_TOPICS.map((t, index) => ({
  index,
  id: t.id,
  residentId: t.residentId,
  category: t.category,
  priority: t.priority ?? 0,
  historyScope: t.historyScope ?? null,
  condition: t.condition ?? null,
}));

const out = JSON.stringify({ count: topics.length, topics }, null, 1);
writeFileSync(new URL('./dialogue-topics-golden.json', import.meta.url), out);
console.log(`golden regenerated: ${topics.length} topics`);
