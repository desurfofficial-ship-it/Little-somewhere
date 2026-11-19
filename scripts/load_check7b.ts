import { migrateWorldState } from '../src/game/migrations';
import { readFileSync } from 'fs';
const raw = JSON.parse(readFileSync('/tmp/build7_door.json', 'utf8'));
const res = migrateWorldState(raw);
console.log(JSON.stringify({
  day: res.state.day,
  minute: res.state.minuteOfDay,
  loc: res.state.playerLocation,
  pos: res.state.playerPos,
  claraMet: res.state.residents.clara?.met,
  bakeryVisited: res.state.sideFlags?.bakeryVisited,
  warnings: res.warnings,
}));
