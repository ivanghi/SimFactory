export const recipes = [
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
    cycleTime: 15
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
    cycleTime: 20
  },
  {
    id: 'gear-assembler',
    inputs: [
      { resource: 'iron-ingot', amount: 2 }
    ],
    outputs: [
      { resource: 'gears', amount: 1 }
    ],
    cycleTime: 15
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
    cycleTime: 20
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