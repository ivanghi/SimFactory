import type { Building, WorldState } from './world';
import { addToStockpile } from './world';
import type { BuildingDef } from '../data/buildings';
import { getBuildingDef } from '../data/buildings';
import { getRecipe } from '../data/recipes';
import { EXTRACTOR_BASE_RATE } from '../data/constants';

export function tick(world: WorldState, dt: number): void {
  world.time += dt;
  const throttle = world.power.efficiency;
  for (const building of world.buildings) {
    const def = getBuildingDef(building.buildingId);
    if (!def) {
      continue;
    }
    if (def.category === 'extractor') {
      runExtractor(world, building, def, dt, throttle);
    } else if (def.category === 'processor') {
      runProcessor(world, building, def, dt, throttle);
    }
  }
}

function runExtractor(
  world: WorldState,
  building: Building,
  def: BuildingDef,
  dt: number,
  throttle: number
): void {
  const tile = world.map.tiles[building.y]?.[building.x];
  if (!tile) {
    return;
  }
  const richness = tile.resource?.richness ?? 1;
  const rate = EXTRACTOR_BASE_RATE * richness * building.adjacencyMultiplier * throttle;
  produce(world, def.recipeId, rate * dt);
}

function runProcessor(
  world: WorldState,
  building: Building,
  def: BuildingDef,
  dt: number,
  throttle: number
): void {
  const recipe = getRecipe(def.recipeId);
  if (!recipe) {
    return;
  }
  const hasInputs = recipe.inputs.every(
    (input) => (world.stockpile[input.resource] ?? 0) >= input.amount
  );
  if (!hasInputs) {
    return;
  }
  building.progress += dt * throttle;
  if (building.progress < recipe.cycleTime) {
    return;
  }
  for (const input of recipe.inputs) {
    world.stockpile[input.resource] = (world.stockpile[input.resource] ?? 0) - input.amount;
  }
  for (const output of recipe.outputs) {
    produce(world, output.resource, output.amount);
  }
  building.progress = 0;
}

function produce(world: WorldState, resource: string, amount: number): void {
  const key = `produce-${resource}`;
  world.milestoneProgress[key] = (world.milestoneProgress[key] ?? 0) + amount;
  addToStockpile(world, resource, amount);
}
