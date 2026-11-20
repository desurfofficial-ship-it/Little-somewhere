#!/bin/bash
# Pass 26 QA: face-detail close-ups (Barnaby/Rowan beards, Mina hat flower),
# bakery & nook porch season dressing, and resident dust-poof observation.
set -u
cd /home/z/my-project/little-somewhere
export AGENT_BROWSER_SESSION=lsd-pass26-01
mkdir -p /tmp/qa_shots && rm -f /tmp/qa_shots/pass26_*.png
mkdir -p download/asset-qa/pass26 && rm -f download/asset-qa/pass26/*.png

setsid nohup npx vite preview --port=4177 --host=0.0.0.0 > /tmp/vite_preview_pass26.log 2>&1 < /dev/null &
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:4177/ && break; sleep 0.5; done
echo "server ready"

npx tsx scripts/make_pass26_qa_save.ts > /tmp/pass26_base.json
python3 - << 'EOF'
import base64, json

base = json.loads(open('/tmp/pass26_base.json').read().strip())

def inject_js(save):
    payload = json.dumps(json.dumps(save))
    return (
      'localStorage.setItem("little_somewhere_world_v1", ' + payload + ');\n'
      'Storage.prototype.setItem = function(){};\n'
      'Storage.prototype.removeItem = function(){};\n'
      'location.reload(); "injected";'
    )

def with_player(pos, facing_expr, minute=None, npc_overrides=None):
    save = dict(base)
    if minute is not None:
        save['minuteOfDay'] = minute
    if npc_overrides:
        rt = dict(save['npcRuntime'])
        for rid, ov in npc_overrides.items():
            entry = dict(rt[rid])
            entry.update(ov)
            rt[rid] = entry
        save['npcRuntime'] = rt
    save['playerPos'] = pos
    save['exteriorPlayerPos'] = pos
    save['playerFacing'] = '__FACING__'
    save['exteriorPlayerFacing'] = '__FACING__'
    js = inject_js(save).replace('"__FACING__"', facing_expr)
    return base64.b64encode(js.encode()).decode()

scenes = {
  'barnaby':  ({'x': 3.9,  'z': 4.1},   'Math.atan2(2.9-3.9, 3.2-4.1)', None, None),
  # Rowan pinned in the open plaza facing the camera — guaranteed clear shot
  # of the orchard-keeper beard (orchard slots are all tree-canopy blocked).
  'rowan':    ({'x': 4.05, 'z': 1.25}, 'Math.atan2(3.2-4.05, 0.4-1.25)', 780,
               {'rowan': {'position': {'x': 3.2, 'z': 0.4}, 'targetPos': {'x': 3.2, 'z': 0.4},
                          'facing': 0.8, 'targetFacing': 0.8, 'waypoints': [], 'currentSpeed': 0,
                          'animState': 'interact', 'activityUntilMinute': 850, 'goalCommittedUntilMinute': 850}}),
  # Mina pinned in the open plaza facing the camera — straw hat ribbon + the
  # tucked blossom read cleanly from the SE camera here.
  'mina':     ({'x': 4.05, 'z': 1.25}, 'Math.atan2(3.2-4.05, 0.4-1.25)', 780,
               {'mina': {'position': {'x': 3.2, 'z': 0.4}, 'targetPos': {'x': 3.2, 'z': 0.4},
                         'facing': 0.8, 'targetFacing': 0.8, 'waypoints': [], 'currentSpeed': 0,
                         'animState': 'admire', 'activityUntilMinute': 850, 'goalCommittedUntilMinute': 850}}),
  'bakery_porch': ({'x': -12.4, 'z': -6.7}, 'Math.PI', None, None),
  'nook_porch':   ({'x': -10.9, 'z': 0.2}, 'Math.atan2(-13.1+10.9, -1.0-0.2)', None, None),
  'plaza':        ({'x': 2.0,  'z': 4.6},   '-2.1', None, None),
}
for name, (pos, facing, minute, npc_ov) in scenes.items():
    open(f'/tmp/pass26_{name}.b64', 'w').write(with_player(pos, facing, minute, npc_ov))

# Spring variant for the bakery porch (day 2 = spring)
spring = dict(base)
spring['day'] = 2
spring['season'] = 'spring'
spring['weather'] = 'sunlit'
spring['playerPos'] = {'x': -12.4, 'z': -6.7}
spring['exteriorPlayerPos'] = {'x': -12.4, 'z': -6.7}
spring['playerFacing'] = '__FACING__'
spring['exteriorPlayerFacing'] = '__FACING__'
js = inject_js(spring).replace('"__FACING__"', 'Math.PI')
open('/tmp/pass26_bakery_spring.b64', 'w').write(base64.b64encode(js.encode()).decode())
EOF

agent-browser console --clear > /dev/null 2>&1
agent-browser errors --clear > /dev/null 2>&1
agent-browser set viewport 1440 900
agent-browser open "http://localhost:4177/?autostart=1"
sleep 8

ZOOM_IN="document.querySelector('canvas').dispatchEvent(new WheelEvent('wheel',{deltaY:-2000})); 'zoomed'"

# --- Face-detail close-ups: zoom to min, open dialogue (the resident turns to
# face the player & the camera snaps into the conversation framing), shoot ---
KEY_E="window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE',bubbles:true})); 'interact'"
for name in barnaby rowan mina; do
  agent-browser eval -b "$(cat /tmp/pass26_${name}.b64)" > /dev/null
  sleep 7
  agent-browser eval "$ZOOM_IN" > /dev/null
  sleep 2
  agent-browser eval "$KEY_E" > /dev/null
  sleep 3
  agent-browser eval "'sheet:' + (document.body.textContent.match(/Talk with|Barnaby|Rowan|Mina/)?.[0] ?? 'none')"
  agent-browser screenshot /tmp/qa_shots/pass26_${name}_closeup.png
  # Close the sheet — the resident keeps facing the player for several sim
  # minutes, so the unobstructed 3D face (beard / hat flower) is now in frame.
  agent-browser eval "window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',bubbles:true})); 'esc'" > /dev/null
  sleep 1.5
  agent-browser screenshot /tmp/qa_shots/pass26_${name}_face.png
  sleep 1
done

# --- Porch season shots (default zoom shows the whole doorway) ---
agent-browser eval -b "$(cat /tmp/pass26_bakery_porch.b64)" > /dev/null
sleep 7
agent-browser eval "$ZOOM_IN" > /dev/null
sleep 2
agent-browser screenshot /tmp/qa_shots/pass26_bakery_porch_winter.png

agent-browser eval -b "$(cat /tmp/pass26_nook_porch.b64)" > /dev/null
sleep 7
agent-browser eval "$ZOOM_IN" > /dev/null
sleep 2
agent-browser screenshot /tmp/qa_shots/pass26_nook_porch_winter.png

agent-browser eval -b "$(cat /tmp/pass26_bakery_spring.b64)" > /dev/null
sleep 7
agent-browser eval "$ZOOM_IN" > /dev/null
sleep 2
agent-browser screenshot /tmp/qa_shots/pass26_bakery_porch_spring.png

# --- Plaza: resident dust poofs + winter knits; two frames to catch movement ---
agent-browser eval -b "$(cat /tmp/pass26_plaza.b64)" > /dev/null
sleep 9
agent-browser eval "$ZOOM_IN" > /dev/null
sleep 2
agent-browser screenshot /tmp/qa_shots/pass26_plaza_poofs_a.png
sleep 4
agent-browser screenshot /tmp/qa_shots/pass26_plaza_poofs_b.png

echo "=== CONSOLE / ERRORS ==="
agent-browser console | tail -8
echo "--- page errors ---"
agent-browser errors | tail -6

pkill -f "vite preview" 2>/dev/null
agent-browser close > /dev/null 2>&1

# Crop close-ups around each resident for face inspection (cheap local zoom)
python3 - << 'EOF'
from PIL import Image
crops = {
  'pass26_barnaby_closeup': (660, 300, 1160, 700),
  'pass26_rowan_closeup':   (330, 330, 830, 730),
  'pass26_mina_closeup':    (560, 330, 1060, 730),
}
for name, box in crops.items():
    img = Image.open(f'/tmp/qa_shots/{name}.png').crop(box)
    img = img.resize((img.width * 2, img.height * 2), Image.LANCZOS)
    img.save(f'/tmp/qa_shots/{name}_crop.png')
    print(name, 'cropped')
EOF
echo "pass26 QA complete"
ls -la /tmp/qa_shots/ | rg pass26