

export type TileType = 'grass' | 'rock' | 'water';
export type Tile = {
  type: TileType;
  resource?: {
    type: ResourceType;
    richness: number; // 0.5-2.0
  };
};

type ResourceType = 'iron-ore' | 'copper-ore' | 'coal' | 'crude-oil';

export type Map = {
  tiles: Tile[][];
  seed: number;
};

// Mulberry32 PRNG implementation
function mulberry32(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeLatticeNoise(random: () => number, cells: number): (x: number, y: number) => number {
  const size = cells + 1;
  const lattice: number[][] = [];
  for (let y = 0; y < size; y++) {
    const row: number[] = [];
    for (let x = 0; x < size; x++) {
      row.push(random());
    }
    lattice.push(row);
  }

  return (x: number, y: number): number => {
    const fx = clamp((x / 64) * cells, 0, cells);
    const fy = clamp((y / 64) * cells, 0, cells);
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(x0 + 1, cells);
    const y1 = Math.min(y0 + 1, cells);
    const tx = smoothstep(fx - x0);
    const ty = smoothstep(fy - y0);
    const top = lerp(lattice[y0][x0], lattice[y0][x1], tx);
    const bottom = lerp(lattice[y1][x0], lattice[y1][x1], tx);
    return lerp(top, bottom, ty);
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function getTerrainType(terrainValue: number): TileType {
  if (terrainValue < 0.3) {
    return 'water';
  } else if (terrainValue < 0.55) {
    return 'rock';
  } else {
    return 'grass';
  }
}

// Generate resource cluster
function generateResourceCluster(
  map: Map,
  resourceType: ResourceType,
  startX: number,
  startY: number,
  random: () => number
): void {
  // Determine cluster size (3-9 tiles)
  const clusterSize = Math.floor(random() * 7) + 3;

  const inBounds = (x: number, y: number): boolean => x >= 0 && x < 64 && y >= 0 && y < 64;
  const isFreeGrass = (x: number, y: number): boolean =>
    inBounds(x, y) && map.tiles[y][x].type === 'grass' && !map.tiles[y][x].resource;

  const placed: [number, number][] = [];
  const isPlaced = (x: number, y: number): boolean =>
    placed.some(([px, py]) => px === x && py === y);
  const touchesOtherCluster = (x: number, y: number): boolean =>
    [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1]
    ].some(([nx, ny]) => {
      if (!inBounds(nx, ny) || isPlaced(nx, ny)) {
        return false;
      }
      return map.tiles[ny][nx].resource?.type === resourceType;
    });
  const canPlace = (x: number, y: number): boolean =>
    isFreeGrass(x, y) && !touchesOtherCluster(x, y);

  if (!isFreeGrass(startX, startY) || touchesOtherCluster(startX, startY)) {
    return;
  }

  const place = (x: number, y: number): void => {
    map.tiles[y][x].resource = {
      type: resourceType,
      richness: random() * 1.5 + 0.5
    };
    placed.push([x, y]);
  };

  place(startX, startY);

  let attempts = 0;
  const maxAttempts = clusterSize * 40;
  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ];

  while (placed.length < clusterSize && attempts < maxAttempts) {
    attempts++;
    const [baseX, baseY] = placed[Math.floor(random() * placed.length)];
    const [dx, dy] = directions[Math.floor(random() * directions.length)];
    const nextX = baseX + dx;
    const nextY = baseY + dy;
    if (canPlace(nextX, nextY)) {
      place(nextX, nextY);
    }
  }

  if (placed.length < 3) {
    for (const [x, y] of placed) {
      delete map.tiles[y][x].resource;
    }
  }
}

const REQUIRED_RESOURCES: ResourceType[] = ['iron-ore', 'copper-ore', 'coal', 'crude-oil'];

function hasResource(map: Map, resourceType: ResourceType): boolean {
  return map.tiles.some(row => row.some(tile => tile.resource?.type === resourceType));
}

function ensureResourcePresence(map: Map, random: () => number): void {
  for (const resourceType of REQUIRED_RESOURCES) {
    if (hasResource(map, resourceType)) {
      continue;
    }
    for (let attempt = 0; attempt < 4000; attempt++) {
      const x = Math.floor(random() * 64);
      const y = Math.floor(random() * 64);
      const tile = map.tiles[y][x];
      if (tile.type === 'grass' && !tile.resource) {
        generateResourceCluster(map, resourceType, x, y, random);
        if (hasResource(map, resourceType)) {
          break;
        }
      }
    }
  }
}

const START_CENTER_X = 32;
const START_CENTER_Y = 32;
const START_HALF_SIZE = 8; // For 16x16 area
const START_MIN_X = START_CENTER_X - START_HALF_SIZE;
const START_MAX_X = START_CENTER_X + START_HALF_SIZE;
const START_MIN_Y = START_CENTER_Y - START_HALF_SIZE;
const START_MAX_Y = START_CENTER_Y + START_HALF_SIZE;

// Iterate the start area in row-major order. A callback that returns true stops.
function forEachStartTile(fn: (x: number, y: number) => boolean | void): void {
  for (let y = START_MIN_Y; y < START_MAX_Y; y++) {
    for (let x = START_MIN_X; x < START_MAX_X; x++) {
      if (fn(x, y)) {
        return;
      }
    }
  }
}

// Check if start area guarantees are met
function checkStartAreaGuarantees(map: Map): boolean {
  let hasIron = false;
  let hasCoal = false;
  let hasWater = false;

  forEachStartTile((x, y) => {
    const tile = map.tiles[y][x];

    if (tile.type === 'water') {
      hasWater = true;
    }

    if (tile.resource) {
      if (tile.resource.type === 'iron-ore') {
        hasIron = true;
      } else if (tile.resource.type === 'coal') {
        hasCoal = true;
      }
    }
  });

  return hasIron && hasCoal && hasWater;
}

function startAreaHasResource(map: Map, resourceType: ResourceType): boolean {
  let found = false;
  forEachStartTile((x, y) => {
    if (map.tiles[y][x].resource?.type === resourceType) {
      found = true;
      return true;
    }
  });
  return found;
}

function startAreaHasWater(map: Map): boolean {
  let found = false;
  forEachStartTile((x, y) => {
    if (map.tiles[y][x].type === 'water') {
      found = true;
      return true;
    }
  });
  return found;
}

// Convert one non-critical tile in the start area to water.
function addStartAreaWater(map: Map): void {
  forEachStartTile((x, y) => {
    const tile = map.tiles[y][x];
    if (!tile.resource || (tile.resource.type !== 'iron-ore' && tile.resource.type !== 'coal')) {
      delete tile.resource; // Remove any non-critical resource
      tile.type = 'water';
      return true;
    }
  });
}

// Place a minimal (3-tile) cluster of one resource inside the start area,
// converting water to grass as needed. Tiles holding `protectedType` are left
// untouched. Uses the caller's PRNG so map output stays deterministic.
function placeStartCluster(
  map: Map,
  random: () => number,
  resourceType: ResourceType,
  protectedType?: ResourceType
): boolean {
  const inArea = (x: number, y: number): boolean =>
    x >= START_MIN_X && x < START_MAX_X && y >= START_MIN_Y && y < START_MAX_Y;
  const isProtected = (x: number, y: number): boolean =>
    protectedType !== undefined && map.tiles[y][x].resource?.type === protectedType;
  const isWater = (x: number, y: number): boolean => map.tiles[y][x].type === 'water';
  const isOpenGrass = (x: number, y: number): boolean =>
    map.tiles[y][x].type === 'grass' && !map.tiles[y][x].resource;

  const place = (x: number, y: number): void => {
    map.tiles[y][x].resource = {
      type: resourceType,
      richness: random() * 1.5 + 0.5
    };
  };
  const toGrass = (x: number, y: number): void => {
    map.tiles[y][x].type = 'grass';
  };
  const tryPlaceBelow = (x: number, y: number): boolean => {
    if (inArea(x, y + 1) && isWater(x, y + 1) && !isProtected(x, y + 1)) {
      toGrass(x, y + 1);
      place(x, y + 1);
      return true;
    }
    if (inArea(x, y + 1) && isOpenGrass(x, y + 1)) {
      place(x, y + 1);
      return true;
    }
    return false;
  };

  // A water start tile becomes grass, then grows into a 3-tile cluster.
  const placeFromWater = (x: number, y: number): void => {
    toGrass(x, y);
    place(x, y);

    // Try placing one to the right
    if (inArea(x + 1, y) && isWater(x + 1, y) && !isProtected(x + 1, y)) {
      toGrass(x + 1, y);
      place(x + 1, y);

      // Try placing one below, else fall back to the left
      if (!tryPlaceBelow(x, y) && inArea(x - 1, y) && isWater(x - 1, y) && !isProtected(x - 1, y)) {
        toGrass(x - 1, y);
        place(x - 1, y);
      }
    } else if (inArea(x + 1, y) && isOpenGrass(x + 1, y)) {
      place(x + 1, y);

      // Try placing one below
      tryPlaceBelow(x, y);
    }
  };

  let placed = false;
  forEachStartTile((x, y) => {
    if (isProtected(x, y)) return;

    if (isWater(x, y)) {
      placeFromWater(x, y);
      placed = true;
      return true;
    }

    if (isOpenGrass(x, y)) {
      // Place a 3-tile cluster starting on grass
      place(x, y);

      // Try placing 2 more adjacent tiles
      let placedAdjacents = 0;
      // Right
      if (inArea(x + 1, y) && isOpenGrass(x + 1, y) && placedAdjacents < 2) {
        place(x + 1, y);
        placedAdjacents++;
      }
      // Below
      if (inArea(x, y + 1) && isOpenGrass(x, y + 1) && placedAdjacents < 2) {
        place(x, y + 1);
        placedAdjacents++;
      }
      // Left
      if (inArea(x - 1, y) && isOpenGrass(x - 1, y) && placedAdjacents < 2) {
        place(x - 1, y);
        placedAdjacents++;
      }

      placed = true;
      return true;
    }
  });

  return placed;
}

// Last resort: stamp a single resource tile in the start area.
function placeStartClusterFallback(
  map: Map,
  random: () => number,
  resourceType: ResourceType,
  protectedType?: ResourceType
): void {
  forEachStartTile((x, y) => {
    if (protectedType !== undefined && map.tiles[y][x].resource?.type === protectedType) return;

    map.tiles[y][x].type = 'grass';
    map.tiles[y][x].resource = {
      type: resourceType,
      richness: random() * 1.5 + 0.5
    };
    return true;
  });
}

// Repair map to meet start area guarantees
function repairStartArea(map: Map, random: () => number): void {
  if (!startAreaHasResource(map, 'iron-ore')) {
    if (!placeStartCluster(map, random, 'iron-ore')) {
      placeStartClusterFallback(map, random, 'iron-ore');
    }
  }

  if (!startAreaHasResource(map, 'coal')) {
    if (!placeStartCluster(map, random, 'coal', 'iron-ore')) {
      placeStartClusterFallback(map, random, 'coal', 'iron-ore');
    }
  }

  if (!startAreaHasWater(map)) {
    addStartAreaWater(map);
  }
}

export function generateMap(seed: number): Map {
  const random = mulberry32(seed);

  const coarseNoise = makeLatticeNoise(random, 8);
  const mediumNoise = makeLatticeNoise(random, 16);
  const fineNoise = makeLatticeNoise(random, 32);

  // Initialize 64x64 grid
  const tiles: Tile[][] = [];
  for (let y = 0; y < 64; y++) {
    tiles.push([]);
    for (let x = 0; x < 64; x++) {
      const terrainValue =
        coarseNoise(x, y) * 0.5 + mediumNoise(x, y) * 0.3 + fineNoise(x, y) * 0.2;
      tiles[y].push({
        type: getTerrainType(terrainValue),
      });
    }
  }
  
  const map: Map = {
    tiles,
    seed
  };
  
  // Generate resource clusters
  const resourceTypesConst: ResourceType[] = ['iron-ore', 'copper-ore', 'coal', 'crude-oil'];
  
  // Number of clusters per resource type
  const clusterCounts = {
    'iron-ore': Math.floor(random() * 5) + 5,  // 5-9 clusters
    'copper-ore': Math.floor(random() * 5) + 5, // 5-9 clusters
    coal: Math.floor(random() * 5) + 5,   // 5-9 clusters
    'crude-oil': Math.floor(random() * 3) + 2     // 2-4 clusters
  };
  
  // Place resource clusters
  for (const resourceType of resourceTypesConst) {
    const count = clusterCounts[resourceType];
    for (let i = 0; i < count; i++) {
      // Random position on the map
      const x = Math.floor(random() * 64);
      const y = Math.floor(random() * 64);
      
      // Only place cluster on grass tiles
      if (map.tiles[y][x].type === 'grass' && !map.tiles[y][x].resource) {
        generateResourceCluster(map, resourceType, x, y, random);
      }
    }
  }
  
  // Check start area guarantees and repair if necessary
  if (!checkStartAreaGuarantees(map)) {
    repairStartArea(map, random);
  }

  ensureResourcePresence(map, random);

  return map;
}