#!/bin/bash
# One-shot headless QA for Priorities 1-3: dialogue sheet visuals, prop card,
# history drawer, reduced-motion, console/error sweep, at 390x844 + 1440x900.
# Screenshots land in /tmp/qa_shots/. Server + browser run inside this single call.
set -u
cd /home/z/my-project/little-somewhere
export AGENT_BROWSER_SESSION=lsd-03e363425671
mkdir -p /tmp/qa_shots && rm -f /tmp/qa_shots/*.png

# 1. Serve the production build (fast, matches shipped artifact)
setsid nohup npx vite preview --port=4173 --host=0.0.0.0 > /tmp/vite_preview.log 2>&1 < /dev/null &
SERVER_PID=$!
for i in $(seq 1 30); do
  curl -s -o /dev/null http://localhost:4173/ && break
  sleep 0.5
done
echo "server ready"

# 2. Build the save-injection payload (fresh morning save beside Clara's plaza spot)
npx tsx scripts/make_dialogue_qa_save.ts > /tmp/dialogue_qa_save.json
python3 - << 'EOF'
import base64, json
save = open('/tmp/dialogue_qa_save.json').read().strip()
js = (
  'const save = ' + json.dumps(save) + ';\n'
  'localStorage.setItem("little_somewhere_world_v1", save);\n'
  # Neuter storage BEFORE reload: the app flushes its in-memory state on unload,
  # which would otherwise clobber the injected save (see scripts/qa_teleport.sh).
  'Storage.prototype.setItem = function(){};\n'
  'Storage.prototype.removeItem = function(){};\n'
  'location.reload(); "injected";'
)
open('/tmp/inject.b64','w').write(base64.b64encode(js.encode()).decode())
EOF

agent-browser console --clear > /dev/null 2>&1
agent-browser errors --clear > /dev/null 2>&1

inject_reload() {
  agent-browser eval -b "$(cat /tmp/inject.b64)" > /dev/null
  sleep 6
}

press_e() {
  agent-browser eval "window.dispatchEvent(new KeyboardEvent('keydown', {code: 'KeyE', bubbles: true})); window.dispatchEvent(new KeyboardEvent('keyup', {code: 'KeyE', bubbles: true})); 'e-sent'"
  sleep 1.2
}

press_escape() {
  agent-browser eval "window.dispatchEvent(new KeyboardEvent('keydown', {code: 'Escape', bubbles: true})); window.dispatchEvent(new KeyboardEvent('keyup', {code: 'Escape', bubbles: true})); 'esc-sent'"
  sleep 1
}

teleport() {
  # $1 = js expression returning {x,z} for playerPos (mutates live save, reloads)
  local js="(() => { const w = JSON.parse(localStorage.getItem('little_somewhere_world_v1')); w.playerPos = $1; w.playerFacing = Math.PI * 0.75; localStorage.setItem('little_somewhere_world_v1', JSON.stringify(w)); Storage.prototype.setItem = function(){}; Storage.prototype.removeItem = function(){}; location.reload(); 'teleported'; })()"
  local b64=$(printf '%s' "$js" | base64 -w 0)
  agent-browser eval -b "$b64" > /dev/null
  sleep 6
}

teleport_beside_resident() {
  # Mutates the live save to park the player 1.2 units south of Clara's live NPC position
  local js="(() => { const w = JSON.parse(localStorage.getItem('little_somewhere_world_v1')); const c = w.npcRuntime && w.npcRuntime.clara ? w.npcRuntime.clara.position : {x: -3.2, z: 0.4}; w.playerPos = {x: c.x, z: c.z + 1.2}; w.playerFacing = Math.PI; localStorage.setItem('little_somewhere_world_v1', JSON.stringify(w)); Storage.prototype.setItem = function(){}; Storage.prototype.removeItem = function(){}; location.reload(); 'beside-clara ' + Math.round(w.playerPos.x * 10) / 10 + ',' + Math.round(w.playerPos.z * 10) / 10; })()"
  local b64=$(printf '%s' "$js" | base64 -w 0)
  agent-browser eval -b "$b64"
  sleep 6
}

echo "=== MOBILE 390x844 ==="
agent-browser set viewport 390 844
agent-browser open "http://localhost:4173/?autostart=1"
sleep 8
inject_reload
agent-browser eval "document.body.dataset.state"
teleport_beside_resident
agent-browser eval "'prompt:' + (document.body.textContent.match(/Talk to \w+/)?.[0] ?? 'none')"
press_e
agent-browser eval "'sheet:' + Boolean(document.querySelector('[role=\"dialog\"]')) + ' | avatar:' + Boolean(document.querySelector('[data-testid=\"resident-dialogue-avatar\"]')) + ' | canvas:' + document.querySelectorAll('[role=\"dialog\"] canvas').length"
agent-browser screenshot /tmp/qa_shots/mobile_dialogue.png

agent-browser eval "document.querySelector('[data-testid=\"dialogue-history-toggle\"]')?.click(); 'history-toggled'"
sleep 0.6
agent-browser eval "'drawer:' + Boolean(document.querySelector('[data-testid=\"dialogue-history-drawer\"]')) + ' | lines:' + document.querySelectorAll('[data-testid=\"dialogue-history-drawer\"] p').length"
agent-browser screenshot /tmp/qa_shots/mobile_dialogue_history.png

# Advance one choice, portrait persists + prose updates
agent-browser eval "Array.from(document.querySelectorAll('[role=\"dialog\"] button')).find(b => b.className.includes('border-[#D8C9B3]'))?.click(); 'choice-clicked'"
sleep 1
agent-browser eval "'still-dialog:' + Boolean(document.querySelector('[role=\"dialog\"]')) + ' | hint:' + Boolean(document.querySelector('[data-testid=\"dialogue-continue-hint\"]'))"
agent-browser screenshot /tmp/qa_shots/mobile_dialogue_choice.png

press_escape
teleport "{x: 0.4, z: 5.4}"
press_e
sleep 1
agent-browser eval "'prop-dialog:' + Boolean(document.querySelector('[role=\"dialog\"]')) + ' | canvas:' + document.querySelectorAll('[role=\"dialog\"] canvas').length"
agent-browser screenshot /tmp/qa_shots/mobile_propcard.png

echo "=== DESKTOP 1440x900 ==="
agent-browser set viewport 1440 900
teleport_beside_resident
press_e
agent-browser screenshot /tmp/qa_shots/desktop_dialogue.png
agent-browser eval "document.querySelector('[data-testid=\"dialogue-history-toggle\"]')?.click(); 'hist2'"
sleep 0.6
agent-browser screenshot /tmp/qa_shots/desktop_dialogue_history.png

echo "=== REDUCED MOTION ==="
agent-browser set media no-preference reduced-motion
press_escape
inject_reload
press_e
agent-browser screenshot /tmp/qa_shots/desktop_reduced_motion.png
agent-browser set media no-preference no-preference

echo "=== SCROLL CHECK (mobile) ==="
agent-browser set viewport 390 844
inject_reload
agent-browser eval "'scrollW:' + document.documentElement.scrollWidth + ' innerW:' + window.innerWidth"

echo "=== CONSOLE / ERRORS ==="
agent-browser console | tail -20
echo "--- page errors ---"
agent-browser errors | tail -10

kill $SERVER_PID 2>/dev/null
agent-browser close > /dev/null 2>&1
echo "QA flow complete"
ls -la /tmp/qa_shots/
