import { WorldState } from '../sim/world';

export function serializeWorld(state: WorldState): string {
  // Implementation placeholder - will be filled in later
  return JSON.stringify(state);
}

export function deserializeWorld(data: string): WorldState {
  // Implementation placeholder - will be filled in later
  return JSON.parse(data);
}