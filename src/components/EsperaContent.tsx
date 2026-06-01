'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Countdown from './Countdown';
import RegisterModal from './RegisterModal';
import { cyber, cyberFonts } from '@/lib/cybertheme';

type Props = {
  editionId: string;
  session: { name: string; email: string } | null;
  liveStartMs: number;
  serverNow: number;
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
  session, liveStartMs, serverNow, liveOver, salesUrl, registered,
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
    <div style={{ background: cyber.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

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
        <Countdown targetMs={liveStartMs} serverNow={serverNow} onReached={handleCountdownReached} />
      </div>

      {/* ── Content card ── */}
      <div style={{ maxWidth: 672, margin: '0 auto', padding: '0 16px 16px', flex: 1, width: '100%' }}>
        <div
          style={{
            background: cyber.surface,
            border: `1px solid ${cyber.accentBorderDim}`,
            borderRadius: 12,
            padding: '32px',
            width: '100%',
          }}
        >
          <h2
            style={{
              fontFamily: cyberFonts.body,
              fontSize: 17,
              fontWeight: 700,
              color: cyber.textPrimary,
              textAlign: 'center',
              marginBottom: 24,
              lineHeight: 1.4,
            }}
          >
            Enquanto você aguarda, veja o<br />que vai descobrir hoje:
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {BULLETS.map((text, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  <svg
                    style={{ color: cyber.accent }}
                    width={18}
                    height={18}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p style={{ fontSize: 13.5, color: cyber.textLabel, lineHeight: 1.65, margin: 0 }}>
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Redirect notice ── */}
      <div style={{ textAlign: 'center', padding: '24px 16px', maxWidth: 560, margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: cyber.textLabel, lineHeight: 1.6, margin: 0 }}>
          Quando chegar às 20h,{' '}
          <span style={{ color: cyber.textPrimary, fontWeight: 600 }}>
            você será redirecionado automaticamente para a Imersão ao vivo.
          </span>{' '}
          Não precisa fazer nada, é só aguardar!
        </p>
      </div>

      {/* ── Footer ── */}
      <div style={{ textAlign: 'center', padding: '16px' }}>
        <p style={{ fontSize: 11, color: cyber.textDecorative, margin: 0 }}>
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
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.9)',
          }}
        >
          <div
            style={{
              background: cyber.surface,
              border: `1px solid ${cyber.accentBorderDim}`,
              borderRadius: 12,
              padding: 40,
              textAlign: 'center',
              maxWidth: 360,
              width: '100%',
              margin: '0 16px',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                border: `2px solid ${cyber.green}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <svg
                style={{ color: cyber.green }}
                width={32}
                height={32}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: cyber.textPrimary,
                fontFamily: cyberFonts.body,
                marginBottom: 8,
              }}
            >
              Cadastro realizado!
            </h2>
            <p style={{ fontSize: 13, color: cyber.textLabel, margin: 0 }}>
              Redirecionando para o webinário em instantes...
            </p>
          </div>
        </div>
      )}

      {/* ── Live Over Modal ── */}
      {showLiveOver && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.92)',
          }}
        >
          <div
            style={{
              background: cyber.surface,
              border: `1px solid ${cyber.accentBorderDim}`,
              borderRadius: 12,
              padding: 32,
              textAlign: 'center',
              maxWidth: 440,
              width: '100%',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>📺</div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: cyber.textPrimary,
                fontFamily: cyberFonts.body,
                marginBottom: 12,
              }}
            >
              A transmissão ao vivo encerrou
            </h2>
            <p style={{ fontSize: 13, color: cyber.textLabel, lineHeight: 1.6, marginBottom: 24 }}>
              Você perdeu a transmissão ao vivo desta edição. Fique atento aos nossos
              canais — e-mail e grupo — onde avisaremos sobre o replay e as próximas edições.
            </p>
            {salesUrl && (
              <a
                href={salesUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  width: '100%',
                  background: `linear-gradient(135deg, ${cyber.accent}, ${cyber.accentDim})`,
                  border: 'none',
                  color: cyber.black,
                  fontWeight: 700,
                  fontSize: 13,
                  padding: '12px 0',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontFamily: cyberFonts.body,
                }}
              >
                Acessar canais oficiais
              </a>
            )}
            <button
              onClick={() => setShowLiveOver(false)}
              style={{
                marginTop: 12,
                fontSize: 12,
                color: cyber.textDecorative,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
