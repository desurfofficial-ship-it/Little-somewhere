#!/bin/bash
# Diagnostic: track the save through inject -> teleport -> reload.
set -u
cd /home/z/my-project/little-somewhere
export AGENT_BROWSER_SESSION=lsd-03e363425671

setsid nohup npx vite preview --port=4174 --host=0.0.0.0 > /tmp/vite_preview2.log 2>&1 < /dev/null &
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:4174/ && break; sleep 0.5; done
echo "server ready"

npx tsx scripts/make_dialogue_qa_save.ts > /tmp/dialogue_qa_save.json
python3 - << 'EOF'
import base64, json
save = open('/tmp/dialogue_qa_save.json').read().strip()
js = 'const save = ' + json.dumps(save) + ';\nlocalStorage.setItem("little_somewhere_world_v1", save);\nlocation.reload(); "injected";'
open('/tmp/inject.b64','w').write(base64.b64encode(js.encode()).decode())

tele = """(() => { const raw = localStorage.getItem('little_somewhere_world_v1'); if (!raw) return 'no-save'; const w = JSON.parse(raw); const c = (w.npcRuntime && w.npcRuntime.clara) ? w.npcRuntime.clara.position : null; if (!c) return 'no-clara raw-len:' + raw.length; w.playerPos = { x: c.x, z: c.z + 1.2 }; w.playerFacing = Math.PI; localStorage.setItem('little_somewhere_world_v1', JSON.stringify(w)); location.reload(); return 'teleported beside clara at ' + c.x + ',' + c.z; })()"""
open('/tmp/tele.b64','w').write(base64.b64encode(tele.encode()).decode())

probe = """(() => { const raw = localStorage.getItem('little_somewhere_world_v1'); if (!raw) return 'no-save'; const w = JSON.parse(raw); return 'day:' + w.day + ' time:' + w.minuteOfDay + ' pos:' + w.playerPos.x + ',' + w.playerPos.z + ' loc:' + w.playerLocation + ' clara:' + (w.npcRuntime && w.npcRuntime.clara ? w.npcRuntime.clara.position.x + ',' + w.npcRuntime.clara.position.z : 'none'); })()"""
open('/tmp/probe.b64','w').write(base64.b64encode(probe.encode()).decode())
EOF

agent-browser set viewport 390 844
agent-browser open "http://localhost:4174/?autostart=1"
sleep 8
echo "--- after first open:"
agent-browser eval -b "$(cat /tmp/probe.b64)"
agent-browser eval -b "$(cat /tmp/inject.b64)"
sleep 7
echo "--- after inject:"
agent-browser eval -b "$(cat /tmp/probe.b64)"
echo "--- teleporting:"
agent-browser eval -b "$(cat /tmp/tele.b64)"
sleep 7
echo "--- after teleport:"
agent-browser eval -b "$(cat /tmp/probe.b64)"
agent-browser eval "document.body.dataset.state + ' | hud:' + document.body.textContent.slice(0, 80).replace(/\n/g, ' ')"
pkill -f "vite preview" 2>/dev/null
agent-browser close > /dev/null 2>&1
echo done
