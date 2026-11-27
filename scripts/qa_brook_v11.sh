#!/bin/bash
# Stage 3 fishing v1.1 QA: West Brook Bank visual evidence.
# Captures (all deterministic injected saves, single server session):
#   brook-bank-desktop.png        — the bank rig on the stream's NORTH bank (Slice W1
#                                   relocation, post-spatial-redesign watershed) + HUD prompt
#   brook-cast-card-desktop.png   — trusted-mouse tap on the proxy → cast prose card
#   brook-bank-mobile.png         — 390x844 bank view
#   jetty-regression-desktop.png  — v1 jetty rig unchanged after the rig-builder refactor
set -u
cd /home/z/my-project/stage3-ws
export AGENT_BROWSER_SESSION=lsd-brook-01
mkdir -p /tmp/qa_shots && rm -f /tmp/qa_shots/brook_*.png /tmp/qa_shots/jetty_*.png
mkdir -p download/asset-qa/stage3-brook && rm -f download/asset-qa/stage3-brook/*.png

npx vite preview --port=4181 --host=0.0.0.0 > /tmp/vite_preview_brook.log 2>&1 < /dev/null &
PREVIEW_PID=$!
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:4181/ && break; sleep 0.5; done
echo "server ready (pid $PREVIEW_PID)"

npx tsx scripts/make_brook_qa_save.ts > /tmp/brook_base.json
echo "base save bytes: $(wc -c < /tmp/brook_base.json)"

# Inject a mutated save and reload. Facing points at the culvert water.
# Args: POS_JSON FACING_EXPR [DAY]
make_inject() {
  python3 - "$1" "$2" "${3:-3}" << 'PYEOF'
import base64, json, sys
pos, facing, day = sys.argv[1], sys.argv[2], sys.argv[3]
save = json.loads(open('/tmp/brook_base.json').read().strip())
save['day'] = int(day)
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

load_scene() { # POS_JSON FACING_EXPR CONTINUE_LABEL [DAY]
  local B64=$(make_inject "$1" "$2" "${4:-3}")
  agent-browser eval "eval(atob('$B64'))" > /dev/null
  sleep 2.5
  agent-browser find text "${3:-Continue Day 3}" click > /dev/null 2>&1 \
    || agent-browser find text "Begin Your Day" click > /dev/null 2>&1
  sleep 3.5
}

BROOK_POS='{"x": -5.5, "z": 12.35}'
BROOK_FACE='Math.atan2(-2.73 - (-5.5), 14.0 - 12.35)'
# Canonical rig view: pond south shore, looking WNW — the north-bank rig
# cluster (planks/creel/rod, cluster center ≈ (-6.24, 12.70)) renders
# unoccluded across the oak's east lawn.
BROOK_VIEW_POS='{"x": 1.2, "z": 17.6}'
BROOK_VIEW_FACE='Math.atan2(-6.24 - 1.2, 12.7 - 17.6)'
BROOK_VIEW_DAY=6
JETTY_POS='{"x": -0.8, "z": 17.6}'
JETTY_FACE='Math.atan2(1.0 - (-0.8), 14.6 - 17.6)'

# ---------- 1. desktop bank view (rig visible across the lawn) ----------
agent-browser set viewport 1440 900 > /dev/null
agent-browser open http://localhost:4181/ > /dev/null
sleep 2
load_scene "$BROOK_VIEW_POS" "$BROOK_VIEW_FACE" "Continue Day $BROOK_VIEW_DAY" "$BROOK_VIEW_DAY"
agent-browser screenshot /tmp/qa_shots/brook_bank_desktop.png > /dev/null
echo "bank desktop captured"

# ---------- 2. trusted tap on the proxy → cast prose card ----------
# Stage the player ON the spot first (section 1 leaves them at the far view);
# the tap must land on the in-range proxy for the immediate interaction path.
load_scene "$BROOK_POS" "$BROOK_FACE"
PROJ=$(agent-browser eval "(() => {
  const zoom = (window.__LS_CAMERA_GET__ && window.__LS_CAMERA_GET__()) || 1;
  const save = JSON.parse(localStorage.getItem('little_somewhere_world_v1'));
  const p = save.playerPos;
  const C = {x: p.x + 19.5*zoom, y: 18.2*zoom, z: p.z + 19.5*zoom};
  const L = {x: p.x, y: 1.0, z: p.z};
  const f0 = {x: L.x-C.x, y: L.y-C.y, z: L.z-C.z};
  const fl = Math.hypot(f0.x, f0.y, f0.z);
  const f = {x: f0.x/fl, y: f0.y/fl, z: f0.z/fl};
  const r = {x: -f.z, y: 0, z: f.x};
  const rl = Math.hypot(r.x, r.y, r.z); r.x/=rl; r.z/=rl;
  const u = {x: r.y*f.z - r.z*f.y, y: r.z*f.x - r.x*f.z, z: r.x*f.y - r.y*f.x};
  const P = {x: -5.5, y: 0.8, z: 12.35};
  const d = {x: P.x-C.x, y: P.y-C.y, z: P.z-C.z};
  const camX = d.x*r.x + d.y*r.y + d.z*r.z;
  const camY = d.x*u.x + d.y*u.y + d.z*u.z;
  const camZ = d.x*f.x + d.y*f.y + d.z*f.z;
  const tanHalf = Math.tan(14*Math.PI/180);
  const aspect = innerWidth/innerHeight;
  const ndcX = (camX/(camZ*tanHalf))/aspect;
  const ndcY = camY/(camZ*tanHalf);
  return ((ndcX*0.5+0.5)*innerWidth).toFixed(1) + ',' + ((1-(ndcY*0.5+0.5))*innerHeight).toFixed(1) + ',zoom=' + zoom;
})()" | tr -d '"')
echo "proxy projection: $PROJ"
PX=$(echo "$PROJ" | cut -d',' -f1)
PY=$(echo "$PROJ" | cut -d',' -f2)
echo "tapping at ($PX, $PY)"
agent-browser mouse move "$PX" "$PY" > /dev/null
agent-browser mouse down > /dev/null
agent-browser mouse up > /dev/null
sleep 1.2
CARD=$(agent-browser eval "document.body.innerText.includes('West Brook Bank') ? 'CARD_OPEN' : 'CARD_MISSING'")
echo "cast card: $CARD"
if [ "$CARD" != "CARD_OPEN" ]; then
  agent-browser eval "document.body.innerText.slice(0, 300)"
fi
agent-browser screenshot /tmp/qa_shots/brook_cast_card_desktop.png > /dev/null
echo "cast card captured"

# ---------- 3. mobile bank view (fresh day, same canonical rig view) ----------
agent-browser set viewport 390 844 > /dev/null
agent-browser open http://localhost:4181/ > /dev/null
sleep 2
load_scene '{"x": 1.2, "z": 17.6}' 'Math.atan2(-5.2 - 1.2, 13.72 - 17.6)' "Continue Day 4" 4
agent-browser screenshot /tmp/qa_shots/brook_bank_mobile.png > /dev/null
echo "bank mobile captured"

# ---------- 4. jetty regression (rig refactor must not move the v1 rig) ----------
load_scene "$JETTY_POS" "$JETTY_FACE"
agent-browser screenshot /tmp/qa_shots/jetty_regression_desktop.png > /dev/null
echo "jetty regression captured"

kill $PREVIEW_PID 2>/dev/null || true
cp /tmp/qa_shots/brook_bank_desktop.png /tmp/qa_shots/brook_cast_card_desktop.png \
   /tmp/qa_shots/brook_bank_mobile.png /tmp/qa_shots/jetty_regression_desktop.png \
   download/asset-qa/stage3-brook/ 2>/dev/null
echo "=== QA COMPLETE ==="
ls -la download/asset-qa/stage3-brook/
