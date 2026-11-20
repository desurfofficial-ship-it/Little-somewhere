#!/bin/bash
# Phase A QA: Sunbeam Conservatory rebuild + door-side reconciliation.
# Captures exterior (vestibule + glazing + gardener's yard), interior (west door,
# east growing shelf), the moon-petal bench grounding, and a mobile viewport check.
set -u
cd /home/z/my-project/little-somewhere
export AGENT_BROWSER_SESSION=lsd-building-phase-a
mkdir -p /tmp/qa_shots && rm -f /tmp/qa_shots/phase_a_*.png

npx vite build > /tmp/phase_a_build.log 2>&1 || { echo "BUILD FAILED"; tail -20 /tmp/phase_a_build.log; exit 1; }
setsid nohup npx vite preview --port=4177 --host=0.0.0.0 > /tmp/vite_preview_phase_a.log 2>&1 < /dev/null &
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:4177/ && break; sleep 0.5; done
echo "server ready"

npx tsx scripts/make_dialogue_qa_save.ts > /tmp/phase_a_base.json
python3 - << 'EOF'
import base64, json

base = json.loads(open('/tmp/phase_a_base.json').read().strip())

def inject_js(save):
    payload = json.dumps(json.dumps(save))
    return (
      'localStorage.setItem("little_somewhere_world_v1", ' + payload + ');\n'
      'Storage.prototype.setItem = function(){};\n'
      'Storage.prototype.removeItem = function(){};\n'
      'location.reload(); "injected";'
    )

configs = [
  # Exterior: standing on the door approach looking east at the vestibule
  ('ext_door', 2, 'spring', 'exterior', {'x': 9.5, 'z': 3.2}, 'Math.PI * 0.5'),
  # Exterior: wide three-quarter view of the whole conservatory from the lane
  ('ext_wide', 2, 'spring', 'exterior', {'x': 8.2, 'z': 8.6}, 'Math.PI * 0.72'),
  # Exterior: north-west corner (rain barrel, herb beds, tool rack side)
  ('ext_north', 2, 'spring', 'exterior', {'x': 12.6, 'z': -3.4}, 'Math.PI * 0.75'),
  # Interior: at the reconciled west door spawn facing into the room
  ('in_door', 2, 'spring', 'greenhouse_interior', {'x': -2.3, 'z': 1.5}, 'Math.PI * 0.5'),
  # Interior: center of the room facing the east growing shelf
  ('in_shelf', 2, 'spring', 'greenhouse_interior', {'x': 0.2, 'z': 0.0}, '0'),
  # Interior winter: heater corner + frost dressing
  ('in_winter', 31, 'winter', 'greenhouse_interior', {'x': 0.2, 'z': 0.0}, 'Math.PI * 1.25'),
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
    open(f'/tmp/phase_a_{name}.b64', 'w').write(base64.b64encode(js.encode()).decode())
EOF

agent-browser console --clear > /dev/null 2>&1
agent-browser errors --clear > /dev/null 2>&1
agent-browser set viewport 1440 900
agent-browser open "http://localhost:4177/?autostart=1"
sleep 8

for name in ext_door ext_wide ext_north in_door in_shelf; do
  agent-browser eval -b "$(cat /tmp/phase_a_${name}.b64)" > /dev/null
  sleep 7
  agent-browser screenshot /tmp/qa_shots/phase_a_${name}.png
  echo "captured ${name}"
done

# Moon-petal bloom check on the rebuilt potting bench (stage 3 flag)
python3 - << 'EOF'
import base64, json
save = json.loads(open('/tmp/phase_a_base.json').read().strip())
save['day'] = 2
save['season'] = 'spring'
save['weather'] = 'sunlit'
save['playerLocation'] = 'exterior'
save['playerPos'] = {'x': 9.5, 'z': 3.2}
save['exteriorPlayerPos'] = {'x': 9.5, 'z': 3.2}
save['playerFacing'] = 'Math.PI * 0.5'
save['flags'] = {**save.get('flags', {}), 'plantedMoonPetals': True}
js = ('localStorage.setItem("little_somewhere_world_v1", ' + json.dumps(json.dumps(save)) + ');\n'
      'Storage.prototype.setItem = function(){};\nStorage.prototype.removeItem = function(){};\n'
      'location.reload(); "injected";')
open('/tmp/phase_a_moon.b64', 'w').write(base64.b64encode(js.encode()).decode())
EOF
agent-browser eval -b "$(cat /tmp/phase_a_moon.b64)" > /dev/null
sleep 7
agent-browser screenshot /tmp/qa_shots/phase_a_moon_bench.png
echo "captured moon_bench"

agent-browser eval -b "$(cat /tmp/phase_a_in_winter.b64)" > /dev/null
sleep 7
agent-browser screenshot /tmp/qa_shots/phase_a_in_winter.png
echo "captured in_winter"

# Mobile viewport sanity on the exterior door approach
agent-browser set viewport 390 844
agent-browser eval -b "$(cat /tmp/phase_a_ext_door.b64)" > /dev/null
sleep 7
agent-browser eval "'scrollW:' + document.documentElement.scrollWidth + ' innerW:' + window.innerWidth"
agent-browser screenshot /tmp/qa_shots/phase_a_ext_door_mobile.png

echo "=== CONSOLE / ERRORS ==="
agent-browser console | tail -8
echo "--- page errors ---"
agent-browser errors | tail -6

pkill -f "vite preview" 2>/dev/null
agent-browser close > /dev/null 2>&1
echo "phase A QA complete"
ls -la /tmp/qa_shots/ | rg phase_a