#!/bin/bash
# QA helper: teleport the player inside the running game by mutating the live save.
# Usage: qa_teleport.sh <x> <z> [facing]
X="$1"; Z="$2"; FACING="$3"
agent-browser eval "window.dispatchEvent(new KeyboardEvent('keydown', {code: 'Escape', bubbles: true})); JSON.stringify(localStorage.getItem('little_somewhere_world_v1'))" > /tmp/live_save_raw.txt 2>/dev/null
python3 - "$X" "$Z" "$FACING" << 'EOF'
import json, sys
x, z, facing = float(sys.argv[1]), float(sys.argv[2]), sys.argv[3]
raw = open('/tmp/live_save_raw.txt').read().strip()
while isinstance(raw, str):
    raw = json.loads(raw)
    if isinstance(raw, str):
        continue
w = raw
w['playerPos'] = {'x': x, 'z': z}
if facing:
    w['playerFacing'] = float(facing)
payload = json.dumps(json.dumps(w))
js = "localStorage.setItem(\"little_somewhere_world_v1\", " + payload + "); Storage.prototype.setItem = function(){}; Storage.prototype.removeItem = function(){}; location.reload(); \"done\";"
open('/tmp/teleport.js', 'w').write(js)
EOF
agent-browser eval "$(cat /tmp/teleport.js)"
sleep 5
agent-browser eval "Array.from(document.querySelectorAll('button')).map(b => (b.getAttribute('aria-label') || b.textContent || '').slice(0,70)).filter(t => t.length).join(' | ')" | head -2
