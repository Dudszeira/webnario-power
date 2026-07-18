'use client';

import { useState, useEffect } from 'react';
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
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, Upload, Loader2 } from 'lucide-react';

type SimComment = { id: string; type: string; author_name: string; text: string; video_timestamp: number };

function formatTs(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
}

const TYPE_LABELS: Record<string, string> = {
  simulated_user: 'Plateia',
  simulated_staff: 'Staff sim.',
  simulated_purchase: 'Compra sim.',
};

export default function AdminImport() {
  const [file, setFile] = useState<File | null>(null);
  const [replace, setReplace] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ inserted: number; errors: string[] } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [comments, setComments] = useState<SimComment[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  async function loadComments() {
    setLoadingList(true);
    try {
      const r = await fetch('/api/admin/import');
      const d = await r.json();
      setComments(d.comments || []);
    } catch { /* network error — keep previous list */ }
    finally { setLoadingList(false); }
  }

  useEffect(() => { loadComments(); }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('replace', replace ? 'true' : 'false');
      const res = await fetch('/api/admin/import', { method: 'POST', body: fd });
      const data = await res.json();
      setResult(data); setShowErrors(false);
      if (data.ok) loadComments();
    } catch { setResult({ inserted: 0, errors: ['Erro de conexão. Tente novamente.'] }); }
    finally { setUploading(false); }
  }

  async function clearAll() {
    if (!confirm('Excluir todos os comentários simulados desta edição?')) return;
    try { await fetch('/api/admin/import', { method: 'DELETE' }); }
    catch { /* ignore */ }
    loadComments();
  }

  const templateUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(
    'tipo;nome_exibido;texto;timestamp\n' +
    'usuario_simulado;João Silva;Que conteúdo incrível!;00:05:00\n' +
    'staff_simulado;Staff;Obrigado pela pergunta!;00:05:30\n' +
    'compra_simulada;Maria Santos;Acabei de garantir minha vaga!;00:45:00\n'
  );

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border">
          <div className="flex w-full items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" />
            <h1 className="text-base font-medium">Importar Roteiro</h1>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 p-4 lg:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-[12.5px] text-muted-foreground">Upload de .xlsx ou .csv com comentários simulados da live.</p>
            <Button variant="outline" size="sm" className="shrink-0" render={<a href={templateUrl} download="template-roteiro.csv" />}>
              <Download className="size-3.5" /> Template CSV
            </Button>
          </div>

          <Card>
            <CardContent>
              <form onSubmit={handleUpload} className="flex flex-col gap-3.5">
                <div
                  className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border'}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <Upload className={`mx-auto mb-2 size-6 ${file ? 'text-primary' : 'text-muted-foreground'}`} />
                  {file ? (
                    <p className="text-sm font-semibold text-primary">{file.name}</p>
                  ) : (
                    <>
                      <p className="mb-0.5 text-sm text-muted-foreground">Arraste ou clique para selecionar</p>
                      <p className="text-[11px] text-muted-foreground/70">.xlsx ou .csv</p>
                    </>
                  )}
                  <input id="file-input" type="file" accept=".xlsx,.csv" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                </div>

                <div className="flex items-center gap-2.5">
                  <Switch id="replace" checked={replace} onCheckedChange={setReplace} />
                  <Label htmlFor="replace">Substituir simulados existentes desta edição</Label>
                </div>

                <div>
                  <Button type="submit" disabled={!file || uploading}>
                    {uploading && <Loader2 className="size-4 animate-spin" />}
                    {uploading ? 'Importando...' : 'Importar arquivo'}
                  </Button>
                </div>
              </form>

              {result && (
                <div className={`mt-3.5 rounded-lg border p-3 ${result.errors?.length ? 'border-amber-500/20 bg-amber-500/5' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-semibold ${result.inserted > 0 ? 'text-emerald-400' : 'text-amber-500'}`}>
                      {result.inserted} linhas importadas com sucesso.
                      {result.errors?.length > 0 && ` ${result.errors.length} erros.`}
                    </p>
                    {result.errors?.length > 0 && (
                      <Button type="button" variant="outline" size="sm" className="h-6 shrink-0 border-amber-500/30 px-2 text-[11px] text-amber-500" onClick={() => setShowErrors(v => !v)}>
                        {showErrors ? 'Ocultar detalhes' : 'Ver detalhes'}
                      </Button>
                    )}
                  </div>
                  {showErrors && result.errors?.length > 0 && (
                    <div className="mt-2 max-h-48 overflow-y-auto border-t border-amber-500/15 pt-2">
                      {result.errors.map((err, i) => <p key={i} className="my-0.5 text-[11px] text-amber-500">{err}</p>)}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden py-0">
            <div className="border-b border-border px-[18px] py-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Colunas do CSV/XLSX</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coluna</TableHead>
                  <TableHead>Obrigatória</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { col: 'tipo', desc: 'usuario_simulado | staff_simulado | compra_simulada' },
                  { col: 'nome_exibido', desc: 'Nome que aparece no chat' },
                  { col: 'texto', desc: 'Mensagem do comentário' },
                  { col: 'timestamp', desc: 'HH:MM:SS, MM:SS ou segundos (ex: 300)' },
                ].map(({ col, desc }) => (
                  <TableRow key={col}>
                    <TableCell><code className="text-xs text-primary">{col}</code></TableCell>
                    <TableCell><Badge variant="secondary">Sim</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{desc}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="gap-0 overflow-hidden py-0">
            <div className="flex items-center justify-between border-b border-border px-[18px] py-3">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Roteiro carregado</p>
                <Badge variant="secondary">{comments.length} linhas</Badge>
              </div>
              {comments.length > 0 && (
                <Button variant="outline" size="sm" className="h-6 border-destructive/20 px-2 text-[11px] text-destructive hover:bg-destructive/10" onClick={clearAll}>
                  Limpar tudo
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Texto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingList ? (
                  <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : comments.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="py-6 text-center italic text-muted-foreground/70">Nenhum comentário simulado importado</TableCell></TableRow>
                ) : comments.map(c => (
                  <TableRow key={c.id}>
                    <TableCell><code className="text-xs text-primary">{formatTs(c.video_timestamp)}</code></TableCell>
                    <TableCell><Badge variant="secondary">{TYPE_LABELS[c.type] || c.type}</Badge></TableCell>
                    <TableCell className="font-medium">{c.author_name}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-muted-foreground">{c.text}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
