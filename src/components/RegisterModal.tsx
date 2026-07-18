'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

type Props = {
  onSuccess: () => void;
  onBlocked: (salesUrl: string) => void;
};

export default function RegisterModal({ onSuccess, onBlocked }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim() || !email.trim()) {
      setError('Preencha todos os campos.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (res.status === 409) { onBlocked(data.sales_page_url || ''); return; }
      if (!res.ok) { setError(data.error || 'Erro. Tente novamente.'); return; }
      onSuccess();
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md">
        <CardContent>
          <div className="mb-6 flex justify-center">
            <Image src="/logo.webp" alt="Negócio de Fotografia 10K" width={150} height={56} className="object-contain" />
          </div>

          <h2 className="mb-2 text-center text-xl font-bold">Você está a um passo!</h2>
          <p className="mb-6 text-center text-sm leading-relaxed text-muted-foreground">
            Você está a um passo de descobrir os 3 pilares para faturar mais de{' '}
            <span className="font-semibold text-primary">10 mil reais por mês!</span> Para acessar a
            imersão, adicione seus dados abaixo:
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Primeiro Nome</Label>
              <Input
                type="text"
                placeholder="Seu primeiro nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Seu E-mail</Label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            {error && <p className="text-center text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={loading} className="mt-1 h-11 uppercase tracking-wide">
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? 'Aguarde...' : 'Quero Entrar na Imersão'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
