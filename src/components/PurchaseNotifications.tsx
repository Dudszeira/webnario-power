'use client';

import { useEffect, useState, useRef, useMemo } from 'react';

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
  shownAt: number;
  exiting?: boolean;
};

type Props = {
  simulatedComments: SimComment[];
  videoOffsetRef: React.RefObject<number>;
  ctaEnabled?: boolean;
  notificationsEnabled?: boolean;
};

const CITIES = [
  'São Paulo, SP', 'Rio de Janeiro, RJ', 'Belo Horizonte, MG', 'Curitiba, PR',
  'Porto Alegre, RS', 'Salvador, BA', 'Fortaleza, CE', 'Manaus, AM',
  'Recife, PE', 'Goiânia, GO', 'Florianópolis, SC', 'Campinas, SP',
  'Natal, RN', 'Campo Grande, MS', 'Teresina, PI', 'Maceió, AL',
  'Joinville, SC', 'Ribeirão Preto, SP', 'Uberlândia, MG', 'Brasília, DF',
];

const AUTO_NAMES = [
  'Ana Paula', 'Carlos Eduardo', 'Mariana S.', 'João Pedro', 'Fernanda Lima',
  'Rafael Costa', 'Juliana M.', 'Bruno Souza', 'Camila F.', 'Diego Alves',
  'Larissa B.', 'Thiago R.', 'Patrícia N.', 'Lucas Mendes', 'Gabriela O.',
  'Rodrigo T.', 'Amanda G.', 'Felipe A.', 'Natalia C.', 'Gustavo P.',
  'Beatriz L.', 'Leonardo S.', 'Andressa V.', 'Matheus H.', 'Sabrina D.',
  'Victor M.', 'Caroline X.', 'Anderson J.', 'Priscila W.', 'Eduardo K.',
  'Renata Q.', 'Fábio Z.', 'Isabela Y.', 'Marcelo U.', 'Tatiane I.',
];

const AUTO_MESSAGES = ['se juntou a Power Start'];

function nameToCity(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return CITIES[Math.abs(h) % CITIES.length];
}

function formatName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return `há ${secs}s`;
  return `há ${Math.floor(secs / 60)}min`;
}

function scheduleToast(
  p: SimComment,
  delayMs: number,
  shownIds: React.RefObject<Set<string>>,
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>,
) {
  setTimeout(() => {
    if (shownIds.current!.has(p.id)) return;
    shownIds.current!.add(p.id);
    const toast: Toast = { id: p.id, name: p.author_name, text: p.text, shownAt: Date.now() };
    setToasts((prev) => [...prev.slice(-3), toast]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => t.id === p.id ? { ...t, exiting: true } : t));
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== p.id)), 400);
    }, 6000);
  }, delayMs);
}

function showAutoToast(setToasts: React.Dispatch<React.SetStateAction<Toast[]>>) {
  const name = AUTO_NAMES[Math.floor(Math.random() * AUTO_NAMES.length)];
  const text = AUTO_MESSAGES[Math.floor(Math.random() * AUTO_MESSAGES.length)];
  const id = `auto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const toast: Toast = { id, name, text, shownAt: Date.now() };
  setToasts((prev) => [...prev.slice(-3), toast]);
  setTimeout(() => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 400);
  }, 6000);
}

export default function PurchaseNotifications({ simulatedComments, videoOffsetRef, ctaEnabled, notificationsEnabled }: Props) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [, setTick] = useState(0);
  const shownIds = useRef<Set<string>>(new Set());
  // Independent admin toggle ANDed on top of the existing CTA gate — off by
  // default only when explicitly disabled, so existing behavior is unchanged.
  const active = !!ctaEnabled && notificationsEnabled !== false;
  const prevCtaRef = useRef(active ?? false);
  const didMountRef = useRef(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduledTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const purchases = useMemo(
    () => simulatedComments.filter((c) => c.type === 'simulated_purchase'),
    [simulatedComments],
  );

  // On mount: show the most recent past purchases for late joiners (up to 3, staggered)
  useEffect(() => {
    if (didMountRef.current || !purchases.length || !active) return;
    const joinOffset = videoOffsetRef.current ?? 0;
    if (joinOffset <= 5) return;
    didMountRef.current = true;

    const past = purchases
      .filter(p => p.video_timestamp <= joinOffset)
      .sort((a, b) => b.video_timestamp - a.video_timestamp)
      .slice(0, 3)
      .reverse();

    let cumulativeDelay = 0;
    past.forEach((p) => {
      scheduleToast(p, cumulativeDelay, shownIds, setToasts);
      cumulativeDelay += 5000 + Math.floor(Math.random() * 7000); // 5–12s entre cada uma
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fire toasts based on video timestamp (5s window for reliability)
  useEffect(() => {
    if (!purchases.length || !active) return;
    const interval = setInterval(() => {
      const offset = videoOffsetRef.current ?? 0;
      purchases.forEach((p) => {
        if (!shownIds.current.has(p.id) && p.video_timestamp <= offset && p.video_timestamp > offset - 5) {
          const jitter = Math.floor(Math.random() * 5000); // até 5s de variação
          scheduleToast(p, jitter, shownIds, setToasts);
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [purchases, videoOffsetRef, active]);

  // Fire unshown DB purchases in staggered order when CTA is activated
  useEffect(() => {
    if (!active) {
      // Cancel any pending scheduled toasts and clear visible ones
      scheduledTimers.current.forEach(clearTimeout);
      scheduledTimers.current = [];
      setToasts([]);
      prevCtaRef.current = false;
      return;
    }
    if (prevCtaRef.current) return;
    prevCtaRef.current = true;
    const unshown = purchases.filter((p) => !shownIds.current.has(p.id));
    let cumulativeDelay = 0;
    unshown.forEach((p) => {
      const delay = cumulativeDelay;
      const tid = setTimeout(() => {
        if (shownIds.current!.has(p.id)) return;
        shownIds.current!.add(p.id);
        const toast: Toast = { id: p.id, name: p.author_name, text: p.text, shownAt: Date.now() };
        setToasts((prev) => [...prev.slice(-3), toast]);
        setTimeout(() => {
          setToasts((prev) => prev.map((t) => t.id === p.id ? { ...t, exiting: true } : t));
          setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== p.id)), 400);
        }, 6000);
      }, delay);
      scheduledTimers.current.push(tid);
      cumulativeDelay += 20000 + Math.floor(Math.random() * 25000); // 20–45s entre cada uma
    });
  }, [active, purchases]);

  // Auto-generated purchase notifications while CTA is active
  // First fires 30s after CTA is enabled, then every 25–40s (randomized)
  useEffect(() => {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    if (!active) return;

    const scheduleNext = (delay: number) => {
      autoTimerRef.current = setTimeout(() => {
        showAutoToast(setToasts);
        scheduleNext(25000 + Math.floor(Math.random() * 15000));
      }, delay);
    };

    scheduleNext(30000);

    return () => {
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, [active]);

  // Tick to refresh "há Xs" timestamps
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 5000);
    return () => clearInterval(t);
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-24 left-3 md:bottom-6 md:left-6 z-50 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 300 }}>
      {toasts.map((t) => {
        const city = nameToCity(t.name);
        const displayName = formatName(t.name);
        const initial = t.name.charAt(0).toUpperCase();

        return (
          <div
            key={t.id}
            className={t.exiting ? 'toast-exit' : 'toast-enter'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'linear-gradient(135deg, rgba(15,58,35,0.98), rgba(20,70,40,0.98))',
              border: '1px solid rgba(34,197,94,0.35)',
              borderRadius: 14,
              padding: '12px 14px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(34,197,94,0.12)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #16a34a, #15803d)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 700, color: '#fff',
              fontFamily: "'Montserrat', sans-serif",
              boxShadow: '0 2px 8px rgba(22,163,74,0.4)',
            }}>
              {initial}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Name + city */}
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: '#fff', lineHeight: 1.3, fontFamily: "'Montserrat', sans-serif" }}>
                {displayName}{' '}
                <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.6)' }}>de {city}</span>
              </p>
              {/* Action text */}
              <p style={{ margin: '2px 0 4px', fontSize: 12, color: 'rgba(255,255,255,0.85)', fontFamily: "'Montserrat', sans-serif" }}>
                {t.text}
              </p>
              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10.5, color: 'rgba(134,239,172,0.7)', fontFamily: "'Montserrat', sans-serif" }}>
                  {timeAgo(t.shownAt)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
