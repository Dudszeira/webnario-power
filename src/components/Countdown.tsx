'use client';

import { useEffect, useState, useCallback } from 'react';

type Props = {
  targetMs: number;
  onReached?: () => void;
};

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, '0');
}

export default function Countdown({ targetMs, onReached }: Props) {
  const calc = useCallback(() => {
    const diff = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
    return {
      days: Math.floor(diff / 86400),
      hours: Math.floor((diff % 86400) / 3600),
      minutes: Math.floor((diff % 3600) / 60),
      seconds: diff % 60,
      done: diff === 0,
    };
  }, [targetMs]);

  const [time, setTime] = useState(calc);

  useEffect(() => {
    const t = setInterval(() => {
      const next = calc();
      setTime(next);
      if (next.done) { clearInterval(t); onReached?.(); }
    }, 1000);
    return () => clearInterval(t);
  }, [calc, onReached]);

  const units = [
    { label: 'DIAS', value: pad(time.days) },
    { label: 'HRS',  value: pad(time.hours) },
    { label: 'MIN',  value: pad(time.minutes) },
    { label: 'SEG',  value: pad(time.seconds) },
  ];

  return (
    <div className="flex items-center gap-2">
      {units.map((u, i) => (
        <div key={u.label} className="flex items-center gap-2">
          {/* Flip card */}
          <div
            className="flex flex-col items-center justify-center rounded-lg"
            style={{
              background: '#1a1a1a',
              minWidth: 72,
              minHeight: 72,
              padding: '10px 14px',
            }}
          >
            <span
              className="tabular-nums font-bold leading-none"
              style={{ fontSize: 38, color: '#fff', fontVariantNumeric: 'tabular-nums' }}
            >
              {u.value}
            </span>
            <span
              className="font-semibold tracking-widest mt-1"
              style={{ fontSize: 10, color: '#6b7280', letterSpacing: '0.2em' }}
            >
              {u.label}
            </span>
          </div>

          {/* Separator (not after last) */}
          {i < units.length - 1 && (
            <span
              className="font-bold -mt-4 select-none"
              style={{ fontSize: 28, color: '#374151' }}
            >
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
