import React from 'react';
import { milestones } from '../data/milestones';
import { buildings } from '../data/buildings';
import { resources } from '../data/resources';
import type { WorldState } from '../sim/world';
import { useGame } from './useGame';
import { Tooltip } from './tooltip';

interface MilestoneDef {
  id: string;
  unlockedBy: string;
  quantity?: number;
}

interface Goal {
  building: string;
  label: string;
  progress: number;
  target: number;
  done: boolean;
}

function describeGoal(world: WorldState, milestone: MilestoneDef): Goal | null {
  const buildingName = buildings.find((b) => b.id === milestone.id)?.name ?? milestone.id;
  if (milestone.unlockedBy === 'start') return null;
  const target = milestone.quantity ?? 1;

  if (milestone.unlockedBy.startsWith('produce-')) {
    const id = milestone.unlockedBy.slice('produce-'.length);
    const name = resources.find((r) => r.id === id)?.name ?? id;
    const progress = world.milestoneProgress[`produce-${id}`] ?? 0;
    return {
      building: buildingName,
      label: `Produce ${target} ${name}`,
      progress,
      target,
      done: !!world.unlocked[milestone.id]
    };
  }

  if (milestone.unlockedBy.startsWith('place-')) {
    const id = milestone.unlockedBy.slice('place-'.length);
    const name = buildings.find((b) => b.id === id)?.name ?? id;
    const progress = world.milestoneProgress[`place-${id}`] ?? 0;
    return {
      building: buildingName,
      label: `Place a ${name}`,
      progress,
      target,
      done: !!world.unlocked[milestone.id]
    };
  }

  return null;
}

export const Objectives: React.FC = () => {
  const { world } = useGame();
  if (!world) return null;

  return (
    <div className="objectives">
      <h3>Objectives</h3>
      <ul>
        {milestones.map((milestone) => {
          const goal = describeGoal(world, milestone as MilestoneDef);
          if (!goal) return null;
          return (
            <li key={milestone.id} className={goal.done ? 'done' : 'pending'}>
              <Tooltip text={`Unlocks: ${goal.building}`}>
                <span className="goal-state">{goal.done ? '+' : '-'}</span>
                <span className="goal-label">{goal.label}</span>
                {!goal.done && (
                  <span className="goal-progress">
                    {Math.floor(Math.min(goal.progress, goal.target))}/{goal.target}
                  </span>
                )}
              </Tooltip>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
