/**
 * RoundtableCard — 对话流中的圆桌频道卡片
 *
 * 三种模式各有独特底纹和布局：
 *   moderator: 左侧大头像 + 三角形底纹
 *   ordered:   发言者栏 + 圆角方块底纹
 *   free:      波形动画 + 有机 blob 底纹
 *
 * 暗色/亮色主题自适应。
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { kernelApiFetch } from '../../api/gateway';
import type { RoundtableCreatedData, RoundtableParticipantInfo } from '../../types';

interface RoundtableCardProps {
  data: RoundtableCreatedData;
  onOpenPanel?: (sessionId: string) => void;
}

/* ── Palette per mode ── */

const MODE_META: Record<string, { label: string; desc: string; icon: React.ReactNode }> = {
  moderator: {
    label: '主持人模式',
    desc: '主持人引导每轮讨论',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-[10px] h-[10px]">
        <path d="M12 2l2.09 6.26L21 9.27l-5 3.64L17.18 20 12 16.77 6.82 20 8 12.91l-5-3.64 6.91-1.01z" />
      </svg>
    ),
  },
  ordered: {
    label: '轮流发言',
    desc: '按固定顺序依次发言',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-[10px] h-[10px]">
        <path d="M17 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2z" />
        <path d="M9 7h6M9 11h6M9 15h4" />
      </svg>
    ),
  },
  free: {
    label: '自由模式',
    desc: '所有参与者自由发言 · 无固定顺序 · 碰撞创意',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-[10px] h-[10px]">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
};

/* ── Fluid avatar color from name ── */
function nameToGradient(name: string): string {
  const h = (name.charCodeAt(0) * 37 + (name.charCodeAt(1) || 0) * 17) % 360;
  const h2 = (h + 40) % 360;
  return `radial-gradient(circle at 40% 40%, hsl(${h},60%,72%), hsl(${h2},50%,48%))`;
}

/* ── Backgrounds per mode ── */

function HostBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 72% 42%, rgba(192,132,252,0.05) 0%, transparent 50%), radial-gradient(ellipse at 35% 80%, rgba(129,140,248,0.03) 0%, transparent 40%)' }}>
      <div className="rt-bg-art absolute right-0 top-0 bottom-0 w-[65%] transition-opacity duration-[600ms]"
        style={{ opacity: 'var(--rt-bg-art-opacity)' }}>
        {/* triangle 1 */}
        <div style={{
          position: 'absolute', right: 20, top: 10, width: 0, height: 0,
          borderLeft: '70px solid transparent', borderRight: '70px solid transparent',
          borderBottom: '120px solid rgba(129,140,248,0.7)',
          filter: 'blur(1px)', borderRadius: 12, transform: 'rotate(-12deg)',
          animation: 'rt-tri-h1 14s ease-in-out infinite',
        }} />
        {/* triangle 2 */}
        <div style={{
          position: 'absolute', right: 55, top: 25, width: 0, height: 0,
          borderLeft: '55px solid transparent', borderRight: '55px solid transparent',
          borderBottom: '95px solid rgba(192,132,252,0.5)',
          filter: 'blur(1px)', borderRadius: 10, transform: 'rotate(8deg)',
          animation: 'rt-tri-h2 11s ease-in-out infinite',
        }} />
        {/* triangle 3 */}
        <div style={{
          position: 'absolute', right: 140, bottom: 25, width: 0, height: 0,
          borderLeft: '30px solid transparent', borderRight: '30px solid transparent',
          borderBottom: '52px solid rgba(244,114,182,0.35)',
          filter: 'blur(0.5px)', borderRadius: 8, transform: 'rotate(-25deg)',
          animation: 'rt-tri-h3 10s ease-in-out infinite',
        }} />
      </div>
    </div>
  );
}

function OrderedBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 76% 38%, rgba(96,165,250,0.05) 0%, transparent 50%), radial-gradient(ellipse at 28% 72%, rgba(129,140,248,0.03) 0%, transparent 40%)' }}>
      <div className="rt-bg-art absolute right-0 top-0 bottom-0 w-[65%] transition-opacity duration-[600ms]"
        style={{ opacity: 'var(--rt-bg-art-opacity)' }}>
        <div style={{
          position: 'absolute', right: 15, top: '50%', width: 115, height: 115, marginTop: -65,
          borderRadius: 22,
          background: 'linear-gradient(140deg, rgba(96,165,250,0.7) 0%, rgba(129,140,248,0.55) 100%)',
          filter: 'blur(0.5px)', transform: 'rotate(12deg)',
          animation: 'rt-sq-1 12s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', right: 65, top: '50%', width: 95, height: 95, marginTop: -35,
          borderRadius: 18,
          background: 'linear-gradient(160deg, rgba(129,140,248,0.55) 0%, rgba(165,180,252,0.4) 100%)',
          filter: 'blur(0.5px)', transform: 'rotate(32deg)',
          animation: 'rt-sq-2 10s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', right: 130, top: '50%', width: 72, height: 72, marginTop: -5,
          borderRadius: 14,
          background: 'linear-gradient(180deg, rgba(147,197,253,0.45) 0%, rgba(96,165,250,0.3) 100%)',
          filter: 'blur(0.5px)', transform: 'rotate(52deg)',
          animation: 'rt-sq-3 15s ease-in-out infinite',
        }} />
      </div>
    </div>
  );
}

function FreeBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 75% 40%, rgba(52,211,153,0.05) 0%, transparent 45%), radial-gradient(ellipse at 25% 70%, rgba(96,165,250,0.03) 0%, transparent 40%)' }}>
      <div className="rt-bg-art absolute right-0 top-0 bottom-0 w-[65%] transition-opacity duration-[600ms]"
        style={{ opacity: 'var(--rt-bg-art-opacity)', filter: 'blur(0.3px)' }}>
        <div style={{
          position: 'absolute', right: 30, top: 15, width: 80, height: 80,
          borderRadius: '50% 50% 40% 60% / 55% 45% 55% 45%',
          background: 'linear-gradient(135deg, #34D399 0%, #60A5FA 100%)',
          animation: 'rt-morph-1 7s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', right: 160, top: 60, width: 55, height: 55,
          borderRadius: '45% 55% 50% 50% / 50% 50% 50% 50%',
          background: 'linear-gradient(160deg, #6EE7B7 0%, #34D399 100%)',
          opacity: 0.6,
          animation: 'rt-morph-2 9s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', right: 90, bottom: 20, width: 65, height: 65,
          borderRadius: '55% 45% 50% 50% / 45% 55% 45% 55%',
          background: 'linear-gradient(200deg, #60A5FA 0%, #34D399 100%)',
          opacity: 0.45,
          animation: 'rt-morph-3 11s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', right: 220, top: 25, width: 45, height: 45,
          borderRadius: '50% 50% 45% 55% / 50% 50% 50% 50%',
          background: 'linear-gradient(170deg, #34D399 0%, #818CF8 100%)',
          opacity: 0.35,
          animation: 'rt-morph-4 13s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', right: 270, bottom: 35, width: 40, height: 40,
          borderRadius: '45% 55% 55% 45% / 50% 45% 55% 50%',
          background: 'linear-gradient(140deg, #6EE7B7 0%, #60A5FA 100%)',
          opacity: 0.3,
          animation: 'rt-morph-5 8s ease-in-out infinite',
        }} />
      </div>
    </div>
  );
}

/* ── Small fluid avatar ── */
function FluidAvatar({ name, size = 28, borderVar = 'var(--rt-card-bg)' }: { name: string; size?: number; borderVar?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid ${borderVar}`,
      overflow: 'hidden', position: 'relative', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: nameToGradient(name),
        filter: 'blur(3px) saturate(1.3)',
      }} />
    </div>
  );
}

/* ── Host avatar (large, with ring) ── */
function HostAvatar() {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 w-[130px] shrink-0">
      <div style={{
        width: 88, height: 88, borderRadius: '50%', padding: 3,
        background: 'linear-gradient(135deg,rgba(129,140,248,0.4),rgba(192,132,252,0.3),rgba(96,165,250,0.4))',
      }}>
        <div className="w-full h-full rounded-full overflow-hidden relative"
          style={{ background: 'var(--rt-avatar-inner-bg)' }}>
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(circle at 35% 40%, rgba(129,140,248,0.7) 0%, transparent 50%), radial-gradient(circle at 65% 60%, rgba(192,132,252,0.6) 0%, transparent 45%), radial-gradient(circle at 50% 80%, rgba(96,165,250,0.5) 0%, transparent 40%), radial-gradient(circle at 30% 70%, rgba(244,114,182,0.3) 0%, transparent 35%)',
            filter: 'blur(8px) saturate(1.2)',
            animation: 'rt-fluid-shift 6s ease-in-out infinite',
          }} />
          <div className="absolute inset-0" style={{
            background: 'var(--rt-avatar-fg-gradient)',
          }} />
        </div>
      </div>
      <span className="text-[10px] font-bold tracking-wide" style={{ color: 'var(--rt-accent-host)' }}>
        主持人
      </span>
    </div>
  );
}

/* ── Speaker bar (ordered mode) — single row ── */
function SpeakerBar({ speaker }: { speaker?: RoundtableParticipantInfo }) {
  const name = speaker?.display_name || '参与者';
  return (
    <div className="flex items-center gap-2 rounded-full" style={{
      padding: '5px 12px 5px 5px',
      background: 'var(--rt-bar-bg)',
      border: '1px solid var(--rt-bar-border)',
      width: 'fit-content',
    }}>
      <div className="w-5 h-5 rounded-full overflow-hidden relative shrink-0">
        <div className="absolute inset-0" style={{
          background: nameToGradient(name),
          filter: 'blur(2px) saturate(1.3)',
        }} />
      </div>
      <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</span>
      <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>正在发言</span>
      <div className="flex gap-[2px] ml-0.5">
        {[0, 1, 2].map(i => (
          <i key={i} className="not-italic block w-[3px] h-[3px] rounded-full"
            style={{
              background: 'var(--rt-typing-dot)',
              animation: `rt-typing 1.2s infinite ${i * 0.15}s`,
            }} />
        ))}
      </div>
    </div>
  );
}

/* ── Wave bars (free mode) ── */
function WaveBars() {
  const heights = [6, 14, 9, 16, 7, 11];
  const delays = [0, 0.1, 0.2, 0.05, 0.25, 0.15];
  return (
    <div className="flex items-center gap-[10px]">
      <div className="flex items-center gap-[2px] h-[18px]">
        {heights.map((h, i) => (
          <div key={i} className="w-[2.5px] rounded-[1.5px]"
            style={{
              height: h, background: '#34D399',
              animation: `rt-wave 1.2s ease-in-out infinite ${delays[i]}s`,
            }} />
        ))}
      </div>
      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>多人同时发言中</span>
    </div>
  );
}

/* ── Progress dots (moderator) ── */
function ProgressDots({ current, total, participants }: { current: number; total: number; participants: RoundtableParticipantInfo[] }) {
  const dots: React.ReactNode[] = [];
  for (let i = 0; i < total; i++) {
    const isNow = i === current;
    const isFuture = i > current;
    const hue = participants[i] ? (participants[i].display_name.charCodeAt(0) * 37) % 360 : 0;
    const color = `hsl(${hue},50%,65%)`;

    if (i > 0) {
      dots.push(<div key={`dl-${i}`} className="w-[5px] h-px" style={{ background: 'var(--rt-dot-line)' }} />);
    }
    if (isFuture) {
      dots.push(<div key={i} className="w-[7px] h-[7px] rounded-full" style={{
        background: 'var(--rt-dot-future-bg)',
        border: '1px solid var(--rt-dot-future-border)',
      }} />);
    } else if (isNow) {
      dots.push(<div key={i} className="w-[7px] h-[7px] rounded-full" style={{
        background: color,
        boxShadow: `0 0 0 2px var(--rt-card-bg), 0 0 0 3.5px ${color}`,
        animation: 'rt-dot-now 2.2s ease-in-out infinite',
      }} />);
    } else {
      dots.push(<div key={i} className="w-[7px] h-[7px] rounded-full opacity-90" style={{ background: color }} />);
    }
  }
  return <div className="flex items-center gap-[3px]">{dots}</div>;
}

/* ── Live indicator ── */
function LiveIndicator({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-[5px] ml-auto text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
      <span className="relative w-[5px] h-[5px] rounded-full bg-[#34D399]">
        <span className="absolute inset-[-3px] rounded-full border border-[rgba(52,211,153,0.25)]"
          style={{ animation: 'rt-live-pulse 2s infinite' }} />
      </span>
      {text}
    </div>
  );
}

/* ══════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════ */
export const RoundtableCard = memo(function RoundtableCard({ data, onOpenPanel }: RoundtableCardProps) {
  const [status, setStatus] = useState(data.status || 'active');
  const [currentRound, setCurrentRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(5);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(0);

  const mode = data.speaking_mode || 'ordered';
  const meta = MODE_META[mode] || MODE_META.ordered;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await kernelApiFetch(`/api/v1/roundtable/${data.session_id}`);
        if (res.ok && !cancelled) {
          const info = await res.json();
          if (info.status) setStatus(info.status);
          if (info.current_round) setCurrentRound(info.current_round);
          if (info.max_rounds) setMaxRounds(info.max_rounds);
          if (info.messages?.length) setMessageCount(info.messages.length);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [data.session_id]);

  useEffect(() => {
    const handleStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.session_id === data.session_id) {
        if (detail.status) setStatus(detail.status);
        if (detail.current_round) setCurrentRound(detail.current_round);
        if (detail.active_speaker) setCurrentSpeaker(detail.active_speaker as string);
      }
    };
    const handleMessage = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.session_id === data.session_id && detail?.message) {
        setMessageCount(c => c + 1);
        if (detail.message.display_name) setCurrentSpeaker(detail.message.display_name);
      }
    };
    window.addEventListener('roundtable-status', handleStatus);
    window.addEventListener('roundtable-message', handleMessage);
    return () => {
      window.removeEventListener('roundtable-status', handleStatus);
      window.removeEventListener('roundtable-message', handleMessage);
    };
  }, [data.session_id]);

  const handleClick = useCallback(() => {
    onOpenPanel?.(data.session_id);
  }, [data.session_id, onOpenPanel]);

  const isActive = status === 'active';
  const isConcluded = status === 'concluded';

  const speakerParticipant = useMemo(() => {
    if (!currentSpeaker) return data.participants[0];
    return data.participants.find(p => p.display_name === currentSpeaker) || data.participants[0];
  }, [currentSpeaker, data.participants]);

  const liveText = mode === 'free'
    ? `活跃 · ${messageCount} 条`
    : `${currentRound}/${maxRounds} 轮`;

  const statusText = isConcluded ? '已结束' : '';

  return (
    <div
      onClick={handleClick}
      data-testid={`roundtable-card-${data.session_id}`}
      className="roundtable-card rt-card group relative overflow-hidden cursor-pointer"
      style={{
        width: '66%', maxWidth: 580,
        height: 190, borderRadius: 16,
        background: 'var(--rt-card-bg)',
        border: 'var(--rt-card-border)',
        boxShadow: 'var(--rt-card-shadow)',
        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        marginBottom: 8,
      }}
    >
      {/* Top gradient line — color matches mode */}
      <div className="absolute top-0 left-0 right-0 h-px z-[3]" style={{
        background: mode === 'moderator'
          ? 'linear-gradient(90deg, #F472B6 0%, #C084FC 40%, #818CF8 100%)'
          : mode === 'ordered'
            ? 'linear-gradient(90deg, #818CF8 0%, #60A5FA 50%, #93C5FD 100%)'
            : 'linear-gradient(90deg, #34D399 0%, #6EE7B7 40%, #60A5FA 100%)',
        opacity: 'var(--rt-topline-opacity)',
      }} />

      {/* Background art per mode */}
      {mode === 'moderator' && <HostBackground />}
      {mode === 'ordered' && <OrderedBackground />}
      {mode === 'free' && <FreeBackground />}

      {/* Card inner */}
      <div className={`relative z-[2] h-full flex items-stretch p-[20px_22px] ${mode === 'moderator' ? 'gap-5' : 'gap-[18px]'}`} data-testid="roundtable-card-content">

        {/* Moderator: large avatar on left */}
        {mode === 'moderator' && <HostAvatar />}

        {/* Info panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tag */}
          <div className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[10px] font-semibold mb-2 w-fit"
            style={{
              background: mode === 'moderator' ? 'var(--rt-tag-host-bg)' : mode === 'ordered' ? 'var(--rt-tag-ord-bg)' : 'var(--rt-tag-free-bg)',
              color: mode === 'moderator' ? 'var(--rt-tag-host-color)' : mode === 'ordered' ? 'var(--rt-tag-ord-color)' : 'var(--rt-tag-free-color)',
            }}>
            {meta.icon}
            {meta.label}
            {statusText && <span className="ml-1 opacity-70">· {statusText}</span>}
          </div>

          {/* Title */}
          <div className="text-[16px] font-bold leading-[1.3] tracking-tight mb-1" style={{
            color: 'var(--text-primary)', letterSpacing: '-0.01em',
          }}>
            {data.display_name}
          </div>

          {/* Brief description — short mode-contextual line, NOT full topic */}
          <div className="text-[11px] leading-[1.45]" style={{ color: 'var(--text-muted)' }}>
            {data.topic
              ? (data.topic.length > 40 ? data.topic.slice(0, 40) + '…' : data.topic)
              : meta.desc}
          </div>

          {/* Ordered: speaker bar — centered between desc and footer */}
          {mode === 'ordered' && isActive && <div className="my-auto"><SpeakerBar speaker={speakerParticipant} /></div>}

          {/* Free: wave bars — centered between desc and footer */}
          {mode === 'free' && isActive && <div className="my-auto"><WaveBars /></div>}

          {/* Spacer when no mid-section */}
          {!(mode === 'ordered' && isActive) && !(mode === 'free' && isActive) && <div className="flex-1" />}

          {/* Footer */}
          <div className="flex items-center gap-3 mt-auto pt-3">
            <div className="flex">
              {data.participants.slice(0, 5).map((p, i) => (
                <div className="roundtable-card-participant" key={p.id || i} data-testid={`roundtable-card-participant-${p.id || i}`} style={{ marginLeft: i > 0 ? -7 : 0, position: 'relative', zIndex: 5 - i }}>
                  <FluidAvatar name={p.display_name} size={28} borderVar="var(--rt-card-bg)" />
                </div>
              ))}
            </div>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {data.participants.length} 人
            </span>

            {mode === 'moderator' && (
              <ProgressDots current={currentRound - 1} total={Math.min(maxRounds, 7)} participants={data.participants} />
            )}

            {isActive && <LiveIndicator text={liveText} />}
            {isConcluded && (
              <span className="ml-auto text-[10px] font-semibold px-[7px] py-[2px] rounded-full"
                style={{
                  color: 'var(--text-muted)',
                  background: 'var(--rt-chip-bg)',
                  border: '1px solid var(--rt-chip-border)',
                }}>
                {currentRound}/{maxRounds} 轮
              </span>
            )}
          </div>
        </div>
      </div>

    </div>
  );
});

export default RoundtableCard;
