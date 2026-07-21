'use client';

import { useEffect, useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, Pin, Loader2, Pencil, Trash2, Check, X } from 'lucide-react';

type Comment = {
  id: string; type: string; author_name: string; text: string;
  visible: number; is_pinned: number; created_at: string; video_timestamp: number | null;
};

const TYPE_LABELS: Record<string, string> = {
  real_user: 'Usuário real',
  real_staff: 'Staff real',
  simulated_user: 'Sim. plateia',
  simulated_staff: 'Sim. staff',
  simulated_purchase: 'Compra sim.',
};

function fmtTimestamp(secs: number | null): string {
  if (secs == null) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function AdminComments() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState('');
  const [newName, setNewName] = useState('Staff');
  const [isPinned, setIsPinned] = useState(false);
  const [pinStart, setPinStart] = useState('');
  const [pinEnd, setPinEnd] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch('/api/admin/comments');
      const d = await r.json();
      setComments(d.comments || []);
    } catch { /* network error — keep previous list */ }
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  async function toggleVisible(id: string, visible: number) {
    try { await fetch('/api/admin/comments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, visible: visible ? 0 : 1 }) }); }
    catch { /* ignore */ }
    load();
  }

  async function togglePin(id: string, pinned: number) {
    try { await fetch('/api/admin/comments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_pinned: pinned ? 0 : 1 }) }); }
    catch { /* ignore */ }
    load();
  }

  function startEdit(c: Comment) {
    setEditingId(c.id);
    setEditText(c.text);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText('');
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return;
    setSavingEdit(true);
    try {
      await fetch('/api/admin/comments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, text: editText.trim() }) });
      setEditingId(null);
      setEditText('');
      load();
    } catch { /* ignore */ }
    finally { setSavingEdit(false); }
  }

  async function deleteCommentRow(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/admin/comments?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setComments(prev => prev.filter(c => c.id !== id));
    } catch { /* ignore */ }
    finally { setDeletingId(null); setConfirmDeleteId(null); }
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newText.trim()) return;
    setSending(true);
    try {
      await fetch('/api/admin/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'real_staff', author_name: newName, text: newText, is_pinned: isPinned, pin_start_seconds: pinStart ? parseInt(pinStart) : null, pin_end_seconds: pinEnd ? parseInt(pinEnd) : null }),
      });
      setNewText(''); setIsPinned(false); setPinStart(''); setPinEnd('');
      load();
    } catch { /* network error — leave form intact so user can retry */ }
    finally { setSending(false); }
  }

  if (loading) return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-7 animate-spin text-primary" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border">
          <div className="flex w-full items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" />
            <h1 className="text-base font-medium">Moderação</h1>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-3 p-4 lg:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-[12.5px] text-muted-foreground">Envie comentários, fixe pins e modere mensagens da live.</p>
            <Button variant="outline" size="sm" className="shrink-0" render={<a href="/api/admin/export-comments" />}>
              <Download className="size-3.5" /> Baixar comentários
            </Button>
          </div>

          <Card>
            <CardContent>
              <div className="mb-3.5 border-l-2 border-primary pl-3">
                <p className="text-sm font-semibold">Enviar comentário / pin</p>
                <p className="text-[11px] text-muted-foreground">Mensagem enviada como staff em tempo real.</p>
              </div>
              <form onSubmit={sendComment} className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Tipo</Label>
                    <Input value="Staff real" disabled readOnly />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Nome exibido</Label>
                    <Input value={newName} onChange={e => setNewName(e.target.value)} />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Mensagem</Label>
                  <Input value={newText} onChange={e => setNewText(e.target.value)} placeholder="Texto do comentário..." required />
                </div>

                <div className="flex items-center gap-2.5">
                  <Switch id="is_pinned" checked={isPinned} onCheckedChange={setIsPinned} />
                  <Label htmlFor="is_pinned">Fixar como pin (CTA)</Label>
                </div>

                {isPinned && (
                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-primary/5 p-3">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Pin início (seg)</Label>
                      <Input type="number" value={pinStart} onChange={e => setPinStart(e.target.value)} placeholder="0" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Pin fim (seg)</Label>
                      <Input type="number" value={pinEnd} onChange={e => setPinEnd(e.target.value)} placeholder="3600" />
                    </div>
                  </div>
                )}

                <div>
                  <Button type="submit" disabled={sending || !newText.trim()}>
                    {sending && <Loader2 className="size-4 animate-spin" />}
                    {sending ? 'Enviando...' : 'Enviar agora'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden py-0">
            <div className="flex items-center gap-2 border-b border-border px-[18px] py-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Todos os comentários</p>
              <Badge variant="secondary">{comments.length}</Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Autor</TableHead>
                  <TableHead>Texto</TableHead>
                  <TableHead>Minutagem</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comments.map(c => (
                  <TableRow key={c.id} className={c.visible ? undefined : 'opacity-35'}>
                    <TableCell><Badge variant="secondary">{TYPE_LABELS[c.type] || c.type}</Badge></TableCell>
                    <TableCell className="font-medium">{c.author_name}</TableCell>
                    <TableCell className="max-w-[260px] text-muted-foreground">
                      {editingId === c.id ? (
                        <Input
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(c.id); if (e.key === 'Escape') cancelEdit(); }}
                          autoFocus
                          className="h-7 text-[12.5px]"
                        />
                      ) : (
                        <span className="block truncate">{c.text}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground/70">{fmtTimestamp(c.video_timestamp)}</TableCell>
                    <TableCell>
                      {editingId === c.id ? (
                        <div className="flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 gap-1 px-2 text-[11px] border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
                            disabled={savingEdit || !editText.trim()}
                            onClick={() => saveEdit(c.id)}
                          >
                            {savingEdit ? <Loader2 className="size-2.5 animate-spin" /> : <Check className="size-2.5" />} Salvar
                          </Button>
                          <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-[11px]" onClick={cancelEdit}>
                            <X className="size-2.5" /> Cancelar
                          </Button>
                        </div>
                      ) : confirmDeleteId === c.id ? (
                        <div className="flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 gap-1 px-2 text-[11px] border-destructive/30 text-destructive hover:bg-destructive/10"
                            disabled={deletingId === c.id}
                            onClick={() => deleteCommentRow(c.id)}
                          >
                            {deletingId === c.id ? <Loader2 className="size-2.5 animate-spin" /> : null} Confirmar exclusão
                          </Button>
                          <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-[11px]" onClick={() => setConfirmDeleteId(null)}>
                            <X className="size-2.5" /> Cancelar
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className={`h-6 px-2 text-[11px] ${c.visible ? 'border-destructive/20 text-destructive hover:bg-destructive/10' : 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'}`}
                            onClick={() => toggleVisible(c.id, c.visible)}
                          >
                            {c.visible ? 'Ocultar' : 'Mostrar'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`h-6 gap-1 px-2 text-[11px] ${c.is_pinned ? 'border-primary/30 text-primary' : ''}`}
                            onClick={() => togglePin(c.id, c.is_pinned)}
                          >
                            <Pin className="size-2.5" /> {c.is_pinned ? 'Fixado' : 'Fixar'}
                          </Button>
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" title="Editar" onClick={() => startEdit(c)}>
                            <Pencil className="size-2.5" />
                          </Button>
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0 border-destructive/20 text-destructive hover:bg-destructive/10" title="Excluir" onClick={() => setConfirmDeleteId(c.id)}>
                            <Trash2 className="size-2.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {comments.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-6 text-center italic text-muted-foreground/70">Nenhum comentário ainda</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
