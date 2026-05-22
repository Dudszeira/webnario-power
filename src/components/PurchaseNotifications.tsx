'use client';

import { useEffect, useState, useRef } from 'react';

type SimComment = {
  id: string;
  type: string;
  author_name: string;
  text: string;
  video_timestamp: number;
};

type Toast = {
  id: string;
  name: string;
  text: string;
  exiting?: boolean;
};

type Props = {
  simulatedComments: SimComment[];
  videoOffsetRef: React.RefObject<number>;
};

export default function PurchaseNotifications({ simulatedComments, videoOffsetRef }: Props) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const shownIds = useRef<Set<string>>(new Set());

  const purchases = simulatedComments.filter((c) => c.type === 'simulated_purchase');

  useEffect(() => {
    if (!purchases.length) return;

    const interval = setInterval(() => {
      const offset = videoOffsetRef.current ?? 0;
      // Check which purchases should fire now (within last 2 seconds)
      purchases.forEach((p) => {
        if (!shownIds.current.has(p.id) && p.video_timestamp <= offset && p.video_timestamp > offset - 2) {
          shownIds.current.add(p.id);
          const toast: Toast = { id: p.id, name: p.author_name, text: p.text };
          setToasts((prev) => [...prev.slice(-4), toast]);

          // Auto remove after 5s
          setTimeout(() => {
            setToasts((prev) => prev.map((t) => t.id === p.id ? { ...t, exiting: true } : t));
            setTimeout(() => {
              setToasts((prev) => prev.filter((t) => t.id !== p.id));
            }, 400);
          }, 5000);
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [purchases, videoOffsetRef]);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 shadow-2xl max-w-xs ${t.exiting ? 'toast-exit' : 'toast-enter'}`}
        >
          <div className="flex-shrink-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
            {t.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-xs text-green-400 font-semibold">Compra realizada!</p>
            <p className="text-white text-sm font-medium leading-tight">{t.name}</p>
            <p className="text-gray-400 text-xs">{t.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
