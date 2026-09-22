import React from 'react';
import { useGame } from './useGame';

export const PowerGauge: React.FC = () => {
  const { world } = useGame();
  if (!world) return null;
  const { supply, demand, efficiency } = world.power;
  const ratio = demand > 0 ? Math.min(supply / demand, 1) : 1;
  const throttled = efficiency < 0.999;

  return (
    <div className={`power-gauge${throttled ? ' throttled' : ''}`}>
      <span className="power-label">Power</span>
      <span className="power-bar">
        <span className="power-fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
      </span>
      <span className="power-text">
        {Math.round(supply)} / {Math.round(demand)}
        {throttled ? ` — ${Math.round(efficiency * 100)}% speed` : ''}
      </span>
    </div>
  );
};
