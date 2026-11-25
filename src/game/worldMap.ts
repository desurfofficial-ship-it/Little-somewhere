import {
  CarryableItemId,
  PropInteractableId,
  SeatSpot,
  Vec2,
  WorldPropPlacement,
} from './types';
import { getCobbleSurfaceHeight } from './groundSurfaces';

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
  { id: 'pond_water', minX: -2.2, maxX: 5.68, minZ: 11.2, maxZ: 16.65 },
  // Cedar bridge west handrail & culvert mouth barrier (keeps walkers inside bridge deck or west lawn without clipping rails/brook)
  { id: 'bridge_west_rail', minX: -3.7, maxX: -3.58, minZ: 11.72, maxZ: 16.28 },
  // Foxglove Rise terraced knoll (SE) — mound body framing the walkable ramp (north, z 16.7..18.0) and deck (20.4..22.5 × 18.0..20.2);
  // deck itself stays walkable and is elevated via getGroundHeightAt (same pattern as the cedar bridge).
  // Ramp corridor widened (WP-1/WQA-01): mound edges 20.42/22.38 give the player radius (0.48) a ~1.0 m
  // clear stair lane (20.9..21.9) instead of the former 0.24 m pinch that snagged tap-walks.
  { id: 'rise_mound_west_of_ramp', minX: 18.1, maxX: 20.42, minZ: 16.6, maxZ: 18.0 },
  { id: 'rise_mound_east_of_ramp', minX: 22.38, maxX: 24.6, minZ: 16.6, maxZ: 18.0 },
  { id: 'rise_mound_west_of_deck', minX: 18.1, maxX: 20.4, minZ: 18.0, maxZ: 20.2 },
  { id: 'rise_mound_east_of_deck', minX: 22.5, maxX: 24.6, minZ: 18.0, maxZ: 20.2 },
  { id: 'rise_mound_south_of_deck', minX: 18.1, maxX: 24.6, minZ: 20.2, maxZ: 21.9 },
];

export const CIRCLE_OBSTACLES: CircleObstacle[] = [
  { id: 'fountain_basin', x: 0, z: 1.5, radius: 2.46 },
  { id: 'gazebo_pillars', x: 0, z: -9.5, radius: 2.3 },
  { id: 'hollow_oak', x: -6.2, z: 15.6, radius: 1.35 },
  { id: 'tea_cart', x: -5.4, z: -3.2, radius: 1.05 },
  { id: 'plaza_board', x: 4.4, z: -3.2, radius: 0.75 },
  // Plaza & Pond handcrafted cedar benches
  { id: 'east_bench', x: 5.15, z: 3.0, radius: 0.42 },
  { id: 'west_bench', x: -5.15, z: 3.0, radius: 0.42 },
  { id: 'gazebo_bench', x: 5.2, z: -9.8, radius: 0.42 },
  { id: 'pond_bench', x: 1.8, z: 19.3, radius: 0.42 },
  // Willow Lane prototype courtyard trees & signpost
  { id: 'willow_tree_sw', x: -19.2, z: 13.6, radius: 0.68 },
  { id: 'willow_tree_south', x: -15.5, z: 15.0, radius: 0.65 },
  { id: 'willow_tree_nw', x: -16.8, z: 5.2, radius: 0.62 },
  { id: 'willow_signpost', x: -12.5, z: 5.7, radius: 0.42 },
  // Collision twins for previously walk-through props (WP-1/WQA-05, audit-1c M2/M3/M4).
  // NOTE: pond_driftwood_log deliberately has NO circle twin — the thin drift log (r≈0.16)
  // lies along the shoreline with its west body inside the pond_water inflated exclusion
  // and its east tip IS the designed comb stand-spot (same stand-on contract as the
  // south viewing pier); a center obstacle would wall off the interaction.
  { id: 'willow_mailbox_post', x: -9.8, z: 7.2, radius: 0.25 },
  { id: 'gh_planter_bench', x: 11.1, z: 1.7, radius: 0.45 },
  { id: 'lane_signpost', x: 21.5, z: 0.8, radius: 0.35 },
  { id: 'beeline_cairn', x: 8.2, z: -19.9, radius: 0.4 },
  // Fern Hollow Orchard (north district landmark)
  { id: 'orchard_tree_nw', x: -9.6, z: -17.2, radius: 0.52 },
  { id: 'orchard_tree_w', x: -6.6, z: -20.1, radius: 0.52 },
  { id: 'orchard_tree_mid', x: -3.2, z: -18.2, radius: 0.52 },
  { id: 'orchard_tree_n', x: -0.2, z: -20.3, radius: 0.52 },
  { id: 'orchard_tree_e', x: 2.6, z: -17.0, radius: 0.52 },
  { id: 'orchard_tree_ne', x: 5.4, z: -19.6, radius: 0.52 },
  { id: 'orchard_gate_w', x: -4.3, z: -14.9, radius: 0.42 },
  { id: 'orchard_gate_e', x: -0.9, z: -14.9, radius: 0.42 },
  { id: 'orchard_ladder', x: -5.85, z: -20.35, radius: 0.35 },
  { id: 'orchard_crates', x: -3.7, z: -20.3, radius: 0.55 },
  { id: 'orchard_skep', x: 4.9, z: -16.3, radius: 0.4 },
  { id: 'orchard_bench', x: -11.0, z: -20.6, radius: 0.42 },
  { id: 'orchard_tasting_table', x: 1.8, z: -19.4, radius: 0.68 },
  // The Wild Hollows (Build 10)
  { id: 'old_stone_well', x: -21.4, z: 19.0, radius: 0.78 },
  { id: 'wild_bee_log', x: 11.0, z: -19.7, radius: 0.5 },
  { id: 'rise_bench', x: 20.85, z: 19.1, radius: 0.42 },
  { id: 'sorrel_bench', x: -19.7, z: 17.55, radius: 0.42 },
  { id: 'hollow_birch_w', x: -22.6, z: 16.3, radius: 0.45 },
  { id: 'hollow_birch_s', x: -19.15, z: 20.7, radius: 0.45 },
  { id: 'hollow_birch_nw', x: -23.1, z: 19.7, radius: 0.45 },
  { id: 'lane_boulder_n', x: 18.9, z: 7.4, radius: 0.5 },
  { id: 'lane_boulder_s', x: 21.9, z: 10.8, radius: 0.45 },
];

export const SEAT_SPOTS: readonly SeatSpot[] = [
  {
    id: 'seat_east_plaza',
    label: 'East Plaza Bench',
    seatPos: { x: 5.15, z: 3.0 },
    approachPos: { x: 4.15, z: 3.0 },
    facingAngle: -Math.PI / 2,
    seatHeight: 0.36,
    zoneId: 'square',
  },
  {
    id: 'seat_west_plaza',
    label: 'West Plaza Bench',
    seatPos: { x: -5.15, z: 3.0 },
    approachPos: { x: -4.15, z: 3.0 },
    facingAngle: Math.PI / 2,
    seatHeight: 0.36,
    zoneId: 'square',
  },
  {
    id: 'seat_gazebo_east',
    label: 'Gazebo Cedar Bench',
    seatPos: { x: 5.2, z: -9.8 },
    approachPos: { x: 4.15, z: -9.8 },
    facingAngle: -Math.PI / 2,
    seatHeight: 0.36,
    zoneId: 'gazebo',
  },
  {
    id: 'seat_pond_south',
    label: 'Mirror Pond Bench',
    seatPos: { x: 1.8, z: 19.3 },
    approachPos: { x: 1.8, z: 18.2 },
    facingAngle: Math.PI,
    seatHeight: 0.36,
    zoneId: 'pond',
  },
  {
    id: 'seat_orchard_bench',
    label: 'Fern Hollow Orchard Bench',
    seatPos: { x: -11.0, z: -20.6 },
    approachPos: { x: -10.0, z: -20.6 },
    facingAngle: Math.PI / 2,
    seatHeight: 0.36,
    zoneId: 'orchard',
  },
  {
    id: 'seat_foxglove_rise',
    label: 'Foxglove Rise Lookout Bench',
    seatPos: { x: 20.85, z: 19.1 },
    approachPos: { x: 21.85, z: 19.1 },
    facingAngle: -Math.PI / 2,
    seatHeight: 0.36,
    zoneId: 'square',
  },
  {
    id: 'seat_sorrel_hollow',
    label: 'Sorrel Hollow Garden Bench',
    seatPos: { x: -19.7, z: 17.55 },
    // Overhaul C-3: approach widened +0.15 — the old −18.75 left a 0.05
    // margin against the r 0.42 bench collider; any collider bump would have
    // re-trapped sitters (regression-locked at ≥0.2 in seating.test.ts).
    approachPos: { x: -18.6, z: 17.55 },
    facingAngle: Math.PI / 2,
    seatHeight: 0.36,
    zoneId: 'orchard',
  },
];

export const CARRYABLE_PROP_DEFS: ReadonlyArray<Omit<WorldPropPlacement, 'holder'>> = [
  {
    id: 'water_pail',
    label: 'Copper Water Pail',
    description: 'A little brass-hooped pail ready for greenhouse blooms or dry window boxes.',
    pos: { x: 2.65, z: 3.65 },
    homePos: { x: 2.65, z: 3.65 },
    likedBy: ['mina', 'toby', 'arthur'],
  },
  {
    id: 'rosemary_basket',
    label: 'Warm Loaf & Herb Basket',
    description: 'Freshly braided sourdough tucked beside sprigs of garden rosemary.',
    pos: { x: -10.5, z: -6.4 },
    homePos: { x: -10.5, z: -6.4 },
    likedBy: ['clara', 'sora', 'barnaby', 'jun'],
  },
  {
    id: 'chalk_bundle',
    label: 'Pastel Street Chalks',
    description: 'Pastel chalks tied with twine for hopscotch grids and lane sketches.',
    pos: { x: -11.4, z: -1.6 },
    homePos: { x: -11.4, z: -1.6 },
    likedBy: ['pip', 'nora', 'toby'],
  },
  {
    id: 'tea_tray',
    label: 'Chamomile Tea Tray',
    description: 'Two steaming porcelain cups set upon a painted cedar tray.',
    pos: { x: -4.1, z: -2.6 },
    homePos: { x: -4.1, z: -2.6 },
    likedBy: ['sora', 'nora', 'clara', 'mina'],
  },
  {
    id: 'lost_parcel',
    label: 'Twine-Tied Lane Parcel',
    description: 'An unhurried parcel wrapped in kraft paper waiting for a friendly hand.',
    pos: { x: -11.2, z: 6.2 },
    homePos: { x: -11.2, z: 6.2 },
    likedBy: ['jun', 'arthur', 'barnaby'],
  },
];

export function createInitialWorldProps(): Record<CarryableItemId, WorldPropPlacement> {
  const out = {} as Record<CarryableItemId, WorldPropPlacement>;
  for (const def of CARRYABLE_PROP_DEFS) {
    out[def.id] = {
      ...def,
      pos: { ...def.pos },
      homePos: { ...def.homePos },
      holder: 'world',
      likedBy: [...def.likedBy],
    };
  }
  return out;
}

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
  { id: 'orchard', name: 'Fern Hollow Orchard', subtitle: 'Crabapples, bee skeps & dappled shade', x: -2.6, z: -18.2, radius: 6.5 },
  { id: 'marigold_lane', name: 'Marigold Lane', subtitle: 'Wildflowers behind the glasshouse', x: 20.3, z: 5.5, radius: 5.2 },
  { id: 'foxglove_rise', name: 'Foxglove Rise', subtitle: 'A lookout over the whole valley', x: 21.6, z: 18.5, radius: 5.4 },
  { id: 'sorrel_hollow', name: 'Sorrel Hollow', subtitle: 'A birch-shaded forgotten garden', x: -20.4, z: 18.3, radius: 5.2 },
  { id: 'bee_line', name: 'The Bee Line', subtitle: 'Clover trail & the wild bee log', x: 10.4, z: -18.8, radius: 5.0 },
];

/**
 * Shared landmark anchors (single source of truth). The plaza fountain's
 * interactable anchor previously drifted to (0, 4.1) while every other consumer
 * (collision circle, interaction metrics, scene builder, proxies) sits on the
 * true basin center (0, 1.5) — the anchor now references FOUNTAIN_CENTER so it
 * cannot drift again. Same pattern for the Mirror Pond center.
 */
export const FOUNTAIN_CENTER: Vec2 = { x: 0, z: 1.5 };
export const POND_CENTER: Vec2 = { x: 1.6, z: 14.0 };

export const PROP_INTERACTABLES: PropInteractable[] = [
  { id: 'player_door', name: 'Cottage Porch Door', x: -10.3, z: 10.0, interactRadius: 2.5 },
  { id: 'player_mailbox', name: 'Willow Mailbox', x: -9.8, z: 7.2, interactRadius: 2.3 },
  // NOTE (WP-1): player_mailbox/pond_driftwood get walkable approachPos overrides in
  // getPropInteractionMetrics below so the tap-proxy stays glued to the visual while the
  // stand spot sits outside the new collision twins.
  { id: 'gazebo_bell', name: 'Gazebo Bell Spire', x: 0, z: -6.8, interactRadius: 2.8 },
  { id: 'fountain_plaza', name: 'Mossy Stone Fountain', x: FOUNTAIN_CENTER.x, z: FOUNTAIN_CENTER.z, interactRadius: 2.6 },
  { id: 'hollow_oak', name: 'Hollow Oak Root', x: -6.2, z: 14.0, interactRadius: 2.5 },
  { id: 'plaza_noticeboard', name: 'Neighborhood Noticeboard', x: 4.4, z: -2.2, interactRadius: 2.3 },
  { id: 'mirror_pond', name: 'Mirror Pond Bank', x: 1.8, z: 10.6, interactRadius: 2.6 },
  { id: 'cottage_window_box', name: 'Porch Herb & Chamomile Box', x: -10.1, z: 12.1, interactRadius: 2.3 },
  { id: 'greenhouse_planters', name: 'Sunbeam Herb Planters', x: 10.0, z: 1.7, interactRadius: 2.4 },
  { id: 'orchard_harvest', name: 'Orchard Harvest Crates', x: -4.2, z: -19.2, interactRadius: 2.4 },
  { id: 'orchard_skep', name: 'Orchard Bee Skep', x: 3.9, z: -16.3, interactRadius: 2.3 },
  { id: 'pond_driftwood', name: 'Mirror Pond Driftwood Nook', x: 5.95, z: 13.8, interactRadius: 2.4 },
  { id: 'greenhouse_door', name: 'Sunbeam Greenhouse Door', x: 10.15, z: 3.2, interactRadius: 2.1 },
  { id: 'bakery_door', name: 'Hearth & Crumb Bakery Door', x: -12.4, z: -6.75, interactRadius: 2.2 },
  { id: 'nook_door', name: 'Linden Book Nook Door', x: -11.8, z: -1.0, interactRadius: 2.2 },
  { id: 'copperwheel_door', name: 'Copperwheel Cottage Door', x: 13.1, z: -7.55, interactRadius: 2.2 },
  { id: 'old_stone_well', name: 'Old Stone Well', x: -20.2, z: 18.3, interactRadius: 2.5 },
  { id: 'rise_vista', name: 'Foxglove Rise Panorama', x: 22.0, z: 19.3, interactRadius: 2.6 },
  { id: 'marigold_bank', name: 'Wildflower Bank', x: 20.3, z: 3.3, interactRadius: 2.4 },
  { id: 'wild_bee_log', name: 'Wild Bee Log', x: 11.0, z: -18.6, interactRadius: 2.3 },
  // WP-4 (Workstream E): the Sorrel Hollow garden bed — the world's first community
  // project anchor. Tending it across three unhurried visits persistently transforms
  // the hollow (registry: src/game/communityProjects.ts).
  { id: 'sorrel_garden_bed', name: 'Forgotten Garden Bed', x: -20.9, z: 21.0, interactRadius: 2.3 },
  // Stage 3: the Willow Jetty — one quiet cast a day on Mirror Pond's south
  // shore (registry: src/game/fishing.ts). Standing point sits outside the
  // pond_water exclusion box (maxZ 16.65) and clear of the pond bench approach.
  { id: 'willow_jetty', name: 'Willow Jetty', x: -0.8, z: 17.6, interactRadius: 2.4 },
  // Stage 3 v1.1: West Brook Bank — the second quiet cast, at the culvert mouth
  // on the west lawn (same daily cadence, shared day gate — see fishing.ts).
  // Standing point verified via scripts/probe_brook_spot.ts: walkable + A* reachable
  // at r 0.48, 0.87u from the culvert water (west tip x -3.58), 2.44u clear of the
  // hollow-oak circle (-6.2, 15.6, r 1.35 + r 0.48 = 1.83), 0.9u+ from token anchors.
  { id: 'west_brook_bank', name: 'West Brook Bank', x: -4.45, z: 13.9, interactRadius: 2.4 },
];

export interface PropInteractionMetrics {
  inRange: boolean;
  scoreDistance: number;
  focusPos: Vec2;
  approachPos: Vec2;
  splashPos: Vec2;
}

const FOUNTAIN_BASIN_RADIUS = 2.46;
const POND_SHORE_BOX = { minX: -2.0, maxX: 5.62, minZ: 11.24, maxZ: 16.6 };

/**
 * Computes perimeter-aware interaction reachability, water/feature focus target, walkable approach spot,
 * and splash impact point for every landmark prop — ensuring multi-sided access for Fountain and Mirror Pond.
 */
export function getPropInteractionMetrics(
  propId: PropInteractableId,
  fromPos: Vec2,
  actorRadius = 0.48,
): PropInteractionMetrics {
  if (propId === 'fountain_plaza') {
    const dx = fromPos.x - FOUNTAIN_CENTER.x;
    const dz = fromPos.z - FOUNTAIN_CENTER.z;
    const distCenter = Math.hypot(dx, dz);
    const nx = distCenter > 0.01 ? dx / distCenter : 0;
    const nz = distCenter > 0.01 ? dz / distCenter : 1;
    const rimDist = Math.max(0, distCenter - FOUNTAIN_BASIN_RADIUS);
    const approachRadius = FOUNTAIN_BASIN_RADIUS + actorRadius + 0.34;
    const candidateApproach: Vec2 = {
      x: FOUNTAIN_CENTER.x + nx * approachRadius,
      z: FOUNTAIN_CENTER.z + nz * approachRadius,
    };
    const approachPos = isPointWalkable(candidateApproach.x, candidateApproach.z, actorRadius)
      ? candidateApproach
      : { x: 0, z: FOUNTAIN_CENTER.z + approachRadius };
    return {
      inRange: rimDist <= 1.65,
      scoreDistance: rimDist + 1.05,
      focusPos: { ...FOUNTAIN_CENTER },
      approachPos,
      splashPos: {
        x: FOUNTAIN_CENTER.x + nx * 1.18,
        z: FOUNTAIN_CENTER.z + nz * 1.18,
      },
    };
  }

  if (propId === 'mirror_pond') {
    const onBridge =
      fromPos.x >= -3.65 &&
      fromPos.x <= -2.05 &&
      fromPos.z >= 11.35 &&
      fromPos.z <= 16.65;

    const clampedX = Math.max(POND_SHORE_BOX.minX, Math.min(POND_SHORE_BOX.maxX, fromPos.x));
    const clampedZ = Math.max(POND_SHORE_BOX.minZ, Math.min(POND_SHORE_BOX.maxZ, fromPos.z));
    const dx = fromPos.x - clampedX;
    const dz = fromPos.z - clampedZ;
    const shoreDist = Math.hypot(dx, dz);

    // Exclude west hollow-oak bank (x < -2.1) unless player is standing on the cedar bridge
    const bankAccessible = fromPos.x >= -2.1 || onBridge;
    const inRange = onBridge || (bankAccessible && shoreDist <= 1.65);

    // Direction pointing into pond water from player
    const toCenterDx = POND_CENTER.x - clampedX;
    const toCenterDz = POND_CENTER.z - clampedZ;
    const toCenterLen = Math.hypot(toCenterDx, toCenterDz) || 1;
    const splashPos: Vec2 = onBridge
      ? { x: -0.4, z: Math.max(12.6, Math.min(15.4, fromPos.z)) }
      : {
          x: Math.max(-1.4, Math.min(4.7, clampedX + (toCenterDx / toCenterLen) * 1.45)),
          z: Math.max(12.3, Math.min(15.7, clampedZ + (toCenterDz / toCenterLen) * 1.45)),
        };

    // Walkable shore approach spot outside pond obstacle box
    let outX = dx;
    let outZ = dz;
    if (shoreDist < 0.05) {
      outX = 0;
      outZ = -1;
    } else {
      outX /= shoreDist;
      outZ /= shoreDist;
    }
    const offsetOut = actorRadius + 0.36;
    let candidateApproach: Vec2 = {
      x: clampedX + outX * offsetOut,
      z: clampedZ + outZ * offsetOut,
    };
    if (!isPointWalkable(candidateApproach.x, candidateApproach.z, actorRadius)) {
      candidateApproach = { x: 1.8, z: 10.5 };
    }

    return {
      inRange,
      scoreDistance: (onBridge ? 0.85 : shoreDist) + 0.5,
      focusPos: splashPos,
      approachPos: candidateApproach,
      splashPos,
    };
  }

  if (propId === 'player_mailbox') {
    const def = PROP_INTERACTABLES.find((p) => p.id === propId)!;
    const dist = distance2D(fromPos, { x: def.x, z: def.z });
    return {
      inRange: dist <= def.interactRadius,
      scoreDistance: dist,
      focusPos: { x: def.x, z: def.z },
      approachPos: { x: -9.0, z: 7.2 },
      splashPos: { x: def.x, z: def.z },
    };
  }

  if (propId === 'pond_driftwood') {
    const def = PROP_INTERACTABLES.find((p) => p.id === propId)!;
    const dist = distance2D(fromPos, { x: def.x, z: def.z });
    return {
      inRange: dist <= def.interactRadius,
      scoreDistance: dist,
      focusPos: { x: 5.85, z: 13.8 },
      approachPos: { x: 6.55, z: 14.6 },
      splashPos: { x: 5.85, z: 13.8 },
    };
  }

  const def = PROP_INTERACTABLES.find((p) => p.id === propId)!;
  const dist = distance2D(fromPos, { x: def.x, z: def.z });
  const focusPos: Vec2 =
    propId === 'gazebo_bell'
      ? { x: 0, z: -9.5 }
      : propId === 'hollow_oak'
      ? { x: -6.2, z: 15.6 }
      : propId === 'plaza_noticeboard'
      ? { x: 4.4, z: -3.2 }
      : propId === 'player_door'
      ? { x: -10.8, z: 10.0 }
      : propId === 'greenhouse_door'
      ? { x: 11.15, z: 3.2 }
      : propId === 'bakery_door'
      ? { x: -12.4, z: -8.15 }
      : propId === 'nook_door'
      ? { x: -13.1, z: -1.0 }
      : propId === 'copperwheel_door'
      ? { x: 13.1, z: -9.4 }
      : propId === 'cottage_window_box'
      ? { x: -10.8, z: 12.1 }
      : propId === 'greenhouse_planters'
      ? { x: 11.1, z: 1.7 }
      : propId === 'orchard_harvest'
      ? { x: -3.7, z: -20.3 }
      : propId === 'orchard_skep'
      ? { x: 4.9, z: -16.3 }
      : propId === 'old_stone_well'
      ? { x: -21.4, z: 19.0 }
      : propId === 'rise_vista'
      ? { x: 21.4, z: 19.1 }
      : propId === 'marigold_bank'
      ? { x: 20.3, z: 2.5 }
      : propId === 'wild_bee_log'
      ? { x: 11.0, z: -19.7 }
      : { x: def.x, z: def.z };

  return {
    inRange: dist <= def.interactRadius,
    scoreDistance: dist,
    focusPos,
    approachPos: { x: def.x, z: def.z },
    splashPos: focusPos,
  };
}

export function distance2D(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

/**
 * Returns the physical surface Y elevation at world-space (x, z) so walkers climb smoothly
 * across Mirror Pond's cambered cedar footbridge instead of clipping through its planks.
 *
 * FLICKER FIX G2: also returns the authored cobble slab height (0.05, edge-ramped) via
 * src/game/groundSurfaces.ts — the rendered network and the logical contract now share
 * one source of truth (characters, contact discs, rings and dust no longer sink 5 cm
 * under the plaza; see docs/visual-quality/mobile-floor-flickering-investigation.md R3).
 */
export function getGroundHeightAt(x: number, z: number): number {
  // Mirror Pond Cedar Footbridge at x = -2.9, deck width 1.86 (-3.83..-1.97), z = 11.45..16.55
  if (x >= -3.88 && x <= -1.92 && z >= 11.4 && z <= 16.6) {
    const t = (z - 14.0) / 4.6; // -0.56..+0.56
    const normalized = Math.max(-0.5, Math.min(0.5, t));
    const arch = 0.24 + (1 - 4 * normalized * normalized) * 0.18;
    // Feather gently onto approach stone abutments at the very tips
    const edgeFeather = Math.max(0, Math.min(1, (2.6 - Math.abs(z - 14.0)) / 0.35));
    return arch * edgeFeather;
  }
  // Foxglove Rise lookout (SE, Build 10): ramp (20.44..22.36 × 16.7..18.0, widened in WP-1
  // to match the stair visual) climbs to the cedar deck (20.4..22.5 × 18.0..20.2) at 0.62 —
  // every other edge of the terraced mound is guarded by `rise_mound_*` obstacle boxes, so
  // the discontinuities are unreachable (same walk-elevation contract as the bridge).
  if (x >= 20.4 && x <= 22.5 && z >= 18.0 && z <= 20.2) {
    return 0.62;
  }
  if (x >= 20.44 && x <= 22.36 && z >= 16.7 && z < 18.0) {
    return 0.62 * ((z - 16.7) / 1.3);
  }
  return getCobbleSurfaceHeight(x, z);
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

/**
 * Returns how strongly `actorPos` facing `facingAngle` looks toward `targetPos` (1.0 = directly ahead, -1.0 = behind).
 */
export function computeFacingAlignment(actorPos: Vec2, facingAngle: number, targetPos: Vec2): number {
  const dx = targetPos.x - actorPos.x;
  const dz = targetPos.z - actorPos.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.01) return 1;
  const fx = Math.sin(facingAngle);
  const fz = Math.cos(facingAngle);
  return (dx / dist) * fx + (dz / dist) * fz;
}

export function getSeatById(seatId: string | null | undefined): SeatSpot | undefined {
  if (!seatId) return undefined;
  return SEAT_SPOTS.find((s) => s.id === seatId);
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
