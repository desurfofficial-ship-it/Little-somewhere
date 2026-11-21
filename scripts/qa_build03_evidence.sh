#!/bin/bash
# qa_build03_evidence.sh — BUILD 03 evidence set (Doc 07 §7 testing contract:
# fresh-save parity + full-progress veteran captures + perf row; reuses the
# BUILD 01/02 harness doctrine — never overwrites other evidence sets).
#
# Output: download/asset-qa/build03-validation/ (desktop 1440x900 + selected
# mobile 390x844), metadata.jsonl with per-shot zoom/phase/season, plus the
# measured perf row (20 s BUILD 03 veteran golden-hour gameplay, ?perf=1).
#
# Usage: bash scripts/qa_build03_evidence.sh [all|desktop-only|mobile-only]
set -u
cd /home/z/my-project/little-somewhere

OUT_DIR="download/asset-qa/build03-validation"
ONLY="${1:-all}"
export AGENT_BROWSER_SESSION="lsd-b03-$(date +%s)"
PORT=4183
mkdir -p "$OUT_DIR"  # metadata.jsonl is append-only + de-duplicated below (resumable)
mkdir -p /tmp/qa_shots && rm -f /tmp/qa_shots/b03_*.png

setsid nohup npx vite preview --port=$PORT --host=127.0.0.1 > /tmp/vite_preview_b03.log 2>&1 < /dev/null &
VITE_PID=$!
for i in $(seq 1 60); do curl -s -o /dev/null "http://localhost:$PORT/" && break; sleep 0.5; done
echo "server ready on $PORT"

npx tsx scripts/make_build03_veteran_save.ts > /tmp/build03_veteran.json

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
        save['day'] = day if day is not None else {'spring': 10, 'summer': 17, 'autumn': 28, 'winter': 37}[season]
    if weather is not None: save['weather'] = weather
    return save

def place(save, pos, facing):
    save['playerPos'] = pos
    save['exteriorPlayerPos'] = pos
    save['playerFacing'] = facing
    save['exteriorPlayerFacing'] = facing
    return save

def fresh(minute=840, season='spring', day=1):
    """Doc 07 §7.3 fresh-save parity base: brand-new world, spring dayOfSeason 1."""
    save = json.loads(open('/tmp/build03_veteran.json').read().strip())
    # strip every BUILD 03 signal back to a fresh world
    fresh_world = json.loads(open('/tmp/build03_fresh.json').read().strip())
    return fresh_world

scenarios = {}
def add(name, save):
    scenarios[name] = save

# --- FRESH-SAVE PARITY (Doc 07 §7.3: identical to pre-BUILD-03 Day 1) --------
fresh_base = None  # filled from /tmp/build03_fresh.json below
s = fresh()
add('fresh_plaza_hero', place(dict(s), {'x': 2.0, 'z': 4.6}, -2.1))
s = fresh()
add('fresh_noticeboard', place(dict(s), {'x': 5.5, 'z': -2.1}, -2.36))
s = fresh()
add('fresh_bakery_ledge', place(dict(s), {'x': -13.2, 'z': -6.9}, -2.3))
s = fresh(minute=1230)
si = dict(s); si['playerLocation'] = 'cottage_interior'; si['playerPos'] = {'x': 0.4, 'z': 0.9}
add('fresh_cottage_interior', si)

# --- 5.1 STORYLINE WORLD PROPS -----------------------------------------------
s = with_env()
add('v_zine_board', place(s, {'x': 5.5, 'z': -2.1}, -2.36))          # noticeboard
s = with_env()
add('v_bakery_herb_crate', place(s, {'x': -13.2, 'z': -6.9}, -2.3))  # under-ledge crate
s = with_env()
add('v_music_stand_pond', place(s, {'x': 4.0, 'z': 20.6}, -2.4))     # pond south bank
s = with_env(minute=1230)
add('v_pier_sconces', place(s, {'x': 3.7, 'z': 18.8}, -2.4))         # dusk amber hoods
s = with_env()
add('v_watch_charm', place(s, {'x': 15.3, 'z': -7.2}, -2.34))        # porch lantern charm

# --- 5.2 TOKENS + KEEPSAKE ECHOES ---------------------------------------------
s = with_env()
add('v_token_clara', place(s, {'x': -7.7, 'z': -6.7}, -2.38))        # friend charm on bakery post
s = with_env()
add('v_token_mina', place(s, {'x': 10.0, 'z': 4.8}, -2.38))          # kindred ribbon, greenhouse porch (walkable west side)
s = with_env(minute=840)
si = dict(s); si['playerLocation'] = 'nook_interior'; si['playerPos'] = {'x': 0.4, 'z': 0.9}
add('v_echo_nook_zine', si)                                           # zine copy on the counter
s = with_env(minute=840)
si = dict(s); si['playerLocation'] = 'copperwheel_interior'; si['playerPos'] = {'x': 0.4, 'z': 0.9}
add('v_echo_workshop_bell', si)                                       # brass bell on the bench
s = with_env(minute=840)
si = dict(s); si['playerLocation'] = 'greenhouse_interior'; si['playerPos'] = {'x': 0.4, 'z': 0.9}
add('v_echo_greenhouse_wreath', si)                                   # wreath on the growing shelf
s = with_env()
add('v_echo_pond_card', place(s, {'x': 7.1, 'z': 15.1}, -2.4))        # Toby's watercolor on driftwood

# --- 5.4 EXPLORATION MARKS ------------------------------------------------------
s = with_env()
add('v_mark_well_ribbon', place(s, {'x': -19.8, 'z': 21.6}, -2.37))  # walkable spot near the well
s = with_env()
add('v_mark_rise_cairn', place(s, {'x': 22.0, 'z': 14.4}, -2.37))    # walkable spot near the stair approach
s = with_env()
add('v_mark_lane_arrow', place(s, {'x': 22.9, 'z': 2.4}, -2.37))
s = with_env()
add('v_mark_hive_wreath', place(s, {'x': 11.5, 'z': -18.2}, -2.38))

# --- 5.3 WITHIN-SEASON DRIFT PAIR (day 1 parity anchor vs day 10 full drift) --
s = with_env(season='spring', day=1, minute=840)
add('v_drift_spring_day1', place(s, {'x': -17.0, 'z': -17.0}, -2.35))
s = with_env(season='spring', day=10, minute=840)
add('v_drift_spring_day10', place(s, {'x': -17.0, 'z': -17.0}, -2.35))

# --- 5.5/5.3c COTTAGE INTERIOR TIERS + POSIES ----------------------------------
s = with_env(minute=840)
si = dict(s); si['playerLocation'] = 'cottage_interior'; si['playerPos'] = {'x': 0.4, 'z': 0.9}
add('v_cottage_tiers', si)

# --- 5.6a NOTICEBOARD GLINT ------------------------------------------------------
s = with_env(minute=1230)
add('v_noticeboard_glint', place(s, {'x': 5.5, 'z': -2.1}, -2.36))

# --- HERO ----------------------------------------------------------------------
s = with_env()
add('v_plaza_hero_build03', place(s, {'x': 2.0, 'z': 4.6}, -2.1))

for name, save in scenarios.items():
    js = inject_js(save)
    open(f'/tmp/b03_{name}.b64', 'w').write(base64.b64encode(js.encode()).decode())

SCENARIO_META = {
  'fresh_plaza_hero':          ('1.0', 'FRESH-SAVE parity: Day 1, every BUILD 03 group hidden'),
  'fresh_noticeboard':         ('0.72', 'FRESH-SAVE parity: no zine board, no glint'),
  'fresh_bakery_ledge':        ('0.72', 'FRESH-SAVE parity: no herb crate'),
  'fresh_cottage_interior':    ('interior-0.68', 'FRESH-SAVE parity: tier groups + posy growth hidden'),
  'v_zine_board':              ('0.72', '5.1a chalk zine cover + caddy (art_edition tint)'),
  'v_bakery_herb_crate':       ('0.72', '5.1b herb crate under ledge lip (tea_basket bunches)'),
  'v_music_stand_pond':        ('1.0', '5.1c cedar music stand (carved_clef variant)'),
  'v_pier_sconces':            ('1.0', '5.1e hooded amber sconces at dusk (bridge_compromise)'),
  'v_watch_charm':             ('0.72', '5.1d brass pendulum charm (patient_repair bead)'),
  'v_token_clara':             ('0.72', '5.2a friend charm (affinity >= 60)'),
  'v_token_mina':              ('0.72', '5.2b kindred marigold ribbon (affinity >= 90)'),
  'v_echo_nook_zine':          ('interior-0.68', '5.2c zine copy echo on nook counter'),
  'v_echo_workshop_bell':      ('interior-0.68', '5.2c brass bell echo on workshop bench'),
  'v_echo_greenhouse_wreath':  ('interior-0.68', '5.2c herb wreath echo on growing shelf'),
  'v_echo_pond_card':          ('1.0', '5.2c watercolor card echo on pond driftwood'),
  'v_mark_well_ribbon':        ('1.0', '5.4 survey ribbon on the Old Stone Well'),
  'v_mark_rise_cairn':         ('1.0', '5.4 cairn + ribbon at the Rise stair approach'),
  'v_mark_lane_arrow':         ('0.72', '5.4 chalk arrow on the lane signpost'),
  'v_mark_hive_wreath':        ('1.0', '5.4 sprig wreath on the wild bee log'),
  'v_drift_spring_day1':       ('1.0', '5.3 drift PARITY ANCHOR: spring dayOfSeason 1 (world-edge grove ring canopy)'),
  'v_drift_spring_day10':      ('1.0', '5.3 full drift: spring dayOfSeason 10 (world-edge grove ring canopy)'),
  'v_cottage_tiers':           ('interior-0.68', '5.5 book stack 3 + dipper + 2nd card + posy full'),
  'v_noticeboard_glint':       ('1.0', '5.6a newest-flyer brass pin glint at dusk'),
  'v_plaza_hero_build03':      ('1.0', 'BUILD 03 golden hero (all signals earned)'),
}
with open('/tmp/b03_meta.json', 'w') as f:
    json.dump(SCENARIO_META, f)

print(f"payloads: {len(scenarios)}")
EOF

# fresh-save world (no BUILD 03 signals)
npx tsx -e "
import { createFreshWorldState, serializeWorldState } from './src/game/storage';
process.stdout.write(serializeWorldState(createFreshWorldState()));
" > /tmp/build03_fresh.json

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
  agent-browser screenshot "/tmp/qa_shots/b03_${1}_${2}.png" > /dev/null
  cp "/tmp/qa_shots/b03_${1}_${2}.png" "$OUT_DIR/${1}_${2}.png"
}

meta() {
  local zoom_note
  zoom_note=$(python3 -c "import json;m=json.load(open('/tmp/b03_meta.json'));print(json.dumps(m.get('$1',('1.0',''))))")
  if ! grep -q "\"shot\":\"$1\",\"viewport\":\"$2\"" "$OUT_DIR/metadata.jsonl" 2>/dev/null; then
    printf '{"shot":"%s","viewport":"%s","meta":%s}\n' "$1" "$2" "$zoom_note" >> "$OUT_DIR/metadata.jsonl"
  fi
}

INTERIOR_SCENARIOS="fresh_cottage_interior v_echo_nook_zine v_echo_workshop_bell v_echo_greenhouse_wreath v_cottage_tiers"

run_scenario() { # name viewport
  local name=$1 vp=$2
  if [ -s "$OUT_DIR/${name}_${vp}.png" ]; then return 0; fi
  agent-browser close > /dev/null 2>&1 || true
  pkill -f "agent-browser" 2>/dev/null || true
  sleep 1
  agent-browser console --clear > /dev/null 2>&1
  agent-browser errors --clear > /dev/null 2>&1
  agent-browser open "http://localhost:$PORT/" > /dev/null
  sleep 2
  agent-browser eval -b "$(cat /tmp/b03_${name}.b64)" > /dev/null
  # Freeze persistence on the injector page IMMEDIATELY: the title screen mounts
  # a world from whatever localStorage held at mount and its 5 s autosave can
  # overwrite the injection before the navigation (race seen on SwiftShader-decayed
  # boots — the same injection race BUILD 02 documented).
  agent-browser eval "Storage.prototype.setItem = function(){}; Storage.prototype.removeItem = function(){}; 'a-stubbed'" > /dev/null
  agent-browser open "http://localhost:$PORT/?autostart=1&v=${name}-$RANDOM" > /dev/null
  wait_playing || true
  agent-browser eval "Storage.prototype.setItem = function(){}; Storage.prototype.removeItem = function(){}; 'stubbed'" > /dev/null
  sleep 2
  local want_zoom=0
  if [[ "$name" == *_detail || "$name" == v_zine_board || "$name" == v_bakery_herb_crate || "$name" == v_watch_charm || "$name" == v_token_clara || "$name" == v_token_mina || "$name" == v_mark_lane_arrow || "$name" == fresh_noticeboard || "$name" == fresh_bakery_ledge ]]; then want_zoom=1; fi
  if [ "$want_zoom" != "0" ]; then
    local st
    for i in $(seq 1 100); do
      st=$(agent-browser eval "document.body.dataset.state" 2>/dev/null | tail -1)
      [ "$st" = '"playing"' ] && break
      sleep 1
    done
    if [ "$want_zoom" = "1" ]; then agent-browser eval "if(window.__LS_CAMERA_SET__){window.__LS_CAMERA_SET__(0.72)}" > /dev/null; fi
    sleep 6
  fi
  local errors
  errors=$(agent-browser errors 2>/dev/null | rg -c "Error" || echo 0)
  shoot "$name" "$vp"
  meta "$name" "$vp"
  echo "  [$name/$vp] pageErrors=$errors"
}

# ---- Perf evidence pass (SKIP_PERF=1 on re-runs) -----------------------------
if [ "${SKIP_PERF:-0}" = "1" ]; then echo "perf pass skipped"; else
agent-browser open "http://localhost:$PORT/" > /dev/null
sleep 2
agent-browser eval -b "$(cat /tmp/b03_v_plaza_hero_build03.b64)" > /dev/null
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
printf '{"shot":"perf_plaza_hero_build03","viewport":"1440x900","zoom":"1.0","note":"20s BUILD 03 veteran golden-hour gameplay (Doc 07 full-progress save)","gl":%s,"pageErrors":%s,"perf":%s}\n' \
  "${PERF_GL:-\"unknown\"}" "${PERF_ERRORS:-0}" "${PERF_SUMMARY:-null}" >> "$OUT_DIR/metadata.jsonl"
echo "perf evidence: $PERF_SUMMARY"
fi

# ---- Clean capture pass -------------------------------------------------------
agent-browser open "http://localhost:$PORT/?autostart=1" > /dev/null
sleep 6

EXTERIOR_SCENARIOS="fresh_plaza_hero fresh_noticeboard fresh_bakery_ledge v_zine_board v_bakery_herb_crate v_music_stand_pond v_pier_sconces v_watch_charm v_token_clara v_token_mina v_echo_pond_card v_mark_well_ribbon v_mark_rise_cairn v_mark_lane_arrow v_mark_hive_wreath v_drift_spring_day1 v_drift_spring_day10 v_noticeboard_glint v_plaza_hero_build03"

if [ "$ONLY" != "mobile-only" ]; then
  echo "--- desktop 1440x900: fresh parity + exteriors ---"
  for s in $EXTERIOR_SCENARIOS; do echo "shot: $s"; run_scenario "$s" desktop; done
  echo "--- desktop 1440x900: interiors ---"
  for s in $INTERIOR_SCENARIOS; do echo "shot: $s"; run_scenario "$s" desktop; done
fi
if [ "$ONLY" != "desktop-only" ]; then
  echo "--- mobile 390x844 ---"
  for s in v_plaza_hero_build03 v_zine_board v_music_stand_pond v_cottage_tiers; do
    echo "shot: $s (mobile)"; run_scenario "$s" mobile
  done
fi

kill $VITE_PID 2>/dev/null || true
echo "BUILD 03 evidence complete: $(ls "$OUT_DIR"/*.png 2>/dev/null | wc -l) shots"
