export interface Recipe {
  id: string;
  inputs: { resource: string; amount: number }[];
  outputs: { resource: string; amount: number }[];
  cycleTime: number;
}

const recipes: Recipe[] = [
  {
    id: 'smelter',
    inputs: [
      { resource: 'iron-ore', amount: 2 },
      { resource: 'coal', amount: 1 }
    ],
    outputs: [
      { resource: 'iron-ingot', amount: 1 }
    ],
    cycleTime: 10
  },
  {
    id: 'copper-smelter',
    inputs: [
      { resource: 'copper-ore', amount: 2 },
      { resource: 'coal', amount: 1 }
    ],
    outputs: [
      { resource: 'copper-ingot', amount: 1 }
    ],
    cycleTime: 10
  },
  {
    id: 'refinery',
    inputs: [
      { resource: 'crude-oil', amount: 2 }
    ],
    outputs: [
      { resource: 'fuel', amount: 1 }
    ],
    cycleTime: 6
  },
  {
    id: 'chemical-plant',
    inputs: [
      { resource: 'crude-oil', amount: 1 },
      { resource: 'water', amount: 1 }
    ],
    outputs: [
      { resource: 'plastic', amount: 1 }
    ],
    cycleTime: 10
  },
  {
    id: 'gear-assembler',
    inputs: [
      { resource: 'iron-ingot', amount: 2 }
    ],
    outputs: [
      { resource: 'gears', amount: 1 }
    ],
    cycleTime: 8
  },
  {
    id: 'circuit-assembler',
    inputs: [
      { resource: 'copper-ingot', amount: 1 },
      { resource: 'plastic', amount: 1 }
    ],
    outputs: [
      { resource: 'circuits', amount: 1 }
    ],
    cycleTime: 12
  },
  {
    id: 'lab',
    inputs: [
      { resource: 'circuits', amount: 1 },
      { resource: 'gears', amount: 1 }
    ],
    outputs: [
      { resource: 'science', amount: 1 }
    ],
    cycleTime: 15
  },
  {
    id: 'coal-generator',
    inputs: [
      { resource: 'coal', amount: 1 }
    ],
    outputs: [
      { resource: 'power', amount: 6 }
    ],
    cycleTime: 4
  }
];

export function getRecipe(id: string): Recipe | undefined {
  return recipes.find((recipe) => recipe.id === id);
}