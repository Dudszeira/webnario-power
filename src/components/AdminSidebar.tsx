'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Radio,
  Settings,
  Upload,
  MessageSquare,
  ExternalLink,
  LogOut,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AdminIconPicker, ICON_OPTIONS, type BrandingIcon } from './AdminIconPicker';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/live', label: 'Monitor Live', icon: Radio },
  { href: '/admin/configuracoes', label: 'Configurações', icon: Settings },
  { href: '/admin/importar', label: 'Importar', icon: Upload },
  { href: '/admin/comentarios', label: 'Comentários', icon: MessageSquare },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    try {
      await fetch('/api/admin/auth-session', { method: 'DELETE' });
    } catch {
      // navigate anyway — server will reject the invalid session on next request
    }
    router.push('/admin/login');
  }

  const [branding, setBranding] = useState<BrandingIcon>({ type: 'letter', value: null });
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    fetch('/api/admin/branding')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setBranding(d); })
      .catch(() => {/* keep the default letter fallback */});
  }, []);

  const PresetIcon = branding.type === 'preset'
    ? ICON_OPTIONS.find((o) => o.name === branding.value)?.Icon
    : null;

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Tooltip>
              <TooltipTrigger render={<SidebarMenuButton size="lg" onClick={() => setPickerOpen(true)} />}>
                <div
                  className={cn(
                    'flex aspect-square size-6 shrink-0 items-center justify-center overflow-hidden rounded-md text-[10px] font-black',
                    branding.type === 'upload' && branding.value
                      ? 'bg-transparent'
                      : 'bg-primary text-primary-foreground'
                  )}
                >
                  {branding.type === 'upload' && branding.value ? (
                    <img src={branding.value} alt="" className="size-full object-cover" />
                  ) : PresetIcon ? (
                    <PresetIcon className="size-3.5" />
                  ) : (
                    'W'
                  )}
                </div>
                <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-[9px] tracking-[0.2em] text-muted-foreground">SISTEMA</span>
                  <span className="truncate text-sm font-black tracking-[0.1em]">WEBNARIO</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">Clique para trocar o ícone</TooltipContent>
            </Tooltip>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    tooltip={item.label}
                    render={<Link href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Ver ao vivo" render={<a href="/ao-vivo" target="_blank" rel="noopener noreferrer" />}>
              <ExternalLink />
              <span>Ver ao vivo</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sair" onClick={logout}>
              <LogOut />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex items-center gap-1.5 px-2 py-1.5 group-data-[collapsible=icon]:hidden">
          <span className="pulse-live inline-block size-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          <span className="text-[9px] tracking-[0.2em] text-muted-foreground">ONLINE</span>
        </div>
      </SidebarFooter>
      <AdminIconPicker open={pickerOpen} onOpenChange={setPickerOpen} onChange={setBranding} />
    </Sidebar>
  );
}
