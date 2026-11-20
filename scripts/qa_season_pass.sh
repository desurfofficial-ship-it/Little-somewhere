#!/bin/bash
# One-shot season QA: bakery / book nook / greenhouse seasonal dressing + resident motion feel.
set -u
cd /home/z/my-project/little-somewhere
export AGENT_BROWSER_SESSION=lsd-season-pass-01
mkdir -p /tmp/qa_shots && rm -f /tmp/qa_shots/season_*.png

setsid nohup npx vite preview --port=4176 --host=0.0.0.0 > /tmp/vite_preview_season.log 2>&1 < /dev/null &
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:4176/ && break; sleep 0.5; done
echo "server ready"

npx tsx scripts/make_dialogue_qa_save.ts > /tmp/season_base.json
python3 - << 'EOF'
import base64, json

base = json.loads(open('/tmp/season_base.json').read().strip())

def inject_js(save):
    payload = json.dumps(json.dumps(save))
    return (
      'localStorage.setItem("little_somewhere_world_v1", ' + payload + ');\n'
      'Storage.prototype.setItem = function(){};\n'
      'Storage.prototype.removeItem = function(){};\n'
      'location.reload(); "injected";'
    )

# Interior saves: season + location + door-spawn position in one reload
configs = [
  ('winter', 31, 'bakery_interior',   {'x': 0.0, 'z': 1.5},  'Math.PI'),
  ('autumn', 25, 'nook_interior',     {'x': 1.5, 'z': 0.0},  'Math.PI * 1.5'),
  ('spring', 2,  'greenhouse_interior', {'x': 2.3, 'z': -0.4}, 'Math.PI * 1.5'),
  ('winter', 31, 'greenhouse_interior', {'x': 2.3, 'z': -0.4}, 'Math.PI * 1.5'),
]
for season, day, loc, pos, facing in configs:
    save = dict(base)
    save['day'] = day
    save['season'] = season
    save['weather'] = 'sunlit'
    save['playerLocation'] = loc
    save['playerPos'] = pos
    save['exteriorPlayerPos'] = pos
    save['playerFacing'] = f'__FACING__'
    js = inject_js(save).replace('"__FACING__"', facing)
    open(f'/tmp/season_{season}_{loc.split("_")[0]}.b64', 'w').write(base64.b64encode(js.encode()).decode())

# Exterior winter save beside a resident path for the motion-feel shot
save = dict(base)
save['day'] = 31
save['season'] = 'winter'
save['weather'] = 'sunlit'
save['playerLocation'] = 'exterior'
save['exteriorPlayerPos'] = {'x': -8.0, 'z': 9.4}
save['playerPos'] = {'x': -8.0, 'z': 9.4}
save['playerFacing'] = 'Math.PI'
js = inject_js(save).replace('"Math.PI"', 'Math.PI')
open('/tmp/season_winter_ext.b64', 'w').write(base64.b64encode(js.encode()).decode())
EOF

agent-browser console --clear > /dev/null 2>&1
agent-browser errors --clear > /dev/null 2>&1
agent-browser set viewport 1440 900
agent-browser open "http://localhost:4176/?autostart=1"
sleep 8

agent-browser eval -b "$(cat /tmp/season_winter_bakery.b64)" > /dev/null
sleep 7
agent-browser eval "'loc:' + (document.body.textContent.match(/Hearth & Crumb|Bakery/)?.[0] ?? 'unknown')"
agent-browser screenshot /tmp/qa_shots/season_winter_bakery.png

agent-browser eval -b "$(cat /tmp/season_autumn_nook.b64)" > /dev/null
sleep 7
agent-browser eval "'loc:' + (document.body.textContent.match(/Linden Book Nook|Book Nook/)?.[0] ?? 'unknown')"
agent-browser screenshot /tmp/qa_shots/season_autumn_nook.png

agent-browser eval -b "$(cat /tmp/season_spring_greenhouse.b64)" > /dev/null
sleep 7
agent-browser eval "'loc:' + (document.body.textContent.match(/Sunbeam Greenhouse|Greenhouse/)?.[0] ?? 'unknown')"
agent-browser screenshot /tmp/qa_shots/season_spring_greenhouse.png

agent-browser eval -b "$(cat /tmp/season_winter_greenhouse.b64)" > /dev/null
sleep 7
agent-browser screenshot /tmp/qa_shots/season_winter_greenhouse.png

agent-browser eval -b "$(cat /tmp/season_winter_ext.b64)" > /dev/null
sleep 9
agent-browser screenshot /tmp/qa_shots/season_winter_exterior_a.png
sleep 3
agent-browser screenshot /tmp/qa_shots/season_winter_exterior_b.png

# Mobile viewport sanity: bakery winter at phone size
agent-browser set viewport 390 844
agent-browser eval -b "$(cat /tmp/season_winter_bakery.b64)" > /dev/null
sleep 7
agent-browser eval "'scrollW:' + document.documentElement.scrollWidth + ' innerW:' + window.innerWidth"
agent-browser screenshot /tmp/qa_shots/season_winter_bakery_mobile.png

echo "=== CONSOLE / ERRORS ==="
agent-browser console | tail -8
echo "--- page errors ---"
agent-browser errors | tail -6

pkill -f "vite preview" 2>/dev/null
agent-browser close > /dev/null 2>&1
echo "season QA complete"
ls -la /tmp/qa_shots/ | rg season
