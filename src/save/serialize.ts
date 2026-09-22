import { generateMap } from '../sim/mapgen';
import type { Map } from '../sim/mapgen';
import { getBuildingDef } from '../data/buildings';
import type { Building, PowerState, WorldState } from '../sim/world';

export const CURRENT_SAVE_VERSION = 1;
export const LEGACY_SAVE_VERSION = 0;

const MAP_SIZE = 64;
const SPEED_MIN = 0;
const SPEED_MAX = 3;

export type SaveErrorCode = 'invalid-format' | 'unsupported-version' | 'corrupt';

export class SaveError extends Error {
  readonly code: SaveErrorCode;

  constructor(code: SaveErrorCode, message: string) {
    super(message);
    this.name = 'SaveError';
    this.code = code;
  }
}

export interface SaveMeta {
  savedAt: number;
  speed: number;
}

export interface GameSave {
  world: WorldState;
  meta: SaveMeta;
}

export interface SerializedBuilding {
  id: string;
  buildingId: string;
  x: number;
  y: number;
  adjacencyMultiplier: number;
  progress: number;
}

export interface SaveFile {
  version: number;
  seed: number;
  buildings: SerializedBuilding[];
  stockpile: Record<string, number>;
  unlocked: Record<string, boolean>;
  milestoneProgress: Record<string, number>;
  time: number;
  nextBuildingId: number;
  power: PowerState;
  savedAt: number;
  speed: number;
}

export type RawSaveFile = Record<string, unknown>;
export type Migration = (save: RawSaveFile) => unknown;
export type MigrationTable = Record<number, Migration>;

export interface LoadOptions {
  migrations?: MigrationTable;
  currentVersion?: number;
}

export const migrations: MigrationTable = {
  [LEGACY_SAVE_VERSION]: migrateLegacyWorld
};

export function serializeWorld(world: WorldState, meta: SaveMeta): string {
  const file: SaveFile = {
    version: CURRENT_SAVE_VERSION,
    seed: world.map.seed,
    buildings: world.buildings.map((building) => ({
      id: building.id,
      buildingId: building.buildingId,
      x: building.x,
      y: building.y,
      adjacencyMultiplier: building.adjacencyMultiplier,
      progress: building.progress
    })),
    stockpile: { ...world.stockpile },
    unlocked: { ...world.unlocked },
    milestoneProgress: { ...world.milestoneProgress },
    time: world.time,
    nextBuildingId: world.nextBuildingId,
    power: { ...world.power },
    savedAt: meta.savedAt,
    speed: meta.speed
  };
  return JSON.stringify(file);
}

export function deserializeWorld(data: string, options: LoadOptions = {}): GameSave {
  const currentVersion = options.currentVersion ?? CURRENT_SAVE_VERSION;
  const table = options.migrations ?? migrations;

  const raw = parseSaveJson(data);
  const version = readVersion(raw);
  if (version > currentVersion) {
    throw new SaveError(
      'unsupported-version',
      `Save version ${version} is newer than the supported version ${currentVersion}. ` +
        'Update the game before loading this save.'
    );
  }

  const migrated = runMigrations(raw, version, currentVersion, table);
  return fromSaveFile(migrated);
}

export function runMigrations(
  raw: RawSaveFile,
  fromVersion: number,
  toVersion: number,
  table: MigrationTable = migrations
): RawSaveFile {
  let save = raw;
  for (let version = fromVersion; version < toVersion; version++) {
    const migrate = table[version];
    if (!migrate) {
      throw new SaveError('corrupt', `No migration is registered from save version ${version}.`);
    }
    const next = migrate(save);
    if (!isRecord(next)) {
      throw new SaveError(
        'corrupt',
        `Migration from save version ${version} did not produce a save object.`
      );
    }
    save = { ...next, version: version + 1 };
  }
  return save;
}

function migrateLegacyWorld(save: RawSaveFile): RawSaveFile {
  const map = save.map;
  if (!isRecord(map) || !isFiniteNumber(map.seed)) {
    throw new SaveError('corrupt', 'Legacy save is missing a valid map seed.');
  }
  return {
    seed: map.seed,
    buildings: save.buildings,
    stockpile: save.stockpile,
    unlocked: save.unlocked,
    milestoneProgress: save.milestoneProgress ?? {},
    time: save.time ?? 0,
    nextBuildingId: save.nextBuildingId ?? 1,
    power: save.power ?? { supply: 0, demand: 0, efficiency: 1 },
    savedAt: 0,
    speed: 1
  };
}

function parseSaveJson(data: string): RawSaveFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    throw new SaveError('invalid-format', 'Save data is not valid JSON.');
  }
  if (!isRecord(parsed)) {
    throw new SaveError('invalid-format', 'Save data must be a JSON object.');
  }
  return parsed;
}

function readVersion(raw: RawSaveFile): number {
  if ('version' in raw) {
    const version = raw.version;
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
      throw new SaveError('corrupt', 'Save has an invalid version field.');
    }
    return version;
  }
  if (isRecord(raw.map)) {
    return LEGACY_SAVE_VERSION;
  }
  throw new SaveError('corrupt', 'Save is missing a version field.');
}

function fromSaveFile(raw: RawSaveFile): GameSave {
  const seed = requireFiniteNumber(raw, 'seed');
  const map = generateMap(seed);

  const world: WorldState = {
    map,
    buildings: parseBuildings(raw.buildings, map),
    stockpile: parseNumberRecord(raw.stockpile, 'stockpile'),
    unlocked: parseBooleanRecord(raw.unlocked, 'unlocked'),
    milestoneProgress: parseNumberRecord(raw.milestoneProgress, 'milestoneProgress'),
    time: requireFiniteNumber(raw, 'time'),
    nextBuildingId: requireInteger(raw, 'nextBuildingId', 1),
    power: parsePower(raw.power)
  };

  const meta: SaveMeta = {
    savedAt: requireFiniteNumber(raw, 'savedAt'),
    speed: parseSpeed(raw.speed)
  };

  return { world, meta };
}

function parseBuildings(value: unknown, map: Map): Building[] {
  if (!Array.isArray(value)) {
    throw new SaveError('corrupt', 'Save buildings must be an array.');
  }
  return value.map((entry) => {
    if (!isRecord(entry)) {
      throw new SaveError('corrupt', 'Save contains an invalid building entry.');
    }
    const buildingId = requireString(entry, 'buildingId');
    if (!getBuildingDef(buildingId)) {
      throw new SaveError('corrupt', `Save references an unknown building "${buildingId}".`);
    }
    const x = requireInteger(entry, 'x', 0);
    const y = requireInteger(entry, 'y', 0);
    if (x >= MAP_SIZE || y >= MAP_SIZE || !map.tiles[y]?.[x]) {
      throw new SaveError('corrupt', `Save places a building outside the map at (${x}, ${y}).`);
    }
    return {
      id: requireString(entry, 'id'),
      buildingId,
      x,
      y,
      adjacencyMultiplier: requireFiniteNumber(entry, 'adjacencyMultiplier'),
      progress: requireFiniteNumber(entry, 'progress')
    };
  });
}

function parsePower(value: unknown): PowerState {
  if (!isRecord(value)) {
    throw new SaveError('corrupt', 'Save is missing its power state.');
  }
  return {
    supply: requireFiniteNumber(value, 'supply'),
    demand: requireFiniteNumber(value, 'demand'),
    efficiency: requireFiniteNumber(value, 'efficiency')
  };
}

function parseSpeed(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < SPEED_MIN ||
    value > SPEED_MAX
  ) {
    throw new SaveError('corrupt', 'Save has an invalid speed setting.');
  }
  return value;
}

function parseNumberRecord(value: unknown, field: string): Record<string, number> {
  if (!isRecord(value)) {
    throw new SaveError('corrupt', `Save field "${field}" must be an object.`);
  }
  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isFiniteNumber(entry)) {
      throw new SaveError('corrupt', `Save field "${field}.${key}" must be a finite number.`);
    }
    result[key] = entry;
  }
  return result;
}

function parseBooleanRecord(value: unknown, field: string): Record<string, boolean> {
  if (!isRecord(value)) {
    throw new SaveError('corrupt', `Save field "${field}" must be an object.`);
  }
  const result: Record<string, boolean> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'boolean') {
      throw new SaveError('corrupt', `Save field "${field}.${key}" must be a boolean.`);
    }
    result[key] = entry;
  }
  return result;
}

function requireString(record: RawSaveFile, field: string): string {
  const value = record[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new SaveError('corrupt', `Save field "${field}" must be a non-empty string.`);
  }
  return value;
}

function requireFiniteNumber(record: RawSaveFile, field: string): number {
  const value = record[field];
  if (!isFiniteNumber(value)) {
    throw new SaveError('corrupt', `Save field "${field}" must be a finite number.`);
  }
  return value;
}

function requireInteger(record: RawSaveFile, field: string, min: number): number {
  const value = record[field];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new SaveError('corrupt', `Save field "${field}" must be an integer of at least ${min}.`);
  }
  return value;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is RawSaveFile {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}