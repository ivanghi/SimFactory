

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

// Check if start area guarantees are met
function checkStartAreaGuarantees(map: Map): boolean {
  const centerX = 32;
  const centerY = 32;
  const halfSize = 8; // For 16x16 area
  
  let hasIron = false;
  let hasCoal = false;
  let hasWater = false;
  
  for (let y = centerY - halfSize; y < centerY + halfSize; y++) {
    for (let x = centerX - halfSize; x < centerX + halfSize; x++) {
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
    }
  }
  
  return hasIron && hasCoal && hasWater;
}

// Repair map to meet start area guarantees
function repairStartArea(map: Map, random: () => number): void {
  const centerX = 32;
  const centerY = 32;
  const halfSize = 8; // For 16x16 area
  
  // Check if we have an iron cluster in the start area
  let hasIron = false;
  for (let y = centerY - halfSize; y < centerY + halfSize; y++) {
    for (let x = centerX - halfSize; x < centerX + halfSize; x++) {
      if (map.tiles[y][x].resource?.type === 'iron-ore') {
        hasIron = true;
        break;
      }
    }
    if (hasIron) break;
  }
  
  // Add iron if missing (create a minimal cluster)
  if (!hasIron) {
    // Find a suitable location in the start area to place a small iron cluster
    let placed = false;
    for (let y = centerY - halfSize; y < centerY + halfSize && !placed; y++) {
      for (let x = centerX - halfSize; x < centerX + halfSize && !placed; x++) {
        // Try to place a minimal iron cluster (at least 3 tiles) starting from this position
        if (map.tiles[y][x].type === 'water') {
          // Convert this tile to grass with iron resource
          map.tiles[y][x].type = 'grass';
          map.tiles[y][x].resource = {
            type: 'iron-ore',
            richness: random() * 1.5 + 0.5
          };
          
          // Place 2 more connected iron tiles to form a minimal 3-tile cluster
          // Try placing one to the right
          if (x + 1 < centerX + halfSize && map.tiles[y][x + 1].type === 'water') {
            map.tiles[y][x + 1].type = 'grass';
            map.tiles[y][x + 1].resource = {
              type: 'iron-ore',
              richness: random() * 1.5 + 0.5
            };
            
            // Try placing one below
            if (y + 1 < centerY + halfSize && map.tiles[y + 1][x].type === 'water') {
              map.tiles[y + 1][x].type = 'grass';
              map.tiles[y + 1][x].resource = {
                type: 'iron-ore',
                richness: random() * 1.5 + 0.5
              };
            } else if (y + 1 < centerY + halfSize && map.tiles[y + 1][x].type === 'grass' && !map.tiles[y + 1][x].resource) {
              map.tiles[y + 1][x].resource = {
                type: 'iron-ore',
                richness: random() * 1.5 + 0.5
              };
            } else if (x - 1 >= centerX - halfSize && map.tiles[y][x - 1].type === 'water') {
              map.tiles[y][x - 1].type = 'grass';
              map.tiles[y][x - 1].resource = {
                type: 'iron-ore',
                richness: random() * 1.5 + 0.5
              };
            }
          } else if (x + 1 < centerX + halfSize && map.tiles[y][x + 1].type === 'grass' && !map.tiles[y][x + 1].resource) {
            map.tiles[y][x + 1].resource = {
              type: 'iron-ore',
              richness: random() * 1.5 + 0.5
            };
            
            // Try placing one more
            if (y + 1 < centerY + halfSize && map.tiles[y + 1][x].type === 'water') {
              map.tiles[y + 1][x].type = 'grass';
              map.tiles[y + 1][x].resource = {
                type: 'iron-ore',
                richness: random() * 1.5 + 0.5
              };
            } else if (y + 1 < centerY + halfSize && map.tiles[y + 1][x].type === 'grass' && !map.tiles[y + 1][x].resource) {
              map.tiles[y + 1][x].resource = {
                type: 'iron-ore',
                richness: random() * 1.5 + 0.5
              };
            }
          }
          placed = true;
        } else if (map.tiles[y][x].type === 'grass' && !map.tiles[y][x].resource) {
          // Place a 3-tile cluster starting on grass
          map.tiles[y][x].resource = {
            type: 'iron-ore',
            richness: random() * 1.5 + 0.5
          };
          
          // Try placing 2 more adjacent tiles
          let placedAdjacents = 0;
          // Right
          if (x + 1 < centerX + halfSize && map.tiles[y][x + 1].type === 'grass' && !map.tiles[y][x + 1].resource && placedAdjacents < 2) {
            map.tiles[y][x + 1].resource = {
              type: 'iron-ore',
              richness: random() * 1.5 + 0.5
            };
            placedAdjacents++;
          }
          // Below
          if (y + 1 < centerY + halfSize && map.tiles[y + 1][x].type === 'grass' && !map.tiles[y + 1][x].resource && placedAdjacents < 2) {
            map.tiles[y + 1][x].resource = {
              type: 'iron-ore',
              richness: random() * 1.5 + 0.5
            };
            placedAdjacents++;
          }
          // Left
          if (x - 1 >= centerX - halfSize && map.tiles[y][x - 1].type === 'grass' && !map.tiles[y][x - 1].resource && placedAdjacents < 2) {
            map.tiles[y][x - 1].resource = {
              type: 'iron-ore',
              richness: random() * 1.5 + 0.5
            };
            placedAdjacents++;
          }
          
          placed = true;
        }
      }
    }
    
    // If we couldn't place a proper cluster, just place a single tile (fallback)
    if (!placed) {
      for (let y = centerY - halfSize; y < centerY + halfSize && !placed; y++) {
        for (let x = centerX - halfSize; x < centerX + halfSize && !placed; x++) {
          if (map.tiles[y][x].type !== 'water') {
            map.tiles[y][x].type = 'grass';
          } else {
            map.tiles[y][x].type = 'grass';
          }
          map.tiles[y][x].resource = {
            type: 'iron-ore',
            richness: random() * 1.5 + 0.5
          };
          placed = true;
        }
      }
    }
  }
  
  // Check if we have a coal cluster in the start area
  let hasCoal = false;
  for (let y = centerY - halfSize; y < centerY + halfSize; y++) {
    for (let x = centerX - halfSize; x < centerX + halfSize; x++) {
      if (map.tiles[y][x].resource?.type === 'coal') {
        hasCoal = true;
        break;
      }
    }
    if (hasCoal) break;
  }
  
  // Add coal if missing (create a minimal cluster)
  if (!hasCoal) {
    // Find a suitable location in the start area to place a small coal cluster
    let placed = false;
    for (let y = centerY - halfSize; y < centerY + halfSize && !placed; y++) {
      for (let x = centerX - halfSize; x < centerX + halfSize && !placed; x++) {
        // Skip if this tile already has iron (to avoid overwriting)
        if (map.tiles[y][x].resource?.type === 'iron-ore') continue;
        
        if (map.tiles[y][x].type === 'water') {
          // Convert this tile to grass with coal resource
          map.tiles[y][x].type = 'grass';
          map.tiles[y][x].resource = {
            type: 'coal',
            richness: random() * 1.5 + 0.5
          };
          
          // Place 2 more connected coal tiles to form a minimal 3-tile cluster
          // Try placing one to the right
          if (x + 1 < centerX + halfSize && map.tiles[y][x + 1].type === 'water' && 
              map.tiles[y][x + 1].resource?.type !== 'iron-ore') {
            map.tiles[y][x + 1].type = 'grass';
            map.tiles[y][x + 1].resource = {
              type: 'coal',
              richness: random() * 1.5 + 0.5
            };
            
            // Try placing one below
            if (y + 1 < centerY + halfSize && map.tiles[y + 1][x].type === 'water' &&
                map.tiles[y + 1][x].resource?.type !== 'iron-ore') {
              map.tiles[y + 1][x].type = 'grass';
              map.tiles[y + 1][x].resource = {
                type: 'coal',
                richness: random() * 1.5 + 0.5
              };
            } else if (y + 1 < centerY + halfSize && map.tiles[y + 1][x].type === 'grass' && 
                      !map.tiles[y + 1][x].resource && map.tiles[y + 1][x].resource?.type !== 'iron-ore') {
              map.tiles[y + 1][x].resource = {
                type: 'coal',
                richness: random() * 1.5 + 0.5
              };
            } else if (x - 1 >= centerX - halfSize && map.tiles[y][x - 1].type === 'water' &&
                      map.tiles[y][x - 1].resource?.type !== 'iron-ore') {
              map.tiles[y][x - 1].type = 'grass';
              map.tiles[y][x - 1].resource = {
                type: 'coal',
                richness: random() * 1.5 + 0.5
              };
            }
          } else if (x + 1 < centerX + halfSize && map.tiles[y][x + 1].type === 'grass' && 
                    !map.tiles[y][x + 1].resource && map.tiles[y][x + 1].resource?.type !== 'iron-ore') {
            map.tiles[y][x + 1].resource = {
              type: 'coal',
              richness: random() * 1.5 + 0.5
            };
            
            // Try placing one more
            if (y + 1 < centerY + halfSize && map.tiles[y + 1][x].type === 'water' &&
                map.tiles[y + 1][x].resource?.type !== 'iron-ore') {
              map.tiles[y + 1][x].type = 'grass';
              map.tiles[y + 1][x].resource = {
                type: 'coal',
                richness: random() * 1.5 + 0.5
              };
            } else if (y + 1 < centerY + halfSize && map.tiles[y + 1][x].type === 'grass' && 
                      !map.tiles[y + 1][x].resource && map.tiles[y + 1][x].resource?.type !== 'iron-ore') {
              map.tiles[y + 1][x].resource = {
                type: 'coal',
                richness: random() * 1.5 + 0.5
              };
            }
          }
          placed = true;
        } else if (map.tiles[y][x].type === 'grass' && !map.tiles[y][x].resource) {
          // Place a 3-tile cluster starting on grass
          map.tiles[y][x].resource = {
            type: 'coal',
            richness: random() * 1.5 + 0.5
          };
          
          // Try placing 2 more adjacent tiles
          let placedAdjacents = 0;
          // Right
          if (x + 1 < centerX + halfSize && map.tiles[y][x + 1].type === 'grass' && 
              !map.tiles[y][x + 1].resource && map.tiles[y][x + 1].resource?.type !== 'iron-ore' && placedAdjacents < 2) {
            map.tiles[y][x + 1].resource = {
              type: 'coal',
              richness: random() * 1.5 + 0.5
            };
            placedAdjacents++;
          }
          // Below
          if (y + 1 < centerY + halfSize && map.tiles[y + 1][x].type === 'grass' && 
              !map.tiles[y + 1][x].resource && map.tiles[y + 1][x].resource?.type !== 'iron-ore' && placedAdjacents < 2) {
            map.tiles[y + 1][x].resource = {
              type: 'coal',
              richness: random() * 1.5 + 0.5
            };
            placedAdjacents++;
          }
          // Left
          if (x - 1 >= centerX - halfSize && map.tiles[y][x - 1].type === 'grass' && 
              !map.tiles[y][x - 1].resource && map.tiles[y][x - 1].resource?.type !== 'iron-ore' && placedAdjacents < 2) {
            map.tiles[y][x - 1].resource = {
              type: 'coal',
              richness: random() * 1.5 + 0.5
            };
            placedAdjacents++;
          }
          
          placed = true;
        }
      }
    }
    
    // If we couldn't place a proper cluster, just place a single tile (fallback)
    if (!placed) {
      for (let y = centerY - halfSize; y < centerY + halfSize && !placed; y++) {
        for (let x = centerX - halfSize; x < centerX + halfSize && !placed; x++) {
          // Make sure we don't overwrite iron
          if (!map.tiles[y][x].resource || map.tiles[y][x].resource!.type !== 'iron-ore') {
            if (map.tiles[y][x].type !== 'water') {
              map.tiles[y][x].type = 'grass';
            } else {
              map.tiles[y][x].type = 'grass';
            }
            map.tiles[y][x].resource = {
              type: 'coal',
              richness: random() * 1.5 + 0.5
            };
            placed = true;
          }
        }
      }
    }
  }
  
  // Check if we have water in the start area
  let hasWater = false;
  for (let y = centerY - halfSize; y < centerY + halfSize; y++) {
    for (let x = centerX - halfSize; x < centerX + halfSize; x++) {
      if (map.tiles[y][x].type === 'water') {
        hasWater = true;
        break;
      }
    }
    if (hasWater) break;
  }
  
  // Add water if missing (convert one non-resource tile to water)
  if (!hasWater) {
    // Find a tile without a critical resource and convert to water
    let placed = false;
    for (let y = centerY - halfSize; y < centerY + halfSize && !placed; y++) {
      for (let x = centerX - halfSize; x < centerX + halfSize && !placed; x++) {
        // Only convert tiles that don't have iron or coal resources
        if (!map.tiles[y][x].resource || 
            (map.tiles[y][x].resource!.type !== 'iron-ore' && map.tiles[y][x].resource!.type !== 'coal')) {
          delete map.tiles[y][x].resource;  // Remove any non-critical resource
          map.tiles[y][x].type = 'water';
          placed = true;
        }
      }
    }
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