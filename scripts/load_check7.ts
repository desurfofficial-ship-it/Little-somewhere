import { loadWorldState } from '../src/game/storage';
const w = loadWorldState();
console.log(JSON.stringify({
  day: w.day,
  minute: w.minuteOfDay,
  loc: w.playerLocation,
  pos: w.playerPos,
  claraMet: w.residents.clara?.met,
  bakeryVisited: w.sideFlags?.bakeryVisited,
}));
