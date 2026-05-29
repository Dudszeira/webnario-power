'use client';

import { useEffect, useRef, useState } from 'react';
import { cyber, cyberFonts } from '@/lib/cybertheme';

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
  const parsed = parse(value);
  const [viewYear, setViewYear] = useState(() => parsed?.year ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parsed?.month ?? new Date().getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = parse(value);
    if (p) { setViewYear(p.year); setViewMonth(p.month); }
  }, [value]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

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
    <div ref={ref} style={{ position: 'relative' }}>
      <style>{`
        .dtp-day:hover { background: rgba(0,180,255,0.12) !important; color: #c8e4f4 !important; }
        .dtp-nav:hover { border-color: #00B4FF !important; }
        .dtp-time::-webkit-inner-spin-button, .dtp-time::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .dtp-time { -moz-appearance: textfield; }
      `}</style>

      {/* Trigger */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: cyber.bg,
          border: `1px solid ${open ? cyber.accent : cyber.accentBorderDim}`,
          borderRadius: 4, padding: '9px 12px', boxSizing: 'border-box',
          color: parsed ? cyber.textPrimary : cyber.textDecorative,
          fontFamily: cyberFonts.body, fontSize: 13,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          transition: 'border-color .2s',
        }}
      >
        <svg width="14" height="14" fill="none" stroke={cyber.accent} strokeWidth={1.5} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style={{ flex: 1 }}>{displayLabel}</span>
        <svg width="10" height="10" fill="none" stroke={cyber.textSupport} strokeWidth={2.5} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 300,
          background: cyber.surface, border: `1px solid ${cyber.accentBorderDim}`,
          borderRadius: 8, padding: 16, boxShadow: `0 8px 32px rgba(0,0,0,0.85)`,
          minWidth: 272,
        }}>
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" className="dtp-nav"
              onClick={() => viewMonth === 0 ? (setViewMonth(11), setViewYear(y => y - 1)) : setViewMonth(m => m - 1)}
              style={{ background: 'none', border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 4, color: cyber.accent, cursor: 'pointer', fontSize: 14, padding: '2px 9px', fontFamily: cyberFonts.body, transition: 'border-color .15s' }}>‹</button>
            <span style={{ fontSize: 11, fontFamily: cyberFonts.body, color: cyber.accent, fontWeight: 700, letterSpacing: '0.08em' }}>
              {MONTHS[viewMonth].toUpperCase()} {viewYear}
            </span>
            <button type="button" className="dtp-nav"
              onClick={() => viewMonth === 11 ? (setViewMonth(0), setViewYear(y => y + 1)) : setViewMonth(m => m + 1)}
              style={{ background: 'none', border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 4, color: cyber.accent, cursor: 'pointer', fontSize: 14, padding: '2px 9px', fontFamily: cyberFonts.body, transition: 'border-color .15s' }}>›</button>
          </div>

          {/* Week headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 3 }}>
            {WEEK_DAYS.map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 9, color: cyber.textDecorative, fontFamily: cyberFonts.body, fontWeight: 700, padding: '3px 0', letterSpacing: '0.04em' }}>{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 14 }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSel = parsed?.year === viewYear && parsed?.month === viewMonth && parsed?.day === day;
              const isToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
              return (
                <button key={day} type="button"
                  className={!isSel ? 'dtp-day' : ''}
                  onClick={() => selectDay(day)}
                  style={{
                    background: isSel ? cyber.accent : 'transparent',
                    border: `1px solid ${isSel ? cyber.accent : isToday ? cyber.accentBorderDim : 'transparent'}`,
                    borderRadius: 4,
                    color: isSel ? cyber.black : isToday ? cyber.accent : cyber.textPrimary,
                    fontFamily: cyberFonts.body, fontSize: 12, fontWeight: isSel ? 700 : 400,
                    cursor: 'pointer', padding: '5px 0', textAlign: 'center',
                    transition: 'all .1s',
                  }}
                >{day}</button>
              );
            })}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: cyber.accentBorderDim, marginBottom: 12 }} />

          {/* Time row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="12" height="12" fill="none" stroke={cyber.accent} strokeWidth={1.5} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <input className="dtp-time" type="number" min={0} max={23}
              value={String(parsed?.hour ?? 20).padStart(2,'0')}
              onChange={e => changeTime(parseInt(e.target.value) || 0, parsed?.minute ?? 0)}
              style={{ width: 46, background: cyber.bg, border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 4, padding: '5px 0', color: cyber.textPrimary, fontFamily: cyberFonts.body, fontSize: 14, textAlign: 'center', outline: 'none' }}
            />
            <span style={{ color: cyber.accent, fontWeight: 700, fontSize: 15 }}>:</span>
            <input className="dtp-time" type="number" min={0} max={59}
              value={String(parsed?.minute ?? 0).padStart(2,'0')}
              onChange={e => changeTime(parsed?.hour ?? 20, parseInt(e.target.value) || 0)}
              style={{ width: 46, background: cyber.bg, border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 4, padding: '5px 0', color: cyber.textPrimary, fontFamily: cyberFonts.body, fontSize: 14, textAlign: 'center', outline: 'none' }}
            />
            <button type="button" onClick={() => setOpen(false)}
              style={{ marginLeft: 'auto', background: cyber.accent, color: cyber.black, border: 'none', borderRadius: 4, padding: '5px 18px', fontSize: 12, fontFamily: cyberFonts.body, fontWeight: 700, cursor: 'pointer' }}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
