'use client';

import { useEffect, useRef, useState } from 'react';

type ChatComment = {
  id: string;
  type: 'real_user' | 'real_staff' | 'simulated_user' | 'simulated_staff' | 'simulated_purchase';
  author_name: string;
  text: string;
  created_at?: string;
  video_timestamp?: number;
  pin_start_seconds?: number;
  pin_end_seconds?: number;
  reply?: string;
  reply_author?: string;
};

type Props = {
  editionId: string;
  sessionName: string;
  chatEnabled: boolean;
  chatMode: 'general' | 'isolated';
  simulatedComments: ChatComment[];
  pinnedComments: ChatComment[];
  videoOffsetRef: React.RefObject<number>;
  ctaEnabled: boolean;
  ctaUrl: string;
  ctaText: string;
  ctaStartSecs: number;
  ctaEndSecs: number;
  viewerMin: number;
  viewerMax: number;
  onMinimize?: () => void;
  onCtaChange?: (val: boolean) => void;
};

// ── Theme tokens ─────────────────────────────────────────────────────────────
function theme(dark: boolean) {
  return dark ? {
    bg: '#111111', bgHeader: '#0a0a0a', bgInput: '#0a0a0a',
    bgField: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.07)',
    borderField: 'rgba(255,255,255,0.1)', text: 'rgba(255,255,255,0.78)',
    textTitle: '#ffffff', textMuted: 'rgba(255,255,255,0.35)',
    textTyping: 'rgba(255,255,255,0.3)', dotTyping: 'rgba(255,255,255,0.3)',
    replyBg: 'rgba(85,160,238,0.06)', replyText: 'rgba(255,255,255,0.65)',
    toggleBg: 'rgba(255,255,255,0.08)', scrollbar: 'rgba(255,255,255,0.1)',
    modalBg: '#1c1f2e', modalBorder: 'rgba(85,160,238,0.25)',
    staffInputBg: 'rgba(255,255,255,0.07)', staffInputBorder: 'rgba(255,255,255,0.12)',
    staffInputColor: '#fff', staffInputPlaceholder: 'rgba(255,255,255,0.22)',
    modalTitleColor: '#fff',
  } : {
    bg: '#ffffff', bgHeader: '#f5f5f5', bgInput: '#f5f5f5',
    bgField: 'rgba(0,0,0,0.04)', border: 'rgba(0,0,0,0.09)',
    borderField: 'rgba(0,0,0,0.12)', text: 'rgba(0,0,0,0.75)',
    textTitle: '#111111', textMuted: 'rgba(0,0,0,0.38)',
    textTyping: 'rgba(0,0,0,0.3)', dotTyping: 'rgba(0,0,0,0.25)',
    replyBg: 'rgba(85,160,238,0.07)', replyText: 'rgba(0,0,0,0.55)',
    toggleBg: 'rgba(0,0,0,0.07)', scrollbar: 'rgba(0,0,0,0.1)',
    modalBg: '#ffffff', modalBorder: 'rgba(85,160,238,0.3)',
    staffInputBg: 'rgba(0,0,0,0.05)', staffInputBorder: 'rgba(0,0,0,0.14)',
    staffInputColor: '#111', staffInputPlaceholder: 'rgba(0,0,0,0.28)',
    modalTitleColor: '#111',
  };
}

// ── Avatar color from name hash ───────────────────────────────────────────────
const AVATAR_COLORS = ['#4a6fa5','#5a8a6a','#8a5a6a','#6a5a8a','#8a7a5a','#5a7a8a','#7a5a5a','#5a7a5a'];
function nameColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function isHost(name: string, type: string) {
  return type === 'real_staff' || type === 'simulated_staff' ||
    name.toLowerCase().includes('robison') || name.toLowerCase() === 'host';
}

// ── Viewer count ──────────────────────────────────────────────────────────────
function ViewerCount({ min, max, T }: { min: number; max: number; T: ReturnType<typeof theme> }) {
  const [count, setCount] = useState(() => Math.floor((min + max) / 2));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function tick() {
      timerRef.current = setTimeout(() => {
        setCount(prev => {
          const delta = Math.random() < 0.12 ? (Math.random() < 0.5 ? -2 : 2) : (Math.random() < 0.5 ? -1 : 1);
          const next = prev + delta;
          return next < min ? min : next > max ? max : next;
        });
        tick();
      }, 15000 + Math.random() * 30000);
    }
    tick();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [min, max]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: T.textMuted, fontFamily: "'Montserrat', sans-serif" }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill={T.textMuted}>
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
      </svg>
      <span>{count} assistindo</span>
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function ToggleSwitch({ on, onChange, label, T }: { on: boolean; onChange: (v: boolean) => void; label: string; T: ReturnType<typeof theme> }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }} onClick={() => onChange(!on)}>
      <div style={{ width: 32, height: 18, borderRadius: 9, background: on ? '#55A0EE' : 'rgba(128,128,128,0.25)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: T.text, fontFamily: "'Montserrat', sans-serif" }}>{label}</span>
    </label>
  );
}

// ── Comment row ───────────────────────────────────────────────────────────────
function CommentRow({
  comment, isOwn, isStaff: staffLogged, onReply, T,
}: {
  comment: ChatComment;
  isOwn: boolean;
  isStaff: boolean;
  onReply: (c: ChatComment) => void;
  T: ReturnType<typeof theme>;
}) {
  const host = isHost(comment.author_name, comment.type);
  const nameCol = host ? '#e0a030' : isOwn ? '#7ec8a0' : '#55A0EE';

  return (
    <div
      className="lc-comment-new"
      onClick={() => staffLogged && onReply(comment)}
      style={{
        display: 'flex', gap: 10,
        cursor: staffLogged ? 'pointer' : 'default',
        opacity: 1, transition: 'opacity .15s',
        ...(host ? {
          background: 'rgba(224,160,48,0.07)',
          borderLeft: '2px solid rgba(224,160,48,0.35)',
          borderRadius: 8,
          padding: '8px 10px',
          margin: '0 -10px',
        } : {}),
      }}
      onMouseEnter={e => { if (staffLogged) (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: nameColor(comment.author_name),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: '#fff',
        fontFamily: "'Montserrat', sans-serif",
      }}>
        {comment.author_name.charAt(0).toUpperCase()}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: nameCol, fontFamily: "'Montserrat', sans-serif" }}>
            {comment.author_name}
          </span>
          {host && (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3, background: 'rgba(224,160,48,0.15)', color: '#e0a030', border: '1px solid rgba(224,160,48,0.3)' }}>HOST</span>
          )}
          {isOwn && (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3, background: 'rgba(126,200,160,0.15)', color: '#7ec8a0', border: '1px solid rgba(126,200,160,0.3)' }}>Você</span>
          )}
        </div>
        <p style={{ fontSize: 13, color: T.text, lineHeight: 1.55, wordBreak: 'break-word', margin: 0, fontFamily: "'Montserrat', sans-serif" }}>
          {comment.text}
        </p>
        {comment.reply && (
          <div style={{ marginTop: 8, padding: '8px 10px', background: T.replyBg, borderLeft: '2px solid rgba(85,160,238,0.4)', borderRadius: '0 4px 4px 0' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#55A0EE', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 3, fontFamily: "'Montserrat', sans-serif" }}>
              {comment.reply_author || 'Host'} respondeu
            </div>
            <div style={{ fontSize: 12, color: T.replyText, lineHeight: 1.5, fontFamily: "'Montserrat', sans-serif" }}>
              {comment.reply}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pinned banner ─────────────────────────────────────────────────────────────
function PinnedBanner({ comment, ctaUrl, ctaText, dark }: { comment: ChatComment; ctaUrl: string; ctaText: string; dark: boolean }) {
  const authorName = comment.author_name || 'Robison Kunz';
  const initial = authorName.charAt(0).toUpperCase();

  return (
    <div style={{ margin: '8px 12px 0', padding: '10px 12px', background: 'rgba(85,160,238,0.08)', border: '1px solid rgba(85,160,238,0.25)', borderRadius: 10 }}>
      {/* Header: pin icon + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#55A0EE"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#55A0EE', textTransform: 'uppercase', letterSpacing: '.07em', fontFamily: "'Montserrat', sans-serif" }}>Fixado</span>
      </div>
      {/* Author row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(224,160,48,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#e0a030', flexShrink: 0 }}>
          {initial}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e0a030', fontFamily: "'Montserrat', sans-serif" }}>{authorName}</span>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3, background: 'rgba(224,160,48,0.15)', color: '#e0a030', border: '1px solid rgba(224,160,48,0.3)' }}>HOST</span>
        </div>
      </div>
      <p style={{ fontSize: 13, fontWeight: 500, color: dark ? '#fff' : 'rgba(0,0,0,0.78)', margin: 0, fontFamily: "'Montserrat', sans-serif", lineHeight: 1.5, paddingLeft: 36 }}>{comment.text}</p>
      {ctaUrl && (
        <a href={ctaUrl} target="_blank" rel="noopener noreferrer"
          onClick={() => fetch('/api/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'cta_click', meta: { url: ctaUrl } }) })}
          style={{ display: 'inline-block', marginTop: 10, marginLeft: 36, background: '#55A0EE', color: '#fff', fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 6, textDecoration: 'none', fontFamily: "'Montserrat', sans-serif" }}>
          {ctaText || 'Acessar agora →'}
        </a>
      )}
    </div>
  );
}

const DEFAULT_WELCOME_PIN: ChatComment = {
  id: '__welcome__',
  type: 'real_staff',
  author_name: 'Robison Kunz',
  text: '👋 Seja bem-vindo(a) à imersão! Estamos muito felizes em ter você aqui. Fique à vontade para comentar e interagir conosco ao longo da live!',
};

// ── Main component ────────────────────────────────────────────────────────────
export default function ChatPanel({
  editionId, sessionName, chatEnabled, chatMode,
  simulatedComments, pinnedComments, videoOffsetRef,
  ctaEnabled, ctaUrl, ctaText, ctaStartSecs, ctaEndSecs,
  viewerMin, viewerMax, onMinimize, onCtaChange,
}: Props) {
  const [isDark, setIsDark] = useState(true);
  const [comments, setComments] = useState<ChatComment[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [lastPoll, setLastPoll] = useState('1970-01-01T00:00:00.000Z');
  const [typingName, setTypingName] = useState<string | null>(null);
  const [ctaVisible, setCtaVisible] = useState(true);

  // Staff state
  const [isStaff, setIsStaff] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffToken, setStaffToken] = useState('');
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffModalName, setStaffModalName] = useState('');
  const [staffModalPw, setStaffModalPw] = useState('');
  const [staffPwVisible, setStaffPwVisible] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [staffLogging, setStaffLogging] = useState(false);
  const [chatPublic, setChatPublic] = useState(chatMode === 'general');
  const [serverCtaEnabled, setServerCtaEnabled] = useState(ctaEnabled);
  const [liveCtaUrl, setLiveCtaUrl] = useState(ctaUrl);
  const [liveCtaText, setLiveCtaText] = useState(ctaText);
  const [staffMetrics, setStaffMetrics] = useState({ online: 0, cta_clicks: 0 });

  // Reply state
  const [replyTarget, setReplyTarget] = useState<ChatComment | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const shownSimIds = useRef<Set<string>>(new Set());
  const typingSimIds = useRef<Set<string>>(new Set());
  const mountTimeRef = useRef(Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollCountRef = useRef(0);
  const didInitialReplayRef = useRef(false);

  // Track video offset as state so CTA and pinned comments react to video progress
  const [videoOffset, setVideoOffset] = useState(() => videoOffsetRef.current ?? 0);
  useEffect(() => {
    const t = setInterval(() => {
      const cur = videoOffsetRef.current ?? 0;
      setVideoOffset(prev => prev !== cur ? cur : prev);
    }, 1000);
    return () => clearInterval(t);
  }, [videoOffsetRef]);

  const T = theme(isDark);

  // Restore staff session + theme from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lc_staff_session');
      if (saved) {
        const { name, token, ts } = JSON.parse(saved);
        if (Date.now() - ts < 8 * 3600 * 1000) {
          setIsStaff(true); setStaffName(name); setStaffToken(token);
        } else {
          localStorage.removeItem('lc_staff_session');
        }
      }
      if (localStorage.getItem('lc_chat_theme') === 'light') setIsDark(false);
    } catch {}
  }, []);

  function toggleTheme() {
    setIsDark(d => {
      const next = !d;
      try { localStorage.setItem('lc_chat_theme', next ? 'dark' : 'light'); } catch {}
      return next;
    });
  }

  function logoutStaff() {
    setIsStaff(false); setStaffName(''); setStaffToken('');
    try { localStorage.removeItem('lc_staff_session'); } catch {}
  }

  async function handleStaffLogin() {
    if (!staffModalName.trim() || !staffModalPw) return;
    setStaffLogging(true); setStaffError('');
    try {
      const res = await fetch('/api/staff/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: staffModalName.trim(), password: staffModalPw }),
      });
      const data = await res.json();
      if (data.token) {
        setIsStaff(true); setStaffName(staffModalName.trim()); setStaffToken(data.token);
        setShowStaffModal(false); setStaffModalName(''); setStaffModalPw('');
        try { localStorage.setItem('lc_staff_session', JSON.stringify({ name: staffModalName.trim(), token: data.token, ts: Date.now() })); } catch {}
      } else {
        setStaffError(data.error || 'Senha incorreta');
      }
    } catch {
      setStaffError('Erro ao conectar. Tente novamente.');
    }
    setStaffLogging(false);
  }

  async function sendReply() {
    if (!replyText.trim() || !replyTarget || sendingReply) return;
    setSendingReply(true);
    try {
      const res = await fetch('/api/staff/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
        body: JSON.stringify({ commentId: replyTarget.id, reply: replyText.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setComments(prev => prev.map(c => c.id === replyTarget.id ? { ...c, reply: replyText.trim(), reply_author: staffName } : c));
        setReplyTarget(null); setReplyText('');
      }
    } catch {}
    setSendingReply(false);
  }

  async function toggleChatMode(val: boolean) {
    setChatPublic(val);
    try {
      await fetch('/api/staff/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
        body: JSON.stringify({ chat_mode: val ? 'general' : 'isolated' }),
      });
    } catch {}
  }

  async function toggleCta(val: boolean) {
    setServerCtaEnabled(val);
    onCtaChange?.(val);
    if (val) setCtaVisible(true); // restore if staff had previously dismissed the banner
    try {
      await fetch('/api/staff/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
        body: JSON.stringify({ cta_enabled: val ? 1 : 0 }),
      });
    } catch {}
  }

  function handleReply(comment: ChatComment) {
    setReplyTarget(comment);
    setReplyText(comment.reply || '');
  }

  const scrollToBottom = () => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; };

  // Refs so poll closures always see current values
  const staffTokenRef = useRef(staffToken);
  useEffect(() => { staffTokenRef.current = staffToken; }, [staffToken]);
  const serverCtaEnabledRef = useRef(serverCtaEnabled);
  useEffect(() => { serverCtaEnabledRef.current = serverCtaEnabled; }, [serverCtaEnabled]);

  // Poll real comments every 3s; every 2nd poll (~6s) does a full refresh to pick up reply updates
  useEffect(() => {
    let active = true;
    const poll = async () => {
      if (!active) return;
      pollCountRef.current += 1;
      const isFull = pollCountRef.current % 2 === 0;
      try {
        const headers: HeadersInit = {};
        if (staffTokenRef.current) headers['Authorization'] = `Bearer ${staffTokenRef.current}`;
        const url = isFull
          ? `/api/chat?full=1`
          : `/api/chat?since=${encodeURIComponent(lastPoll)}`;
        const res = await fetch(url, { headers });
        const data = await res.json();
        // Only sync CTA state from poll for non-staff — staff controls it directly via toggle
        if (!staffTokenRef.current) {
          if (data.cta_enabled !== undefined) {
            const nowEnabled = !!data.cta_enabled;
            // Reset ctaVisible when CTA transitions off→on (staff re-enabled it)
            if (!serverCtaEnabledRef.current && nowEnabled) setCtaVisible(true);
            setServerCtaEnabled(nowEnabled);
          }
          if (data.cta_url) setLiveCtaUrl(data.cta_url);
          if (data.cta_text !== undefined) setLiveCtaText(data.cta_text);
        }
        if (data.comments?.length) {
          const incoming = data.comments as ChatComment[];
          setComments(prev => {
            const prevIndexMap = new Map(prev.map((c, i) => [c.id, i]));
            const result = [...prev];
            const toAppend: ChatComment[] = [];
            for (const ic of incoming) {
              const existingIdx = prevIndexMap.get(ic.id);
              if (existingIdx !== undefined) {
                if (ic.reply && ic.reply !== result[existingIdx].reply) {
                  result[existingIdx] = { ...result[existingIdx], reply: ic.reply, reply_author: ic.reply_author };
                }
              } else {
                toAppend.push(ic);
              }
            }
            return [...result, ...toAppend];
          });
          // Only advance lastPoll from real comments — prevents simulated items from corrupting the cursor
          const newest = incoming[incoming.length - 1].created_at;
          if (newest && !isFull) setLastPoll(newest);
          if (isFull && newest && newest > lastPoll) setLastPoll(newest);
        }
        // sim_replied: update reply fields on simulated comments already in state.
        // Never append them early — the simulation engine handles dispatch at the right video_timestamp.
        if (data.sim_replied?.length) {
          const simItems = data.sim_replied as ChatComment[];
          setComments(prev => {
            const prevIndexMap = new Map(prev.map((c, i) => [c.id, i]));
            const result = [...prev];
            for (const ic of simItems) {
              const existingIdx = prevIndexMap.get(ic.id);
              if (existingIdx !== undefined && ic.reply && ic.reply !== result[existingIdx].reply) {
                result[existingIdx] = { ...result[existingIdx], reply: ic.reply, reply_author: ic.reply_author };
              }
              // If NOT in state yet (future video_timestamp), do not append — simulation engine will dispatch it
            }
            return result;
          });
        }
      } catch {}
    };
    const t = setInterval(poll, 3000);
    poll();
    return () => { active = false; clearInterval(t); };
  }, [lastPoll]);

  // On mount: replay simulated comments whose timestamp already passed (late joiners)
  useEffect(() => {
    if (didInitialReplayRef.current) return;
    didInitialReplayRef.current = true;
    const joinOffset = videoOffsetRef.current ?? 0;
    if (joinOffset <= 5) return;

    const past = simulatedComments
      .filter(c =>
        c.type !== 'simulated_purchase' &&
        c.video_timestamp != null &&
        (c.video_timestamp ?? 0) <= joinOffset
      )
      .sort((a, b) => (a.video_timestamp ?? 0) - (b.video_timestamp ?? 0));

    if (!past.length) return;
    past.forEach(c => shownSimIds.current.add(c.id));
    setComments(prev => [...prev, ...past.map(c => ({ ...c, created_at: new Date().toISOString() }))]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dispatch simulated comments + typing indicator
  useEffect(() => {
    const chatSims = simulatedComments.filter(c =>
      c.type !== 'simulated_purchase'
    );
    const t = setInterval(() => {
      const offset = videoOffsetRef.current ?? 0;
      const freshMount = Date.now() - mountTimeRef.current < 4000;
      chatSims.forEach(c => {
        if (shownSimIds.current.has(c.id) || c.video_timestamp == null) return;
        if (!freshMount && !typingSimIds.current.has(c.id) && offset >= c.video_timestamp - 3 && offset < c.video_timestamp) {
          typingSimIds.current.add(c.id);
          setTypingName(c.author_name);
        }
        if (c.video_timestamp <= offset && c.video_timestamp > offset - 5) {
          shownSimIds.current.add(c.id);
          setTypingName(null);
          setComments(prev => [...prev, { ...c, created_at: new Date().toISOString() }]);
        }
      });
    }, 1000);
    return () => clearInterval(t);
  }, [simulatedComments, videoOffsetRef]);

  useEffect(() => { scrollToBottom(); }, [comments]);

  // Poll staff metrics every 10s (online count, cta clicks, chat mode)
  // Note: cta_enabled is NOT synced here — staff controls it directly via the toggle
  // and syncing from DB would overwrite the optimistic local state.
  useEffect(() => {
    if (!isStaff || !staffToken) return;
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/staff/metrics', { headers: { Authorization: `Bearer ${staffToken}` } });
        const data = await res.json();
        if (data.online !== undefined) setStaffMetrics({ online: data.online, cta_clicks: data.cta_clicks });
        if (data.chat_mode !== undefined) setChatPublic(data.chat_mode === 'general');
        if (data.cta_enabled !== undefined) setServerCtaEnabled(!!data.cta_enabled);
      } catch {}
    };
    fetchMetrics();
    const t = setInterval(fetchMetrics, 10000);
    return () => clearInterval(t);
  }, [isStaff, staffToken]);

  const activePins = pinnedComments.filter(p => {
    if (!p.pin_start_seconds && !p.pin_end_seconds) return true;
    return videoOffset >= (p.pin_start_seconds ?? 0) && videoOffset <= (p.pin_end_seconds ?? Infinity);
  });
  // CTA shows for everyone when staff has enabled it — no time-window restriction for viewers
  const showCta = serverCtaEnabled && liveCtaUrl && ctaVisible;

  async function sendComment() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    const tempId = `opt_${Date.now()}`;
    const displayName = isStaff ? 'Equipe Kunz' : sessionName;
    const commentType: ChatComment['type'] = isStaff ? 'real_staff' : 'real_user';
    setComments(prev => [...prev, { id: tempId, type: commentType, author_name: displayName, text, created_at: new Date().toISOString() }]);
    setInput('');
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (isStaff && staffToken) headers['Authorization'] = `Bearer ${staffToken}`;
      const res = await fetch('/api/chat', { method: 'POST', headers, body: JSON.stringify({ text }) });
      // Only try to parse JSON if the response looks like JSON — avoids throwing on HTML error pages
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        // Non-JSON response (e.g. Vercel error page) — keep optimistic comment visible
        setSending(false);
        return;
      }
      const data = await res.json();
      if (data.id) {
        setComments(prev => prev.map(c => c.id === tempId ? { ...c, id: data.id } : c));
      }
      // On server errors (403, 500 etc.) keep the optimistic comment visible — don't silently delete it
    } catch {
      // True network failure: keep the comment visible with a faded style rather than removing it
      // (no-op — comment stays in state with temp id)
    }
    setSending(false);
  }

  const btnBase: React.CSSProperties = {
    width: 30, height: 30, borderRadius: '50%', background: T.toggleBg,
    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0, transition: 'background .2s',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, fontFamily: "'Montserrat', sans-serif", position: 'relative' }}>

      {/* ── CTA Banner ─────────────────────────────────────── */}
      {showCta && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 14px', background: 'linear-gradient(135deg,#e0a030,#e06020)', flexShrink: 0, animation: 'lcSlideIn .4s ease' }}>
          <a href={liveCtaUrl} target="_blank" rel="noopener noreferrer"
            onClick={() => fetch('/api/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'cta_click', meta: { url: liveCtaUrl } }) })}
            style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', textDecoration: 'none', flex: 1, fontSize: 12, fontWeight: 700, letterSpacing: '.03em', transition: 'opacity .15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '.9'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}>
            <div className="lc-cta-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', flexShrink: 0 }} />
            <span>{liveCtaText || '🔥 Vagas abertas! Garanta sua vaga agora'}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </a>
          <button
            onClick={() => setCtaVisible(false)}
            style={{ all: 'unset', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: 18, lineHeight: 1, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.35)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.2)'; }}
          >×</button>
        </div>
      )}

      {/* ── Staff Bar (post-login) ──────────────────────────── */}
      {isStaff && (
        <div style={{ padding: '10px 14px', background: 'rgba(85,160,238,0.08)', borderBottom: '1px solid rgba(85,160,238,0.2)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {/* Header: staff label + name + logout */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#55A0EE', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: "'Montserrat', sans-serif" }}>⚡ Staff</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#fff' : '#111', background: 'rgba(85,160,238,0.2)', padding: '2px 9px', borderRadius: 20, fontFamily: "'Montserrat', sans-serif" }}>{staffName}</span>
            </div>
            <button onClick={logoutStaff}
              style={{ all: 'unset', border: `1px solid ${T.border}`, borderRadius: 5, padding: '3px 10px', fontSize: 10, fontWeight: 700, color: T.textMuted, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: "'Montserrat', sans-serif" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e05050'; (e.currentTarget as HTMLElement).style.color = '#e05050'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = T.border; (e.currentTarget as HTMLElement).style.color = T.textMuted; }}>
              Sair
            </button>
          </div>
          {/* Metrics */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.text, fontFamily: "'Montserrat', sans-serif" }}>
              🟢 <strong>{staffMetrics.online}</strong> online
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.text, fontFamily: "'Montserrat', sans-serif" }}>
              🛒 <strong>{staffMetrics.cta_clicks}</strong> cliques
            </span>
          </div>
          {/* Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ToggleSwitch on={serverCtaEnabled} onChange={toggleCta} label="CTA ativo" T={T} />
          </div>
          {/* Hint */}
          <span style={{ fontSize: 10, color: T.textMuted, fontStyle: 'italic', fontFamily: "'Montserrat', sans-serif" }}>Clique em um comentário para responder</span>
        </div>
      )}

      {/* ── Reply form ─────────────────────────────────────── */}
      {replyTarget && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 14px', borderBottom: `1px solid ${T.border}`, background: 'rgba(85,160,238,0.04)', flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#55A0EE', textTransform: 'uppercase', letterSpacing: '.07em' }}>↩ Respondendo: <em style={{ textTransform: 'none', fontWeight: 400 }}>{replyTarget.author_name}</em></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
              placeholder="Digite a resposta..."
              rows={2}
              maxLength={500}
              style={{ flex: 1, background: T.bgField, border: `1px solid ${T.borderField}`, borderRadius: 6, padding: '7px 10px', fontSize: 12, color: T.textTitle, fontFamily: "'Montserrat', sans-serif", resize: 'none', outline: 'none' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#55A0EE')}
              onBlur={e => (e.currentTarget.style.borderColor = T.borderField)}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button onClick={sendReply} disabled={sendingReply || !replyText.trim()}
                style={{ all: 'unset', background: '#55A0EE', color: '#fff', borderRadius: 6, padding: '0 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', cursor: 'pointer', display: 'flex', alignItems: 'center', flex: 1, opacity: sendingReply || !replyText.trim() ? 0.4 : 1 }}>
                Enviar
              </button>
              <button onClick={() => { setReplyTarget(null); setReplyText(''); }}
                style={{ all: 'unset', border: `1px solid ${T.border}`, borderRadius: 6, padding: '0 10px', fontSize: 11, color: T.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: T.bgHeader, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="lc-live-blink" style={{ width: 8, height: 8, borderRadius: '50%', background: '#e03c3c', flexShrink: 0, display: 'block' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: T.textTitle, letterSpacing: '.05em', textTransform: 'uppercase' }}>Comentários ao Vivo</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Minimize button */}
          {onMinimize && (
            <button
              onClick={onMinimize}
              title="Minimizar chat"
              style={btnBase}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.toggleBg; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          )}
          {/* Staff lock button */}
          <button
            onClick={() => isStaff ? null : setShowStaffModal(true)}
            title={isStaff ? `Staff: ${staffName}` : 'Acesso da equipe'}
            style={{ ...btnBase, background: isStaff ? 'rgba(85,160,238,0.15)' : T.toggleBg, position: 'relative' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isStaff ? '#55A0EE' : T.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            {isStaff && <span style={{ position: 'absolute', top: 3, right: 3, width: 7, height: 7, borderRadius: '50%', background: '#7ec8a0', border: `1px solid ${T.bgHeader}` }} />}
          </button>
          {/* Theme toggle */}
          <button onClick={toggleTheme} title={isDark ? 'Modo claro' : 'Modo escuro'} style={btnBase}>
            {isDark ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Pinned ─────────────────────────────────────────── */}
      <div style={{ paddingBottom: 8, flexShrink: 0 }}>
        {activePins.length > 0
          ? activePins.map(p => <PinnedBanner key={p.id} comment={p} ctaUrl={ctaUrl} ctaText={ctaText} dark={isDark} />)
          : <PinnedBanner key="__welcome__" comment={DEFAULT_WELCOME_PIN} ctaUrl="" ctaText="" dark={isDark} />
        }
      </div>

      {/* ── Comment list ───────────────────────────────────── */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14, scrollBehavior: 'smooth', scrollbarWidth: 'thin', scrollbarColor: `${T.scrollbar} transparent` }}>
        {comments.length === 0 && (
          <p style={{ textAlign: 'center', fontSize: 12, color: T.textMuted, marginTop: 32, fontStyle: 'italic' }}>Seja o primeiro a comentar!</p>
        )}
        {comments.map(c => (
          <CommentRow key={c.id} comment={c} isOwn={c.author_name === sessionName && c.type === 'real_user'} isStaff={isStaff} onReply={handleReply} T={T} />
        ))}
      </div>

      {/* ── Typing indicator ───────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 14px', height: 22, opacity: typingName ? 1 : 0, transition: 'opacity .3s', background: T.bg, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {[0, 1, 2].map(i => (
            <span key={i} className="lc-typing-dot" style={{ width: 4, height: 4, borderRadius: '50%', background: T.dotTyping, display: 'block', animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
        <span style={{ fontSize: 11, color: T.textTyping, fontStyle: 'italic' }}>{typingName} está digitando...</span>
      </div>

      {/* ── Input area ─────────────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: '12px 14px', borderTop: `1px solid ${T.border}`, background: T.bgInput, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input type="text" value={isStaff ? 'Equipe Kunz' : sessionName} readOnly
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', background: T.bgField, border: `1px solid ${T.borderField}`, borderRadius: 6, padding: '9px 12px', fontSize: 13, color: T.textMuted, fontFamily: "'Montserrat', sans-serif", outline: 'none', cursor: 'default' }} />
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
          disabled={!chatEnabled || sending} maxLength={200}
          placeholder="Escreva seu comentário..." rows={2}
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', background: T.bgField, border: `1px solid ${T.borderField}`, borderRadius: 6, padding: '9px 12px', fontSize: 13, color: T.textTitle, fontFamily: "'Montserrat', sans-serif", outline: 'none', resize: 'none', lineHeight: 1.4, transition: 'border-color .2s' }}
          onFocus={e => (e.currentTarget.style.borderColor = '#55A0EE')}
          onBlur={e => (e.currentTarget.style.borderColor = T.borderField)} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <ViewerCount min={viewerMin} max={viewerMax} T={T} />
          <button onClick={sendComment} disabled={!chatEnabled || sending || !input.trim()}
            style={{ background: '#55A0EE', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 20px', fontSize: 12, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", opacity: (!chatEnabled || sending || !input.trim()) ? 0.4 : 1, transition: 'opacity .15s' }}>
            Comentar
          </button>
        </div>
        {!chatEnabled && <p style={{ textAlign: 'center', fontSize: 11, color: T.textMuted, margin: 0 }}>Chat desabilitado</p>}
      </div>

      {/* ── Staff Login Modal ───────────────────────────────── */}
      {showStaffModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowStaffModal(false); }}
        >
          <div style={{ background: T.modalBg, border: `1px solid ${T.modalBorder}`, borderRadius: 14, padding: '28px 24px', width: 300, maxWidth: 'calc(100vw - 32px)', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 24px 60px rgba(0,0,0,0.6)', animation: 'lcModalIn .2s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: T.modalTitleColor, letterSpacing: '.02em' }}>🔐 Acesso da Equipe</span>
              <button onClick={() => setShowStaffModal(false)} style={{ all: 'unset', width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>×</button>
            </div>

            {staffError && (
              <div style={{ fontSize: 12, color: '#e08080', background: 'rgba(224,80,80,0.1)', borderRadius: 6, padding: '8px 11px', fontWeight: 500 }}>{staffError}</div>
            )}

            <input
              type="text" value={staffModalName} onChange={e => setStaffModalName(e.target.value)}
              placeholder="Seu nome (ex: Ana — equipe)"
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', background: T.staffInputBg, border: `1px solid ${T.staffInputBorder}`, borderRadius: 8, padding: '10px 13px', fontSize: 13, fontWeight: 500, color: T.staffInputColor, fontFamily: "'Montserrat', sans-serif", outline: 'none' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#55A0EE')}
              onBlur={e => (e.currentTarget.style.borderColor = T.staffInputBorder)}
            />

            <div style={{ position: 'relative' }}>
              <input
                type={staffPwVisible ? 'text' : 'password'} value={staffModalPw}
                onChange={e => setStaffModalPw(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleStaffLogin(); }}
                placeholder="Senha da equipe"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', background: T.staffInputBg, border: `1px solid ${T.staffInputBorder}`, borderRadius: 8, padding: '10px 38px 10px 13px', fontSize: 13, fontWeight: 500, color: T.staffInputColor, fontFamily: "'Montserrat', sans-serif", outline: 'none' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#55A0EE')}
                onBlur={e => (e.currentTarget.style.borderColor = T.staffInputBorder)}
              />
              <button onClick={() => setStaffPwVisible(v => !v)}
                style={{ all: 'unset', position: 'absolute', top: '50%', right: 12, transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                {staffPwVisible ? (
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                ) : (
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                )}
              </button>
            </div>

            <button onClick={handleStaffLogin} disabled={staffLogging || !staffModalName.trim() || !staffModalPw}
              style={{ all: 'unset', display: 'block', width: '100%', boxSizing: 'border-box', background: staffLogging || !staffModalName.trim() || !staffModalPw ? 'rgba(85,160,238,0.45)' : '#55A0EE', color: '#fff', borderRadius: 8, padding: 11, fontSize: 12, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', textAlign: 'center', cursor: staffLogging ? 'not-allowed' : 'pointer', fontFamily: "'Montserrat', sans-serif", transition: 'opacity .15s' }}>
              {staffLogging ? 'Verificando...' : 'Entrar como Staff'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
