import React from 'react';
import { resources } from '../data/resources';
import { getStorageCap } from '../sim/world';
import { useGame } from './useGame';
import { Tooltip } from './tooltip';
import { SettingsMenu } from './settings-menu';
import { RATE_WINDOW_SECONDS } from '../sim/rates';

function formatRate(rate: number): string {
  return rate >= 100 ? String(Math.floor(rate)) : rate.toFixed(1);
}

export const TopBar: React.FC = () => {
  const { world, sciencePerMinute } = useGame();
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
      <Tooltip
        text={`Science per minute — average produced over the last ${RATE_WINDOW_SECONDS}s of game time`}
      >
        <div className="res science-rate">
          <span className="res-name">Science/min</span>
          <span className="res-amt">{formatRate(sciencePerMinute)}</span>
        </div>
      </Tooltip>
      <SettingsMenu />
    </div>
  );
};
