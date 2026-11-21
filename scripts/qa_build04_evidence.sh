#!/bin/bash
# qa_build04_evidence.sh — BUILD 04 "Life in Motion" evidence set.
# Doctrine: reuse the BUILD 01-03 harness pattern (veteran Doc 07 save,
# cache-buster navigation, storage stub, per-shot fresh browser, resumable).
#
# Adds BUILD 04-specific evidence:
#   - motion frame-triples (same pinned scene, 3 shots 1.5 s apart) for the talk
#     mouth-flap, wave elbow snap and ambient motion — stills alone cannot prove
#     animation, so pixel-different frame series are the evidence unit;
#   - UI captures (satchel thumbnails, journal portraits, zoom cluster);
#   - a measured perf row (20 s veteran golden gameplay, ?perf=1) compared
#     against download/asset-qa/build04-validation/baseline-perf.jsonl.
#
# Usage: bash scripts/qa_build04_evidence.sh [all|desktop-only|mobile-only]
set -u
cd /home/z/my-project/little-somewhere

OUT_DIR="download/asset-qa/build04-validation"
ONLY="${1:-all}"
export AGENT_BROWSER_SESSION="lsd-b04-$(date +%s)"
PORT=4186
mkdir -p "$OUT_DIR"
mkdir -p /tmp/qa_shots && rm -f /tmp/qa_shots/b04_*.png

npm run build > /tmp/b04_evidence_build.log 2>&1 || { echo "BUILD FAILED"; tail -5 /tmp/b04_evidence_build.log; exit 1; }

setsid nohup npx vite preview --port=$PORT --host=127.0.0.1 > /tmp/vite_preview_b04.log 2>&1 < /dev/null &
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

scenarios = {}
def add(name, save):
    scenarios[name] = save

# --- hero + ambient motion frame-triple (crowns sway, signs swing) ----------
s = with_env()
add('v_plaza_hero_build04', place(dict(s), {'x': 2.0, 'z': 4.6}, -2.1))

# --- natural walk cast (morning routines, stride + elbows + pre-bend live) ---
s = with_env(minute=520)
add('v_cast_walk_plaza', place(dict(s), {'x': 2.0, 'z': 4.6}, -2.1))

# --- talk mouth-flap (clara pinned talking, dialogue zoom) -------------------
s = with_env()
s = pin(s, 'clara', 3.4, 6.2, -2.2, 'talk')
add('v_talk_flap_zoom', place(s, {'x': 2.0, 'z': 4.6}, -2.1))

# --- wave elbow snap ---------------------------------------------------------
s = with_env()
s = pin(s, 'clara', 3.4, 6.2, -2.2, 'wave')
add('v_wave_elbow_zoom', place(s, {'x': 2.0, 'z': 4.6}, -2.1))

# --- dusk lantern breathe + festoon (AM-4) -----------------------------------
s = with_env(minute=1230)
add('v_dusk_lanterns_build04', place(s, {'x': 3.7, 'z': 18.8}, -2.4))

# --- UI captures (satchel thumbnails / journal portraits) ---------------------
add('ui_satchel_thumbnails', place(dict(with_env()), {'x': 2.0, 'z': 4.6}, -2.1))
add('ui_journal_portraits', place(dict(with_env()), {'x': 2.0, 'z': 4.6}, -2.1))

for name, save in scenarios.items():
    js = inject_js(save)
    open(f'/tmp/b04_{name}.b64', 'w').write(base64.b64encode(js.encode()).decode())

SCENARIO_META = {
  'v_plaza_hero_build04':   ('1.0', 'BUILD 04 golden hero (veteran, ambient sway + sign swing live)'),
  'v_cast_walk_plaza':      ('1.0', 'morning routines: stride gait, elbows, pre-bent legs live'),
  'v_talk_flap_zoom':       ('0.72', 'clara pinned talk at dialogue zoom — mouth-flap frame 1'),
  'v_wave_elbow_zoom':      ('0.72', 'clara pinned wave at dialogue zoom — elbow snap frame 1'),
  'v_dusk_lanterns_build04': ('1.0', 'dusk pier sconces — lantern breathe + festoon (AM-4)'),
  'ui_satchel_thumbnails':  ('1.0', 'satchel drawer open — 25-item canvas thumbnails + bespoke cozy icons'),
  'ui_journal_portraits':   ('1.0', 'journal People tab — procedural knit portraits (7.4)'),
}
with open('/tmp/b04_meta.json', 'w') as f:
    json.dump(SCENARIO_META, f)

print(f"payloads: {len(scenarios)}")
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

shoot() {
  if [ -s "$OUT_DIR/${1}_${2}.png" ]; then return 0; fi
  agent-browser screenshot "/tmp/qa_shots/b04_${1}_${2}.png" > /dev/null
  cp "/tmp/qa_shots/b04_${1}_${2}.png" "$OUT_DIR/${1}_${2}.png"
}

meta() {
  local note
  note=$(python3 -c "import json;m=json.load(open('/tmp/b04_meta.json'));print(json.dumps(m.get('$1',('1.0',''))))")
  if ! grep -q "\"shot\":\"$1\",\"viewport\":\"$2\"" "$OUT_DIR/metadata.jsonl" 2>/dev/null; then
    printf '{"shot":"%s","viewport":"%s","meta":%s}\n' "$1" "$2" "$note" >> "$OUT_DIR/metadata.jsonl"
  fi
}

ui_click() {
  agent-browser eval "(() => { const b = document.querySelector(\"button[title='$1']\"); if (b) { b.click(); return 'clicked'; } return 'not-found'; })()" 2>/dev/null | tail -1
}

run_scenario() { # name viewport zoom[0|0.72] frames[N] uiAction[title|none]
  local name=$1 vp=$2 zoom=$3 frames=${4:-1} ui=${5:-none}
  if [ -s "$OUT_DIR/${name}_${vp}.png" ]; then return 0; fi
  agent-browser close > /dev/null 2>&1 || true
  pkill -f "agent-browser" 2>/dev/null || true
  sleep 1
  agent-browser console --clear > /dev/null 2>&1
  agent-browser errors --clear > /dev/null 2>&1
  if [ "$vp" = "mobile" ]; then
    agent-browser open "http://localhost:$PORT/" > /dev/null
    agent-browser set viewport 390 844 > /dev/null
  else
    agent-browser open "http://localhost:$PORT/" > /dev/null
    agent-browser set viewport 1440 900 > /dev/null
  fi
  sleep 2
  agent-browser eval -b "$(cat /tmp/b04_${name}.b64)" > /dev/null
  agent-browser eval "Storage.prototype.setItem = function(){}; Storage.prototype.removeItem = function(){}; 'a-stubbed'" > /dev/null
  agent-browser open "http://localhost:$PORT/?autostart=1&v=${name}-$RANDOM" > /dev/null
  wait_playing || true
  agent-browser eval "Storage.prototype.setItem = function(){}; Storage.prototype.removeItem = function(){}; 'stubbed'" > /dev/null
  sleep 2
  if [ "$zoom" != "0" ]; then
    agent-browser eval "if(window.__LS_CAMERA_SET__){window.__LS_CAMERA_SET__($zoom)}" > /dev/null
    sleep 6
  fi
  local errors
  errors=$(agent-browser errors 2>/dev/null | rg -c "Error" || echo 0)
  if [ "$ui" != "none" ]; then
    ui_click "$ui" > /dev/null
    sleep 1.5
    if [ "$name" = "ui_journal_portraits" ]; then
      agent-browser eval "(() => { const t = [...document.querySelectorAll('[role=\"tab\"], button')].find(b => (b.textContent || '').includes('People')); if (t) { t.click(); return 'tab'; } return 'no-tab'; })()" > /dev/null
      sleep 1.2
    fi
  fi
  shoot "$name" "$vp"
  meta "$name" "$vp"
  # Motion frame-triples: same live scene, later shots 1.5 s apart.
  if [ "$frames" -gt 1 ]; then
    for f in $(seq 2 "$frames"); do
      sleep 1.5
      shoot "${name}_f$f" "$vp"
      meta "${name}_f$f" "$vp"
    done
  fi
  echo "  [$name/$vp] pageErrors=$errors frames=$frames ui=$ui"
}

# ------------------------------------------------------------------ capture --
if [ "$ONLY" != "mobile-only" ]; then
  echo "--- desktop 1440x900 ---"
  run_scenario v_plaza_hero_build04 desktop 0 3 none
  run_scenario v_cast_walk_plaza desktop 0 1 none
  run_scenario v_talk_flap_zoom desktop 0.72 3 none
  run_scenario v_wave_elbow_zoom desktop 0.72 2 none
  run_scenario v_dusk_lanterns_build04 desktop 0 1 none
  run_scenario ui_satchel_thumbnails desktop 0 1 "Satchel & Keepsakes [I]"
  run_scenario ui_journal_portraits desktop 0 1 "Pocket Journal [J]"
fi
if [ "$ONLY" != "desktop-only" ]; then
  echo "--- mobile 390x844 ---"
  run_scenario v_plaza_hero_build04 mobile 0 1 none
  run_scenario ui_satchel_thumbnails mobile 0 1 "Satchel & Keepsakes [I]"
fi

# ---- Perf evidence pass ------------------------------------------------------
if ! grep -q '"shot":"perf_plaza_hero_build04"' "$OUT_DIR/metadata.jsonl" 2>/dev/null; then
  agent-browser close > /dev/null 2>&1 || true
  pkill -f "agent-browser" 2>/dev/null || true
  sleep 1
  agent-browser open "http://localhost:$PORT/" > /dev/null
  sleep 2
  agent-browser eval -b "$(cat /tmp/b04_v_plaza_hero_build04.b64)" > /dev/null
  agent-browser open "http://localhost:$PORT/?autostart=1&perf=1&v=perf-b04-$RANDOM" > /dev/null
  sleep 1
  wait_playing || true
  agent-browser eval "window.__LS_PERF__ && window.__LS_PERF__.reset(); 'warmup-start'" > /dev/null
  sleep 8
  agent-browser eval "window.__LS_PERF__ && window.__LS_PERF__.reset(); 'perf-reset'" > /dev/null
  sleep 20
  PERF_SUMMARY=$(agent-browser eval "JSON.stringify(window.__LS_PERF__ ? window.__LS_PERF__.summary() : null)" 2>/dev/null | tail -1)
  PERF_GL=$(agent-browser eval "(()=>{const c=document.createElement('canvas');const g=c.getContext('webgl2')||c.getContext('webgl');if(!g)return'n/a';const e=g.getExtension('WEBGL_debug_renderer_info');return e?String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)):String(g.getParameter(g.RENDERER));})()" 2>/dev/null | tail -1)
  PERF_ERRORS=$(agent-browser errors 2>/dev/null | rg -c "Error" || echo 0)
  printf '{"shot":"perf_plaza_hero_build04","viewport":"1440x900","zoom":"1.0","note":"20s BUILD 04 veteran golden-hour gameplay (same framing as baseline-perf.jsonl)","gl":%s,"pageErrors":%s,"perf":%s}\n' \
    "${PERF_GL:-\"unknown\"}" "${PERF_ERRORS:-0}" "${PERF_SUMMARY:-null}" >> "$OUT_DIR/metadata.jsonl"
  echo "perf evidence: $PERF_SUMMARY"
else
  echo "perf row already present (resumable skip)"
fi

agent-browser close > /dev/null 2>&1 || true
kill $VITE_PID 2>/dev/null || true
echo "BUILD 04 evidence complete: $(ls "$OUT_DIR"/*.png 2>/dev/null | wc -l) shots"
