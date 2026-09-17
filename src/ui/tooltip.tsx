import React from 'react';

export const Tooltip: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div className="tooltip">
      {text}
    </div>
  );
};