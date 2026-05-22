'use client';

import { useState } from 'react';
import Image from 'next/image';

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{ background: '#1c1c1c' }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image
            src="/logo.webp"
            alt="Negócio de Fotografia 10K"
            width={150}
            height={56}
            className="object-contain"
          />
        </div>

        {/* Heading */}
        <h2 className="text-2xl font-bold text-white text-center mb-2">
          Você está a um passo!
        </h2>
        <p className="text-sm text-center leading-relaxed mb-7" style={{ color: '#9ca3af' }}>
          Você está a um passo de descobrir os 3 pilares para faturar mais de{' '}
          <span className="text-white font-semibold">10 mil reais por mês!</span> Para
          acessar a imersão, adicione seus dados abaixo:
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div>
            <label
              className="block text-xs font-bold uppercase tracking-widest mb-1.5"
              style={{ color: '#6b7280' }}
            >
              Primeiro Nome
            </label>
            <input
              type="text"
              placeholder="Seu primeiro nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
              className="w-full rounded-lg px-4 py-3 text-white text-sm outline-none transition focus:ring-2"
              style={{
                background: '#2a2a2a',
                border: '1px solid #333',
                color: '#fff',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#333')}
            />
          </div>

          {/* Email */}
          <div>
            <label
              className="block text-xs font-bold uppercase tracking-widest mb-1.5"
              style={{ color: '#6b7280' }}
            >
              Seu E-mail
            </label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              className="w-full rounded-lg px-4 py-3 text-sm outline-none transition"
              style={{
                background: '#2a2a2a',
                border: '1px solid #333',
                color: '#fff',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#333')}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full font-bold py-4 rounded-xl text-sm uppercase tracking-wide transition-opacity disabled:opacity-60 text-white mt-2"
            style={{ background: '#1e3a8a', letterSpacing: '0.08em' }}
          >
            {loading ? 'Aguarde...' : 'Quero Entrar na Imersão'}
          </button>
        </form>
      </div>
    </div>
  );
}
