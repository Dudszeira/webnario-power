'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import VideoPlayer from './VideoPlayer';
import ChatPanel from './ChatPanel';
import PurchaseNotifications from './PurchaseNotifications';

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
  ctaEnabled: boolean;
  ctaUrl: string;
  ctaText: string;
  ctaStartSecs: number;
  ctaEndSecs: number;
  viewerMin: number;
  viewerMax: number;
  simulatedComments: SimComment[];
  pinnedComments: SimComment[];
  salesUrl: string;
  isAdminPreview?: boolean;
};

export default function AoVivoContent({
  editionId, session, videoSource, videoUrl, videoDuration, initialOffset, liveStartMs,
  chatEnabled, chatMode, ctaEnabled, ctaUrl, ctaText, ctaStartSecs, ctaEndSecs,
  viewerMin, viewerMax, simulatedComments, pinnedComments, salesUrl, isAdminPreview,
}: Props) {
  const videoOffsetRef = useRef<number>(initialOffset);
  const [liveEnded, setLiveEnded] = useState(false);

  const handleTimeUpdate = useCallback((secs: number) => {
    videoOffsetRef.current = secs;
  }, []);

  useEffect(() => {
    const check = () => {
      if (Date.now() > liveStartMs + videoDuration * 1000) setLiveEnded(true);
    };
    check();
    const t = setInterval(check, 10000);
    return () => clearInterval(t);
  }, [liveStartMs, videoDuration]);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#0d0d0d' }}>

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

      {/* ── Main layout: video (left) + chat (right, desktop) ── */}
      <div className="flex flex-col md:flex-row flex-1 p-4 md:p-6 gap-4 md:gap-5">

        {/* Left column */}
        <div className="flex flex-col flex-1 min-w-0 gap-4">

          {/* Video card */}
          <div
            className="w-full overflow-hidden"
            style={{ borderRadius: 20, background: '#111', border: '1px solid #1e1e1e' }}
          >
            <VideoPlayer
              source={videoSource}
              url={videoUrl}
              initialOffset={initialOffset}
              onTimeUpdate={handleTimeUpdate}
            />
          </div>

          {/* Info card below video */}
          <div
            className="flex items-center gap-4 px-5 py-4 flex-shrink-0"
            style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 20 }}
          >
            {/* Logo thumbnail */}
            <div className="flex-shrink-0">
              <Image
                src="/logo.webp"
                alt="Logo"
                width={88}
                height={72}
                className="object-contain rounded"
              />
            </div>
            {/* Headline */}
            <p className="text-sm leading-snug flex-1 min-w-0" style={{ color: '#d1d5db' }}>
              Os{' '}
              <strong className="text-white">3 Pilares</strong> Para Transformar Sua Fotografia em um{' '}
              <strong className="text-white">Negócio Lucrativo</strong> que fatura mais de{' '}
              <strong className="text-white">10 Mil Reais</strong> todos os meses.
            </p>
          </div>

          {/* Mobile chat (below info card, hidden on md+) */}
          <div
            className="md:hidden overflow-hidden"
            style={{ minHeight: 400, borderRadius: 20, border: '1px solid #1e1e1e' }}
          >
            <ChatPanel
              editionId={editionId}
              sessionName={session.name}
              chatEnabled={chatEnabled}
              chatMode={chatMode}
              simulatedComments={simulatedComments as any}
              pinnedComments={pinnedComments as any}
              videoOffsetRef={videoOffsetRef}
              ctaEnabled={ctaEnabled}
              ctaUrl={ctaUrl}
              ctaText={ctaText}
              ctaStartSecs={ctaStartSecs}
              ctaEndSecs={ctaEndSecs}
              viewerMin={viewerMin}
              viewerMax={viewerMax}
            />
          </div>
        </div>

        {/* Right column — chat card (desktop only) */}
        <div
          className="hidden md:flex flex-col flex-shrink-0 overflow-hidden"
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
            ctaEnabled={ctaEnabled}
            ctaUrl={ctaUrl}
            ctaText={ctaText}
            ctaStartSecs={ctaStartSecs}
            ctaEndSecs={ctaEndSecs}
            viewerMin={viewerMin}
            viewerMax={viewerMax}
          />
        </div>
      </div>

      {/* Purchase notifications */}
      <PurchaseNotifications
        simulatedComments={simulatedComments as any}
        videoOffsetRef={videoOffsetRef}
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
              A transmissão ao vivo chegou ao fim. Obrigado por participar! Fique atento aos
              nossos canais para as próximas informações.
            </p>
            {salesUrl && (
              <a
                href={salesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full font-bold py-3 rounded-xl text-sm text-white transition-opacity hover:opacity-90"
                style={{ background: '#2563eb' }}
              >
                Próximos passos →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
