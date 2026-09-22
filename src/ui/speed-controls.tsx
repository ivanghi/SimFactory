import React from 'react';
import { useGame } from './useGame';
import { setSpeed, type SpeedSetting } from './store';

const OPTIONS: { value: SpeedSetting; label: string }[] = [
  { value: 0, label: 'Pause' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 3, label: '3x' }
];

export const SpeedControls: React.FC = () => {
  const { speed } = useGame();
  return (
    <div className="speed-controls">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          className={speed === option.value ? 'active' : ''}
          onClick={() => setSpeed(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
