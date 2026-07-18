import Image from 'next/image';
import { Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Waves from '@/components/Waves';

export default function BloqueadoPage({
  searchParams,
}: {
  searchParams: { sales?: string };
}) {
  const salesUrl = searchParams.sales || '';

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4">
      <Waves lineColor="rgba(255,255,255,0.1)" backgroundColor="transparent" />
      <div className="relative w-full max-w-md text-center">
        <Image src="/logo.webp" alt="Logo" width={160} height={60} className="mx-auto mb-8 object-contain" />

        <Card className="relative overflow-hidden bg-transparent p-0">
          <Waves lineColor="rgba(255,255,255,0.14)" backgroundColor="transparent" />
          <CardContent className="relative flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-8 text-center backdrop-blur-2xl">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Lock className="size-6" />
            </div>
            <h1 className="text-2xl font-bold">Acesso não disponível</h1>
            <p className="leading-relaxed text-muted-foreground">
              Este acesso já foi utilizado nesta edição da imersão. Cada participação é única e exclusiva por evento.
            </p>

            {salesUrl ? (
              <Button className="w-full" render={<a href={salesUrl} />}>
                Quero garantir meu acesso
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground/70">
                Fique atento aos canais oficiais para a próxima edição.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
