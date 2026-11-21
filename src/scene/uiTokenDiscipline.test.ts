import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * BUILD 04 (Doc 03 §9.1): the UI palette became real design tokens
 * (index.css @theme + components/uiPalette.ts). This discipline test bans
 * re-introducing the raw palette hex literals in the UI layer, so the token
 * adoption cannot silently rot back into scatter. Allowed locations:
 *  - src/index.css (the token definitions themselves)
 *  - src/components/uiPalette.ts (canvas-painter values)
 */
const PROJECT_ROOT = process.cwd(); // npm test always runs from the repo root
const ALLOWED_FILES = new Set([
  join(PROJECT_ROOT, 'src', 'index.css'),
  join(PROJECT_ROOT, 'src', 'components', 'uiPalette.ts'),
]);

const BANNED_HEXES = [
  '#faf5ec', // linen
  '#f1e8d9', // linen-deep
  '#e7dfcf', // page-ground
  '#2d241e', // espresso
  '#6a5b50', // espresso-muted
  '#5e5046', // umber
  '#c86446', // terracotta
  '#b45539', // terracotta-deep
  '#5e8062', // sage
  '#e5a93c', // honey
  '#d4c4ae', // stone-line
  '#e2d4c0', // parchment
  '#f4ece0', // card-warm
];

function collectUiFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'game' || entry === 'scene') continue;
      collectUiFiles(full, out);
    } else if (/\.(tsx?|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
}

test('BUILD 04: UI palette hex literals stay migrated to design tokens', () => {
  const files: string[] = [];
  collectUiFiles(join(PROJECT_ROOT, 'src'), files);
  const offenders: string[] = [];
  for (const file of files) {
    if (ALLOWED_FILES.has(file)) continue;
    const text = readFileSync(file, 'utf8').toLowerCase();
    for (const hex of BANNED_HEXES) {
      if (text.includes(hex)) {
        offenders.push(`${file.replace(PROJECT_ROOT + '/', '')} contains ${hex}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `palette literals must use tokens (bg-linen/text-espresso/... or var(--color-*)):\n${offenders.join('\n')}`,
  );
});
