'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

type Props = {
  targetMs: number;
  serverNow?: number;
  onReached?: () => void;
};

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, '0');
}

export default function Countdown({ targetMs, serverNow, onReached }: Props) {
  // Clock skew: difference between server time and client time at mount.
  // Corrects for users whose system clock is ahead or behind the server.
  const clockSkewRef = useRef<number>(serverNow != null ? serverNow - Date.now() : 0);

  const calc = useCallback(() => {
    const now = Date.now() + clockSkewRef.current;
    const diff = Math.max(0, Math.floor((targetMs - now) / 1000));
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
          <div className="flex min-h-[72px] min-w-[72px] flex-col items-center justify-center rounded-lg border border-border bg-card px-3.5 py-2.5 shadow-sm">
            <span className="text-[38px] font-bold leading-none tabular-nums text-primary">
              {u.value}
            </span>
            <span className="mt-1 text-[9px] font-semibold tracking-[0.2em] text-muted-foreground">
              {u.label}
            </span>
          </div>

          {i < units.length - 1 && (
            <span className="-mt-4 select-none text-[28px] font-bold text-muted-foreground/50">:</span>
          )}
        </div>
      ))}
    </div>
  );
}
