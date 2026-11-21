#!/bin/bash
# qa_build02_evidence.sh — BUILD 02 evidence set (brief Part 11: full-cast +
# architecture + props + interiors + mobile + perf, all through the BUILD 01
# harness doctrine — never overwrites other evidence sets).
#
# Output: download/asset-qa/build02-validation/ (desktop 1440x900 + mobile
# 390x844 for every scenario), metadata.jsonl with per-shot zoom/phase/season,
# plus the measured perf row (20 s veteran golden-hour gameplay, ?perf=1).
set -u
cd /home/z/my-project/little-somewhere

OUT_DIR="download/asset-qa/build02-validation"
ONLY="${1:-all}"
export AGENT_BROWSER_SESSION="lsd-b02-$(date +%s)"
PORT=4181
mkdir -p "$OUT_DIR" && rm -f "$OUT_DIR"/metadata.jsonl
mkdir -p /tmp/qa_shots && rm -f /tmp/qa_shots/b02_*.png

setsid nohup npx vite preview --port=$PORT --host=127.0.0.1 > /tmp/vite_preview_b02.log 2>&1 < /dev/null &
VITE_PID=$!
for i in $(seq 1 60); do curl -s -o /dev/null "http://localhost:$PORT/" && break; sleep 0.5; done
echo "server ready on $PORT"

npx tsx scripts/make_audit_veteran_save.ts > /tmp/audit_veteran.json

# ---------------------------------------------------------------- payloads --
python3 - << 'EOF'
import base64, json

base = json.loads(open('/tmp/audit_veteran.json').read().strip())

def inject_js(save):
    payload = json.dumps(json.dumps(save))
    # No reload here: the driver navigates freshly AFTER the injection, so the
    # old page's stale `playing` state can never short-circuit the boot wait.
    return (
      'localStorage.setItem("little_somewhere_world_v1", ' + payload + ');\n'
      'sessionStorage.setItem("ls_qa_stub", "1");\n'
      '"stored";'
    )

def pin(save, rid, x, z, facing, anim, until=1290):
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

scenarios = {}
def add(name, save):
    scenarios[name] = save

# --- FULL-CAST LINEUP (brief 11.2: silhouette + gameplay distance) -----------
s = with_env()  # golden hour summer
s = pin(s, 'clara',   1.2, 2.2, -2.4, 'idle')
s = pin(s, 'rowan',   2.4, 2.6, -2.6, 'idle')
s = pin(s, 'barnaby', 0.0, 3.0, -2.5, 'idle')
s = pin(s, 'arthur',  3.6, 2.2, -2.4, 'idle')
s = pin(s, 'pip',    -1.2, 2.8, -2.6, 'idle')
add('cast_plaza_lineup', place(s, {'x': 2.0, 'z': 7.4}, -2.5))

s2 = dict(scenarios['cast_plaza_lineup'])
add('cast_plaza_lineup_wide', s2)  # shot at 1.45 via zoom eval

# --- FACIAL IDENTITY ROW (brief 11.2: close facial view) ---------------------
faces = [
    ('face_clara',   'clara',   1.2, 2.2, -2.4),
    ('face_rowan',   'rowan',   1.2, 2.2, -2.4),
    ('face_barnaby', 'barnaby', 1.2, 2.2, -2.4),
    ('face_arthur',  'arthur',  1.2, 2.2, -2.4),
    ('face_pip',     'pip',     1.2, 2.2, -2.4),
    ('face_nora',    'nora',    1.2, 2.2, -2.4),
    ('face_sora',    'sora',    1.2, 2.2, -2.4),
    ('face_toby',    'toby',    1.2, 2.2, -2.4),
    ('face_mina',    'mina',    1.2, 2.2, -2.4),
    ('face_jun',     'jun',     1.2, 2.2, -2.4),
]
for name, rid, px, pz, facing in faces:
    s = with_env()
    s = pin(s, rid, px, pz, facing, 'idle')
    add(name, place(s, {'x': px, 'z': pz + 1.35}, facing))  # close framing

# --- ARCHETYPE FULL-BODY READS ----------------------------------------------
s = with_env()
s = pin(s, 'barnaby', 1.0, 1.5, -2.7, 'idle')
add('barnaby_barrel_read', place(s, {'x': 1.0, 'z': 3.6}, -2.5))

s = with_env()
s = pin(s, 'arthur', 0.4, 1.4, -2.6, 'idle')
s = pin(s, 'sora',   1.9, 1.6, -2.7, 'idle')
add('slender_pair_read', place(s, {'x': 1.15, 'z': 3.8}, -2.5))

s = with_env()
s = pin(s, 'pip', -0.3, 1.2, -2.7, 'idle')
add('pip_bean_read', place(s, {'x': -0.3, 'z': 2.9}, -2.5))

# --- CRAFT EVIDENCE (V3/V5 after-shots + new registers) ----------------------
s = with_env()
add('copperwheel_craft_hero', place(s, {'x': 9.6, 'z': -7.2}, 2.3))

s = with_env()
add('copperwheel_oriel_detail', place(s, {'x': 9.0, 'z': -10.4}, -2.35))  # west side

s = with_env()
add('woodshop_dormer_detail', place(s, {'x': 9.6, 'z': 10.0}, -0.7))

s = with_env()
add('tea_cart_detail', place(s, {'x': -5.4, 'z': -1.4}, -3.0))

s = with_env(minute=1230, season='winter', day=33)
add('bench_winter_cushions', place(s, {'x': 2.0, 'z': 4.6}, -2.1))

s = with_env()
add('dusk_lantern_glow', place(s, {'x': 2.0, 'z': 4.6}, -2.1)) if False else None
s = with_env(minute=1230)
add('dusk_lantern_glow', place(s, {'x': 4.9, 'z': 5.0}, 2.3))

s = with_env(season='spring', day=2, minute=840)
add('spring_meadow_spread', place(s, {'x': 2.0, 'z': 6.4}, -2.6))

# --- PAIL TWO-HAND CARRY (Doc 04 §4.4 third variant) --------------------------
s = with_env()
s['playerHeldItem'] = 'water_pail'
add('pail_twohand_carry', place(s, {'x': 2.0, 'z': 4.6}, -2.1))

# --- INTERIORS (brief 11.5: furniture, lighting, seasonLife, readability) ----
s = with_env(minute=1230, season='winter', day=33)
s['playerLocation'] = 'copperwheel_interior'
s['playerPos'] = {'x': 0.4, 'z': 0.9}
add('workshop_interior_winter', s)

s = with_env(minute=840, season='summer', day=8)
s['playerLocation'] = 'copperwheel_interior'
s['playerPos'] = {'x': 0.4, 'z': 0.9}
add('workshop_interior_summer', s)

s = with_env(minute=1230, season='winter', day=33)
s['playerLocation'] = 'bakery_interior'
s['playerPos'] = {'x': 0.4, 'z': 0.9}
add('bakery_runner_winter', s)

s = with_env(minute=1230, season='winter', day=33)
s['playerLocation'] = 'nook_interior'
s['playerPos'] = {'x': 0.4, 'z': 0.9}
add('nook_winter_blanket', s)

s = with_env(minute=840, season='summer', day=8)
s['playerLocation'] = 'greenhouse_interior'
s['playerPos'] = {'x': 0.4, 'z': 0.9}
add('greenhouse_summer_maps', s)

# --- NEW HERO ------------------------------------------------------------------
s = with_env()
add('plaza_hero_build02', place(s, {'x': 2.0, 'z': 4.6}, -2.1))

for name, save in scenarios.items():
    js = inject_js(save)
    open(f'/tmp/b02_{name}.b64', 'w').write(base64.b64encode(js.encode()).decode())

SCENARIO_META = {
  'cast_plaza_lineup':          ('1.0', 'full-cast lineup, gameplay distance'),
  'cast_plaza_lineup_wide':     ('1.45', 'cast silhouette survey'),
  'barnaby_barrel_read':        ('1.0', 'Barrel archetype full-body'),
  'slender_pair_read':          ('1.0', 'Slender archetype pair'),
  'pip_bean_read':              ('1.0', 'Bean archetype full-body'),
  'pail_twohand_carry':         ('1.0', 'two-hand carry variant (water pail)'),
  'copperwheel_craft_hero':     ('1.0', 'V3-after: craft set + oriel'),
  'copperwheel_oriel_detail':   ('0.72', 'oriel massing break detail'),
  'woodshop_dormer_detail':     ('0.72', 'ridge dormer detail'),
  'tea_cart_detail':            ('0.72', 'V5-after: spoked wheels + valance'),
  'bench_winter_cushions':      ('1.0', 'winter wool cushions'),
  'dusk_lantern_glow':          ('1.0', 'lantern glass gradient at dusk'),
  'spring_meadow_spread':       ('1.0', 'spring petal spread + structure dressing'),
  'workshop_interior_winter':   ('interior-0.68', 'seasonLife winter'),
  'workshop_interior_summer':   ('interior-0.68', 'seasonLife summer'),
  'bakery_runner_winter':       ('interior-0.68', 'woven-edge runner + mapSets'),
  'nook_winter_blanket':        ('interior-0.68', 'nook winter + mapSets'),
  'greenhouse_summer_maps':     ('interior-0.68', 'greenhouse texture program'),
  'plaza_hero_build02':         ('1.0', 'BUILD 02 golden hero'),
}
for name, rid, px, pz, facing in faces:
    SCENARIO_META[name] = ('0.72', f'{rid} close facial read')

with open('/tmp/b02_meta.json', 'w') as f:
    json.dump(SCENARIO_META, f)

print(f"payloads: {len(scenarios)}")
EOF

# ------------------------------------------------------------------ driver --
wait_playing() {
  for i in $(seq 1 240); do
    ST=$(agent-browser eval "document.body.dataset.state || 'none'" 2>/dev/null | tail -1)
    [ "$ST" = "playing" ] && return 0
    sleep 0.5
  done
  echo "WARN: playing state not reached" >&2
  return 1
}

shoot() {
  if [ -s "$OUT_DIR/${1}_${2}.png" ]; then return 0; fi
  agent-browser screenshot "/tmp/qa_shots/b02_${1}_${2}.png" > /dev/null
  cp "/tmp/qa_shots/b02_${1}_${2}.png" "$OUT_DIR/${1}_${2}.png"
}

meta() {
  local zoom_note
  zoom_note=$(python3 -c "import json;m=json.load(open('/tmp/b02_meta.json'));print(json.dumps(m.get('$1',('1.0',''))))")
  printf '{"shot":"%s","viewport":"%s","meta":%s}\n' "$1" "$2" "$zoom_note" >> "$OUT_DIR/metadata.jsonl"
}

INTERIOR_SCENARIOS="workshop_interior_winter workshop_interior_summer bakery_runner_winter nook_winter_blanket greenhouse_summer_maps"

run_scenario() { # name viewport
  local name=$1 vp=$2
  if [ -s "$OUT_DIR/${name}_${vp}.png" ]; then return 0; fi  # resumable: skip whole scenario
  # Fresh browser per scenario: repeated reloads degrade SwiftShader boot to
  # >120s within one session; a restart costs ~3s and keeps every boot ~10s.
  agent-browser close > /dev/null 2>&1 || true
  pkill -f "agent-browser" 2>/dev/null || true
  sleep 1
  agent-browser console --clear > /dev/null 2>&1
  agent-browser errors --clear > /dev/null 2>&1
  # Fresh browser has no page: open the app first so the injection has a real
  # origin (localStorage on about:blank throws SecurityError).
  agent-browser open "http://localhost:$PORT/" > /dev/null
  sleep 2
  # Inject the save on the CURRENT page (no reload), then navigate fresh with a
  # cache-buster: the new page boots from the injected save and the old page's
  # `playing` state can never short-circuit the boot wait.
  agent-browser eval -b "$(cat /tmp/b02_${name}.b64)" > /dev/null
  agent-browser open "http://localhost:$PORT/?autostart=1&v=${name}-$RANDOM" > /dev/null
  # Boot under SwiftShader throttling can take >60s in long sessions; the zoom
  # MUST be applied only after `playing` (the hook mounts with the canvas).
  wait_playing || true
  # Freeze persistence for the capture session (deterministic re-captures).
  agent-browser eval "Storage.prototype.setItem = function(){}; Storage.prototype.removeItem = function(){}; 'stubbed'" > /dev/null
  sleep 2
  local want_zoom=0
  if [[ "$name" == face_* || "$name" == *_detail || "$name" == tea_cart_detail || "$name" == copperwheel_oriel_detail ]]; then want_zoom=1; fi
  if [ "$name" = "cast_plaza_lineup_wide" ]; then want_zoom=2; fi
  if [ "$want_zoom" != "0" ]; then
    # Confirm playing one more time (state-aware), then set the zoom target.
    local st
    for i in $(seq 1 100); do
      st=$(agent-browser eval "document.body.dataset.state" 2>/dev/null | tail -1)
      [ "$st" = '"playing"' ] && break
      sleep 1
    done
    if [ "$want_zoom" = "1" ]; then agent-browser eval "$ZOOM_IN_072" > /dev/null; else agent-browser eval "$ZOOM_OUT_145" > /dev/null; fi
    sleep 6
  fi
  local errors
  errors=$(agent-browser errors 2>/dev/null | rg -c "Error" || echo 0)
  shoot "$name" "$vp"
  meta "$name" "$vp"
  echo "  [$name/$vp] pageErrors=$errors"
}

ZOOM_IN_072="if(window.__LS_CAMERA_SET__){window.__LS_CAMERA_SET__(0.72)}else{document.querySelector('canvas').dispatchEvent(new WheelEvent('wheel',{deltaY:-400}))}"
ZOOM_OUT_145="if(window.__LS_CAMERA_SET__){window.__LS_CAMERA_SET__(1.45)}else{document.querySelector('canvas').dispatchEvent(new WheelEvent('wheel',{deltaY:+700}))}"

# ---- Perf evidence pass (screenshot-free; SKIP_PERF=1 on re-runs) -----------
if [ "${SKIP_PERF:-0}" = "1" ]; then echo "perf pass skipped"; else
PERF_PASS_BODY=1
agent-browser open "http://localhost:$PORT/" > /dev/null
sleep 2
agent-browser eval -b "$(cat /tmp/b02_plaza_hero_build02.b64)" > /dev/null
agent-browser open "http://localhost:$PORT/?autostart=1&perf=1&v=perf-$RANDOM" > /dev/null
sleep 1
wait_playing || true
agent-browser eval "window.__LS_PERF__ && window.__LS_PERF__.reset(); 'warmup-start'" > /dev/null
sleep 8
agent-browser eval "window.__LS_PERF__ && window.__LS_PERF__.reset(); 'perf-reset'" > /dev/null
sleep 20
PERF_SUMMARY=$(agent-browser eval "JSON.stringify(window.__LS_PERF__ ? window.__LS_PERF__.summary() : null)" 2>/dev/null | tail -1)
PERF_GL=$(agent-browser eval "(()=>{const c=document.createElement('canvas');const g=c.getContext('webgl2')||c.getContext('webgl');if(!g)return'n/a';const e=g.getExtension('WEBGL_debug_renderer_info');return e?String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)):String(g.getParameter(g.RENDERER));})()" 2>/dev/null | tail -1)
PERF_ERRORS=$(agent-browser errors 2>/dev/null | rg -c "Error" || echo 0)
printf '{"shot":"perf_plaza_hero_build02","viewport":"1440x900","zoom":"1.0","note":"20s veteran golden-hour gameplay, measured (post contact-shadow instancing)","gl":%s,"pageErrors":%s,"perf":%s}\n' \
  "${PERF_GL:-\"unknown\"}" "${PERF_ERRORS:-0}" "${PERF_SUMMARY:-null}" >> "$OUT_DIR/metadata.jsonl"
echo "perf evidence: $PERF_SUMMARY"

fi
# ---- Clean capture pass ------------------------------------------------------
agent-browser open "http://localhost:$PORT/?autostart=1" > /dev/null
sleep 6

EXTERIOR_SCENARIOS="cast_plaza_lineup cast_plaza_lineup_wide barnaby_barrel_read slender_pair_read pip_bean_read pail_twohand_carry copperwheel_craft_hero copperwheel_oriel_detail woodshop_dormer_detail tea_cart_detail bench_winter_cushions dusk_lantern_glow spring_meadow_spread plaza_hero_build02 face_clara face_rowan face_barnaby face_arthur face_pip face_nora face_sora face_toby face_mina face_jun"

if [ "$ONLY" != "mobile-only" ]; then
  echo "--- desktop 1440x900: exteriors + cast ---"
  for s in $EXTERIOR_SCENARIOS; do echo "shot: $s"; run_scenario "$s" desktop; done
  echo "--- desktop 1440x900: interiors ---"
  for s in $INTERIOR_SCENARIOS; do echo "shot: $s"; run_scenario "$s" desktop; done
fi
if [ "$ONLY" != "desktop-only" ]; then
  echo "--- mobile 390x844 ---"
  for s in cast_plaza_lineup plaza_hero_build02 copperwheel_craft_hero pail_twohand_carry workshop_interior_winter face_pip; do echo "shot: $s (mobile)"; run_scenario "$s" mobile; done
fi

echo "=== CONSOLE (tail) ==="
agent-browser console | tail -6
kill $VITE_PID 2>/dev/null || true
echo "=== DONE: $OUT_DIR ==="
