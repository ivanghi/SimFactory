

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

// Value noise function for terrain generation
function valueNoise(x: number, y: number, frequency: number, _random: () => number): number {
  const xInt = Math.floor(x * frequency);
  const yInt = Math.floor(y * frequency);
  
  // Hash coordinates
  let hash = xInt;
  hash = hash * 374761393 + yInt * 681639419;
  hash = hash ^ hash >>> 13;
  hash = (hash * hash * hash * 12345 + hash) & 0xFFFFFFFF;
  
  return (hash >>> 0) / 0xFFFFFFFF;
}

// Interpolate between two values
function interpolate(a: number, b: number, t: number): number {
  // Cubic interpolation for smoother transitions
  t = t * t * (3 - 2 * t);
  return a * (1 - t) + b * t;
}

// Generate 2D value noise
function generateValueNoise(x: number, y: number, scale: number, random: () => number): number {
  const scaledX = x / scale;
  const scaledY = y / scale;
  
  const xInt = Math.floor(scaledX);
  const yInt = Math.floor(scaledY);
  
  const xFrac = scaledX - xInt;
  const yFrac = scaledY - yInt;
  
  // Get noise values at grid corners
  const v1 = valueNoise(xInt, yInt, 1, random);
  const v2 = valueNoise(xInt + 1, yInt, 1, random);
  const v3 = valueNoise(xInt, yInt + 1, 1, random);
  const v4 = valueNoise(xInt + 1, yInt + 1, 1, random);
  
  // Interpolate
  const top = interpolate(v1, v2, xFrac);
  const bottom = interpolate(v3, v4, xFrac);
  return interpolate(top, bottom, yFrac);
}

// Generate terrain based on position
function getTerrainType(x: number, y: number, random: () => number): TileType {
  // Create multiple octaves of noise for interesting terrain
  let terrainValue = 0;
  terrainValue += generateValueNoise(x, y, 32, random) * 0.5;
  terrainValue += generateValueNoise(x, y, 16, random) * 0.25;
  terrainValue += generateValueNoise(x, y, 8, random) * 0.25;
  
  // Normalize to 0-1 range
  terrainValue = terrainValue / 1.0;
  
  // Determine terrain type based on value
  if (terrainValue < 0.2) {
    return 'water';
  } else if (terrainValue < 0.5) {
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
  
  // Starting position
  let currentX = startX;
  let currentY = startY;
  
  // Place initial resource tile
  if (currentX >= 0 && currentX < 64 && currentY >= 0 && currentY < 64) {
    // Only place resource on grass tiles
    if (map.tiles[currentY][currentX].type === 'grass') {
      const richness = random() * 1.5 + 0.5; // Range 0.5 to 2.0
      map.tiles[currentY][currentX].resource = {
        type: resourceType,
        richness
      };
    }
  }
  
  // Place remaining tiles in the cluster
  let placedTiles = 1;
  while (placedTiles < clusterSize) {
    // Choose a random adjacent position
    const directions = [
      [-1, 0], [1, 0], [0, -1], [0, 1],  // Up, Down, Left, Right
      [-1, -1], [-1, 1], [1, -1], [1, 1] // Diagonals
    ];
    
    const dir = directions[Math.floor(random() * directions.length)];
    const newX = currentX + dir[0];
    const newY = currentY + dir[1];
    
    // Check bounds
    if (newX >= 0 && newX < 64 && newY >= 0 && newY < 64) {
      // Place resource if it's on grass and not already occupied
      if (map.tiles[newY][newX].type === 'grass' && !map.tiles[newY][newX].resource) {
        const richness = random() * 1.5 + 0.5; // Range 0.5 to 2.0
        map.tiles[newY][newX].resource = {
          type: resourceType,
          richness
        };
        currentX = newX;
        currentY = newY;
        placedTiles++;
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
  
  // Initialize 64x64 grid
  const tiles: Tile[][] = [];
  for (let y = 0; y < 64; y++) {
    tiles.push([]);
    for (let x = 0; x < 64; x++) {
      tiles[y].push({
        type: getTerrainType(x, y, random),
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
  
  return map;
}