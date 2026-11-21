#!/bin/bash
# qa_build04_baseline_perf.sh — BUILD 04 pre-change baseline perf row.
# Reuses the BUILD 01-03 harness doctrine (identical veteran save + plaza hero
# framing as the build03 perf row, so before/after rows are comparable).
# Output: download/asset-qa/build04-validation/baseline-perf.jsonl
set -u
cd /home/z/my-project/little-somewhere

OUT_DIR="download/asset-qa/build04-validation"
mkdir -p "$OUT_DIR"
export AGENT_BROWSER_SESSION="lsd-b04-base-$(date +%s)"
PORT=4185

npm run build > /tmp/b04_baseline_build.log 2>&1 || { echo "BUILD FAILED"; tail -5 /tmp/b04_baseline_build.log; exit 1; }

setsid nohup npx vite preview --port=$PORT --host=127.0.0.1 > /tmp/vite_preview_b04base.log 2>&1 < /dev/null &
VITE_PID=$!
for i in $(seq 1 60); do curl -s -o /dev/null "http://localhost:$PORT/" && break; sleep 0.5; done
echo "server ready on $PORT"

npx tsx scripts/make_build03_veteran_save.ts > /tmp/build03_veteran.json

# ---- payload: veteran save framed at the plaza hero spot (same as build03 perf row)
python3 - << 'EOF'
import base64, json
save = json.loads(open('/tmp/build03_veteran.json').read().strip())
save['playerPos'] = {'x': 2.0, 'z': 4.6}
save['exteriorPlayerPos'] = {'x': 2.0, 'z': 4.6}
save['playerFacing'] = -2.1
save['exteriorPlayerFacing'] = -2.1
js = 'localStorage.setItem("little_somewhere_world_v1", ' + json.dumps(json.dumps(save)) + ');\n"stored";'
open('/tmp/b04_baseline.b64', 'w').write(base64.b64encode(js.encode()).decode())
EOF

agent-browser close > /dev/null 2>&1 || true
pkill -f "agent-browser" 2>/dev/null || true
sleep 1
agent-browser open "http://localhost:$PORT/" > /dev/null
sleep 2
agent-browser eval -b "$(cat /tmp/b04_baseline.b64)" > /dev/null
agent-browser open "http://localhost:$PORT/?autostart=1&perf=1&v=b04base-$RANDOM" > /dev/null
sleep 1

# wait for gameplay (same doctrine as build03 harness)
for i in $(seq 1 40); do
  st=$(agent-browser eval "document.body.dataset.state || 'none'" 2>/dev/null | tail -1)
  case "$st" in *play*) echo "playing after ${i}s"; break;; esac
  sleep 1
done

agent-browser eval "window.__LS_PERF__ && window.__LS_PERF__.reset(); 'warmup-start'" > /dev/null
sleep 8
agent-browser eval "window.__LS_PERF__ && window.__LS_PERF__.reset(); 'perf-reset'" > /dev/null
sleep 20
PERF_SUMMARY=$(agent-browser eval "JSON.stringify(window.__LS_PERF__ ? window.__LS_PERF__.summary() : null)" 2>/dev/null | tail -1)
PERF_GL=$(agent-browser eval "(()=>{const c=document.createElement('canvas');const g=c.getContext('webgl2')||c.getContext('webgl');if(!g)return'n/a';const e=g.getExtension('WEBGL_debug_renderer_info');return e?String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)):String(g.getParameter(g.RENDERER));})()" 2>/dev/null | tail -1)
PERF_ERRORS=$(agent-browser errors 2>/dev/null | rg -c "Error" || echo 0)
printf '{"shot":"perf_baseline_build04","viewport":"1440x900","zoom":"1.0","note":"20s pre-change baseline, BUILD 03 veteran golden-hour gameplay (Doc 07 full-progress save, plaza hero framing)","gl":%s,"pageErrors":%s,"perf":%s}\n' \
  "${PERF_GL:-\"unknown\"}" "${PERF_ERRORS:-0}" "${PERF_SUMMARY:-null}" | tee -a "$OUT_DIR/baseline-perf.jsonl"
echo "baseline perf: $PERF_SUMMARY"

agent-browser close > /dev/null 2>&1 || true
kill $VITE_PID 2>/dev/null || true
echo "BUILD 04 baseline perf captured."
