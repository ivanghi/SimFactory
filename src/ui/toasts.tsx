import React, { useEffect, useState } from 'react';
import { useGame } from './useGame';

const TOAST_TTL_MS = 2800;

function ageOk(ts: number, now: number): boolean {
  return now - ts < TOAST_TTL_MS;
}

export const Toasts: React.FC = () => {
  const { toasts } = useGame();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (toasts.length === 0) return;
    const handle = setInterval(() => setTick((tick) => tick + 1), 500);
    return () => clearInterval(handle);
  }, [toasts.length]);

  const now = Date.now();
  const visible = toasts.filter((toast) => ageOk(toast.ts, now));
  if (visible.length === 0) return null;

  return (
    <div className="toasts">
      {visible.map((toast) => (
        <div key={toast.id} className="toast">
          {toast.text}
        </div>
      ))}
    </div>
  );
};
