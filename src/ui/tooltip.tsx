import React from 'react';

export const Tooltip: React.FC<{ text: React.ReactNode; children: React.ReactNode }> = ({
  text,
  children
}) => {
  return (
    <span className="tooltip-wrap">
      {children}
      <span className="tooltip">{text}</span>
    </span>
  );
};
