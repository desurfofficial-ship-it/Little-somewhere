/**
 * Runtime topic snapshot — imports DIALOGUE_TOPICS from the real module and
 * dumps id / residentId / category / priority / condition / historyScope per
 * topic, in array order. Used to prove the refactor preserves everything.
 *
 * Usage: npx tsx scripts/snapshot_topics_runtime.ts <out.json>
 */
import { writeFileSync } from 'node:fs';
import { DIALOGUE_TOPICS } from '../src/game/narrative';

const snapshot = DIALOGUE_TOPICS.map((t, index) => ({
  index,
  id: t.id,
  residentId: t.residentId,
  category: t.category,
  priority: t.priority,
  historyScope: t.historyScope ?? null,
  condition: t.condition ?? null,
}));

const out = process.argv[2] ?? 'scripts/topic_snapshot_runtime.json';
writeFileSync(out, JSON.stringify({ count: snapshot.length, topics: snapshot }, null, 1));
console.log(`wrote ${snapshot.length} topics to ${out}`);
