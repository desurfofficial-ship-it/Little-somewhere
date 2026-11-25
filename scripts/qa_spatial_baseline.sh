#!/bin/bash
# Stage 3 spatial redesign — BASELINE captures (before any geometry change).
# Deterministic injected saves, single server session. Adapted from qa_brook_v11.sh.
set -u
cd /home/z/my-project/stage3-ws
export AGENT_BROWSER_SESSION=lsd-spatial-base-01
mkdir -p /tmp/qa_base && rm -f /tmp/qa_base/*.png
mkdir -p download/asset-qa/stage3-spatial/baseline

echo "=== building production bundle ==="
npm run build > /tmp/vite_build_base.log 2>&1 || { echo "BUILD FAILED"; tail -20 /tmp/vite_build_base.log; exit 1; }
echo "build ok"

npx vite preview --port=4182 --host=0.0.0.0 > /tmp/vite_preview_base.log 2>&1 < /dev/null &
PREVIEW_PID=$!
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:4182/ && break; sleep 0.5; done
echo "server ready (pid $PREVIEW_PID)"

npx tsx scripts/make_brook_qa_save.ts > /tmp/spatial_base.json
echo "base save bytes: $(wc -c < /tmp/spatial_base.json)"

# Inject a mutated save and reload.
make_inject() {
  python3 - "$1" "$2" << 'PYEOF'
import base64, json, sys
pos, facing = sys.argv[1], sys.argv[2]
save = json.loads(open('/tmp/spatial_base.json').read().strip())
save['playerPos'] = json.loads(pos)
save['exteriorPlayerPos'] = json.loads(pos)
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

load_scene() { # POS_JSON FACING_EXPR ZOOM
  local B64=$(make_inject "$1" "$2")
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

# ---------- 1. desktop far-zoom neighborhood overview ----------
agent-browser set viewport 1440 900 > /dev/null
agent-browser open http://localhost:4182/ > /dev/null
sleep 2
load_scene '{"x": 0.0, "z": 6.0}' 'Math.atan2(-1.0, -3.5)' 1.75
agent-browser screenshot /tmp/qa_base/baseline_overview_desktop.png > /dev/null
echo "1. overview desktop captured"

# ---------- 2. plaza + fountain, normal zoom ----------
load_scene '{"x": 2.8, "z": 6.2}' 'Math.atan2(-2.8, -4.7)' 1.0
agent-browser screenshot /tmp/qa_base/baseline_plaza_desktop.png > /dev/null
echo "2. plaza desktop captured"

# ---------- 3. pond district: bridge + brook + oak, normal zoom ----------
load_scene '{"x": 1.2, "z": 17.6}' 'Math.atan2(-6.4, -3.88)' 1.0
agent-browser screenshot /tmp/qa_base/baseline_pond_desktop.png > /dev/null
echo "3. pond desktop captured"

# ---------- 4. hollow oak, close zoom ----------
load_scene '{"x": -5.0, "z": 11.6}' 'Math.atan2(-1.2, 4.0)' 0.85
agent-browser screenshot /tmp/qa_base/baseline_oak_desktop.png > /dev/null
echo "4. oak desktop captured"

# ---------- 5. bridge close-up ----------
load_scene '{"x": -3.4, "z": 9.8}' 'Math.atan2(0.5, 4.2)' 0.8
agent-browser screenshot /tmp/qa_base/baseline_bridge_desktop.png > /dev/null
echo "5. bridge desktop captured"

# ---------- 6. mobile pond district ----------
agent-browser set viewport 390 844 > /dev/null
agent-browser open http://localhost:4182/ > /dev/null
sleep 2
load_scene '{"x": 1.2, "z": 17.6}' 'Math.atan2(-6.4, -3.88)' 1.0
agent-browser screenshot /tmp/qa_base/baseline_pond_mobile.png > /dev/null
echo "6. pond mobile captured"

# ---------- 7. mobile far-zoom overview ----------
load_scene '{"x": 0.0, "z": 6.0}' 'Math.atan2(-1.0, -3.5)' 1.75
agent-browser screenshot /tmp/qa_base/baseline_overview_mobile.png > /dev/null
echo "7. overview mobile captured"

kill $PREVIEW_PID 2>/dev/null || true
cp /tmp/qa_base/*.png download/asset-qa/stage3-spatial/baseline/ 2>/dev/null
echo "=== BASELINE QA COMPLETE ==="
ls -la download/asset-qa/stage3-spatial/baseline/
