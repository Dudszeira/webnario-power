'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Clock, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEK_DAYS = ['D','S','T','Q','Q','S','S'];

function parse(value: string) {
  if (!value) return null;
  const [datePart, timePart] = value.split('T');
  if (!datePart) return null;
  const [y, m, d] = datePart.split('-').map(Number);
  const [h = 20, mn = 0] = (timePart || '').split(':').map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m - 1, day: d, hour: h, minute: mn };
}

function fmt(year: number, month: number, day: number, hour: number, minute: number) {
  return `${String(year).padStart(4,'0')}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
}

export default function CyberDateTimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const parsed = parse(value);
  const [viewYear, setViewYear] = useState(() => parsed?.year ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parsed?.month ?? new Date().getMonth());
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = parse(value);
    if (p) { setViewYear(p.year); setViewMonth(p.month); }
  }, [value]);

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onScroll() { setOpen(false); }
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const DROP_HEIGHT = 340; // estimated dropdown height in px

  function openPicker() {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const opensUp = spaceBelow < DROP_HEIGHT + 8;
      setDropPos({
        top: opensUp ? r.top - DROP_HEIGHT - 4 : r.bottom + 4,
        left: r.left,
        width: r.width,
      });
    }
    setOpen(o => !o);
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const today = new Date();

  function selectDay(day: number) {
    onChange(fmt(viewYear, viewMonth, day, parsed?.hour ?? 20, parsed?.minute ?? 0));
  }

  function changeTime(h: number, mn: number) {
    if (!parsed) return;
    onChange(fmt(parsed.year, parsed.month, parsed.day, Math.min(23, Math.max(0, h)), Math.min(59, Math.max(0, mn))));
  }

  const displayLabel = parsed
    ? `${String(parsed.day).padStart(2,'0')} ${MONTHS[parsed.month].slice(0,3).toLowerCase()} ${parsed.year}  ${String(parsed.hour).padStart(2,'0')}:${String(parsed.minute).padStart(2,'0')}`
    : 'Selecionar data e hora';

  return (
    <div ref={triggerRef} className="relative">
      {/* Trigger */}
      <div
        onClick={openPicker}
        className={cn(
          'flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg border bg-transparent px-2.5 text-[13px] transition-colors',
          open ? 'border-ring ring-3 ring-ring/50' : 'border-input',
          parsed ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        <CalendarDays className="size-3.5 shrink-0 text-primary" />
        <span className="flex-1 truncate">{displayLabel}</span>
        <ChevronDown className={cn('size-3 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </div>

      {/* Dropdown — position:fixed so it never affects page scroll height */}
      {open && (
        <div
          className="fixed z-50 min-w-[272px] rounded-lg border border-border bg-popover p-4 shadow-xl"
          style={{ top: dropPos.top, left: dropPos.left }}
        >
          {/* Month navigation */}
          <div className="mb-2.5 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="size-6"
              onClick={() => viewMonth === 0 ? (setViewMonth(11), setViewYear(y => y - 1)) : setViewMonth(m => m - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="size-6"
              onClick={() => viewMonth === 11 ? (setViewMonth(0), setViewYear(y => y + 1)) : setViewMonth(m => m + 1)}
            >
              <ChevronRight />
            </Button>
          </div>

          {/* Week headers */}
          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEK_DAYS.map((d, i) => (
              <div key={i} className="py-0.5 text-center text-[9px] font-bold tracking-wide text-muted-foreground">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="mb-3.5 grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSel = parsed?.year === viewYear && parsed?.month === viewMonth && parsed?.day === day;
              const isToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={cn(
                    'rounded-md border py-1 text-center text-xs transition-colors',
                    isSel
                      ? 'border-primary bg-primary font-bold text-primary-foreground'
                      : isToday
                        ? 'border-primary/40 text-primary hover:bg-accent'
                        : 'border-transparent text-foreground hover:bg-accent'
                  )}
                >{day}</button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="mb-3 h-px bg-border" />

          {/* Time row */}
          <div className="flex items-center gap-2">
            <Clock className="size-3 text-primary" />
            <input
              type="number"
              min={0}
              max={23}
              value={String(parsed?.hour ?? 20).padStart(2,'0')}
              onChange={e => changeTime(parseInt(e.target.value) || 0, parsed?.minute ?? 0)}
              className="w-[46px] rounded-md border border-input bg-transparent py-1 text-center text-sm text-foreground outline-none focus-visible:border-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-sm font-bold text-primary">:</span>
            <input
              type="number"
              min={0}
              max={59}
              value={String(parsed?.minute ?? 0).padStart(2,'0')}
              onChange={e => changeTime(parsed?.hour ?? 20, parseInt(e.target.value) || 0)}
              className="w-[46px] rounded-md border border-input bg-transparent py-1 text-center text-sm text-foreground outline-none focus-visible:border-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <Button type="button" size="sm" className="ml-auto h-7 px-4 text-xs" onClick={() => setOpen(false)}>
              OK
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
