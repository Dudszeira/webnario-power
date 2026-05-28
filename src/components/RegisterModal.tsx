'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cyber, cyberFonts } from '@/lib/cybertheme';

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
        style={{
          position: 'relative',
          background: cyber.surface,
          border: `1px solid ${cyber.accentBorder}`,
          borderRadius: 12,
          boxShadow: `0 0 60px ${cyber.accentGlow}`,
          padding: 32,
          maxWidth: 420,
          width: '100%',
        }}
      >
        {/* Corner accent triangle */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            borderWidth: '0 16px 16px 0',
            borderStyle: 'solid',
            borderColor: `transparent ${cyber.accentBorder} transparent transparent`,
            borderRadius: '0 12px 0 0',
          }}
        />

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
        <h2
          style={{
            fontFamily: cyberFonts.body,
            fontSize: 22,
            fontWeight: 700,
            color: cyber.textPrimary,
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          Você está a um passo!
        </h2>
        <p
          style={{
            fontSize: 13,
            color: cyber.textLabel,
            textAlign: 'center',
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          Você está a um passo de descobrir os 3 pilares para faturar mais de{' '}
          <span style={{ color: cyber.accent, fontWeight: 600 }}>10 mil reais por mês!</span> Para
          acessar a imersão, adicione seus dados abaixo:
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Nome */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 10,
                fontFamily: cyberFonts.body,
                color: cyber.textLabel,
                letterSpacing: '3px',
                textTransform: 'uppercase',
                marginBottom: 6,
                fontWeight: 600,
              }}
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
              style={{
                width: '100%',
                background: cyber.bg,
                border: `1px solid ${cyber.accentBorderDim}`,
                borderRadius: 6,
                padding: '10px 14px',
                color: cyber.textPrimary,
                fontFamily: cyberFonts.body,
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = cyber.accent)}
              onBlur={(e) => (e.currentTarget.style.borderColor = cyber.accentBorderDim)}
            />
          </div>

          {/* Email */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 10,
                fontFamily: cyberFonts.body,
                color: cyber.textLabel,
                letterSpacing: '3px',
                textTransform: 'uppercase',
                marginBottom: 6,
                fontWeight: 600,
              }}
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
              style={{
                width: '100%',
                background: cyber.bg,
                border: `1px solid ${cyber.accentBorderDim}`,
                borderRadius: 6,
                padding: '10px 14px',
                color: cyber.textPrimary,
                fontFamily: cyberFonts.body,
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = cyber.accent)}
              onBlur={(e) => (e.currentTarget.style.borderColor = cyber.accentBorderDim)}
            />
          </div>

          {error && (
            <p style={{ color: cyber.error, fontSize: 13, textAlign: 'center' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading
                ? 'rgba(0,180,255,0.3)'
                : `linear-gradient(135deg, ${cyber.accent}, ${cyber.accentDim})`,
              border: 'none',
              color: cyber.black,
              fontFamily: cyberFonts.display,
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '13px 0',
              borderRadius: 8,
              marginTop: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Aguarde...' : 'Quero Entrar na Imersão'}
          </button>
        </form>
      </div>
    </div>
  );
}
