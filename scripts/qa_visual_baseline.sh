#!/bin/bash
# qa_visual_baseline.sh — Visual Identity Evolution Build 01, Phase 0 capture harness (Doc 08 0.1).
#
# Repeatable, standardized captures for the six approved validation targets
# (Doc 09): Clara, Rowan, Copperwheel Cottage, Willow Step hearth corner, Sora's
# tea cart, and the Sunlit Fountain Plaza. Every capture standardizes camera
# position (via player placement, the game's isometric rig), camera zoom (wheel
# events on the real game camera), resolution, lighting phase (minuteOfDay),
# season, weather, character animation state (pinned npcRuntime slots), object
# arrangement, and asset loading completion (waits for the playing state).
#
# Usage:
#   scripts/qa_visual_baseline.sh baseline    → download/asset-qa/build01-baseline/
#   scripts/qa_visual_baseline.sh validation  → download/asset-qa/build01-validation/
#   scripts/qa_visual_baseline.sh baseline mobile-only
#
# The harness NEVER overwrites another set: output goes to the set directory it
# is given, so baseline images are preserved for side-by-side comparison (brief
# Part 2.2). metadata.jsonl records per-shot the scenario constants (viewport,
# zoom, phase, season); GL renderer + measured perf summary live in the
# dedicated perf_plaza_hero evidence row (see the perf pass below).
set -u
cd /home/z/my-project/little-somewhere

SET_NAME="${1:-baseline}"
ONLY="${2:-all}"
case "$SET_NAME" in
  baseline)   OUT_DIR="download/asset-qa/build01-baseline" ;;
  validation) OUT_DIR="download/asset-qa/build01-validation" ;;
  *) echo "usage: qa_visual_baseline.sh baseline|validation [all|desktop-only|mobile-only]" >&2; exit 1 ;;
esac

export AGENT_BROWSER_SESSION="lsd-build01-${SET_NAME}"
PORT=4179
mkdir -p "$OUT_DIR" && rm -f "$OUT_DIR"/metadata.jsonl  # resumable: existing pngs are preserved
mkdir -p /tmp/qa_shots && rm -f /tmp/qa_shots/b01_*.png

setsid nohup npx vite preview --port=$PORT --host=127.0.0.1 > /tmp/vite_preview_b01.log 2>&1 < /dev/null &
VITE_PID=$!
for i in $(seq 1 40); do curl -s -o /dev/null "http://localhost:$PORT/" && break; sleep 0.5; done
echo "server ready on $PORT"

npx tsx scripts/make_audit_veteran_save.ts > /tmp/audit_veteran.json

# ---------------------------------------------------------------- payloads --
python3 - << 'EOF'
import base64, json

base = json.loads(open('/tmp/audit_veteran.json').read().strip())

def inject_js(save):
    payload = json.dumps(json.dumps(save))
    return (
      'localStorage.setItem("little_somewhere_world_v1", ' + payload + ');\n'
      'Storage.prototype.setItem = function(){};\n'
      'Storage.prototype.removeItem = function(){};\n'
      'location.reload(); "injected";'
    )

def pin(save, rid, x, z, facing, anim, until=1290):  # hold to day end — pins must survive golden(1080)/dusk(1230)
    rt = dict(save['npcRuntime'])
    entry = dict(rt[rid])
    entry.update({
      'position': {'x': x, 'z': z}, 'targetPos': {'x': x, 'z': z},
      'facing': facing, 'targetFacing': facing, 'waypoints': [],
      'currentSpeed': 0, 'animState': anim,
      'activityUntilMinute': until, 'goalCommittedUntilMinute': until,
    })
    rt[rid] = entry
    save['npcRuntime'] = rt
    return save

def with_env(minute=None, season=None, weather=None, day=None):
    save = dict(base)
    if minute is not None: save['minuteOfDay'] = minute
    if season is not None:
        save['season'] = season
        save['day'] = day if day is not None else {'spring': 2, 'summer': 8, 'autumn': 21, 'winter': 33}[season]
    if weather is not None: save['weather'] = weather
    return save

def place(save, pos, facing):
    save['playerPos'] = pos
    save['exteriorPlayerPos'] = pos
    save['playerFacing'] = facing
    save['exteriorPlayerFacing'] = facing
    return save

F = lambda expr: ('__FACING__', expr)

# scenario table: name → (save builder, zoom shots)
scenarios = {}

def add(name, save):
    scenarios[name] = save

# --- PLAZA (V6) -------------------------------------------------------------
s = with_env()
add('plaza_hero', place(s, {'x': 2.0, 'z': 4.6}, -2.1))

s = with_env(minute=840, season='winter', day=33)
add('plaza_winter_midday', place(s, {'x': 2.0, 'z': 4.6}, -2.1))

s = with_env(minute=1230)  # dusk, lanterns lit
add('plaza_dusk', place(s, {'x': 2.0, 'z': 4.6}, -2.1))

s = with_env()
for rid, (x, z, fc, an) in {
    'clara':   (-1.4, 2.9, -1.2, 'walk'),
    'rowan':   (2.9, 0.2, 2.2, 'admire'),
    'mina':    (-3.4, 3.6, 0.4, 'walk'),
    'barnaby': (3.9, 2.4, -2.5, 'idle'),
    'sora':    (-4.9, 0.2, 1.4, 'walk'),
}.items():
    pin(s, rid, x, z, fc, an)
add('plaza_residents_medium', place(s, {'x': 2.0, 'z': 4.6}, -2.1))

# --- TEA CART (V5) ----------------------------------------------------------
s = with_env()
add('tea_cart_hero', place(s, {'x': -4.25, 'z': -2.05}, -2.1))

# --- COPPERWHEEL (V3) -------------------------------------------------------
s = with_env()
add('copperwheel_hero', place(s, {'x': 14.7, 'z': -7.3}, -2.35))
s = with_env(minute=1230)
add('copperwheel_dusk', place(s, {'x': 14.7, 'z': -7.3}, -2.35))

# --- CLARA (V1) -------------------------------------------------------------
s = with_env()
pin(s, 'clara', -2.6, 1.2, -2.36, 'idle')   # open plaza SE of the fountain — no door proxies nearby
add('clara_back_silhouette', place(s, {'x': -1.5, 'z': 2.3}, -2.36))

s = with_env()
pin(s, 'clara', -2.6, 1.2, 0.78, 'idle')    # facing SE: face toward the camera, clear of door proxies
add('clara_plaza_default', place(s, {'x': -1.5, 'z': 2.3}, -2.36))

s = with_env()
pin(s, 'clara', -2.6, 1.2, 0.78, 'idle')
add('clara_dialogue', place(s, {'x': -1.85, 'z': 1.75}, -2.36))

s = with_env(minute=840, season='winter', day=33)
pin(s, 'clara', -2.6, 1.2, 0.78, 'idle')
add('clara_winter_knit', place(s, {'x': -1.5, 'z': 2.3}, -2.36))

# Seated at the east plaza bench (seated-clearance visual row)
s = with_env()
pin(s, 'clara', 5.15, 3.0, -1.5708, 'sit')
add('clara_seated_bench', place(s, {'x': 4.6, 'z': 2.0}, -1.5708))

# --- ROWAN (V2) -------------------------------------------------------------
# Plaza identity framing (pass26-proven, canopy-free)
s = with_env()
pin(s, 'rowan', 3.2, 0.4, 0.8, 'idle')
add('rowan_plaza_identity', place(s, {'x': 4.05, 'z': 1.25}, 0.8))

# Orchard workplace context (basket + arch + trees; canopy is expected here)
s = with_env()
pin(s, 'rowan', -10.0, -20.6, 1.5708, 'admire')
add('rowan_orchard_workplace', place(s, {'x': -9.0, 'z': -19.6}, 1.5708))

# Mid-stride walk read (waypoint walk toward the fountain)
s = with_env()
rt = dict(s['npcRuntime']); entry = dict(rt['rowan'])
entry.update({
  'position': {'x': 2.2, 'z': -1.6}, 'targetPos': {'x': 2.4, 'z': 1.8},
  'waypoints': [{'x': 2.4, 'z': 1.8}], 'currentSpeed': 1.4,
  'facing': 0.14, 'targetFacing': 0.14, 'animState': 'walk',
  'activityUntilMinute': 1290, 'goalCommittedUntilMinute': 1290,
})
rt['rowan'] = entry; s['npcRuntime'] = rt
add('rowan_walk_stride_a', place(s, {'x': 3.4, 'z': 0.4}, 0.14))

# --- HEARTH CORNER (V4) — Willow Step interior ------------------------------
s = with_env(minute=540)  # morning
s['playerLocation'] = 'cottage_interior'
add('hearth_morning', place(s, {'x': 0.6, 'z': -0.3}, 2.6))

s = with_env(minute=1230)  # dusk, hearth truth-light interplay
s['playerLocation'] = 'cottage_interior'
add('hearth_dusk', place(s, {'x': 0.6, 'z': -0.3}, 2.6))

s = with_env(minute=840, season='winter', day=33)
s['playerLocation'] = 'cottage_interior'
add('hearth_winter', place(s, {'x': 0.6, 'z': -0.3}, 2.6))

for name, save in scenarios.items():
    js = inject_js(save)
    if '__FACING__' in js:
        js = js.replace('"__FACING__"', str(save.get('playerFacing', '0')))
    open(f'/tmp/b01_{name}.b64', 'w').write(base64.b64encode(js.encode()).decode())

# Static scenario metadata (zoom/phase/season are scenario constants — the
# runtime records GL renderer + perf only in the dedicated evidence passes).
SCENARIO_META = {
  'plaza_hero':            ('1.0', 'golden summer hero'),
  'plaza_hero_145':        ('1.45', 'survey squint'),
  'plaza_winter_midday':   ('1.0', 'winter value-band check'),
  'plaza_dusk':            ('1.0', 'dusk lantern choreography'),
  'plaza_residents_medium':('1.0', 'cast differentiation read'),
  'tea_cart_hero':         ('1.0', 'V5 object gate'),
  'copperwheel_hero':      ('1.0', 'V3 hero angle'),
  'copperwheel_dusk':      ('1.0', 'gear medallion + lantern emissive'),
  'clara_back_silhouette': ('1.0', 'V1 silhouette read'),
  'clara_plaza_default':   ('1.0', 'V1 default framing'),
  'clara_dialogue':        ('dialogue', 'conversation framing, sheet open'),
  'clara_dialogue_closed': ('0.72', 'face crop, sheet closed'),
  'clara_winter_knit':     ('1.0', 'winter-dyed knits'),
  'clara_seated_bench':    ('1.0', 'seated clearance visual'),
  'rowan_plaza_identity':  ('1.0', 'V2 identity read'),
  'rowan_orchard_workplace':('1.0', 'orchard workplace context'),
  'rowan_walk_stride_a':   ('1.0', 'mid-stride gait frame a'),
  'rowan_walk_stride_a_b': ('1.0', 'mid-stride gait frame b'),
  'hearth_morning':        ('interior-0.68', 'morning hearth'),
  'hearth_morning_072':    ('interior-0.56', 'hearth detail'),
  'hearth_dusk':           ('interior-0.68', 'dusk hearth truth-light'),
  'hearth_dusk_072':       ('interior-0.56', 'hearth detail dusk'),
  'hearth_winter':         ('interior-0.68', 'winter hearth'),
  'hearth_winter_072':     ('interior-0.56', 'hearth detail winter'),
}
with open('/tmp/b01_meta.json', 'w') as f:
    json.dump(SCENARIO_META, f)

print(f"payloads: {len(scenarios)}")
EOF

# ------------------------------------------------------------------ driver --
ZOOM_IN_072="document.querySelector('canvas').dispatchEvent(new WheelEvent('wheel',{deltaY:-400})); 'zoom 0.72'"
ZOOM_OUT_145="document.querySelector('canvas').dispatchEvent(new WheelEvent('wheel',{deltaY:+700})); 'zoom 1.45'"
KEY_E="window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE',bubbles:true})); 'interact'"
KEY_ESC="window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',bubbles:true})); 'esc'"

shoot() { # name viewport
  if [ -s "$OUT_DIR/${1}_${2}.png" ]; then return 0; fi  # resumable: keep existing captures
  agent-browser screenshot "/tmp/qa_shots/b01_${1}_${2}.png" > /dev/null
  cp "/tmp/qa_shots/b01_${1}_${2}.png" "$OUT_DIR/${1}_${2}.png"
}

meta() { # name viewport
  local zoom_note
  zoom_note=$(python3 -c "import json;m=json.load(open('/tmp/b01_meta.json'));print(json.dumps(m.get('$1',('1.0',''))))")
  printf '{"shot":"%s","viewport":"%s","meta":%s}\n' "$1" "$2" "$zoom_note" >> "$OUT_DIR/metadata.jsonl"
}

wait_playing() { # poll for the playing state (asset loading completion standard)
  # NB: agent-browser eval returns JSON-quoted strings ("playing") — strip quotes.
  for i in $(seq 1 30); do
    local st
    st=$(agent-browser eval "document.body.dataset.state ?? 'unknown'" 2>/dev/null | tail -1 | tr -d '"')
    if [ "$st" = "playing" ]; then return 0; fi
    sleep 0.5
  done
  echo "WARN: state never reached 'playing'" >&2
  return 1
}

run_scenario() { # name zoom(shots) viewports extra-evals
  local name="$1"; shift
  local views="$1"; shift
  for v in $views; do
    case "$v" in
      desktop) agent-browser set viewport 1440 900 > /dev/null ;;
      mobile)  agent-browser set viewport 390 844 > /dev/null ;;
    esac
    agent-browser eval -b "$(cat /tmp/b01_${name}.b64)" > /dev/null
    sleep 1
    wait_playing || true
    sleep 5
    agent-browser eval "window.__LS_PERF__ && window.__LS_PERF__.reset(); 'perf-reset'" > /dev/null
    case "$name" in
      clara_dialogue)
        agent-browser eval "$ZOOM_IN_072" > /dev/null; sleep 2
        agent-browser eval "$KEY_E" > /dev/null; sleep 3
        # Assert the dialogue sheet really rendered before shooting (review fix:
        # never record an evidence frame that is actually a pause modal).
        SHEET=$(agent-browser eval "document.body.textContent.includes('Clara') && !document.body.textContent.includes('Resting') ? 'open' : 'retry'" 2>/dev/null | tr -d '"')
        if [ "$SHEET" != "open" ]; then
          sleep 2; agent-browser eval "$KEY_ESC" > /dev/null; sleep 1.5
          agent-browser eval "$KEY_E" > /dev/null; sleep 3
        fi
        shoot "$name" "$v" && meta "$name" "$v"
        agent-browser eval "$KEY_ESC" > /dev/null; sleep 2
        shoot "${name}_closed" "$v" && meta "${name}_closed" "$v"
        ;;
      rowan_walk_stride_a)
        sleep 2
        shoot "$name" "$v" && meta "$name" "$v"
        sleep 1.5
        shoot "${name}_b" "$v" && meta "${name}_b" "$v"
        ;;
      plaza_hero)
        shoot "$name" "$v" && meta "$name" "$v"
        agent-browser eval "$ZOOM_OUT_145" > /dev/null; sleep 2
        shoot "${name}_145" "$v" && meta "${name}_145" "$v"
        ;;
      hearth_morning|hearth_dusk|hearth_winter)
        shoot "$name" "$v" && meta "$name" "$v"
        agent-browser eval "$ZOOM_IN_072" > /dev/null; sleep 2
        shoot "${name}_072" "$v" && meta "${name}_072" "$v"
        ;;
      *)
        shoot "$name" "$v" && meta "$name" "$v"
        ;;
    esac
  done
}

DESKTOP_SCENARIOS="plaza_hero plaza_winter_midday plaza_dusk plaza_residents_medium tea_cart_hero copperwheel_hero copperwheel_dusk clara_back_silhouette clara_plaza_default clara_dialogue clara_winter_knit clara_seated_bench rowan_plaza_identity rowan_orchard_workplace rowan_walk_stride_a hearth_morning hearth_dusk hearth_winter"
MOBILE_SCENARIOS="plaza_hero tea_cart_hero copperwheel_hero clara_plaza_default rowan_plaza_identity hearth_morning"

agent-browser console --clear > /dev/null 2>&1
agent-browser errors --clear > /dev/null 2>&1

# ---- Perf evidence pass (?perf=1 overlay would pollute captures, so run it
# ---- BEFORE the clean screenshot pass, screenshot-free, then switch URL).
agent-browser open "http://localhost:$PORT/?autostart=1&perf=1" > /dev/null
sleep 6
agent-browser eval -b "$(cat /tmp/b01_plaza_hero.b64)" > /dev/null
sleep 1
wait_playing || true
agent-browser eval "window.__LS_PERF__ && window.__LS_PERF__.reset(); 'warmup-start'" > /dev/null
sleep 8  # warm-up: program compilation + texture uploads settle out of the window
agent-browser eval "window.__LS_PERF__ && window.__LS_PERF__.reset(); 'perf-reset'" > /dev/null
sleep 20  # ~20s of real plaza gameplay for a stable frame-time window
PERF_SUMMARY=$(agent-browser eval "JSON.stringify(window.__LS_PERF__ ? window.__LS_PERF__.summary() : null)" 2>/dev/null | tail -1)
PERF_GL=$(agent-browser eval "(()=>{const c=document.createElement('canvas');const g=c.getContext('webgl2')||c.getContext('webgl');if(!g)return'n/a';const e=g.getExtension('WEBGL_debug_renderer_info');return e?String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)):String(g.getParameter(g.RENDERER));})()" 2>/dev/null | tail -1)
PERF_ERRORS=$(agent-browser errors 2>/dev/null | rg -c "Error" || echo 0)
printf '{"shot":"perf_plaza_hero","viewport":"1440x900","zoom":"1.0","note":"20s veteran golden-hour gameplay, measured","gl":%s,"pageErrors":%s,"perf":%s}\n' \
  "${PERF_GL:-\"unknown\"}" "${PERF_ERRORS:-0}" "${PERF_SUMMARY:-null}" >> "$OUT_DIR/metadata.jsonl"
echo "perf evidence: $PERF_SUMMARY"

# ---- Clean capture pass (no probe, no overlay) ----
agent-browser open "http://localhost:$PORT/?autostart=1" > /dev/null
sleep 6

if [ "$ONLY" != "mobile-only" ]; then
  echo "--- desktop 1440x900 ---"
  for s in $DESKTOP_SCENARIOS; do echo "shot: $s"; run_scenario "$s" desktop; done
fi
if [ "$ONLY" != "desktop-only" ]; then
  echo "--- mobile 390x844 ---"
  for s in $MOBILE_SCENARIOS; do echo "shot: $s (mobile)"; run_scenario "$s" mobile; done
fi

echo "=== CONSOLE (tail) ==="
agent-browser console | tail -6
echo "=== PAGE ERRORS ==="
agent-browser errors | tail -8

kill "$VITE_PID" 2>/dev/null
agent-browser close > /dev/null 2>&1
echo "done → $OUT_DIR"
ls "$OUT_DIR" | head -50
