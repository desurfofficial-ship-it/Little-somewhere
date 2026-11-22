// scripts/check_layer_boundaries.ts
//
// Machine-checks the three-layer architecture boundary (AGENTS.md §2).
// Spec: docs/architecture/master-architecture/04-module-ownership-matrix.md §3
//
// Run in CI:  npx tsx scripts/check_layer_boundaries.ts
//
// Checks (production files only, unless noted):
//   1. src/game/**  must not import `three` / `react` / `react-dom`.
//   2. src/game/**  must not touch browser globals except in SANCTIONED modules.
//   3. src/scene/** must not import from src/components/.
//   4. src/components/** must not import `three` directly.
//   5. src/components/** must not import from src/scene/**.
//   6. src/game/**  production import graph must be acyclic (Tarjan SCC).
//
// String literals and comments are stripped before the browser-global scan so
// that prose like "cottage window." or test descriptions mentioning
// "AudioContext" do not produce false positives. Test files (.test.ts) are
// skipped for the purity checks (Rules 1 & 2) because they legitimately mock
// browser APIs; they ARE included in the structural checks (Rules 3-5) and
// excluded from the DAG check (Rule 6, production-only).
//
// Exit code: 0 if all checks pass, 1 with diagnostics otherwise.

import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

// Sanctioned browser-touch modules in src/game/ (AGENTS.md §2).
// `journal.ts` is a KNOWN VIOLATION (W5, doc 02) temporarily sanctioned until
// Phase E5 remediation folds its localStorage access into the storage port.
// When E5 lands, remove `journal.ts` from this set — the script will then
// enforce the boundary on it.
const SANCTIONED_GAME_BROWSER_MODULES = new Set<string>([
  'storage.ts', // window.localStorage (guarded by typeof window === 'undefined')
  'audio.ts', // AudioContext (lazy ensureContext guard) + window.setTimeout/clearTimeout (W6: until Scheduler port)
  'journal.ts', // TEMPORARY: window.localStorage (W5 — known violation, doc 02; remove after Phase E5)
]);

interface Violation {
  file: string;
  line: number;
  rule: string;
  detail: string;
}

const violations: Violation[] = [];

function walk(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, {withFileTypes: true});
  } catch {
    return out;
  }
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

const allFiles = walk(SRC);
const isTest = (f: string) => /\.test\.ts$/.test(f) || /\.test\.tsx$/.test(f);
const gameFiles = allFiles.filter((f) => f.includes(`${path.sep}game${path.sep}`));
const sceneFiles = allFiles.filter((f) => f.includes(`${path.sep}scene${path.sep}`));
const compFiles = allFiles.filter((f) => f.includes(`${path.sep}components${path.sep}`));

function rel(p: string): string {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

function readLines(p: string): string[] {
  return fs.readFileSync(p, 'utf8').split('\n');
}

// Strip string literals and comments, replacing their content with spaces
// while preserving newlines and total length so line numbers map 1:1 to the
// original source. This prevents prose like "cottage window." or test names
// mentioning "AudioContext" from producing false positives.
function stripStringsAndComments(code: string): string {
  let out = '';
  let i = 0;
  let inLine = false;
  let inBlock = false;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  while (i < code.length) {
    const c = code[i];
    const next = code[i + 1];
    if (inLine) {
      if (c === '\n') {
        inLine = false;
        out += c;
      } else {
        out += ' ';
      }
      i++;
      continue;
    }
    if (inBlock) {
      if (c === '*' && next === '/') {
        inBlock = false;
        out += '  ';
        i += 2;
        continue;
      }
      if (c === '\n') {
        out += c;
        i++;
        continue;
      }
      out += ' ';
      i++;
      continue;
    }
    if (inSingle) {
      if (c === '\\' && next !== undefined) {
        out += '  ';
        i += 2;
        continue;
      }
      if (c === "'") {
        inSingle = false;
        out += ' ';
        i++;
        continue;
      }
      if (c === '\n') {
        out += c;
        i++;
        continue;
      }
      out += ' ';
      i++;
      continue;
    }
    if (inDouble) {
      if (c === '\\' && next !== undefined) {
        out += '  ';
        i += 2;
        continue;
      }
      if (c === '"') {
        inDouble = false;
        out += ' ';
        i++;
        continue;
      }
      if (c === '\n') {
        out += c;
        i++;
        continue;
      }
      out += ' ';
      i++;
      continue;
    }
    if (inTemplate) {
      if (c === '\\' && next !== undefined) {
        out += '  ';
        i += 2;
        continue;
      }
      if (c === '`') {
        inTemplate = false;
        out += ' ';
        i++;
        continue;
      }
      if (c === '\n') {
        out += c;
        i++;
        continue;
      }
      out += ' ';
      i++;
      continue;
    }
    if (c === '/' && next === '/') {
      inLine = true;
      out += '  ';
      i += 2;
      continue;
    }
    if (c === '/' && next === '*') {
      inBlock = true;
      out += '  ';
      i += 2;
      continue;
    }
    if (c === "'") {
      inSingle = true;
      out += ' ';
      i++;
      continue;
    }
    if (c === '"') {
      inDouble = true;
      out += ' ';
      i++;
      continue;
    }
    if (c === '`') {
      inTemplate = true;
      out += ' ';
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// Browser-global code-access patterns. These match actual property accesses,
// not prose mentions, because they require `window.<api>` / `document.<api>` /
// `new AudioContext` / bare `<api>(` call forms.
const BROWSER_GLOBAL_PATTERNS: Array<{re: RegExp; name: string}> = [
  {re: /\bwindow\.(localStorage|setTimeout|clearTimeout|requestAnimationFrame|cancelAnimationFrame|AudioContext|fetch|Worker|indexedDB|navigator|location|history|screen|crypto|addEventListener|removeEventListener|getComputedStyle|matchMedia|innerWidth|innerHeight|devicePixelRatio)\b/g, name: 'window.<api>'},
  {re: /\bdocument\.(addEventListener|removeEventListener|getElementById|querySelector|querySelectorAll|createElement|body|head|documentElement|title|cookie|fonts|visibilityState)\b/g, name: 'document.<api>'},
  {re: /\bnew\s+AudioContext\b/g, name: 'new AudioContext'},
  {re: /\bnew\s+Worker\b/g, name: 'new Worker'},
  {re: /\brequestAnimationFrame\s*\(/g, name: 'requestAnimationFrame('},
  {re: /\bcancelAnimationFrame\s*\(/g, name: 'cancelAnimationFrame('},
  {re: /\blocalStorage\.(getItem|setItem|removeItem|clear)\s*\(/g, name: 'localStorage.<api>('},
  {re: /\bindexedDB\.(open|deleteDatabase)\s*\(/g, name: 'indexedDB.<api>('},
];

// --- Rule 1: src/game/** (production) no three / react / react-dom imports
for (const f of gameFiles) {
  if (isTest(f)) continue;
  const lines = readLines(f);
  lines.forEach((line, i) => {
    if (/\bfrom\s+['"]three['"]/.test(line) || /\bfrom\s+['"]three\//.test(line)) {
      violations.push({file: rel(f), line: i + 1, rule: 'game-no-three', detail: line.trim()});
    }
    if (
      /\bfrom\s+['"]react['"]/.test(line) ||
      /\bfrom\s+['"]react-dom['"]/.test(line) ||
      /\bfrom\s+['"]react\//.test(line) ||
      /\bfrom\s+['"]react-dom\//.test(line)
    ) {
      violations.push({file: rel(f), line: i + 1, rule: 'game-no-react', detail: line.trim()});
    }
  });
}

// --- Rule 2: src/game/** (production) no browser globals except sanctioned
for (const f of gameFiles) {
  if (isTest(f)) continue;
  const base = path.basename(f);
  if (SANCTIONED_GAME_BROWSER_MODULES.has(base)) continue;
  const raw = fs.readFileSync(f, 'utf8');
  const stripped = stripStringsAndComments(raw);
  const strippedLines = stripped.split('\n');
  strippedLines.forEach((line, i) => {
    for (const {re, name} of BROWSER_GLOBAL_PATTERNS) {
      re.lastIndex = 0;
      if (re.test(line)) {
        violations.push({
          file: rel(f),
          line: i + 1,
          rule: 'game-no-browser-globals',
          detail: `${name}: ${readLines(f)[i].trim()}`,
        });
      }
    }
  });
}

// --- Rule 3: src/scene/** no imports from src/components/
for (const f of sceneFiles) {
  const lines = readLines(f);
  lines.forEach((line, i) => {
    if (/\bfrom\s+['"][^'"]*components\//.test(line)) {
      violations.push({file: rel(f), line: i + 1, rule: 'scene-no-components', detail: line.trim()});
    }
  });
}

// --- Rule 4: src/components/** no three imports
for (const f of compFiles) {
  const lines = readLines(f);
  lines.forEach((line, i) => {
    if (/\bfrom\s+['"]three['"]/.test(line) || /\bfrom\s+['"]three\//.test(line)) {
      violations.push({file: rel(f), line: i + 1, rule: 'components-no-three', detail: line.trim()});
    }
  });
}

// --- Rule 5: src/components/** no imports from src/scene/
for (const f of compFiles) {
  const lines = readLines(f);
  lines.forEach((line, i) => {
    if (/\bfrom\s+['"][^'"]*scene\//.test(line)) {
      violations.push({file: rel(f), line: i + 1, rule: 'components-no-scene', detail: line.trim()});
    }
  });
}

// --- Rule 6: src/game/** production import graph acyclic (Tarjan SCC)
function resolveImport(importer: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const dir = path.dirname(importer);
  const resolved = path.resolve(dir, spec);
  const candidates = [
    resolved + '.ts',
    resolved + '.tsx',
    path.join(resolved, 'index.ts'),
    path.join(resolved, 'index.tsx'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const gameProdFiles = gameFiles.filter((f) => !isTest(f));
const gameSet = new Set(gameProdFiles);
const gameAdj = new Map<string, string[]>();
for (const f of gameProdFiles) {
  const lines = readLines(f);
  const deps: string[] = [];
  for (const line of lines) {
    const m = line.match(/\bfrom\s+['"](\.{1,2}[^'"]+)['"]/);
    if (m) {
      const target = resolveImport(f, m[1]);
      if (target && gameSet.has(target) && target !== f) {
        deps.push(target);
      }
    }
  }
  gameAdj.set(f, deps);
}

// Iterative Tarjan SCC
let sccIndex = 0;
const stack: string[] = [];
const onStack = new Set<string>();
const indices = new Map<string, number>();
const lowlinks = new Map<string, number>();
const sccs: string[][] = [];

function strongconnect(root: string): void {
  const callStack: Array<{v: string; wi: number}> = [{v: root, wi: 0}];
  indices.set(root, sccIndex);
  lowlinks.set(root, sccIndex);
  sccIndex++;
  stack.push(root);
  onStack.add(root);

  while (callStack.length > 0) {
    const frame = callStack[callStack.length - 1];
    const deps = gameAdj.get(frame.v) || [];
    if (frame.wi < deps.length) {
      const w = deps[frame.wi];
      frame.wi++;
      if (!indices.has(w)) {
        indices.set(w, sccIndex);
        lowlinks.set(w, sccIndex);
        sccIndex++;
        stack.push(w);
        onStack.add(w);
        callStack.push({v: w, wi: 0});
      } else if (onStack.has(w)) {
        lowlinks.set(frame.v, Math.min(lowlinks.get(frame.v)!, indices.get(w)!));
      }
    } else {
      if (lowlinks.get(frame.v) === indices.get(frame.v)) {
        const comp: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          comp.push(w);
        } while (w !== frame.v);
        sccs.push(comp);
      }
      callStack.pop();
      if (callStack.length > 0) {
        const parent = callStack[callStack.length - 1];
        lowlinks.set(parent.v, Math.min(lowlinks.get(parent.v)!, lowlinks.get(frame.v)!));
      }
    }
  }
}

for (const v of gameProdFiles) {
  if (!indices.has(v)) strongconnect(v);
}

for (const scc of sccs) {
  if (scc.length > 1) {
    violations.push({
      file: rel(scc[0]),
      line: 0,
      rule: 'game-acyclic',
      detail: `cycle among: ${scc.map(rel).join(' -> ')}`,
    });
  }
}
for (const [v, deps] of gameAdj) {
  if (deps.includes(v)) {
    violations.push({file: rel(v), line: 0, rule: 'game-acyclic', detail: 'self-import'});
  }
}

// --- Report
const temporaryWarnings: string[] = [];
if (SANCTIONED_GAME_BROWSER_MODULES.has('journal.ts')) {
  temporaryWarnings.push(
    'journal.ts window.localStorage is a KNOWN VIOLATION (W5, doc 02) temporarily sanctioned until Phase E5.',
  );
}

if (violations.length > 0) {
  console.error(`\n[check_layer_boundaries] ${violations.length} violation(s) found:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.rule}]  ${v.detail}`);
  }
  console.error(
    `\nBoundary spec: docs/architecture/master-architecture/04-module-ownership-matrix.md §3`,
  );
  process.exit(1);
} else {
  console.log('[check_layer_boundaries] OK — three-layer boundary intact, src/game production acyclic.');
  console.log(`[check_layer_boundaries] scanned ${gameProdFiles.length} production game files, ${sceneFiles.length} scene files, ${compFiles.length} component files.`);
  for (const w of temporaryWarnings) {
    console.log(`[check_layer_boundaries] WARNING: ${w}`);
  }
}
