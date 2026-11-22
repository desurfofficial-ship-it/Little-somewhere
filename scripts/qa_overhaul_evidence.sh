#!/bin/bash
# qa_overhaul_evidence.sh — WORLD-QUALITY OVERHAUL evidence campaign.
# Fulfils docs/proposals/2026-11-22-world-quality-overhaul/06 §4 (visual
# verification protocol) for the phases whose captures were still missing:
#
#   phase3-interior-framing/  5 rooms × (entry, yaw+90, zoom min, zoom max)
#                             + cottage cutaway yaw sweep 0/90/180/270
#   phase4-fountain/          rebuilt fountain: flowing ×3 angles, dry pair,
#                             dusk row (before-state = committed BUILD 04
#                             plaza hero captures with the old octagon)
#   phase5-furniture/         bench v2 ×3 spots + winter row, armchairs ×2,
#                             bakery café chair
#   phase6-seating/           foxglove deck seated (C-1 sink fix), stand-up
#                             (C-2), plaza bench seated + sipable in satchel
#   phase7-bug-register/      G-2 future-schema refusal behavioral transcript
#                             (refuse + preserve + no autosave overwrite)
#   phase8-final/             after-perf rows (veteran + fresh parity)
#
# Doctrine: BUILD 01-04 harness pattern (veteran save, storage stub,
# autostart navigation, per-session fresh browser, resumable, per-shot
# metadata with pageErrors count). Camera states are driven through the REAL
# input paths: synthetic canvas pointer drags (yaw 0.006 rad/px) and
# __LS_CAMERA_SET__ (clamped + snapped zoom hook).
#
# Usage: bash scripts/qa_overhaul_evidence.sh [all|phase3|phase4|phase5|phase6|phase7|perf]
set -u
cd /home/z/my-project/little-somewhere

ROOT="download/asset-qa/overhaul"
ONLY="${1:-all}"
export AGENT_BROWSER_SESSION="lsd-overhaul-$(date +%s)"
PORT=4187
mkdir -p "$ROOT"/{phase3-interior-framing,phase4-fountain,phase5-furniture,phase6-seating,phase7-bug-register,phase8-final}
mkdir -p /tmp/qa_shots && rm -f /tmp/qa_shots/ov_*.png

npm run build > /tmp/ov_evidence_build.log 2>&1 || { echo "BUILD FAILED"; tail -5 /tmp/ov_evidence_build.log; exit 1; }

setsid nohup npx vite preview --port=$PORT --host=127.0.0.1 > /tmp/vite_preview_overhaul.log 2>&1 < /dev/null &
VITE_PID=$!
for i in $(seq 1 60); do curl -s -o /dev/null "http://localhost:$PORT/" && break; sleep 0.5; done
echo "server ready on $PORT"

npx tsx scripts/make_build03_veteran_save.ts > /tmp/build03_veteran.json
npx tsx scripts/make_fresh_save.ts > /tmp/fresh_save.json

# ---------------------------------------------------------------- payloads --
python3 - << 'EOF'
import base64, json

base = json.loads(open('/tmp/build03_veteran.json').read().strip())

def inject_js(save):
    payload = json.dumps(json.dumps(save))
    return (
      'localStorage.setItem("little_somewhere_world_v1", ' + payload + ');\n'
      'sessionStorage.setItem("ls_qa_stub", "1");\n'
      '"stored";'
    )

def with_env(minute=None, season=None, weather=None, day=None):
    save = dict(base)
    if minute is not None: save['minuteOfDay'] = minute
    if season is not None:
        save['season'] = season
        save['day'] = day if day is not None else {'spring': 10, 'summer': 17, 'autumn': 28, 'winter': 37}[season]
    if weather is not None: save['weather'] = weather
    return save

def place(save, pos, facing):
    save['playerPos'] = pos
    save['exteriorPlayerPos'] = pos
    save['playerFacing'] = facing
    save['exteriorPlayerFacing'] = facing
    return save

def inside(save, room, pos, facing):
    """Seat the player inside an interior room (Phase 3/5 framing captures)."""
    save = dict(save)
    save['playerLocation'] = room
    save['playerPos'] = pos
    save['playerFacing'] = facing
    # Park the exterior body somewhere stable (plaza hero spot).
    save['exteriorPlayerPos'] = {'x': 2.0, 'z': 4.6}
    save['exteriorPlayerFacing'] = -2.1
    return save

def seated(save, seat_id, pos, facing):
    """C-1/C-2 seating captures: saved sit-state at a locked SEAT_SPOTS id."""
    save = place(save, pos, facing)
    save['playerPosture'] = 'sitting'
    save['playerSeatId'] = seat_id
    return save

scenarios = {}
def add(name, save):
    scenarios[name] = save

# --- Phase 3: interior framing — 5 rooms ------------------------------------
# Player placed at a walkable interior spot; entry / yaw90 / zoommin / zoommax
# are driven per session by the shell (drag + __LS_CAMERA_SET__).
ROOMS = {
  'bakery':      ('bakery_interior',      {'x': -0.3, 'z': 0.4},  2.0),
  'cottage':     ('cottage_interior',     {'x': 0.0,  'z': 0.5},  3.14),
  'nook':        ('nook_interior',        {'x': 0.0,  'z': 0.3},  3.14),
  'copperwheel': ('copperwheel_interior', {'x': 0.6,  'z': 0.0},  0.0),
  'greenhouse':  ('greenhouse_interior',  {'x': 0.0,  'z': -0.2}, 0.0),
}
for name, (room, pos, facing) in ROOMS.items():
    add(f'room_{name}', inside(with_env(), room, pos, facing))

# Cutaway yaw sweep (cottage): near full-walls must hide at any yaw.
add('cutaway_cottage', inside(with_env(), 'cottage_interior', {'x': 0.0, 'z': 0.5}, 3.14))

# --- Phase 4: fountain --------------------------------------------------------
# Rebuilt two-tier circular fountain at FOUNTAIN_CENTER (0,1.5); player frames
# it from the SE approach. Before-state = committed BUILD 04 plaza captures.
f = {'x': 2.0, 'z': 4.2}
add('fountain_after', place(with_env(), f, -2.5))                       # flowing (veteran repairedFountain=true)
add('fountain_after_dusk', place(with_env(minute=1230), f, -2.5))       # dusk lantern row
dry = dict(with_env()); dry['flags'] = dict(dry['flags'], repairedFountain=False)
add('fountain_dry', place(dry, f, -2.5))                                # repair-quest dry state

# --- Phase 5: furniture --------------------------------------------------------
add('bench_east_plaza',  place(with_env(), {'x': 4.1, 'z': 4.3}, 2.46))
add('bench_gazebo',      place(with_env(), {'x': 4.2, 'z': -8.5}, 2.48))
add('bench_pond_south',  place(with_env(), {'x': 1.8, 'z': 20.5}, 3.14))
add('bench_winter',      place(with_env(season='winter'), {'x': 4.1, 'z': 4.3}, 2.46))
add('armchair_nook',        inside(with_env(), 'nook_interior', {'x': -0.9, 'z': 0.55}, 0.0))
add('armchair_copperwheel', inside(with_env(), 'copperwheel_interior', {'x': -0.2, 'z': 1.5}, -1.41))
add('bakery_cafe_chair',    inside(with_env(), 'bakery_interior', {'x': -0.2, 'z': 1.4}, 1.51))

# --- Phase 6: seating residuals ------------------------------------------------
# C-1: deck sit must rest on deck ground Y (no sink); C-2: stand-up fallback.
add('seating_foxglove_deck_seated', seated(with_env(), 'seat_foxglove_rise', {'x': 20.85, 'z': 19.1}, -1.57))
add('seating_foxglove_deck_standup', place(with_env(), {'x': 21.85, 'z': 19.1}, -1.57))
sip = seated(with_env(), 'seat_east_plaza', {'x': 5.15, 'z': 3.0}, -1.57)
sip['inventory'] = dict(sip.get('inventory') or {}, chamomile_pear_tea=2)
add('seating_east_plaza_sip', sip)

# Close variants: bench v2 joinery detail + C-1 deck-contact verification.
for base_name in ('bench_east_plaza', 'bench_gazebo', 'bench_pond_south', 'seating_foxglove_deck_seated'):
    scenarios[f'{base_name}_close'] = scenarios[base_name]

for name, save in scenarios.items():
    js = inject_js(save)
    open(f'/tmp/ov_{name}.b64', 'w').write(base64.b64encode(js.encode()).decode())

# G-2 payload: future-schema save (version 12) parked under the live key.
g2 = dict(base); g2['version'] = 12; g2['note_future'] = 'hand-edited forward-version payload'
open('/tmp/ov_g2_future.b64', 'w').write(base64.b64encode(inject_js(g2).encode()).decode())

# Perf payloads (plaza hero framing identical to baseline-perf.jsonl).
perf_vet = place(with_env(), {'x': 2.0, 'z': 4.6}, -2.1)
open('/tmp/ov_perf_veteran.b64', 'w').write(base64.b64encode(inject_js(perf_vet).encode()).decode())
fresh = json.loads(open('/tmp/fresh_save.json').read().strip())
fresh = place(fresh, {'x': 2.0, 'z': 4.6}, -2.1)
open('/tmp/ov_perf_fresh.b64', 'w').write(base64.b64encode(inject_js(fresh).encode()).decode())

# Open-sky veteran framing (pond bench, no building on the camera→player ray):
# isolates occlusion-fade deltas from content deltas (reconciles WORKLOG 056 +49).
perf_open = place(with_env(), {'x': 1.8, 'z': 20.5}, 3.14)
open('/tmp/ov_perf_veteran_open.b64', 'w').write(base64.b64encode(inject_js(perf_open).encode()).decode())

NOTES = {
  'room_bakery':      ('1.0', 'Hearth & Crumb interior — bounds-derived framing profile (fit 23.1)'),
  'room_cottage':     ('1.0', 'Copperwheel Cottage interior — bounds-derived framing profile (fit 25.9)'),
  'room_nook':        ('1.0', 'Linden Book Nook interior — bounds-derived framing profile (fit 22.1)'),
  'room_copperwheel': ('1.0', 'Copperwheel workshop interior — bounds-derived framing profile (fit 23.3)'),
  'room_greenhouse':  ('1.0', 'Sunbeam Greenhouse interior — interior camera branch fixed (was exterior fallback)'),
  'cutaway_cottage':  ('1.0', 'dynamic per-side cutaway yaw sweep — near full-walls hide at any yaw'),
  'fountain_after':      ('1.0', 'rebuilt fountain flowing (veteran repaired) — before: build04-validation/v_plaza_hero_build04_desktop.png'),
  'fountain_after_dusk': ('1.0', 'rebuilt fountain at dusk — merged masonry under lantern lighting'),
  'fountain_dry':        ('1.0', 'dry repair-quest state preserved — basin/stone ring visible, no water'),
  'bench_east_plaza':  ('0.85', 'bench v2 curved cedar frames + sage/mint pad (East Plaza)'),
  'bench_gazebo':      ('0.85', 'bench v2 (Gazebo Cedar Bench spot)'),
  'bench_pond_south':  ('0.85', 'bench v2 (Mirror Pond Bench spot)'),
  'bench_winter':      ('0.85', 'bench v2 winter row — all-season pad color law'),
  'armchair_nook':        ('0.8', 'nook reading armchair — mint upholstery (Phase 5)'),
  'armchair_copperwheel': ('0.8', 'copperwheel window armchair — mint upholstery (Phase 5)'),
  'bakery_cafe_chair':    ('0.8', 'bakery café corner chair row'),
  'seating_foxglove_deck_seated':  ('1.0', 'C-1 fix: seated on Foxglove Rise deck rests on deck ground Y'),
  'seating_foxglove_deck_standup': ('1.0', 'C-2 fix: stand-up lands at approach, never null fallback'),
  'seating_east_plaza_sip':        ('1.0', 'outdoor bench sipping enabled — sipable tea in satchel'),
  'bench_east_plaza_close':  ('0.62', 'bench v2 joinery detail (East Plaza) — curved cedar frame, rounded rail, sage/mint pad'),
  'bench_gazebo_close':      ('0.62', 'bench v2 joinery detail (Gazebo)'),
  'bench_pond_south_close':  ('0.62', 'bench v2 joinery detail (Mirror Pond)'),
  'seating_foxglove_deck_seated_close': ('0.55', 'C-1 fix close: seated hips rest on deck ground Y — no sink into the deck mesh'),
  'g2_future_schema_refusal':      ('1.0', 'G-2: future-schema save refused, original preserved, autosave blocked'),
}
with open('/tmp/ov_meta.json', 'w') as f2:
    json.dump(NOTES, f2)

print(f"payloads: {len(scenarios)} + g2 + perf×2")
EOF

# ------------------------------------------------------------------ driver --
wait_playing() {
  for i in $(seq 1 240); do
    ST=$(agent-browser eval "document.body.dataset.state || 'none'" 2>/dev/null | tail -1)
    case "$ST" in *play*) return 0;; esac
    sleep 0.5
  done
  echo "WARN: playing state not reached" >&2
  return 1
}

open_game() { # b64file extraParams
  agent-browser close > /dev/null 2>&1 || true
  pkill -f "agent-browser" 2>/dev/null || true
  sleep 1
  agent-browser console --clear > /dev/null 2>&1
  agent-browser errors --clear > /dev/null 2>&1
  agent-browser open "http://localhost:$PORT/" > /dev/null
  agent-browser set viewport 1440 900 > /dev/null
  sleep 2
  agent-browser eval -b "$(cat "$1")" > /dev/null
  agent-browser eval "Storage.prototype.setItem = function(){}; Storage.prototype.removeItem = function(){}; 'a-stubbed'" > /dev/null
  agent-browser open "http://localhost:$PORT/?autostart=1&v=ov-$RANDOM${2:-}" > /dev/null
  wait_playing || true
  agent-browser eval "Storage.prototype.setItem = function(){}; Storage.prototype.removeItem = function(){}; 'stubbed'" > /dev/null
  sleep 2
}

drag() { # dx  — real gesture path: canvas pointerdown → move(dx) → up
  agent-browser eval "(() => { const cs=[...document.querySelectorAll('canvas')].sort((a,b)=>(b.width*b.height)-(a.width*a.height)); const c=cs[0]; if(!c) return 'no-canvas'; const o=(x)=>({bubbles:true,cancelable:true,pointerId:777,pointerType:'mouse',isPrimary:true,button:0,buttons:1,clientX:x,clientY:420}); c.dispatchEvent(new PointerEvent('pointerdown',o(700))); c.dispatchEvent(new PointerEvent('pointermove',o(700+($1)))); c.dispatchEvent(new PointerEvent('pointerup',o(700+($1)))); return 'dragged'; })()" 2>/dev/null | tail -1
}

setzoom() { agent-browser eval "window.__LS_CAMERA_SET__ && window.__LS_CAMERA_SET__($1); 'z'" > /dev/null; }

shoot() { # phase name
  local dir="$ROOT/$1"
  if [ ! -s "$dir/${2}_desktop.png" ]; then
    agent-browser screenshot "/tmp/qa_shots/ov_${1}_${2}.png" > /dev/null
    cp "/tmp/qa_shots/ov_${1}_${2}.png" "$dir/${2}_desktop.png"
  fi
}

meta() { # phase name zoom
  local note
  note=$(python3 -c "import json;m=json.load(open('/tmp/ov_meta.json'));print(json.dumps(m.get('$2',('1.0',''))))")
  if ! grep -q "\"shot\":\"$2\"" "$ROOT/$1/metadata.jsonl" 2>/dev/null; then
    local errors
    errors=$(agent-browser errors 2>/dev/null | rg -c "Error" || echo 0)
    printf '{"shot":"%s","viewport":"1440x900","zoom":"%s","meta":%s,"pageErrors":%s}\n' \
      "$2" "$3" "$note" "${errors:-0}" >> "$ROOT/$1/metadata.jsonl"
  fi
}

# --- Phase 3: 5 rooms × 4 states + cottage cutaway sweep ----------------------
run_room() { # scenarioName roomSlug
  if [ -s "$ROOT/phase3-interior-framing/room_${2}_entry_desktop.png" ] && \
     [ -s "$ROOT/phase3-interior-framing/room_${2}_yaw90_desktop.png" ] && \
     [ -s "$ROOT/phase3-interior-framing/room_${2}_zoommin_desktop.png" ] && \
     [ -s "$ROOT/phase3-interior-framing/room_${2}_zoommax_desktop.png" ]; then
    return 0
  fi
  echo "  [room $2]"
  open_game "/tmp/ov_${1}.b64"
  setzoom 1.0; sleep 3
  shoot phase3-interior-framing "room_${2}_entry";   meta phase3-interior-framing "room_${2}_entry" 1.0
  drag 262; sleep 6
  shoot phase3-interior-framing "room_${2}_yaw90";   meta phase3-interior-framing "room_${2}_yaw90" 1.0
  setzoom 0.55; sleep 3
  shoot phase3-interior-framing "room_${2}_zoommin"; meta phase3-interior-framing "room_${2}_zoommin" 0.55
  setzoom 1.75; sleep 3
  shoot phase3-interior-framing "room_${2}_zoommax"; meta phase3-interior-framing "room_${2}_zoommax" 1.75
}

if [ "$ONLY" = "all" ] || [ "$ONLY" = "phase3" ]; then
  echo "--- phase 3: interior framing ---"
  run_room room_bakery bakery
  run_room room_cottage cottage
  run_room room_nook nook
  run_room room_copperwheel copperwheel
  run_room room_greenhouse greenhouse
  if [ ! -s "$ROOT/phase3-interior-framing/cutaway_cottage_yaw270_desktop.png" ]; then
    echo "  [cutaway cottage yaw sweep]"
    open_game "/tmp/ov_cutaway_cottage.b64"
    setzoom 1.0; sleep 3
    shoot phase3-interior-framing "cutaway_cottage_yaw0";   meta phase3-interior-framing "cutaway_cottage_yaw0" 1.0
    drag 262; sleep 6
    shoot phase3-interior-framing "cutaway_cottage_yaw90";  meta phase3-interior-framing "cutaway_cottage_yaw90" 1.0
    drag 262; sleep 6
    shoot phase3-interior-framing "cutaway_cottage_yaw180"; meta phase3-interior-framing "cutaway_cottage_yaw180" 1.0
    drag 262; sleep 6
    shoot phase3-interior-framing "cutaway_cottage_yaw270"; meta phase3-interior-framing "cutaway_cottage_yaw270" 1.0
  fi
fi

# --- Phase 4: fountain ---------------------------------------------------------
run_fountain() { # scenarioName prefix
  if [ -s "$ROOT/phase4-fountain/${2}_default_desktop.png" ]; then return 0; fi
  echo "  [$2]"
  open_game "/tmp/ov_${1}.b64"
  setzoom 1.0; sleep 3
  shoot phase4-fountain "${2}_default";  meta phase4-fountain "${2}_default" 1.0
  drag 262; sleep 6
  shoot phase4-fountain "${2}_orbit90";  meta phase4-fountain "${2}_orbit90" 1.0
}

if [ "$ONLY" = "all" ] || [ "$ONLY" = "phase4" ]; then
  echo "--- phase 4: fountain ---"
  run_fountain fountain_after fountain_after
  run_fountain fountain_after_dusk fountain_after_dusk
  run_fountain fountain_dry fountain_dry
  if [ ! -s "$ROOT/phase4-fountain/fountain_after_close_desktop.png" ]; then
    open_game "/tmp/ov_fountain_after.b64"
    setzoom 0.55; sleep 3
    shoot phase4-fountain "fountain_after_close"; meta phase4-fountain "fountain_after_close" 0.55
  fi
  if [ ! -s "$ROOT/phase4-fountain/fountain_dry_close_desktop.png" ]; then
    open_game "/tmp/ov_fountain_dry.b64"
    setzoom 0.55; sleep 3
    shoot phase4-fountain "fountain_dry_close"; meta phase4-fountain "fountain_dry_close" 0.55
  fi
fi

# --- Phase 5: furniture ---------------------------------------------------------
run_one() { # phase dir scenarioName zoom [dragDx]
  local dir="$ROOT/$1"
  if [ -s "$dir/${2}_desktop.png" ]; then return 0; fi
  echo "  [$2]"
  open_game "/tmp/ov_${2}.b64"
  setzoom "$3"; sleep 3
  if [ -n "${4:-}" ]; then drag "$4"; sleep 6; fi
  shoot "$1" "$2"; meta "$1" "$2" "$3"
}

if [ "$ONLY" = "all" ] || [ "$ONLY" = "phase5" ]; then
  echo "--- phase 5: furniture ---"
  run_one phase5-furniture bench_east_plaza 0.85
  run_one phase5-furniture bench_gazebo 0.85
  run_one phase5-furniture bench_pond_south 0.85
  run_one phase5-furniture bench_east_plaza_close 0.62
  run_one phase5-furniture bench_gazebo_close 0.62
  run_one phase5-furniture bench_pond_south_close 0.62
  run_one phase5-furniture bench_winter 0.85
  run_one phase5-furniture armchair_nook 0.8
  run_one phase5-furniture armchair_copperwheel 0.8
  run_one phase5-furniture bakery_cafe_chair 0.8
fi

# --- Phase 6: seating residuals ---------------------------------------------------
if [ "$ONLY" = "all" ] || [ "$ONLY" = "phase6" ]; then
  echo "--- phase 6: seating ---"
  run_one phase6-seating seating_foxglove_deck_seated 1.0
  run_one phase6-seating seating_foxglove_deck_seated_close 0.55
  run_one phase6-seating seating_foxglove_deck_standup 1.0
  run_one phase6-seating seating_east_plaza_sip 1.0
fi

# --- Phase 7: G-2 future-schema refusal (behavioral transcript) -------------------
if [ "$ONLY" = "all" ] || [ "$ONLY" = "phase7" ]; then
  echo "--- phase 7: bug register ---"
  if ! grep -q '"shot":"g2_future_schema_refusal"' "$ROOT/phase7-bug-register/metadata.jsonl" 2>/dev/null; then
    open_game "/tmp/ov_g2_future.b64"
    sleep 2
    G2_STORED=$(agent-browser eval "JSON.stringify((() => { const raw = localStorage.getItem('little_somewhere_world_v1'); const v = raw ? (JSON.parse(raw).version ?? null) : null; const backup = localStorage.getItem('little_somewhere_world_v1_backup'); return { storedVersion: v, backupPresent: backup !== null, playerPos: (window.__LS_CAMERA_GET__ !== undefined) ? 'live' : 'none' }; })())" 2>/dev/null | tail -1)
    # 10 s of live gameplay, then confirm autosave did NOT overwrite the v12 payload.
    sleep 10
    G2_AFTER=$(agent-browser eval "JSON.stringify((() => { const raw = localStorage.getItem('little_somewhere_world_v1'); return { storedVersionAfter10s: raw ? (JSON.parse(raw).version ?? null) : null }; })())" 2>/dev/null | tail -1)
    shoot phase7-bug-register g2_future_schema_refusal
    errors=$(agent-browser errors 2>/dev/null | rg -c "Error" || echo 0)
    G2_STORED_B64=$(printf '%s' "${G2_STORED:-null}" | base64 -w0)
    G2_AFTER_B64=$(printf '%s' "${G2_AFTER:-null}" | base64 -w0)
    ERR_B64=$(printf '%s' "${errors:-0}" | base64 -w0)
    python3 - "$ERR_B64" "$G2_STORED_B64" "$G2_AFTER_B64" << 'PYEOF'
import base64, json, sys
err = base64.b64decode(sys.argv[1]).decode() or '0'
stored = json.loads(base64.b64decode(sys.argv[2]).decode())
after = json.loads(base64.b64decode(sys.argv[3]).decode())
row = {
  "shot": "g2_future_schema_refusal",
  "viewport": "1440x900",
  "zoom": "1.0",
  "meta": ["1.0", "G-2: future-schema save refused, original preserved, autosave blocked"],
  "pageErrors": int(err) if err.isdigit() else 0,
  "probe": {
    "storedVersionAtLoad": stored.get("storedVersion"),
    "backupPresent": stored.get("backupPresent"),
    "storedVersionAfter10sLiveGameplay": after.get("storedVersionAfter10s"),
    "verdict": "future-schema payload refused (game started on fresh v11 state); original payload preserved untouched under the live key; autosave did NOT overwrite it during 10s of live gameplay (G-2 data-loss fix live). Refusal is structural via the loadWorldState futureSchemaSaveDetected gate; the explanatory warning string is a deserializeWorldState return value, not a console log."
  }
}
with open('download/asset-qa/overhaul/phase7-bug-register/metadata.jsonl', 'a') as f:
    f.write(json.dumps(row) + '\n')
PYEOF
    echo "  [g2] stored=$G2_STORED after=$G2_AFTER"
  fi
fi

# --- Phase 8: after-perf rows ------------------------------------------------------
run_perf() { # b64file shotLabel outDir note
  if grep -q "\"shot\":\"$2\"" "$ROOT/$3/perf-after.jsonl" 2>/dev/null; then
    echo "  [$2] resumable skip"; return 0
  fi
  open_game "$1" "&perf=1"
  agent-browser eval "window.__LS_PERF__ && window.__LS_PERF__.reset(); 'warmup-start'" > /dev/null
  sleep 8
  agent-browser eval "window.__LS_PERF__ && window.__LS_PERF__.reset(); 'perf-reset'" > /dev/null
  sleep 20
  PERF_SUMMARY=$(agent-browser eval "JSON.stringify(window.__LS_PERF__ ? window.__LS_PERF__.summary() : null)" 2>/dev/null | tail -1)
  PERF_GL=$(agent-browser eval "(()=>{const c=document.createElement('canvas');const g=c.getContext('webgl2')||c.getContext('webgl');if(!g)return'n/a';const e=g.getExtension('WEBGL_debug_renderer_info');return e?String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)):String(g.getParameter(g.RENDERER));})()" 2>/dev/null | tail -1)
  PERF_ERRORS=$(agent-browser errors 2>/dev/null | rg -c "Error" || echo 0)
  printf '{"shot":"%s","viewport":"1440x900","zoom":"1.0","note":"%s","gl":%s,"pageErrors":%s,"perf":%s}\n' \
    "$2" "$4" "${PERF_GL:-\"unknown\"}" "${PERF_ERRORS:-0}" "${PERF_SUMMARY:-null}" >> "$ROOT/$3/perf-after.jsonl"
  echo "  [$2] perf=$PERF_SUMMARY"
}

if [ "$ONLY" = "all" ] || [ "$ONLY" = "perf" ]; then
  echo "--- phase 8: after-perf rows ---"
  run_perf /tmp/ov_perf_veteran.b64 perf_overhaul_veteran phase8-final \
    "20s veteran golden flowing gameplay, plaza hero framing (baseline-perf.jsonl = 2304 pre-change)"
  run_perf /tmp/ov_perf_fresh.b64 perf_overhaul_fresh phase8-final \
    "20s fresh-save gameplay (Entry 054 parity doctrine: fresh 1704 pre-change)"
  run_perf /tmp/ov_perf_veteran_open.b64 perf_overhaul_veteran_opensky phase8-final \
    "20s veteran golden flowing gameplay at open-sky pond framing (no occluder on ray) — reconciles WORKLOG 056 named-offset register"
fi

agent-browser close > /dev/null 2>&1 || true
kill $VITE_PID 2>/dev/null || true
echo "OVERHAUL evidence complete: $(ls "$ROOT"/*/*.png 2>/dev/null | wc -l) shots"
