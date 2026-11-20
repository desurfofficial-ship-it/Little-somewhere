#!/bin/bash
# Phase B+C QA: core craft back-port, implied-space interiors, woodshop/nook/bakery identities.
set -u
cd /home/z/my-project/little-somewhere
export AGENT_BROWSER_SESSION=lsd-building-phase-bc
mkdir -p /tmp/qa_shots && rm -f /tmp/qa_shots/phase_bc_*.png

npx vite build > /tmp/phase_bc_build.log 2>&1 || { echo "BUILD FAILED"; tail -20 /tmp/phase_bc_build.log; exit 1; }
setsid nohup npx vite preview --port=4183 --host=0.0.0.0 > /tmp/vite_preview_phase_bc.log 2>&1 < /dev/null &
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:4183/ && break; sleep 0.5; done
echo "server ready"

npx tsx scripts/make_dialogue_qa_save.ts > /tmp/phase_bc_base.json
python3 - << 'EOF'
import base64, json

base = json.loads(open('/tmp/phase_bc_base.json').read().strip())

def inject_js(save):
    payload = json.dumps(json.dumps(save))
    return (
      'localStorage.setItem("little_somewhere_world_v1", ' + payload + ');\n'
      'Storage.prototype.setItem = function(){};\n'
      'Storage.prototype.removeItem = function(){};\n'
      'location.reload(); "injected";'
    )

configs = [
  # Bakery: south-west three-quarter view (wing + oven + tapered chimney + sign)
  ('bakery_sw', 2, 'spring', 'exterior', {'x': -15.6, 'z': -6.4}, 'Math.PI * 0.78'),
  # Bakery: south facade straight-on (awning, corbel ledge, hanging sign)
  ('bakery_s', 2, 'spring', 'exterior', {'x': -12.4, 'z': -6.0}, 'Math.PI'),
  # Bakery interior: facing the west bakehouse door
  ('bakery_in', 2, 'spring', 'bakery_interior', {'x': -1.2, 'z': 1.4}, 'Math.PI * 1.5'),
  # Book Nook: east facade (bay window + door + cart)
  ('nook_e', 2, 'spring', 'exterior', {'x': -11.6, 'z': -1.6}, 'Math.PI * 1.5'),
  # Book Nook: north-east view (bay + crates + bargeboards)
  ('nook_ne', 2, 'spring', 'exterior', {'x': -12.2, 'z': 3.6}, 'Math.PI * 1.25'),
  # Nook interior: facing the stacks door north-east
  ('nook_in', 2, 'spring', 'nook_interior', {'x': 0.4, 'z': 0.6}, 'Math.PI * 1.35'),
  # Woodshop: south-west view (lumber stack, sawhorse, chips, shingle sign, terracotta roof)
  ('woodshop_sw', 2, 'spring', 'exterior', {'x': 9.4, 'z': 8.4}, 'Math.PI * 0.72'),
  # Woodshop: west approach (door + shingle + barrow)
  ('woodshop_w', 2, 'spring', 'exterior', {'x': 8.2, 'z': 12.6}, 'Math.PI * 0.5'),
  # Cottage interior: north-east corner with the back-room door + loft ladder
  ('cottage_in', 2, 'spring', 'cottage_interior', {'x': 1.4, 'z': 0.6}, 'Math.PI * 1.4'),
  # Willow exterior north-west (bargeboards on the benchmark, unchanged check)
  ('willow_nw', 2, 'spring', 'exterior', {'x': -19.2, 'z': 4.6}, 'Math.PI * 0.72'),
]
for name, day, season, loc, pos, facing in configs:
    save = dict(base)
    save['day'] = day
    save['season'] = season
    save['weather'] = 'sunlit'
    save['playerLocation'] = loc
    save['playerPos'] = pos
    save['exteriorPlayerPos'] = pos
    save['playerFacing'] = f'__FACING__'
    js = inject_js(save).replace('"__FACING__"', facing)
    open(f'/tmp/phase_bc_{name}.b64', 'w').write(base64.b64encode(js.encode()).decode())
EOF

agent-browser console --clear > /dev/null 2>&1
agent-browser errors --clear > /dev/null 2>&1
agent-browser set viewport 1440 900
agent-browser open "http://localhost:4183/?autostart=1"
sleep 8

for name in bakery_sw bakery_s bakery_in nook_e nook_ne nook_in woodshop_sw woodshop_w cottage_in willow_nw; do
  agent-browser eval -b "$(cat /tmp/phase_bc_${name}.b64)" > /dev/null
  sleep 7
  agent-browser screenshot /tmp/qa_shots/phase_bc_${name}.png
  echo "captured ${name}"
done

echo "=== CONSOLE / ERRORS ==="
agent-browser console | tail -8
echo "--- page errors ---"
agent-browser errors | tail -6

pkill -f "vite preview" 2>/dev/null
agent-browser close > /dev/null 2>&1
echo "phase B+C QA complete"
ls /tmp/qa_shots/ | rg phase_bc | head -12