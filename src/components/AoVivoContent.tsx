'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import VideoPlayer from './VideoPlayer';
import ChatPanel from './ChatPanel';
import PurchaseNotifications from './PurchaseNotifications';
import { computeEffectiveCta } from '@/lib/cta';

type SimComment = {
  id: string;
  type: string;
  author_name: string;
  text: string;
  video_timestamp: number;
  is_pinned?: number;
  pin_start_seconds?: number;
  pin_end_seconds?: number;
};

type RealComment = {
  id: string;
  type: string;
  author_name: string;
  text: string;
  created_at: string;
  reply?: string;
  reply_author?: string;
};

type Props = {
  editionId: string;
  session: { registrationId: string; name: string; email: string };
  videoSource: 'upload' | 'youtube';
  videoUrl: string;
  videoDuration: number;
  initialOffset: number;
  liveStartMs: number;
  chatEnabled: boolean;
  chatMode: 'general' | 'isolated';
  ctaAutoEnabled: boolean;
  ctaOverride: 'on' | 'off' | null;
  ctaOverrideAt: string | null;
  ctaUrl: string;
  ctaText: string;
  ctaStartSecs: number;
  ctaEndSecs: number;
  notificationsEnabled?: boolean;
  viewerMin: number;
  viewerMax: number;
  simulatedComments: SimComment[];
  pinnedComments: SimComment[];
  salesUrl: string;
  isAdminPreview?: boolean;
  initialRealComments?: RealComment[];
};

export default function AoVivoContent({
  editionId, session, videoSource, videoUrl, videoDuration, initialOffset, liveStartMs,
  chatEnabled, chatMode, ctaAutoEnabled, ctaOverride, ctaOverrideAt, ctaUrl, ctaText, ctaStartSecs, ctaEndSecs,
  notificationsEnabled, viewerMin, viewerMax, simulatedComments, pinnedComments, salesUrl, isAdminPreview,
  initialRealComments,
}: Props) {
  const videoOffsetRef = useRef<number>(initialOffset);
  const [liveEnded, setLiveEnded] = useState(false);
  // Lifted so PurchaseNotifications reacts to CTA activation and survives minimize/maximize.
  // Computed the same way ChatPanel computes it, seeded with SSR data, so there's no
  // incorrect flash before ChatPanel's own effect confirms it on mount.
  const [liveCta, setLiveCta] = useState(() => computeEffectiveCta({
    offsetSecs: initialOffset,
    overrideOffsetSecs: ctaOverrideAt ? Math.floor((new Date(ctaOverrideAt).getTime() - liveStartMs) / 1000) : null,
    override: ctaOverride,
    autoEnabled: ctaAutoEnabled,
    startSecs: ctaStartSecs,
    endSecs: ctaEndSecs,
  }));
  const [chatMinimized, setChatMinimized] = useState(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem('lc_chat_minimized') === '1'; } catch { return false; }
  });
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  const handleTimeUpdate = useCallback((secs: number) => {
    videoOffsetRef.current = secs;
  }, []);

  // Short screens (phone in landscape, small laptop windows) get the desktop layout from md up;
  // switch the chat to its compact form there so the composer stays on screen.
  const [shortViewport, setShortViewport] = useState(false);
  // Phone turned sideways: video takes the whole screen and the chat steps aside (CSS-hidden,
  // so it keeps its state and comes back as it was when the phone is turned upright).
  const [landscapePhone, setLandscapePhone] = useState(false);
  useEffect(() => {
    const short = window.matchMedia('(max-height: 640px)');
    const phone = window.matchMedia('(orientation: landscape) and (max-height: 500px) and (pointer: coarse)');
    const update = () => { setShortViewport(short.matches); setLandscapePhone(phone.matches); };
    update();
    short.addEventListener('change', update);
    phone.addEventListener('change', update);
    return () => { short.removeEventListener('change', update); phone.removeEventListener('change', update); };
  }, []);

  function toggleChat() {
    setChatMinimized(v => {
      const next = !v;
      try { localStorage.setItem('lc_chat_minimized', next ? '1' : '0'); } catch {}
      return next;
    });
  }

  useEffect(() => {
    const check = () => {
      if (Date.now() > liveStartMs + videoDuration * 1000) setLiveEnded(true);
    };
    check();
    const t = setInterval(check, 10000);
    return () => clearInterval(t);
  }, [liveStartMs, videoDuration]);

  // Heartbeat: track watch time every 60s (skips admin preview)
  useEffect(() => {
    if (isAdminPreview) return;
    const t = setInterval(() => {
      fetch('/api/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'heartbeat', meta: { video_offset: videoOffsetRef.current } }),
      }).catch(() => {});
    }, 60000);
    return () => clearInterval(t);
  }, [isAdminPreview]);

  // Redirect countdown when live ends (skip admin)
  useEffect(() => {
    if (!liveEnded || !salesUrl || isAdminPreview) return;
    setRedirectCountdown(10);
  }, [liveEnded, salesUrl, isAdminPreview]);

  useEffect(() => {
    if (redirectCountdown === null) return;
    if (redirectCountdown <= 0) { window.location.href = salesUrl; return; }
    const t = setTimeout(() => setRedirectCountdown(c => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [redirectCountdown, salesUrl]);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden md:h-screen" style={{ background: '#0d0d0d' }}>

      {/* Admin preview banner */}
      {isAdminPreview && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-2 flex-shrink-0"
          style={{ background: 'rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(245,158,11,0.25)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#f59e0b' }}>
              ⚠ Modo preview — Admin
            </span>
            <span className="text-xs" style={{ color: 'rgba(245,158,11,0.6)' }}>
              Participantes reais são bloqueados fora do horário da live.
            </span>
          </div>
          <a href="/admin" className="text-xs hover:underline flex-shrink-0" style={{ color: '#f59e0b' }}>
            ← Voltar ao admin
          </a>
        </div>
      )}

      {/* ── Main layout: video (left) + chat (right, desktop) ──
          Mobile: video pinned on top, chat fills the rest; only the comment list scrolls. */}
      <div className={`flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden ${landscapePhone ? '' : shortViewport ? 'md:p-3 md:gap-3' : 'md:p-6 md:gap-5'}`}
        style={landscapePhone ? { background: '#000' } : undefined}>

        {/* Left column */}
        <div className={`flex flex-col flex-1 min-w-0 min-h-0 ${landscapePhone ? 'justify-center' : 'md:gap-4 md:overflow-y-auto'}`}>

          {/* Video card (landscape phones: capped at half the height so the chat still fits) */}
          <div
            className={landscapePhone
              ? 'flex-shrink-0 overflow-hidden mx-auto'
              : 'w-full flex-shrink-0 overflow-hidden max-md:w-[min(100%,calc(50dvh*16/9))] max-md:mx-auto md:rounded-[20px] md:border md:border-[#1e1e1e]'}
            style={{ background: '#111', ...(landscapePhone ? { width: 'min(100%, calc(100dvh * 16 / 9))' } : {}) }}
          >
            <VideoPlayer
              source={videoSource}
              url={videoUrl}
              initialOffset={initialOffset}
              videoDuration={videoDuration}
              onTimeUpdate={handleTimeUpdate}
            />
          </div>

          {/* Info card below video (desktop only: on mobile it would push the chat down) */}
          <div
            className={`hidden ${landscapePhone ? '' : 'md:flex'} items-center gap-4 px-5 py-4 flex-shrink-0`}
            style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 20 }}
          >
            {/* Logo thumbnail */}
            <div className="flex-shrink-0">
              <Image
                src="/logo-faixa-preta.png"
                alt="Logo"
                width={110}
                height={36}
                className="object-contain rounded"
              />
            </div>
            {/* Headline */}
            <p className="text-sm leading-snug flex-1 min-w-0" style={{ color: '#d1d5db' }}>
              Os{' '}
              <strong className="text-white">4 Pilares</strong> Para Transformar Sua Fotografia em um{' '}
              <strong className="text-white">Negócio Lucrativo</strong> que fatura mais de{' '}
              <strong className="text-white">200 Mil Reais</strong> todo ano.
            </p>
          </div>

          {/* Mobile chat (fills the space under the video, hidden on md+) */}
          <div
            className={`${landscapePhone ? 'hidden' : 'md:hidden'} flex-1 min-h-0 overflow-hidden`}
            style={{ borderTop: '1px solid #1e1e1e' }}
          >
            <ChatPanel
              editionId={editionId}
              sessionName={session.name}
              chatEnabled={chatEnabled}
              chatMode={chatMode}
              simulatedComments={simulatedComments as any}
              pinnedComments={pinnedComments as any}
              videoOffsetRef={videoOffsetRef}
              ctaAutoEnabled={ctaAutoEnabled}
              ctaOverride={ctaOverride}
              ctaOverrideAt={ctaOverrideAt}
              liveStartMs={liveStartMs}
              ctaUrl={ctaUrl}
              ctaText={ctaText}
              ctaStartSecs={ctaStartSecs}
              ctaEndSecs={ctaEndSecs}
              viewerMin={viewerMin}
              viewerMax={viewerMax}
              onCtaChange={setLiveCta}
              initialRealComments={initialRealComments as any}
              compact
            />
          </div>
        </div>

        {/* Right column — chat card (desktop only) */}
        {chatMinimized ? (
          <button
            onClick={toggleChat}
            title="Abrir chat"
            className={landscapePhone ? 'hidden' : 'hidden md:flex'}
            style={{
              flexShrink: 0,
              width: 44,
              alignSelf: 'stretch',
              background: '#111111',
              border: '1px solid #222222',
              borderRadius: 20,
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.4)',
              padding: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        ) : (
          <div
            className={`hidden ${landscapePhone ? '' : 'md:flex'} flex-col flex-shrink-0 overflow-hidden`}
            style={{
              width: 420,
              borderRadius: 20,
              border: '1px solid #222222',
              background: '#111111',
            }}
          >
            <ChatPanel
              editionId={editionId}
              sessionName={session.name}
              chatEnabled={chatEnabled}
              chatMode={chatMode}
              simulatedComments={simulatedComments as any}
              pinnedComments={pinnedComments as any}
              videoOffsetRef={videoOffsetRef}
              ctaAutoEnabled={ctaAutoEnabled}
              ctaOverride={ctaOverride}
              ctaOverrideAt={ctaOverrideAt}
              liveStartMs={liveStartMs}
              ctaUrl={ctaUrl}
              ctaText={ctaText}
              ctaStartSecs={ctaStartSecs}
              ctaEndSecs={ctaEndSecs}
              viewerMin={viewerMin}
              viewerMax={viewerMax}
              onMinimize={toggleChat}
              onCtaChange={setLiveCta}
              compact={shortViewport}
            />
          </div>
        )}
      </div>

      {/* Purchase notifications */}
      <PurchaseNotifications
        simulatedComments={simulatedComments as any}
        videoOffsetRef={videoOffsetRef}
        ctaEnabled={liveCta}
        notificationsEnabled={notificationsEnabled}
      />

      {/* Live ended modal */}
      {liveEnded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.92)' }}
        >
          <div
            className="rounded-2xl p-8 text-center max-w-md w-full"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <div className="text-5xl mb-4">🏁</div>
            <h2 className="text-2xl font-bold text-white mb-3">Transmissão encerrada</h2>
            <p className="text-sm leading-relaxed mb-6" style={{ color: '#9ca3af' }}>
              A transmissão ao vivo chegou ao fim. Obrigado por participar!
            </p>
            {salesUrl && redirectCountdown !== null && (
              <p className="text-xs mb-4" style={{ color: '#6b7280' }}>
                Redirecionando em <strong style={{ color: '#f59e0b' }}>{redirectCountdown}s</strong>...
              </p>
            )}
            {salesUrl && (
              <a
                href={salesUrl}
                className="block w-full font-bold py-3 rounded-xl text-sm text-white transition-opacity hover:opacity-90"
                style={{ background: '#2563eb' }}
              >
                {redirectCountdown !== null ? 'Ir agora →' : 'Próximos passos →'}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
