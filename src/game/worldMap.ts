import { PropInteractableId, Vec2 } from './types';

export interface BoxObstacle {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CircleObstacle {
  id: string;
  x: number;
  z: number;
  radius: number;
}

export interface LandmarkZone {
  id: string;
  name: string;
  subtitle: string;
  x: number;
  z: number;
  radius: number;
}

export interface PropInteractable {
  id: PropInteractableId;
  name: string;
  x: number;
  z: number;
  interactRadius: number;
}

export interface RegionDefinition {
  id: string;
  name: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export const DEFAULT_REGION_ID = 'willow_square';

export const WORLD_BOUNDS = {
  minX: -25,
  maxX: 25,
  minZ: -23,
  maxZ: 23,
} as const;

export const REGIONS: Record<string, RegionDefinition> = {
  [DEFAULT_REGION_ID]: {
    id: DEFAULT_REGION_ID,
    name: 'Willow Lane & Fountain Square',
    bounds: WORLD_BOUNDS,
  },
};

export const PLAYER_SPAWN: Vec2 = { x: -8.5, z: 9.5 };
export const PLAYER_DEFAULT_FACING = Math.PI * 0.75; // Facing northeast toward town square

export const BOX_OBSTACLES: BoxObstacle[] = [
  // Player Home (Willow Step Cottage)
  { id: 'player_cottage', minX: -18.2, maxX: -10.8, minZ: 6.8, maxZ: 13.2 },
  // Hearth & Crumb Bakery
  { id: 'bakery', minX: -16.4, maxX: -8.4, minZ: -14.2, maxZ: -7.4 },
  // Linden Book Nook
  { id: 'book_nook', minX: -19.2, maxX: -12.4, minZ: -4.2, maxZ: 2.2 },
  // Copperwheel Workshop
  { id: 'workshop_arthur', minX: 9.4, maxX: 16.8, minZ: -14.8, maxZ: -8.2 },
  // Sunbeam Greenhouse
  { id: 'greenhouse', minX: 10.8, maxX: 17.8, minZ: -1.8, maxZ: 5.2 },
  // Pinecone Workshop (Barnaby)
  { id: 'workshop_barnaby', minX: 9.0, maxX: 15.8, minZ: 9.8, maxZ: 16.2 },
  // Pond basin (walk around or cross bridge on west/east)
  { id: 'pond_water', minX: -2.4, maxX: 5.6, minZ: 11.4, maxZ: 16.6 },
];

export const CIRCLE_OBSTACLES: CircleObstacle[] = [
  { id: 'fountain_basin', x: 0, z: 1.5, radius: 2.35 },
  { id: 'gazebo_pillars', x: 0, z: -9.5, radius: 2.3 },
  { id: 'hollow_oak', x: -6.2, z: 15.6, radius: 1.35 },
  { id: 'tea_cart', x: -5.4, z: -3.2, radius: 1.05 },
  { id: 'plaza_board', x: 4.4, z: -3.2, radius: 0.75 },
  // Willow Lane prototype courtyard trees & signpost
  { id: 'willow_tree_sw', x: -19.2, z: 13.6, radius: 0.68 },
  { id: 'willow_tree_south', x: -15.5, z: 15.0, radius: 0.65 },
  { id: 'willow_tree_nw', x: -16.8, z: 5.2, radius: 0.62 },
  { id: 'willow_signpost', x: -12.5, z: 5.7, radius: 0.42 },
];

export const LANDMARK_ZONES: LandmarkZone[] = [
  { id: 'home', name: 'Willow Step Cottage', subtitle: 'Your quiet porch & mailbox', x: -10, z: 10, radius: 6.5 },
  { id: 'square', name: 'Sunlit Fountain Plaza', subtitle: 'Heart of Little Somewhere', x: 0, z: 1.5, radius: 6.5 },
  { id: 'gazebo', name: 'Old Bell Gazebo', subtitle: 'Ivy-draped cedar spire', x: 0, z: -9.5, radius: 6.0 },
  { id: 'bakery', name: 'Hearth & Crumb Bakery', subtitle: 'Clara’s warm sourdough oven', x: -11, z: -7, radius: 6.0 },
  { id: 'workshop_arthur', name: 'Copperwheel Cottage', subtitle: 'Arthur’s clockwork bench', x: 10, z: -8, radius: 6.0 },
  { id: 'greenhouse', name: 'Sunbeam Greenhouse', subtitle: 'Mina’s glass flower house', x: 10.5, z: 2, radius: 6.0 },
  { id: 'book_nook', name: 'Linden Book Nook', subtitle: 'Nora’s paperbacks & tea', x: -12, z: -1, radius: 5.5 },
  { id: 'barnaby', name: 'Pinecone Woodshop', subtitle: 'Barnaby’s cedar shavings', x: 9, z: 12, radius: 5.5 },
  { id: 'pond', name: 'Mirror Pond & Hollow Oak', subtitle: 'Dragonflies and old secrets', x: -1, z: 14.5, radius: 6.5 },
];

export const PROP_INTERACTABLES: PropInteractable[] = [
  { id: 'player_door', name: 'Cottage Porch Door', x: -10.3, z: 10.0, interactRadius: 2.5 },
  { id: 'player_mailbox', name: 'Willow Mailbox', x: -9.8, z: 7.2, interactRadius: 2.3 },
  { id: 'gazebo_bell', name: 'Gazebo Bell Spire', x: 0, z: -6.8, interactRadius: 2.8 },
  { id: 'fountain_plaza', name: 'Mossy Stone Fountain', x: 0, z: 4.1, interactRadius: 2.6 },
  { id: 'hollow_oak', name: 'Hollow Oak Root', x: -6.2, z: 14.0, interactRadius: 2.5 },
  { id: 'plaza_noticeboard', name: 'Neighborhood Noticeboard', x: 4.4, z: -2.2, interactRadius: 2.3 },
];

export function distance2D(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

export function isPointWalkable(x: number, z: number, actorRadius = 0.48): boolean {
  if (
    x < WORLD_BOUNDS.minX + actorRadius ||
    x > WORLD_BOUNDS.maxX - actorRadius ||
    z < WORLD_BOUNDS.minZ + actorRadius ||
    z > WORLD_BOUNDS.maxZ - actorRadius
  ) {
    return false;
  }

  for (const box of BOX_OBSTACLES) {
    if (
      x > box.minX - actorRadius &&
      x < box.maxX + actorRadius &&
      z > box.minZ - actorRadius &&
      z < box.maxZ + actorRadius
    ) {
      return false;
    }
  }

  for (const circle of CIRCLE_OBSTACLES) {
    const dx = x - circle.x;
    const dz = z - circle.z;
    const minDist = circle.radius + actorRadius;
    if (dx * dx + dz * dz < minDist * minDist) {
      return false;
    }
  }

  return true;
}

export function resolveMovement(current: Vec2, desired: Vec2, actorRadius = 0.48): Vec2 {
  if (isPointWalkable(desired.x, desired.z, actorRadius)) {
    return desired;
  }
  // Axis-separated sliding so movement along cottages & fountain feels smooth
  if (isPointWalkable(desired.x, current.z, actorRadius)) {
    return { x: desired.x, z: current.z };
  }
  if (isPointWalkable(current.x, desired.z, actorRadius)) {
    return { x: current.x, z: desired.z };
  }
  return current;
}

export function getLandmarkAt(pos: Vec2): LandmarkZone {
  let closest: LandmarkZone = {
    id: 'lane',
    name: 'Cobblestone Lane',
    subtitle: 'Wandering through Little Somewhere',
    x: pos.x,
    z: pos.z,
    radius: 99,
  };
  let bestDist = Infinity;

  for (const zone of LANDMARK_ZONES) {
    const d = distance2D(pos, { x: zone.x, z: zone.z });
    if (d <= zone.radius && d < bestDist) {
      bestDist = d;
      closest = zone;
    }
  }
  return closest;
}
