import { createFreshWorldState, serializeWorldState } from '../src/game/storage';
import { migrateWorldState } from '../src/game/migrations';
const world = createFreshWorldState();
const parsed = JSON.parse(serializeWorldState(world)) as Record<string, unknown>;
const v7Raw = { ...parsed, schemaVersion: 7 } as Record<string, unknown>;
delete v7Raw.bakeryState;
delete v7Raw.nookState;
const result = migrateWorldState(v7Raw);
console.log(JSON.stringify(result.warnings, null, 2));
