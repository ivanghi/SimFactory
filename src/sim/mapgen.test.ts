import { describe, test, expect } from 'vitest';
import { generateMap, Map, TileType } from './mapgen';

type ResourceType = 'iron-ore' | 'copper-ore' | 'coal' | 'crude-oil';

describe('Map Generation', () => {
  test('determinism: same seed produces identical maps', () => {
    const seed = 12345;
    const map1 = generateMap(seed);
    const map2 = generateMap(seed);
    
    // Compare all tiles
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        expect(map1.tiles[y][x]).toEqual(map2.tiles[y][x]);
      }
    }
    
    // Compare seeds
    expect(map1.seed).toBe(map2.seed);
  });

  test('different seeds produce different maps', () => {
    // Test multiple pairs of different seeds to increase confidence
    // Use well-separated seeds to ensure different sequences
    const seedPairs = [
      [12345, 54321],
      [100, 200],
      [1, 1000000],
      [999, 8888],
      [55555, 77777]
    ];
    
    let differentMapsFound = false;
    
    for (const [seed1, seed2] of seedPairs) {
      if (differentMapsFound) break;
      
      const map1 = generateMap(seed1);
      const map2 = generateMap(seed2);
      
      // Check if maps are different
      for (let y = 0; y < 64 && !differentMapsFound; y++) {
        for (let x = 0; x < 64 && !differentMapsFound; x++) {
          if (map1.tiles[y][x].type !== map2.tiles[y][x].type ||
              map1.tiles[y][x].resource?.type !== map2.tiles[y][x].resource?.type ||
              map1.tiles[y][x].resource?.richness !== map2.tiles[y][x].resource?.richness) {
            differentMapsFound = true;
          }
        }
      }
    }
    
    expect(differentMapsFound).toBe(true);
  });

  test('grid dimensions are exactly 64x64', () => {
    const map = generateMap(12345);
    
    expect(map.tiles.length).toBe(64);
    for (let y = 0; y < 64; y++) {
      expect(map.tiles[y].length).toBe(64);
    }
  });

  test('every tile richness falls in [0.5, 2.0]', () => {
    const map = generateMap(12345);
    
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
          if (map.tiles[y][x].resource) {
            const richness = map.tiles[y][x].resource!.richness;
            expect(richness).toBeGreaterThanOrEqual(0.5);
            expect(richness).toBeLessThanOrEqual(2.0);
          }
      }
    }
  });

  test('terrain types are limited to the three valid values', () => {
    const map = generateMap(12345);
    
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const validTypes: TileType[] = ['grass', 'rock', 'water'];
        expect(validTypes).toContain(map.tiles[y][x].type);
      }
    }
  });

  test('start-area guarantees hold across a sweep of many seeds', () => {
    const numSeeds = 200;
    
    for (let i = 0; i < numSeeds; i++) {
      const map = generateMap(i);
      
      // Check the center 16x16 region (from 24,24 to 40,40)
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
      
      expect(hasIron).toBe(true);
      expect(hasCoal).toBe(true);
      expect(hasWater).toBe(true);
    }
  });

  test('cluster sizes are within 3-9 tiles', () => {
    const map = generateMap(12345);
    
    // Identify clusters by flood-filling connected resource tiles of the same type
    const visited: boolean[][] = Array(64).fill(null).map(() => Array(64).fill(false));
    
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        if (!visited[y][x] && map.tiles[y][x].resource) {
          const resourceType = map.tiles[y][x].resource!.type;
          const clusterSize = measureClusterSize(map, x, y, resourceType, visited);
          expect(clusterSize).toBeGreaterThanOrEqual(3);
          expect(clusterSize).toBeLessThanOrEqual(9);
        }
      }
    }
  });
});

// Helper function to measure cluster size using flood-fill
function measureClusterSize(
  map: Map,
  startX: number,
  startY: number,
  resourceType: ResourceType,
  visited: boolean[][]
): number {
  const stack: [number, number][] = [[startX, startY]];
  let size = 0;
  
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    
    if (x < 0 || x >= 64 || y < 0 || y >= 64) continue;
    if (visited[y][x]) continue;
    if (!map.tiles[y][x].resource || map.tiles[y][x].resource!.type !== resourceType) continue;
    
    visited[y][x] = true;
    size++;
    
    // Add neighbors to stack
    stack.push([x + 1, y]);
    stack.push([x - 1, y]);
    stack.push([x, y + 1]);
    stack.push([x, y - 1]);
  }
  
  return size;
}