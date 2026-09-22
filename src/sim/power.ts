import type { Building, WorldState } from './world';
import type { BuildingDef } from '../data/buildings';
import { getBuildingDef } from '../data/buildings';
import {
  COAL_FUEL_RESOURCE,
  COAL_GENERATOR_BURN_SECONDS,
  COAL_GENERATOR_ID
} from '../data/constants';

export function computeEfficiency(supply: number, demand: number): number {
  if (demand <= 0 || supply >= demand) {
    return 1;
  }
  return supply / demand;
}

export function updatePower(world: WorldState, dt: number): void {
  let supply = 0;
  let demand = 0;
  for (const building of world.buildings) {
    const def = getBuildingDef(building.buildingId);
    if (!def) {
      continue;
    }
    demand += def.powerDraw;
    if (def.category === 'power') {
      supply += generatorOutput(world, building, def, dt);
    }
  }
  world.power.supply = supply;
  world.power.demand = demand;
  world.power.efficiency = computeEfficiency(world.power.supply, world.power.demand);
}

function generatorOutput(
  world: WorldState,
  building: Building,
  def: BuildingDef,
  dt: number
): number {
  const output = (def.powerOutput ?? 0) * building.adjacencyMultiplier;
  if (building.buildingId === COAL_GENERATOR_ID) {
    return runCoalGenerator(world, building, output, dt);
  }
  return output;
}

function runCoalGenerator(
  world: WorldState,
  building: Building,
  output: number,
  dt: number
): number {
  // Track fuel consumption separately from progress to ensure accurate consumption
  if (building.progress <= 0) {
    const fuel = world.stockpile[COAL_FUEL_RESOURCE] ?? 0;
    if (fuel >= 1) {
      world.stockpile[COAL_FUEL_RESOURCE] = fuel - 1;
      building.progress = COAL_GENERATOR_BURN_SECONDS;
    }
  }
  
  if (building.progress <= 0) {
    return 0;
  }
  
  building.progress = Math.max(0, building.progress - dt);
  return output;
}
