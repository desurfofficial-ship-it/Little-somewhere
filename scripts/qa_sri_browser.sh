#!/bin/bash
# systemic-reliability Phase Nine — browser QA of observable save/load/journal
# behavior on the initiative branch build (repo browser-QA convention:
# single script holds the vite preview server up for the whole run).
set -u
cd /home/z/my-project/little-somewhere-sri
export AGENT_BROWSER_SESSION=sri-browser-qa
mkdir -p /tmp/qa_shots && rm -f /tmp/qa_shots/sri_*.png
PORT=4183

setsid nohup npx vite preview --port=$PORT --host=0.0.0.0 > /tmp/vite_preview_sri.log 2>&1 < /dev/null &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null; agent-browser close 2>/dev/null' EXIT
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:$PORT/ && break; sleep 0.5; done
echo "== server ready on :$PORT =="

echo "== STEP 1: boot fresh =="
agent-browser open http://localhost:$PORT
agent-browser wait --load networkidle
sleep 5
echo "-- console (last 6):"; agent-browser console 2>&1 | tail -6
echo "-- page errors:"; agent-browser errors 2>&1 | tail -4
agent-browser screenshot /tmp/qa_shots/sri_01_boot.png

echo "== STEP 1b: begin the day (title screen) =="
agent-browser find text "Begin Your Day" click
sleep 6
echo "-- payload after begin:"
agent-browser eval "(() => { const w = localStorage.getItem('little_somewhere_world_v1'); return w ? 'payload ' + w.length + 'B, day=' + JSON.parse(w).day + ', memories=' + (JSON.parse(w).memories?.length ?? 0) : 'MISSING'; })()"

echo "== STEP 2: open journal (Pocket Journal button) =="
agent-browser find aria "Open Pocket Journal" click 2>/dev/null || agent-browser eval "document.querySelector('[aria-label=\"Open Pocket Journal\"]')?.click(); 'clicked'"
sleep 1.5
agent-browser screenshot /tmp/qa_shots/sri_02_journal_open.png
echo "-- journal text sample:"
agent-browser eval "document.querySelector('[aria-label=\"Journal sections\"]')?.innerText?.slice(0,400) ?? 'JOURNAL-NOT-FOUND'"

echo "== STEP 3: healthy save/reload continuity =="
SAVE1=$(agent-browser eval "localStorage.getItem('little_somewhere_world_v1')?.length ?? 'MISSING'")
echo "-- healthy payload length: $SAVE1"
J1=$(agent-browser eval "JSON.parse(localStorage.getItem('little_somewhere_world_v1')).memories?.length ?? 'none'")
DAY1=$(agent-browser eval "JSON.parse(localStorage.getItem('little_somewhere_world_v1')).day")
echo "-- day=$DAY1 memories=$J1 (payload before reload)"
agent-browser eval "location.reload(); 'reloading'"
sleep 5
J2=$(agent-browser eval "JSON.parse(localStorage.getItem('little_somewhere_world_v1')).memories?.length ?? 'none'")
DAY2=$(agent-browser eval "JSON.parse(localStorage.getItem('little_somewhere_world_v1')).day")
echo "-- day=$DAY2 memories=$J2 (payload after reload) — continuity: day $DAY1→$DAY2, memories $J1→$J2"
echo "-- re-enter world (title screen shows on load) and confirm the save is loaded, not reset:"
agent-browser find text "Begin Your Day" click
sleep 6
agent-browser eval "(() => { const w = JSON.parse(localStorage.getItem('little_somewhere_world_v1')); return 'in-world: day=' + w.day + ' memories=' + w.memories.length + ' (must equal pre-reload values)'; })()"
agent-browser find aria "Open Pocket Journal" click 2>/dev/null || agent-browser eval "document.querySelector('[aria-label=\"Open Pocket Journal\"]')?.click(); 'clicked'"
sleep 1.5
agent-browser screenshot /tmp/qa_shots/sri_03_journal_after_reload.png
echo "-- journal sections after reload:"
agent-browser eval "document.querySelector('[aria-label=\"Journal sections\"]')?.innerText?.slice(0,200) ?? 'JOURNAL-NOT-FOUND'"
agent-browser console 2>&1 | tail -4

echo "== STEP 4: corrupt-save heal (SR-3 unknown pair + SR-8 dupes + SR-1 over-cap + F-SAVE-2 immortal) =="
echo "-- first land on the title screen (an in-world page flushes its state on unload;\n   the title screen never writes, so the injected corrupt payload survives):"
agent-browser eval "location.reload(); 'reloading'"
sleep 6
echo "-- on title screen, corrupt payload (runs before any boot load):"
agent-browser eval "
(() => {
  const w = JSON.parse(localStorage.getItem('little_somewhere_world_v1'));
  w.npcRelations = { ...w.npcRelations, 'zed:clara': { affinity: 90, familiarity: 50 } };
  w.worldEvents = [...(w.worldEvents ?? []), ...(w.worldEvents ?? [])].slice(0, 8);
  const row = (i) => ({ id: 'mem_qa_' + i, day: 1, phase: 'morning', title: 'QA ' + i, summary: 'qa row' });
  w.memories = Array.from({ length: 120 }, (_, i) => row(i));
  if (w.invitations?.active) { w.invitations.active.expiresDay = 1000000000; }
  localStorage.setItem('little_somewhere_world_v1', JSON.stringify(w));
  return 'corrupt payload set: relations=' + Object.keys(w.npcRelations).length + ', events=' + w.worldEvents.length + ', memories=' + w.memories.length;
})()"
agent-browser eval "location.reload(); 'reloading'"
sleep 6
agent-browser eval "(() => { const b = document.querySelector('[aria-label=\"Open Pocket Journal\"]'); if (b) b.click(); return b ? 'in world' : 'title screen (journal not mounted yet)'; })()"
agent-browser find text "Begin Your Day" click 2>/dev/null
sleep 5
echo "-- console warnings after corrupt load (filter):"
agent-browser console 2>&1 | grep -iE "warn|relation|memor|dedup|invit" | tail -10
echo "-- healed state:"
agent-browser eval "
(() => {
  const w = JSON.parse(localStorage.getItem('little_somewhere_world_v1') ?? '{}');
  const backup = localStorage.getItem('little_somewhere_world_v1_backup');
  return JSON.stringify({ memories: w.memories?.length, hasZedKey: Object.keys(w.npcRelations ?? {}).includes('zed:clara'), events: w.worldEvents?.length, backupPresent: !!backup, backupLen: backup?.length ?? 0 });
})()"
echo "-- page errors:"; agent-browser errors 2>&1 | tail -4
agent-browser screenshot /tmp/qa_shots/sri_04_corrupt_healed.png

echo "== STEP 5: unsupported schema version (future version: tombstone + conservative load) =="
agent-browser eval "
(() => {
  const w = JSON.parse(localStorage.getItem('little_somewhere_world_v1'));
  w.schemaVersion = 999;
  localStorage.setItem('little_somewhere_world_v1', JSON.stringify(w));
  return 'version 999 set';
})()"
agent-browser eval "location.reload(); 'reloading'"
sleep 6
echo "-- state after unsupported version (STORAGE_KEY must keep 999 — tombstoned, never rewritten):"
agent-browser eval "
(() => {
  const w = JSON.parse(localStorage.getItem('little_somewhere_world_v1') ?? '{}');
  const backup = localStorage.getItem('little_somewhere_world_v1_backup');
  let backupVersion = null;
  try { backupVersion = JSON.parse(backup ?? 'null')?.schemaVersion ?? null; } catch { backupVersion = 'unparseable'; }
  return JSON.stringify({ schemaVersion: w.schemaVersion, day: w.day, memories: w.memories?.length, backupPresent: !!backup, backupSchemaVersion: backupVersion });
})()"
agent-browser console 2>&1 | grep -iE "warn|version|tombstone|backup" | tail -6
echo "-- page errors:"; agent-browser errors 2>&1 | tail -4
agent-browser screenshot /tmp/qa_shots/sri_05_unsupported_version.png

echo "== STEP 6: final console + network =="
agent-browser console 2>&1 | grep -icE "error" || true
agent-browser network requests 2>&1 | grep -icE "failed|4[0-9][0-9]|5[0-9][0-9]" || true
echo "== browser QA complete; screenshots in /tmp/qa_shots/sri_*.png =="
