'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Waves from './Waves';

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <Waves lineColor="rgba(255,255,255,0.1)" backgroundColor="transparent" />
      <div className="relative w-full max-w-5xl">
        <Card className="overflow-hidden bg-transparent p-0">
          <CardContent className="grid p-0 md:min-h-[560px] md:grid-cols-2">
            <form onSubmit={handleSubmit} className="flex flex-col justify-center border-white/10 bg-white/[0.04] p-8 backdrop-blur-2xl md:border-r md:p-12">
              <FieldGroup>
                <div className="flex flex-col items-center gap-2 text-center">
                  <Image src="/logo.webp" alt="Webnario Power" width={120} height={40} className="mb-1" />
                  <h1 className="text-xl font-bold tracking-widest">ACESSO RESTRITO</h1>
                  <FieldDescription>Área exclusiva de administração.</FieldDescription>
                </div>

                <Field>
                  <div className="relative">
                    <Input
                      id="admin-password"
                      aria-label="Senha"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Digite a senha administrativa"
                      required
                      autoComplete="current-password"
                      className="h-10 pr-9 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {error && <FieldDescription className="text-destructive">{error}</FieldDescription>}
                </Field>

                <Field>
                  <Button type="submit" disabled={loading} className="h-10">
                    {loading && <Loader2 className="size-4 animate-spin" />}
                    {loading ? 'Entrando...' : 'Entrar'}
                  </Button>
                </Field>
              </FieldGroup>
            </form>

            <div className="relative hidden overflow-hidden bg-muted md:block">
              <Image
                src="/BG-01-webnario.webp"
                alt=""
                fill
                sizes="(min-width: 768px) 50vw, 0px"
                className="object-cover"
                priority
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
