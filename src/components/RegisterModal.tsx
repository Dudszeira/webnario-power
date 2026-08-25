'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
      <Card className="w-full max-w-md py-4">
        <CardContent className="px-8 py-4">
          <div className="mb-6 flex justify-center">
            <Image src="/logo-faixa-preta.png" alt="Negócio de Fotografia Faixa Preta" width={195} height={65} className="object-contain" />
          </div>

          <h2 className="mb-2 text-center text-xl font-bold">Você está a um passo!</h2>
          <p className="mb-6 text-center text-sm leading-relaxed text-muted-foreground">
            Você está a um passo de descobrir os 4 pilares para faturar mais de{' '}
            <span className="font-semibold text-primary">200 mil reais por ano!</span> Para acessar a
            imersão, adicione seus dados abaixo:
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              type="text"
              aria-label="Primeiro nome"
              placeholder="Seu primeiro nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
              className="h-11"
            />

            <Input
              type="email"
              aria-label="Seu e-mail"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              className="h-11"
            />

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
