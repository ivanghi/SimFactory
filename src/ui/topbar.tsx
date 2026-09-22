import React from 'react';
import { resources } from '../data/resources';
import { getStorageCap } from '../sim/world';
import { useGame } from './useGame';
import { Tooltip } from './tooltip';

export const TopBar: React.FC = () => {
  const { world } = useGame();
  if (!world) return null;
  const cap = getStorageCap(world);

  return (
    <div className="topbar">
      {resources.map((res) => {
        const amount = world.stockpile[res.id] ?? 0;
        const capped = amount >= cap - 0.001;
        return (
          <Tooltip key={res.id} text={`${res.name} — stored ${Math.floor(amount)} / cap ${cap}`}>
            <div className={`res${capped ? ' capped' : ''}`}>
              <span className="res-name">{res.name}</span>
              <span className="res-amt">{Math.floor(amount)}</span>
            </div>
          </Tooltip>
        );
      })}
      <div className="cap-note">cap {cap}</div>
    </div>
  );
};
