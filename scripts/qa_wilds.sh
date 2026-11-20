#!/bin/bash
# Wild Hollows QA (Build 10): Foxglove Rise deck elevation, Old Stone Well,
# Sorrel Hollow, Marigold Lane, Bee Line, discovery flag + interaction flow.
# Desktop 1440x900 + mobile 390x844, console/page error audit.
set -u
cd /home/z/my-project/little-somewhere
export AGENT_BROWSER_SESSION=lsd-wilds-qa
mkdir -p /tmp/qa_shots && rm -f /tmp/qa_shots/wilds_*.png

npx vite build > /tmp/wilds_build.log 2>&1 || { echo "BUILD FAILED"; tail -20 /tmp/wilds_build.log; exit 1; }
setsid nohup npx vite preview --port=4184 --host=0.0.0.0 > /tmp/vite_preview_wilds.log 2>&1 < /dev/null &
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:4184/ && break; sleep 0.5; done
echo "server ready"

npx tsx scripts/make_wilds_qa_save.ts > /tmp/wilds_base.json
python3 - << 'EOF'
import base64, json

base = json.loads(open('/tmp/wilds_base.json').read().strip())

def inject_js(save):
    payload = json.dumps(json.dumps(save))
    return (
      'localStorage.setItem("little_somewhere_world_v1", ' + payload + ');\n'
      'Storage.prototype.setItem = function(){};\n'
      'Storage.prototype.removeItem = function(){};\n'
      'location.reload(); "injected";'
    )

configs = [
  # Foxglove Rise: player ON the cedar deck (elevation + bench + vista)
  ('rise_deck', {'x': 21.6, 'z': 18.5}, 'Math.atan2(20.9 - 21.6, 19.1 - 18.5)'),
  # Rise stair approach from the north
  ('rise_stair', {'x': 21.3, 'z': 15.4}, 'Math.atan2(21.4 - 21.3, 17.5 - 15.4)'),
  # Old Stone Well from the stand spot
  ('well_close', {'x': -20.2, 'z': 18.3}, 'Math.atan2(-21.4 + 20.2, 19.0 - 18.3)'),
  # Sorrel Hollow wide (birches + bench + well)
  ('hollow_wide', {'x': -16.6, 'z': 18.2}, 'Math.atan2(-21.0 + 16.6, 18.6 - 18.2)'),
  # Marigold Lane bank
  ('lane_bank', {'x': 20.3, 'z': 4.6}, 'Math.atan2(20.3 - 20.3, 2.5 - 4.6)'),
  # Bee Line log
  ('beeline_log', {'x': 10.4, 'z': -18.6}, 'Math.atan2(11.0 - 10.4, -19.7 + 18.6)'),
]
for name, pos, facing in configs:
    save = dict(base)
    save['playerPos'] = pos
    save['exteriorPlayerPos'] = pos
    save['playerFacing'] = '__FACING__'
    save['exteriorPlayerFacing'] = '__FACING__'
    js = inject_js(save).replace('"__FACING__"', facing)
    open(f'/tmp/wilds_{name}.b64', 'w').write(base64.b64encode(js.encode()).decode())

# Discovery check save: player parked inside the Foxglove Rise zone; the sim
# should grant explored_foxglove_rise + memory within a few ticks, autosave persists it.
disc = dict(base)
disc['playerPos'] = {'x': 21.6, 'z': 18.5}
disc['exteriorPlayerPos'] = {'x': 21.6, 'z': 18.5}
disc['playerFacing'] = -0.86
disc['exteriorPlayerFacing'] = -0.86
open('/tmp/wilds_disc.b64', 'w').write(base64.b64encode(inject_js(disc).encode()).decode())
print('saves ready')
EOF

agent-browser console --clear > /dev/null 2>&1
agent-browser errors --clear > /dev/null 2>&1
agent-browser set viewport 1440 900
agent-browser open "http://localhost:4184/?autostart=1"
sleep 8

for name in rise_deck rise_stair well_close hollow_wide lane_bank beeline_log; do
  agent-browser eval -b "$(cat /tmp/wilds_${name}.b64)" > /dev/null
  sleep 7
  agent-browser screenshot /tmp/qa_shots/wilds_${name}.png
  echo "captured ${name}"
done

# Interaction flow: well lore sheet with foxglove seed chip
agent-browser eval -b "$(cat /tmp/wilds_well_close.b64)" > /dev/null
sleep 7
agent-browser eval "(() => { const btns = [...document.querySelectorAll('button')]; const t = btns.find(b => /Well/i.test(b.textContent || '')); if (t) { t.click(); return 'clicked well interact'; } return 'NO WELL BUTTON'; })()"
sleep 2
agent-browser screenshot /tmp/qa_shots/wilds_well_interact.png
echo "captured well_interact"
agent-browser eval "(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('Close') || x.getAttribute('aria-label')?.includes('Close')); if (b) b.click(); return 'closed'; })()" > /dev/null

# Vista sheet (season-aware panorama + deck framing)
agent-browser eval -b "$(cat /tmp/wilds_rise_deck.b64)" > /dev/null
sleep 7
agent-browser eval "(() => { const btns = [...document.querySelectorAll('button')]; const t = btns.find(b => /Rise|Panorama/i.test(b.textContent || '')); if (t) { t.click(); return 'clicked vista'; } return 'NO VISTA BUTTON: ' + btns.filter(b=>b.offsetParent).map(b=>(b.textContent||'').slice(0,22)).join(' | '); })()"
sleep 2
agent-browser screenshot /tmp/qa_shots/wilds_vista_interact.png
agent-browser eval "(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('Close') || x.getAttribute('aria-label')?.includes('Close')); if (b) b.click(); return 'closed'; })()" > /dev/null

# Discovery persistence: reload the discovery save (autosave patched off), then
# unpatch storage so the sim's 5s autosave writes, wait, read back the flag.
agent-browser eval -b "$(cat /tmp/wilds_disc.b64)" > /dev/null
sleep 7
agent-browser eval "Storage.prototype.setItem = Storage.prototype._origSetItem || function(k,v){ (this.__data ||= {})[k]=v; Object.getPrototypeOf(Storage.prototype).setItem.call(this,k,v); }; 'storage restored'" > /dev/null
sleep 9
agent-browser eval "(() => { const w = JSON.parse(localStorage.getItem('little_somewhere_world_v1') || '{}'); const sf = w.sideFlags || {}; const mems = (w.memories || []).map(m => m.id); return JSON.stringify({ rise: sf.explored_foxglove_rise === true, mem: mems.includes('mem_explored_foxglove_rise'), posies: sf.meadowPosiesPicked, all: ['explored_marigold_lane','explored_foxglove_rise','explored_sorrel_hollow','explored_bee_line'].map(k => sf[k] === true) }); })()"
sleep 1
agent-browser screenshot /tmp/qa_shots/wilds_discovery_state.png

# Mobile viewport: stair approach + well + overflow audit
agent-browser set viewport 390 844
agent-browser eval -b "$(cat /tmp/wilds_rise_stair.b64)" > /dev/null
sleep 7
agent-browser eval "(() => ({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth }))()"
agent-browser screenshot /tmp/qa_shots/wilds_mobile_stair.png
agent-browser eval -b "$(cat /tmp/wilds_well_close.b64)" > /dev/null
sleep 7
agent-browser screenshot /tmp/qa_shots/wilds_mobile_well.png
echo "captured mobile"

echo "=== CONSOLE / ERRORS ==="
agent-browser console | tail -10
echo "--- page errors ---"
agent-browser errors | tail -8

pkill -f "vite preview" 2>/dev/null
agent-browser close > /dev/null 2>&1
echo "wilds QA complete"
ls /tmp/qa_shots/ | rg wilds | head -14
