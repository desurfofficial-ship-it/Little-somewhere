#!/bin/bash
# Stage 3 spatial redesign — AFTER round 2 (review fixes: wider/longer brook,
# higher arch + stone cheeks, oak hollow, canopy trim). Fountain shots use the
# REPAIRED state (flags.repairedFountain) so water/cascades/droplets show.
set -u
cd /home/z/my-project/stage3-ws
export AGENT_BROWSER_SESSION=lsd-spatial-after2-01
mkdir -p /tmp/qa_after2 && rm -f /tmp/qa_after2/*.png
mkdir -p download/asset-qa/stage3-spatial/after2

echo "=== building production bundle ==="
npm run build > /tmp/vite_build_after2.log 2>&1 || { echo "BUILD FAILED"; tail -20 /tmp/vite_build_after2.log; exit 1; }
echo "build ok"

npx vite preview --port=4183 --host=0.0.0.0 > /tmp/vite_preview_after2.log 2>&1 < /dev/null &
PREVIEW_PID=$!
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:4183/ && break; sleep 0.5; done
echo "server ready (pid $PREVIEW_PID)"

npx tsx scripts/make_brook_qa_save.ts > /tmp/spatial_base2.json
echo "base save bytes: $(wc -c < /tmp/spatial_base2.json)"

# Inject a mutated save and reload. $3 = REPAIR (1 => repairedFountain)
make_inject() {
  python3 - "$1" "$2" "${3:-0}" << 'PYEOF'
import base64, json, sys
pos, facing, repair = sys.argv[1], sys.argv[2], sys.argv[3]
save = json.loads(open('/tmp/spatial_base2.json').read().strip())
save['playerPos'] = json.loads(pos)
save['exteriorPlayerPos'] = json.loads(pos)
if repair == '1':
    save.setdefault('flags', {})['repairedFountain'] = True
js = (
  'const __save = ' + json.dumps(save) + ';\n'
  'const __facing = ' + facing + ';\n'
  '__save.playerFacing = __facing; __save.exteriorPlayerFacing = __facing;\n'
  'localStorage.setItem("little_somewhere_world_v1", JSON.stringify(__save));\n'
  'Storage.prototype.setItem = function(){};\n'
  'Storage.prototype.removeItem = function(){};\n'
  'location.reload(); "injected";'
)
print(base64.b64encode(js.encode()).decode())
PYEOF
}

load_scene() { # POS_JSON FACING_EXPR ZOOM [REPAIR]
  local B64=$(make_inject "$1" "$2" "${4:-0}")
  agent-browser eval "eval(atob('$B64'))" > /dev/null
  sleep 2.5
  agent-browser find text "Continue Day 3" click > /dev/null 2>&1 \
    || agent-browser find text "Begin Your Day" click > /dev/null 2>&1
  sleep 3.0
  if [ -n "${3:-}" ]; then
    agent-browser eval "window.__LS_CAMERA_SET__ && window.__LS_CAMERA_SET__($3); 'zoom set'" > /dev/null
    sleep 1.5
  fi
}

agent-browser set viewport 1440 900 > /dev/null
agent-browser open http://localhost:4183/ > /dev/null
sleep 2

load_scene '{"x": 0.0, "z": 6.0}' 'Math.atan2(-1.0, -3.5)' 1.75
agent-browser screenshot /tmp/qa_after2/after2_overview_desktop.png > /dev/null
echo "1. overview desktop captured"

load_scene '{"x": 1.2, "z": 17.6}' 'Math.atan2(-6.4, -3.88)' 1.0
agent-browser screenshot /tmp/qa_after2/after2_pond_desktop.png > /dev/null
echo "2. pond desktop captured"

load_scene '{"x": -3.4, "z": 9.8}' 'Math.atan2(0.5, 4.2)' 0.8
agent-browser screenshot /tmp/qa_after2/after2_bridge_desktop.png > /dev/null
echo "3. bridge desktop captured"

load_scene '{"x": -5.0, "z": 11.6}' 'Math.atan2(-1.2, 4.0)' 0.85
agent-browser screenshot /tmp/qa_after2/after2_oak_desktop.png > /dev/null
echo "4. oak desktop captured"

# repaired fountain — plaza view + close-up
load_scene '{"x": 2.8, "z": 6.2}' 'Math.atan2(-2.8, -4.7)' 1.0 1
agent-browser screenshot /tmp/qa_after2/after2_plaza_repaired_desktop.png > /dev/null
echo "5. plaza repaired captured"

load_scene '{"x": 2.6, "z": 4.8}' 'Math.atan2(-2.6, -3.3)' 0.7 1
agent-browser screenshot /tmp/qa_after2/after2_fountain_close_desktop.png > /dev/null
echo "6. fountain close repaired captured"

agent-browser set viewport 390 844 > /dev/null
agent-browser open http://localhost:4183/ > /dev/null
sleep 2
load_scene '{"x": 1.2, "z": 17.6}' 'Math.atan2(-6.4, -3.88)' 1.0
agent-browser screenshot /tmp/qa_after2/after2_pond_mobile.png > /dev/null
echo "7. pond mobile captured"

kill $PREVIEW_PID 2>/dev/null || true
cp /tmp/qa_after2/*.png download/asset-qa/stage3-spatial/after2/ 2>/dev/null
echo "=== AFTER-2 QA COMPLETE ==="
ls -la download/asset-qa/stage3-spatial/after2/
