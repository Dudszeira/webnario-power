'use client';

import { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Rocket, Zap, Tv, Video, Star, Radio, Sparkles, Flame,
  Globe, Shield, Award, Target, Gem, Crown, Compass, Bolt,
  Upload, Loader2,
} from 'lucide-react';

export const ICON_OPTIONS: { name: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { name: 'Rocket', Icon: Rocket },
  { name: 'Zap', Icon: Zap },
  { name: 'Tv', Icon: Tv },
  { name: 'Video', Icon: Video },
  { name: 'Star', Icon: Star },
  { name: 'Radio', Icon: Radio },
  { name: 'Sparkles', Icon: Sparkles },
  { name: 'Flame', Icon: Flame },
  { name: 'Globe', Icon: Globe },
  { name: 'Shield', Icon: Shield },
  { name: 'Award', Icon: Award },
  { name: 'Target', Icon: Target },
  { name: 'Gem', Icon: Gem },
  { name: 'Crown', Icon: Crown },
  { name: 'Compass', Icon: Compass },
  { name: 'Bolt', Icon: Bolt },
];

export type BrandingIcon = { type: 'letter' | 'preset' | 'upload'; value: string | null };

export function AdminIconPicker({
  open,
  onOpenChange,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (next: BrandingIcon) => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function save(form: FormData, key: string) {
    setSaving(key);
    setError(null);
    try {
      const res = await fetch('/api/admin/branding', { method: 'PUT', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao salvar');
      onChange({ type: data.type, value: data.value });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setSaving(null);
    }
  }

  function pickPreset(name: string) {
    const form = new FormData();
    form.set('type', 'preset');
    form.set('value', name);
    save(form, name);
  }

  function resetToLetter() {
    const form = new FormData();
    form.set('type', 'letter');
    save(form, 'letter');
  }

  function handleFile(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      setError('Imagem maior que 2MB');
      return;
    }
    const form = new FormData();
    form.set('type', 'upload');
    form.set('file', file);
    save(form, 'upload');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ícone da sidebar</DialogTitle>
          <DialogDescription>Escolha um ícone pronto ou envie uma imagem.</DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid grid-cols-4 gap-2">
          {ICON_OPTIONS.map(({ name, Icon }) => (
            <button
              key={name}
              type="button"
              onClick={() => pickPreset(name)}
              disabled={saving !== null}
              className="flex aspect-square items-center justify-center rounded-lg border border-border bg-muted/50 text-foreground hover:bg-accent disabled:opacity-50"
            >
              {saving === name ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
            </button>
          ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={saving !== null}
          onClick={() => fileInputRef.current?.click()}
        >
          {saving === 'upload' ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Enviar imagem
        </Button>

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={saving !== null} onClick={resetToLetter}>
            Restaurar padrão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
