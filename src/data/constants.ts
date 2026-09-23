const TICKS_PER_SECOND = 10;
export const TICK_DT = 1 / TICKS_PER_SECOND;

export const BASE_STORAGE_CAP = 500;
export const WAREHOUSE_CAP_BONUS = 250;
export const WAREHOUSE_ID = 'warehouse';

export const EXTRACTOR_BASE_RATE = 1;

export const EXTRACTOR_ADJACENCY_STEP = 0.1;
export const EXTRACTOR_ADJACENCY_MAX = 0.3;

export const SOLAR_PANEL_ID = 'solar-panel';
export const SOLAR_ADJACENCY_STEP = 0.1;
export const SOLAR_ADJACENCY_MAX = 0.5;

export const COAL_GENERATOR_ID = 'coal-generator';
export const COAL_GENERATOR_BURN_SECONDS = 4;
export const COAL_GENERATOR_WATER_BONUS = 0.25;
export const COAL_FUEL_RESOURCE = 'coal';

export const DEMOLISH_REFUND_RATE = 0.5;

export const STARTING_RESOURCES: Record<string, number> = {
  'iron-ore': 50,
  'copper-ore': 30,
  coal: 50,
  'crude-oil': 200,
  water: 50,
  'iron-ingot': 15,
};
