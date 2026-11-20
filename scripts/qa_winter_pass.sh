#!/bin/bash
# One-shot winter QA: resident knit tint + winter collar + cottage winter comforts.
set -u
cd /home/z/my-project/little-somewhere
export AGENT_BROWSER_SESSION=lsd-03e363425671
mkdir -p /tmp/qa_shots && rm -f /tmp/qa_shots/winter_*.png

setsid nohup npx vite preview --port=4175 --host=0.0.0.0 > /tmp/vite_preview3.log 2>&1 < /dev/null &
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:4175/ && break; sleep 0.5; done
echo "server ready"

# Winter QA save: same fresh world, season forced to winter, Clara met
npx tsx scripts/make_dialogue_qa_save.ts > /tmp/winter_save.json
python3 - << 'EOF'
import base64, json
save = json.loads(open('/tmp/winter_save.json').read().strip())
save['day'] = 31; save['season'] = 'winter'
save['weather'] = 'sunlit'
payload = json.dumps(json.dumps(save))
js = (
  'localStorage.setItem("little_somewhere_world_v1", ' + payload + ');\n'
  'Storage.prototype.setItem = function(){};\n'
  'Storage.prototype.removeItem = function(){};\n'
  'location.reload(); "injected";'
)
open('/tmp/winter_inject.b64','w').write(base64.b64encode(js.encode()).decode())

# Teleport inside the cottage (player_door spawn) to view winter comforts
tele = (
  "(() => { const w = JSON.parse(localStorage.getItem('little_somewhere_world_v1'));"
  " w.playerLocation = 'cottage_interior';"
  " w.playerPos = {x: 0.6, z: -0.3};"
  " w.playerFacing = Math.PI * 0.75;"
  " localStorage.setItem('little_somewhere_world_v1', JSON.stringify(w));"
  " Storage.prototype.setItem = function(){};"
  " Storage.prototype.removeItem = function(){};"
  " location.reload(); return 'inside'; })()"
)
open('/tmp/winter_inside.b64','w').write(base64.b64encode(tele.encode()).decode())

# Teleport beside Clara (live position) outdoors to view the winter knit tint
beside = (
  "(() => { const w = JSON.parse(localStorage.getItem('little_somewhere_world_v1'));"
  " w.playerLocation = 'exterior';"
  " w.exteriorPlayerPos = {x: -8.0, z: 9.4};"
  " const c = (w.npcRuntime && w.npcRuntime.clara) ? w.npcRuntime.clara.position : {x: -8.05, z: -6.1};"
  " w.playerPos = {x: c.x, z: c.z + 1.3}; w.playerFacing = Math.PI;"
  " localStorage.setItem('little_somewhere_world_v1', JSON.stringify(w));"
  " Storage.prototype.setItem = function(){};"
  " Storage.prototype.removeItem = function(){};"
  " location.reload(); return 'beside'; })()"
)
open('/tmp/winter_beside.b64','w').write(base64.b64encode(beside.encode()).decode())
EOF

agent-browser console --clear > /dev/null 2>&1
agent-browser errors --clear > /dev/null 2>&1
agent-browser set viewport 1440 900
agent-browser open "http://localhost:4175/?autostart=1"
sleep 8
agent-browser eval -b "$(cat /tmp/winter_inject.b64)" > /dev/null
sleep 7
agent-browser eval "document.body.dataset.state + ' | season:' + document.body.textContent.match(/Winter|Spring|Summer|Autumn/)?.[0]"
agent-browser screenshot /tmp/qa_shots/winter_exterior_clara.png

agent-browser eval -b "$(cat /tmp/winter_inside.b64)" > /dev/null
sleep 7
agent-browser eval "'loc:' + document.body.textContent.match(/Willow Step Cottage/)?.[0]"
agent-browser screenshot /tmp/qa_shots/winter_cottage_interior.png

agent-browser eval -b "$(cat /tmp/winter_beside.b64)" > /dev/null
sleep 7
agent-browser screenshot /tmp/qa_shots/winter_beside_clara.png

echo "=== CONSOLE / ERRORS ==="
agent-browser console | tail -8
echo "--- page errors ---"
agent-browser errors | tail -6

pkill -f "vite preview" 2>/dev/null
agent-browser close > /dev/null 2>&1
echo "winter QA complete"
ls -la /tmp/qa_shots/ | rg winter
