'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { cyber, cyberFonts } from '@/lib/cybertheme';

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push('/admin');
      } else {
        setError('Senha incorreta.');
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
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
              alt="Webnario Power"
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
                margin: '0 0 20px 0',
              }}
            >
              ACESSO RESTRITO
            </h1>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                {/* Subtitle / label */}
                <label
                  htmlFor="admin-password"
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
                <div style={{ position: 'relative' }}>
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
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
                      padding: '11px 42px 11px 14px',
                      color: cyber.textPrimary,
                      fontFamily: cyberFonts.body,
                      fontSize: 14,
                      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 4,
                      color: cyber.textLabel,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <p
                  role="alert"
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
