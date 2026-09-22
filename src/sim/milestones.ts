import { milestones } from '../data/milestones';
import type { MilestoneDef } from '../data/milestones';
import type { WorldState } from './world';

export type MilestoneTrigger =
  | { kind: 'start' }
  | { kind: 'produce'; resource: string; quantity: number }
  | { kind: 'place'; buildingId: string; quantity: number };

export interface MilestoneUnlockEvent {
  type: 'unlock';
  milestoneId: string;
  buildingId: string;
  trigger: MilestoneTrigger;
}

export interface MilestoneObjective {
  milestoneId: string;
  buildingId: string;
  trigger: MilestoneTrigger;
  progress: number;
  target: number;
  done: boolean;
}

export type MilestoneUnlockListener = (event: MilestoneUnlockEvent) => void;

export function parseMilestoneTrigger(def: MilestoneDef): MilestoneTrigger {
  if (def.unlockedBy === 'start') {
    return { kind: 'start' };
  }
  const quantity = def.quantity ?? 1;
  if (def.unlockedBy.startsWith('produce-')) {
    return {
      kind: 'produce',
      resource: def.unlockedBy.slice('produce-'.length),
      quantity
    };
  }
  if (def.unlockedBy.startsWith('place-')) {
    return {
      kind: 'place',
      buildingId: def.unlockedBy.slice('place-'.length),
      quantity
    };
  }
  throw new Error(`Unknown milestone trigger: ${def.unlockedBy}`);
}

export function milestoneCounterKey(trigger: MilestoneTrigger): string | null {
  if (trigger.kind === 'start') {
    return null;
  }
  if (trigger.kind === 'produce') {
    return `produce-${trigger.resource}`;
  }
  return `place-${trigger.buildingId}`;
}

export function milestoneProgressFor(world: WorldState, trigger: MilestoneTrigger): number {
  const key = milestoneCounterKey(trigger);
  if (!key) {
    return 1;
  }
  return world.milestoneProgress[key] ?? 0;
}

export function milestoneTarget(trigger: MilestoneTrigger): number {
  return trigger.kind === 'start' ? 1 : trigger.quantity;
}

function isSatisfied(world: WorldState, trigger: MilestoneTrigger): boolean {
  if (trigger.kind === 'start') {
    return true;
  }
  return milestoneProgressFor(world, trigger) >= trigger.quantity;
}

export function evaluateMilestones(
  world: WorldState,
  notify?: MilestoneUnlockListener
): MilestoneUnlockEvent[] {
  const events: MilestoneUnlockEvent[] = [];
  for (const def of milestones) {
    if (world.unlocked[def.id]) {
      continue;
    }
    const trigger = parseMilestoneTrigger(def);
    if (trigger.kind === 'start') {
      world.unlocked[def.id] = true;
      continue;
    }
    if (!isSatisfied(world, trigger)) {
      continue;
    }
    world.unlocked[def.id] = true;
    const event: MilestoneUnlockEvent = {
      type: 'unlock',
      milestoneId: def.id,
      buildingId: def.id,
      trigger
    };
    events.push(event);
    if (notify) {
      notify(event);
    }
  }
  return events;
}

export function applyMilestonesSilently(world: WorldState): MilestoneUnlockEvent[] {
  return evaluateMilestones(world);
}

export function getMilestoneObjectives(world: WorldState): MilestoneObjective[] {
  return milestones.map(def => {
    const trigger = parseMilestoneTrigger(def);
    return {
      milestoneId: def.id,
      buildingId: def.id,
      trigger,
      progress: milestoneProgressFor(world, trigger),
      target: milestoneTarget(trigger),
      done: !!world.unlocked[def.id]
    };
  });
}