import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DIALOGUE_TOPICS } from './dialogue';
import { RESIDENTS } from './residents';

/**
 * Dialogue Modularization (2026-11) — registry contract tests.
 *
 * The content of DIALOGUE_TOPICS moved from narrative.ts into
 * src/game/dialogue/* modules. These tests pin the registry-level invariants
 * that must never drift as content modules grow:
 *   1. topic ids are unique (ids are used by history keys and tests);
 *   2. topic count + exact id sequence match the golden snapshot taken from
 *      the pre-modularization narrative.ts (ordering contract);
 *   3. registry metadata (resident, category, priority, historyScope,
 *      condition) matches the golden snapshot field-for-field;
 *   4. every topic exposes a build function;
 *   5. resident-scoped topics reference a valid ResidentId.
 *
 * Per-topic behavior (node graphs, conditions in action, builders) remains
 * covered by dialogue.test.ts, storylines.test.ts and the rest of the suite,
 * none of which were modified by the modularization.
 */

const GOLDEN_URL = new URL('../../scripts/dialogue-topics-golden.json', import.meta.url);

interface GoldenTopic {
  index: number;
  id: string;
  residentId: string;
  category: string;
  priority: number;
  historyScope: 'resident' | 'global' | null;
  condition: Record<string, unknown> | null;
}

function loadGolden(): GoldenTopic[] {
  const raw = JSON.parse(readFileSync(GOLDEN_URL, 'utf8')) as { count: number; topics: GoldenTopic[] };
  assert.equal(raw.count, raw.topics.length, 'golden file is internally consistent');
  return raw.topics;
}

test('dialogue registry: every topic id is unique', () => {
  const ids = DIALOGUE_TOPICS.map((t) => t.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(dupes, [], `duplicate topic ids: ${dupes.join(', ')}`);
});

test('dialogue registry: topic count and id sequence match the golden snapshot', () => {
  const golden = loadGolden();
  assert.equal(
    DIALOGUE_TOPICS.length,
    golden.length,
    `topic count changed: registry=${DIALOGUE_TOPICS.length} golden=${golden.length}`,
  );
  const drift = golden
    .map((g, i) => ({ g, actual: DIALOGUE_TOPICS[i]?.id }))
    .filter((x) => x.g.id !== x.actual);
  assert.deepEqual(
    drift.map((x) => ({ expected: x.g.id, actual: x.actual })),
    [],
    'topic ordering drifted from the golden snapshot',
  );
});

test('dialogue registry: registry metadata matches the golden snapshot field-for-field', () => {
  const golden = loadGolden();
  const mismatches: string[] = [];
  golden.forEach((g, i) => {
    const t = DIALOGUE_TOPICS[i];
    const meta = {
      id: t.id,
      residentId: t.residentId,
      category: t.category,
      priority: t.priority,
      historyScope: t.historyScope ?? null,
      condition: t.condition ?? null,
    };
    const expected = {
      id: g.id,
      residentId: g.residentId,
      category: g.category,
      priority: g.priority,
      historyScope: g.historyScope,
      condition: g.condition,
    };
    if (JSON.stringify(meta) !== JSON.stringify(expected)) {
      mismatches.push(`#${i} ${g.id}`);
    }
  });
  assert.deepEqual(mismatches, [], `registry metadata drifted for: ${mismatches.join(', ')}`);
});

test('dialogue registry: every topic exposes a build function', () => {
  const bad = DIALOGUE_TOPICS.filter((t) => typeof t.build !== 'function');
  assert.deepEqual(
    bad.map((t) => t.id),
    [],
    'topics without a build function',
  );
});

test('dialogue registry: resident-scoped topics reference a valid resident or "any"', () => {
  const valid = new Set<string>([...Object.keys(RESIDENTS), 'any']);
  const bad = DIALOGUE_TOPICS.filter((t) => !valid.has(t.residentId));
  assert.deepEqual(
    bad.map((t) => t.id),
    [],
    `topics with unknown residentId: ${bad.map((t) => String(t.residentId)).join(', ')}`,
  );
});
