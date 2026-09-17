import { resources } from './resources';

export const buildings = [
  // Extractors
  {
    id: 'iron-miner',
    name: 'Iron Miner',
    category: 'extractor',
    cost: [{ resource: 'iron-ore', amount: 10 }],
    footprint: { width: 1, height: 1 },
    powerDraw: 0,
    recipeId: 'iron-ore',
    placementRule: 'resource'
  },
  {
    id: 'copper-miner',
    name: 'Copper Miner',
    category: 'extractor',
    cost: [{ resource: 'copper-ore', amount: 10 }],
    footprint: { width: 1, height: 1 },
    powerDraw: 0,
    recipeId: 'copper-ore',
    placementRule: 'resource'
  },
  {
    id: 'coal-miner',
    name: 'Coal Miner',
    category: 'extractor',
    cost: [{ resource: 'coal', amount: 10 }],
    footprint: { width: 1, height: 1 },
    powerDraw: 0,
    recipeId: 'coal',
    placementRule: 'resource'
  },
  {
    id: 'pumpjack',
    name: 'Pumpjack',
    category: 'extractor',
    cost: [{ resource: 'crude-oil', amount: 15 }],
    footprint: { width: 1, height: 1 },
    powerDraw: 0,
    recipeId: 'crude-oil',
    placementRule: 'resource'
  },
  {
    id: 'water-pump',
    name: 'Water Pump',
    category: 'extractor',
    cost: [{ resource: 'water', amount: 10 }],
    footprint: { width: 1, height: 1 },
    powerDraw: 0,
    recipeId: 'water',
    placementRule: 'resource'
  },

  // Processors
  {
    id: 'smelter',
    name: 'Smelter',
    category: 'processor',
    cost: [{ resource: 'iron-ingot', amount: 5 }],
    footprint: { width: 1, height: 1 },
    powerDraw: 2,
    recipeId: 'smelter',
    placementRule: 'factory'
  },
  {
    id: 'copper-smelter',
    name: 'Copper Smelter',
    category: 'processor',
    cost: [{ resource: 'copper-ingot', amount: 5 }],
    footprint: { width: 1, height: 1 },
    powerDraw: 2,
    recipeId: 'copper-smelter',
    placementRule: 'factory'
  },
  {
    id: 'refinery',
    name: 'Refinery',
    category: 'processor',
    cost: [{ resource: 'fuel', amount: 5 }],
    footprint: { width: 1, height: 1 },
    powerDraw: 3,
    recipeId: 'refinery',
    placementRule: 'factory'
  },
  {
    id: 'chemical-plant',
    name: 'Chemical Plant',
    category: 'processor',
    cost: [{ resource: 'plastic', amount: 5 }],
    footprint: { width: 1, height: 1 },
    powerDraw: 3,
    recipeId: 'chemical-plant',
    placementRule: 'factory'
  },
  {
    id: 'gear-assembler',
    name: 'Gear Assembler',
    category: 'processor',
    cost: [{ resource: 'gears', amount: 5 }],
    footprint: { width: 1, height: 1 },
    powerDraw: 2,
    recipeId: 'gear-assembler',
    placementRule: 'factory'
  },
  {
    id: 'circuit-assembler',
    name: 'Circuit Assembler',
    category: 'processor',
    cost: [{ resource: 'circuits', amount: 5 }],
    footprint: { width: 1, height: 1 },
    powerDraw: 3,
    recipeId: 'circuit-assembler',
    placementRule: 'factory'
  },

  // Power/storage
  {
    id: 'solar-panel',
    name: 'Solar Panel',
    category: 'power',
    cost: [{ resource: 'iron-ingot', amount: 5 }],
    footprint: { width: 1, height: 1 },
    powerDraw: 0,
    powerOutput: 1,
    recipeId: '',
    placementRule: 'power'
  },
  {
    id: 'coal-generator',
    name: 'Coal Generator',
    category: 'power',
    cost: [{ resource: 'iron-ingot', amount: 10 }],
    footprint: { width: 1, height: 1 },
    powerDraw: 0,
    powerOutput: 6,
    recipeId: 'coal-generator',
    placementRule: 'power'
  },
  {
    id: 'warehouse',
    name: 'Warehouse',
    category: 'storage',
    cost: [{ resource: 'iron-ingot', amount: 15 }],
    footprint: { width: 1, height: 1 },
    powerDraw: 0,
    recipeId: '',
    placementRule: 'storage'
  },
];