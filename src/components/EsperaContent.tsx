'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Countdown from './Countdown';
import RegisterModal from './RegisterModal';

type Props = {
  editionId: string;
  session: { name: string; email: string } | null;
  liveStartMs: number;
  liveOver: boolean;
  salesUrl: string;
  registered: boolean;
};

const BULLETS = [
  'O erro que fez meu pai quebrar o negócio de fotografia dele e o que fizemos depois para faturar R$ 1 milhão em um ano.',
  'Os 3 pilares de um negócio de fotografia que fatura mais de R$ 10 mil por mês.',
  'Jeito certo vs. jeito errado de fazer marketing — Com exemplos reais de fotógrafos que acertaram e erraram na prática.',
  'Análise ao vivo dos 3 pilares do SEU negócio — Descubra qual dos 3 pilares está travando o seu crescimento e o que fazer para resolver ainda hoje.',
];

export default function EsperaContent({
  session, liveStartMs, liveOver, salesUrl, registered,
}: Props) {
  const router = useRouter();
  const [showRegister, setShowRegister] = useState(!registered && !liveOver);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showLiveOver, setShowLiveOver] = useState(liveOver);
  const [isRegistered, setIsRegistered] = useState(registered);

  function handleRegistered() {
    setShowRegister(false);
    setShowSuccess(true);
    setIsRegistered(true);
    setTimeout(() => setShowSuccess(false), 3500);
  }

  function handleBlocked(url: string) {
    if (url) window.location.href = url;
    else router.push('/bloqueado');
  }

  const handleCountdownReached = useCallback(() => {
    if (isRegistered) router.push('/ao-vivo');
  }, [isRegistered, router]);

  useEffect(() => {
    if (!isRegistered) return;
    const t = setInterval(() => {
      if (Date.now() >= liveStartMs) router.push('/ao-vivo');
    }, 5000);
    return () => clearInterval(t);
  }, [isRegistered, liveStartMs, router]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#000' }}>

      {/* ── Logo ── */}
      <div className="flex flex-col items-center pt-8 pb-6 px-4">
        <Image
          src="/logo.webp"
          alt="Negócio de Fotografia 10K"
          width={200}
          height={74}
          className="object-contain"
          priority
        />
      </div>

      {/* ── Countdown ── */}
      <div className="flex flex-col items-center px-4 pb-8">
        <Countdown targetMs={liveStartMs} onReached={handleCountdownReached} />
      </div>

      {/* ── White content card ── */}
      <div className="w-full max-w-2xl mx-auto px-4 pb-4 flex-1">
        <div
          className="rounded-2xl px-8 py-8 w-full"
          style={{ background: '#fff' }}
        >
          <h2
            className="text-center font-bold text-lg mb-6 leading-snug"
            style={{ color: '#111' }}
          >
            Enquanto você aguarda, veja o<br />que vai descobrir hoje:
          </h2>

          <div className="space-y-4">
            {BULLETS.map((text, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="flex-shrink-0 mt-0.5">
                  <svg
                    className="w-5 h-5"
                    style={{ color: '#9ca3af' }}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Redirect notice ── */}
      <div className="text-center px-4 py-6 max-w-xl mx-auto">
        <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>
          Quando chegar às 20h,{' '}
          <strong className="text-white font-semibold">
            você será redirecionado automaticamente para a Imersão ao vivo.
          </strong>{' '}
          Não precisa fazer nada, é só aguardar!
        </p>
      </div>

      {/* ── Footer ── */}
      <div className="text-center pb-6 px-4">
        <p className="text-xs" style={{ color: '#374151' }}>
          Robison Kunz © {new Date().getFullYear()} · Todos os direitos reservados
        </p>
      </div>

      {/* ── Register Modal ── */}
      {showRegister && !liveOver && (
        <RegisterModal onSuccess={handleRegistered} onBlocked={handleBlocked} />
      )}

      {/* ── Success overlay ── */}
      {showSuccess && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.9)' }}
        >
          <div
            className="rounded-2xl p-10 text-center max-w-sm w-full mx-4"
            style={{ background: '#1a1a1a' }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ border: '2px solid #3b82f6' }}
            >
              <svg className="w-8 h-8" style={{ color: '#3b82f6' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Cadastro realizado!</h2>
            <p style={{ color: '#9ca3af' }} className="text-sm">
              Redirecionando para o webinário em instantes...
            </p>
          </div>
        </div>
      )}

      {/* ── Live Over Modal ── */}
      {showLiveOver && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.92)' }}
        >
          <div
            className="rounded-2xl border p-8 text-center max-w-md w-full"
            style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
          >
            <div className="text-5xl mb-4">📺</div>
            <h2 className="text-2xl font-bold text-white mb-3">
              A transmissão ao vivo encerrou
            </h2>
            <p className="leading-relaxed mb-6 text-sm" style={{ color: '#9ca3af' }}>
              Você perdeu a transmissão ao vivo desta edição. Fique atento aos nossos
              canais — e-mail e grupo — onde avisaremos sobre o replay e as próximas edições.
            </p>
            {salesUrl && (
              <a
                href={salesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full font-bold py-3 rounded-xl transition-colors text-white text-sm"
                style={{ background: '#2563eb' }}
              >
                Acessar canais oficiais
              </a>
            )}
            <button
              onClick={() => setShowLiveOver(false)}
              className="mt-3 text-xs transition-colors"
              style={{ color: '#4b5563' }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
