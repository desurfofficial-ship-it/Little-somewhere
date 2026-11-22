// src/game/migrations-guard.test.ts
//
// GUARD: duplicate-migration-version + chain-contiguity check (LR-A11).
//
// Spec: docs/architecture/master-architecture/07-parallel-development-protocol.md §3
//       docs/architecture/master-architecture/06-shared-contracts.md §2
//
// Catches the parallel schema-bump race where two teams both claim the same
// `migrateV{N}ToV{N+1}` "from" version, or where a version step is skipped,
// or where CURRENT_SCHEMA_VERSION drifts from the actual chain tip.
//
// This guard must pass on every PR. It is the structural backstop that makes
// parallel schema evolution safe before Phase D (per-version migration files)
// lands, and remains the backstop after Phase D.

import test from 'node:test';
import assert from 'node:assert';
import * as migrationsModule from './migrations';

const STEP_RE = /^migrateV(\d+)ToV(\d+)$/;

const stepEntries = Object.keys(migrationsModule)
  .map((k) => ({key: k, match: STEP_RE.exec(k)}))
  .filter((e) => e.match !== null) as Array<{key: string; match: RegExpExecArray}>;

const fromVersions = stepEntries.map((e) => parseInt(e.match[1], 10));
const toVersions = stepEntries.map((e) => parseInt(e.match[2], 10));

test('GUARD: at least one migration step exists (chain non-empty)', () => {
  assert.ok(stepEntries.length > 0, 'no migrateV{N}ToV{N+1} functions found in migrations.ts');
});

test('GUARD: no duplicate "from" version among migration steps (LR-A11)', () => {
  const seen = new Map<number, string>();
  const dupes: string[] = [];
  for (const e of stepEntries) {
    const from = parseInt(e.match[1], 10);
    if (seen.has(from)) {
      dupes.push(`v${from}: ${seen.get(from)} and ${e.key}`);
    } else {
      seen.set(from, e.key);
    }
  }
  assert.deepEqual(dupes, [], `duplicate migration "from" versions found:\n${dupes.join('\n')}`);
});

test('GUARD: migration chain is contiguous from 1 to CURRENT_SCHEMA_VERSION - 1', () => {
  const current = (migrationsModule as unknown as {CURRENT_SCHEMA_VERSION: number}).CURRENT_SCHEMA_VERSION;
  const expectedFromVersions: number[] = [];
  for (let v = 1; v < current; v++) expectedFromVersions.push(v);
  const actual = [...fromVersions].sort((a, b) => a - b);
  assert.deepEqual(
    actual,
    expectedFromVersions,
    `migration chain is not contiguous. Expected from-versions [1..${current - 1}], got [${actual.join(', ')}]. ` +
      `A version step was skipped or CURRENT_SCHEMA_VERSION (${current}) does not match the chain tip.`,
  );
});

test('GUARD: every migration step advances by exactly one version (to = from + 1)', () => {
  const bad: string[] = [];
  for (const e of stepEntries) {
    const from = parseInt(e.match[1], 10);
    const to = parseInt(e.match[2], 10);
    if (to !== from + 1) {
      bad.push(`${e.key}: from=${from} to=${to} (expected to=${from + 1})`);
    }
  }
  assert.deepEqual(bad, [], `migration steps that do not advance by exactly one version:\n${bad.join('\n')}`);
});

test('GUARD: the chain tip matches CURRENT_SCHEMA_VERSION', () => {
  const current = (migrationsModule as unknown as {CURRENT_SCHEMA_VERSION: number}).CURRENT_SCHEMA_VERSION;
  const maxTo = toVersions.length > 0 ? Math.max(...toVersions) : 0;
  assert.equal(
    maxTo,
    current,
    `chain tip (max "to" version) = ${maxTo} but CURRENT_SCHEMA_VERSION = ${current}. ` +
      `Bump CURRENT_SCHEMA_VERSION when adding a migration step, or remove a stale step.`,
  );
});
