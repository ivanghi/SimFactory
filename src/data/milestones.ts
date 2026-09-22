export interface MilestoneDef {
  id: string;
  unlockedBy: string;
  quantity?: number;
}

export const milestones: MilestoneDef[] = [
  // Start unlocked
  { id: 'iron-miner', unlockedBy: 'start' },
  { id: 'coal-miner', unlockedBy: 'start' },
  { id: 'water-pump', unlockedBy: 'start' },
  { id: 'smelter', unlockedBy: 'start' },
  { id: 'gear-assembler', unlockedBy: 'start' },
  { id: 'solar-panel', unlockedBy: 'start' },
  { id: 'warehouse', unlockedBy: 'start' },
  
  // Unlock after producing 50 iron ingots
  { id: 'copper-miner', unlockedBy: 'produce-iron-ingot', quantity: 50 },
  { id: 'copper-smelter', unlockedBy: 'produce-iron-ingot', quantity: 50 },
  { id: 'coal-generator', unlockedBy: 'produce-iron-ingot', quantity: 50 },
  
  // Unlock after placing first coal generator
  { id: 'refinery', unlockedBy: 'place-coal-generator' },
  
  // Unlock after producing 100 fuel
  { id: 'chemical-plant', unlockedBy: 'produce-fuel', quantity: 100 },
  { id: 'pumpjack', unlockedBy: 'produce-fuel', quantity: 100 },
  
  // Unlock after producing 50 gears
  { id: 'circuit-assembler', unlockedBy: 'produce-gears', quantity: 50 },
];