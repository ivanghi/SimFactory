import type { WorldState } from './world';
import { updatePower } from './power';
import { tick } from './tick';
import { applyMilestonesSilently } from './milestones';
import { resources } from '../data/resources';
import { getBuildingDef } from '../data/buildings';

export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
export const OFFLINE_STEP_SECONDS = 60;

export interface OfflineSummary {
  elapsedMs: number;
  capped: boolean;
  steps: number;
  resourceDeltas: Record<string, number>;
  unlocked: string[];
}

export function computeOfflineElapsedMs(now: number, savedAt: number): number {
  return clampElapsed(now - savedAt);
}

export function processOfflineTime(world: WorldState, offlineTimeMs: number): OfflineSummary {
  const elapsedMs = clampElapsed(offlineTimeMs);
  const before = { ...world.stockpile };
  const unlocked = new Set<string>();

  const stepMs = OFFLINE_STEP_SECONDS * 1000;
  const fullSteps = Math.floor(elapsedMs / stepMs);
  for (let i = 0; i < fullSteps; i++) {
    advance(world, OFFLINE_STEP_SECONDS, unlocked);
  }

  const remainderMs = elapsedMs - fullSteps * stepMs;
  if (remainderMs > 0) {
    advance(world, remainderMs / 1000, unlocked);
  }

  const resourceDeltas: Record<string, number> = {};
  for (const [resource, amount] of Object.entries(world.stockpile)) {
    const delta = amount - (before[resource] ?? 0);
    if (delta !== 0) {
      resourceDeltas[resource] = delta;
    }
  }

  return {
    elapsedMs,
    capped: Number.isFinite(offlineTimeMs) && offlineTimeMs > OFFLINE_CAP_MS,
    steps: fullSteps + (remainderMs > 0 ? 1 : 0),
    resourceDeltas,
    unlocked: [...unlocked]
  };
}

export function formatOfflineSummary(summary: OfflineSummary): string | null {
  const parts: string[] = [];

  const order = new Map(resources.map((resource, index) => [resource.id, index]));
  const gains = Object.entries(summary.resourceDeltas)
    .filter(([, delta]) => delta > 0)
    .sort(([a], [b]) => (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER));
  for (const [resource, delta] of gains) {
    parts.push(`+${formatAmount(delta)} ${resourceName(resource)}`);
  }

  if (summary.unlocked.length > 0) {
    const names = summary.unlocked.map((id) => getBuildingDef(id)?.name ?? id);
    parts.push(`unlocked ${names.join(', ')}`);
  }

  if (parts.length === 0) {
    return null;
  }
  return `While you were away: ${parts.join(', ')}`;
}

function advance(world: WorldState, dt: number, unlocked: Set<string>): void {
  updatePower(world, dt);
  tick(world, dt);
  for (const event of applyMilestonesSilently(world)) {
    unlocked.add(event.milestoneId);
  }
}

function clampElapsed(offlineTimeMs: number): number {
  if (Number.isNaN(offlineTimeMs) || offlineTimeMs <= 0) {
    return 0;
  }
  if (!Number.isFinite(offlineTimeMs)) {
    return OFFLINE_CAP_MS;
  }
  return Math.min(offlineTimeMs, OFFLINE_CAP_MS);
}

function resourceName(id: string): string {
  return resources.find((resource) => resource.id === id)?.name ?? id;
}

function formatAmount(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}