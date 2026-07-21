'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ChevronRight, Check, Tv } from 'lucide-react';
import Countdown from './Countdown';
import RegisterModal from './RegisterModal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Waves from './Waves';

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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <Waves lineColor="rgba(255,255,255,0.1)" backgroundColor="transparent" />
      {/* ── Logo ── */}
      <div className="flex flex-col items-center px-4 pb-6 pt-8">
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
      <div className="relative mx-auto w-full max-w-2xl flex-1 px-4 pb-4">
        <Card className="relative overflow-hidden bg-transparent p-0">
          <Waves lineColor="rgba(255,255,255,0.14)" backgroundColor="transparent" />
          <CardContent className="relative rounded-xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-2xl md:p-10">
            <h2 className="mb-6 text-center text-[17px] font-bold leading-snug">
              Enquanto você aguarda, veja o<br />que vai descobrir hoje:
            </h2>

            <div className="flex flex-col gap-4">
              {BULLETS.map((text, i) => (
                <div key={i} className="flex items-start gap-3">
                  <ChevronRight className="mt-0.5 size-[18px] shrink-0 text-primary" strokeWidth={2.5} />
                  <p className="text-[13.5px] leading-relaxed text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Redirect notice ── */}
      <div className="mx-auto max-w-lg px-4 py-6 text-center">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Quando chegar às 20h,{' '}
          <span className="font-semibold text-foreground">
            você será redirecionado automaticamente para a Imersão ao vivo.
          </span>{' '}
          Não precisa fazer nada, é só aguardar!
        </p>
      </div>

      {/* ── Footer ── */}
      <div className="p-4 text-center">
        <p className="text-[11px] text-muted-foreground/70">
          Robison Kunz © {new Date().getFullYear()} · Todos os direitos reservados
        </p>
      </div>

      {/* ── Register Modal ── */}
      {showRegister && !liveOver && (
        <RegisterModal onSuccess={handleRegistered} onBlocked={handleBlocked} />
      )}

      {/* ── Success overlay ── */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
          <Card className="mx-4 w-full max-w-sm">
            <CardContent className="flex flex-col items-center text-center">
              <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full border-2 border-emerald-500">
                <Check className="size-8 text-emerald-500" strokeWidth={2.5} />
              </div>
              <h2 className="mb-2 text-xl font-bold">Cadastro realizado!</h2>
              <p className="text-sm text-muted-foreground">Redirecionando para o webinário em instantes...</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Live Over Modal ── */}
      {showLiveOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="flex flex-col items-center text-center">
              <Tv className="mx-auto mb-4 size-10 text-muted-foreground" />
              <h2 className="mb-3 text-lg font-bold">A transmissão ao vivo encerrou</h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Você perdeu a transmissão ao vivo desta edição. Fique atento aos nossos
                canais — e-mail e grupo — onde avisaremos sobre o replay e as próximas edições.
              </p>
              {salesUrl && (
                <Button className="w-full" render={<a href={salesUrl} target="_blank" rel="noopener noreferrer" />}>
                  Acessar canais oficiais
                </Button>
              )}
              <Button variant="ghost" size="sm" className="mt-3 text-muted-foreground" onClick={() => setShowLiveOver(false)}>
                Fechar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
