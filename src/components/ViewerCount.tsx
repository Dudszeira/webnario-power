'use client';

import { useEffect, useState } from 'react';

type Props = {
  min?: number;
  max?: number;
};

export default function ViewerCount({ min = 210, max = 220 }: Props) {
  const [count, setCount] = useState(() => Math.floor((min + max) / 2));

  useEffect(() => {
    function tick() {
      setCount((prev) => {
        const rare = Math.random() < 0.12;
        const delta = rare ? (Math.random() < 0.5 ? 2 : -2) : (Math.random() < 0.5 ? 1 : -1);
        const next = prev + delta;
        if (next < min) return min;
        if (next > max) return max;
        return next;
      });
      const delay = (15 + Math.floor(Math.random() * 30)) * 1000;
      setTimeout(tick, delay);
    }
    const init = (15 + Math.floor(Math.random() * 30)) * 1000;
    const t = setTimeout(tick, init);
    return () => clearTimeout(t);
  }, [min, max]);

  return (
    <div className="flex items-center gap-1.5">
      {/* People icon */}
      <svg
        className="w-4 h-4"
        style={{ color: '#6b7280' }}
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>
      <span className="font-bold text-sm text-white">{count}</span>
      <span className="text-sm" style={{ color: '#6b7280' }}>assistindo</span>
    </div>
  );
}
