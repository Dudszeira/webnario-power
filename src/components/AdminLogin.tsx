'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { cyber, cyberFonts } from '@/lib/cybertheme';

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/admin/auth-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push('/admin');
    } else {
      setError('Senha incorreta.');
    }
  }

  return (
    <>
      <style>{`
        .cyber-input:focus {
          border-color: ${cyber.accent} !important;
          box-shadow: 0 0 0 2px ${cyber.accentGlowInset};
          outline: none;
        }
        .cyber-btn:hover:not(:disabled) {
          opacity: 0.88;
          box-shadow: 0 0 30px ${cyber.accentGlow};
        }
        .cyber-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>

      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: cyber.bg,
        }}
      >
        <div style={{ width: '100%', maxWidth: 400, padding: '0 16px' }}>
          {/* Card */}
          <div
            style={{
              position: 'relative',
              background: cyber.surface,
              border: `1px solid ${cyber.accentBorder}`,
              borderRadius: 10,
              boxShadow: `0 0 60px ${cyber.accentGlow}`,
              padding: 32,
            }}
          >
            {/* Corner accent triangle */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 0,
                height: 0,
                borderWidth: '0 16px 16px 0',
                borderStyle: 'solid',
                borderColor: `transparent ${cyber.accentBorder} transparent transparent`,
              }}
            />

            {/* Logo */}
            <Image
              src="/logo.webp"
              alt="Logo"
              width={130}
              height={44}
              style={{ display: 'block', margin: '0 auto 20px' }}
            />

            {/* Title */}
            <h1
              style={{
                fontFamily: cyberFonts.display,
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: 2,
                color: cyber.white,
                textAlign: 'center',
                marginBottom: 20,
                margin: '0 0 20px 0',
              }}
            >
              ACESSO RESTRITO
            </h1>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                {/* Subtitle / label */}
                <label
                  style={{
                    display: 'block',
                    fontFamily: cyberFonts.body,
                    fontSize: 10,
                    color: cyber.textLabel,
                    letterSpacing: 3,
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}
                >
                  Senha
                </label>

                {/* Password input */}
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="cyber-input"
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: cyber.bg,
                    border: `1px solid ${cyber.accentBorderDim}`,
                    borderRadius: 4,
                    padding: '11px 14px',
                    color: cyber.textPrimary,
                    fontFamily: cyberFonts.body,
                    fontSize: 14,
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  }}
                />
              </div>

              {/* Error message */}
              {error && (
                <p
                  style={{
                    fontFamily: cyberFonts.body,
                    fontSize: 13,
                    color: cyber.error,
                    marginTop: 4,
                    marginBottom: 8,
                  }}
                >
                  {error}
                </p>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="cyber-btn"
                style={{
                  width: '100%',
                  background: `linear-gradient(135deg, ${cyber.accent}, ${cyber.accentDim})`,
                  border: 'none',
                  borderRadius: 4,
                  padding: 14,
                  color: cyber.black,
                  fontFamily: cyberFonts.display,
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  boxShadow: `0 0 20px ${cyber.accentGlow}`,
                  cursor: 'pointer',
                  marginTop: 6,
                  transition: 'opacity 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
