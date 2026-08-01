import React, { memo, useState, useRef, useMemo } from 'react';
import type { RoundtableCreatedData } from '../../types';

/* ─── Types ─── */

export type SpeakingMode = 'moderator' | 'ordered' | 'free';

export interface ChannelInfo {
  sessionId: string;
  displayName: string;
  mode: SpeakingMode;
  status: string;
  roundNum?: number;
  orbVariant?: number;
}

interface ChannelBarProps {
  channels: ChannelInfo[];
  activeChannelId: string | null;
  onSelect: (sessionId: string) => void;
  onOpenCreatePanel: () => void;
  forceCollapsed?: boolean;
}

/* ─── Extract helper ─── */

export function extractChannels(
  messages: { roundtableData?: RoundtableCreatedData; roundtableDataList?: RoundtableCreatedData[] }[],
): ChannelInfo[] {
  const seen = new Set<string>();
  const result: ChannelInfo[] = [];
  const modeCounters: Record<SpeakingMode, number> = { moderator: 0, ordered: 0, free: 0 };

  for (const m of messages) {
    const list = m.roundtableDataList || (m.roundtableData ? [m.roundtableData] : []);
    for (const d of list) {
      if (seen.has(d.session_id)) continue;
      seen.add(d.session_id);
      const mode = (d.speaking_mode as SpeakingMode) || 'moderator';
      const variant = modeCounters[mode] % 3;
      modeCounters[mode]++;
      result.push({
        sessionId: d.session_id,
        displayName: d.display_name,
        mode,
        status: d.status,
        orbVariant: variant,
      });
    }
  }
  return result;
}

/* ─── Orb Palette System ─── */

const ORB_PALETTES = {
  moderator: [
    { gradient: 'linear-gradient(165deg, #667eea 0%, #1e1b4b 50%, #be185d 100%)', glow: 'rgba(102,126,234,0.15)' },
    { gradient: 'linear-gradient(170deg, #059669 0%, #0a0a0a 52%, #d97706 100%)', glow: 'rgba(5,150,105,0.12)' },
    { gradient: 'linear-gradient(160deg, #f59e0b 0%, #451a03 48%, #b45309 100%)', glow: 'rgba(245,158,11,0.10)' },
  ],
  ordered: [
    { gradient: 'linear-gradient(200deg, #f472b6 0%, #7e22ce 30%, #c084fc 55%, #312e81 80%, #e879f9 100%)', glow: 'rgba(244,114,182,0.12)' },
    { gradient: 'linear-gradient(190deg, #22d3ee 0%, #1e3a5f 28%, #fb923c 52%, #0c4a6e 76%, #67e8f9 100%)', glow: 'rgba(34,211,238,0.10)' },
    { gradient: 'linear-gradient(210deg, #fb7185 0%, #4c0519 26%, #a78bfa 52%, #581c87 78%, #fda4af 100%)', glow: 'rgba(251,113,133,0.12)' },
  ],
  free: [
    { gradient: 'radial-gradient(circle at 40% 40%, #38bdf8 0%, #581c87 32%, #be185d 60%, #1e3a5f 85%, #0f172a 100%)', glow: 'rgba(56,189,248,0.12)' },
    { gradient: 'radial-gradient(circle at 45% 45%, #f59e0b 0%, #7f1d1d 30%, #134e4a 58%, #4c1d95 82%, #0f172a 100%)', glow: 'rgba(245,158,11,0.10)' },
    { gradient: 'radial-gradient(circle at 50% 40%, #84cc16 0%, #1a2e05 32%, #7c2d12 58%, #4338ca 82%, #0f172a 100%)', glow: 'rgba(132,204,22,0.08)' },
  ],
} as const;

function getOrbStyle(mode: SpeakingMode, variant: number): React.CSSProperties {
  const p = ORB_PALETTES[mode][variant % 3];
  return { background: p.gradient };
}

function getGlowColor(mode: SpeakingMode, variant: number): string {
  return ORB_PALETTES[mode][variant % 3].glow;
}

/* ─── Shared constants ─── */

const MODE_LABELS: Record<SpeakingMode, string> = {
  moderator: '主持人模式',
  ordered: '轮序模式',
  free: '自由模式',
};

const MODE_SHORT: Record<SpeakingMode, string> = {
  moderator: '主持',
  ordered: '轮流',
  free: '自由',
};

/* ─── Orb Button ─── */

function OrbButton({
  channel, size = 34, onClick, isActive,
}: {
  channel: ChannelInfo; size?: number; onClick: (e: React.MouseEvent) => void; isActive: boolean;
}) {
  const isRunning = channel.status === 'running' || channel.status === 'active';
  const glow = getGlowColor(channel.mode, channel.orbVariant ?? 0);

  return (
    <button
      className={`channel-orb ch-orb${isRunning && isActive ? ' ch-orb-active' : ''}`}
      onClick={onClick}
      data-testid={`channel-orb-${channel.sessionId}`}
      style={{
        width: size, height: size, borderRadius: size / 2,
        ...getOrbStyle(channel.mode, channel.orbVariant ?? 0),
        border: 'none', cursor: 'pointer', padding: 0,
        opacity: isRunning ? 1 : 0.45,
        outline: isActive ? '2px solid rgba(99,102,241,0.35)' : 'none',
        outlineOffset: 2,
        flexShrink: 0,
        ['--_glow' as string]: glow,
        boxShadow: isActive && isRunning ? `0 0 10px 2px ${glow}` : 'none',
      }}
      title={channel.displayName}
    />
  );
}

/* ─── Channel Row (Expanded panel) ─── */

function ChannelRow({
  channel, isActive, onSelect,
}: {
  channel: ChannelInfo; isActive: boolean; onSelect: (id: string) => void;
}) {
  const isRunning = channel.status === 'running' || channel.status === 'active';

  return (
    <button
      onClick={() => onSelect(channel.sessionId)}
      className="channel-row"
      data-testid={`channel-row-${channel.sessionId}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 7px', borderRadius: 11,
        background: isActive ? 'var(--ch-row-active-bg)' : 'transparent',
        border: 'none', cursor: 'pointer', width: '100%',
        textAlign: 'left', transition: 'background 0.15s',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 16, flexShrink: 0,
        ...getOrbStyle(channel.mode, channel.orbVariant ?? 0),
        opacity: isRunning ? 1 : 0.45,
      }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 11,
          fontWeight: isRunning ? 600 : 500,
          color: isRunning ? 'var(--ch-msg-name)' : 'var(--ch-group-label)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {channel.displayName}
        </span>
        <span style={{
          fontSize: 8, fontWeight: 500,
          color: 'var(--ch-msg-time)',
        }}>
          {channel.roundNum ? `R${channel.roundNum} · ` : ''}
          {MODE_SHORT[channel.mode]}
          {isRunning ? ' · 进行中' : ' · 已结束'}
        </span>
      </div>
    </button>
  );
}

/* ─── ChannelBar (3 states) ─── */

export const ChannelBar = memo(function ChannelBar({
  channels, activeChannelId, onSelect, onOpenCreatePanel, forceCollapsed,
}: ChannelBarProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const expanded = !forceCollapsed;

  const grouped = useMemo(() => {
    const g: Record<SpeakingMode, ChannelInfo[]> = { moderator: [], ordered: [], free: [] };
    channels.forEach(ch => { if (g[ch.mode]) g[ch.mode].push(ch); });
    return g;
  }, [channels]);

  /* Empty State */
  if (channels.length === 0) {
    return (
      <div style={{ position: 'absolute', right: 10, top: 12, zIndex: 20 }} data-testid="channel-bar-empty">
        <button
          onClick={onOpenCreatePanel}
          data-testid="channel-bar-create"
          style={{
            width: 36, height: 36, borderRadius: 18,
            background: 'var(--ch-empty-btn-bg)',
            border: '0.5px solid var(--ch-empty-btn-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            transition: 'transform 0.15s ease',
          }}
          className="ch-icon"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ch-group-label)" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    );
  }

  /* Resting / Expanded */
  return (
    <div ref={panelRef} style={{ position: 'absolute', right: 10, top: 8, zIndex: 20 }} data-testid="channel-bar">
      {!expanded ? (
        <div
          data-testid="channel-bar-collapsed"
          style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 5, padding: 4,
            borderRadius: 24,
            background: 'var(--ch-pill-bg)',
            boxShadow: '0 3px 20px rgba(0,0,0,0.06)',
            border: '0.5px solid var(--ch-pill-border)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            transition: 'all 0.2s ease',
          }}
        >
          {channels.map(ch => (
            <OrbButton
              key={ch.sessionId}
              channel={ch}
              size={34}
              onClick={(e) => { e.stopPropagation(); onSelect(ch.sessionId); }}
              isActive={ch.sessionId === activeChannelId}
            />
          ))}
        </div>
      ) : (
        <div style={{
          background: 'var(--ch-expanded-bg)',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          border: '0.5px solid var(--ch-expanded-border)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          padding: 5, width: 164,
          display: 'flex', flexDirection: 'column', gap: 2,
        }} data-testid="channel-bar-expanded">
          {(['moderator', 'ordered', 'free'] as SpeakingMode[]).map(mode => {
            if (grouped[mode].length === 0) return null;
            return (
              <React.Fragment key={mode}>
                <div className="channel-group" style={{
                  padding: '5px 7px 2px', fontSize: 8, fontWeight: 600,
                  color: 'var(--ch-group-label)', letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }} data-testid={`channel-group-${mode}`}>
                  {MODE_LABELS[mode]}
                </div>
                {grouped[mode].map(ch => (
                  <ChannelRow
                    key={ch.sessionId}
                    channel={ch}
                    isActive={ch.sessionId === activeChannelId}
                    onSelect={onSelect}
                  />
                ))}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
});

/* ─── EmptyChannelPanel (Create Roundtable) ─── */

interface EmptyChannelPanelProps {
  onClose: () => void;
  onCreateRoundtable: (mode: SpeakingMode) => void;
}

const CARD_COLORS: Record<SpeakingMode, { bg: string; textMuted: string }> = {
  moderator: { bg: 'var(--ch-card-moderator)', textMuted: 'var(--ch-card-text-muted-mod)' },
  ordered:   { bg: 'var(--ch-card-ordered)',   textMuted: 'var(--ch-card-text-muted-ord)' },
  free:      { bg: 'var(--ch-card-free)',      textMuted: 'var(--ch-card-text-muted-free)' },
};

const MODES: { key: SpeakingMode; tabLabel: string }[] = [
  { key: 'moderator', tabLabel: '主持' },
  { key: 'ordered',   tabLabel: '轮流' },
  { key: 'free',      tabLabel: '自由' },
];

const CASE_STUDIES: Record<SpeakingMode, {
  title: string; desc: string; badge: string;
  statusText?: string; footerLeft: string; footerRight: string;
}> = {
  moderator: {
    title: '并购尽调多维度评估',
    badge: '☆ 主持人模式',
    desc: '财务审查、法律合规、市场竞争分析\n主持人控场多角色深度评估',
    footerLeft: '3人',
    footerRight: '主持中',
  },
  ordered: {
    title: 'Q3 GTM 策略制定',
    badge: '▦ 轮流发言',
    desc: '工程、市场、销售、客成按序轮询，\n各自调研后给出 Go-to-Market 方案',
    statusText: '市场分析师 正在发言 •••',
    footerLeft: '4人',
    footerRight: '2/4',
  },
  free: {
    title: '竞品突发动态快速分析',
    badge: '▥ 自由模式',
    desc: '话题自由流转：产品→市场→财务→\n销售，链式 @传递探讨应对策略',
    statusText: '链式接力讨论中',
    footerLeft: '3人',
    footerRight: '',
  },
};

export function EmptyChannelPanel({ onClose, onCreateRoundtable }: EmptyChannelPanelProps) {
  const [activeMode, setActiveMode] = useState<SpeakingMode>('moderator');

  const modeOrder: SpeakingMode[] = ['moderator', 'ordered', 'free'];
  const activeIdx = modeOrder.indexOf(activeMode);
  const topMode = modeOrder[(activeIdx + 2) % 3];
  const midMode = activeMode;
  const bottomMode = modeOrder[(activeIdx + 1) % 3];

  type SlotProps = { rotate: number; z: number; top: number; right: number; isMid: boolean };
  const SLOTS: Record<string, SlotProps> = {
    top:    { rotate: 10,  z: 1, top: 30,  right: -60, isMid: false },
    mid:    { rotate: 0,   z: 3, top: 85,  right: -30, isMid: true },
    bottom: { rotate: -16, z: 2, top: 140, right: -60, isMid: false },
  };

  const modeToSlot: Partial<Record<SpeakingMode, SlotProps>> = {
    [topMode]:    SLOTS.top,
    [midMode]:    SLOTS.mid,
    [bottomMode]: SLOTS.bottom,
  };

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: 'var(--ch-create-bg)',
      borderRadius: 44, position: 'relative',
    }} data-testid="empty-channel-panel">
      {/* Close button — top right */}
      <button
        onClick={onClose}
        data-testid="empty-channel-panel-close"
        style={{
          position: 'absolute', top: 20, right: 20, zIndex: 10,
          width: 32, height: 32, borderRadius: 16,
          background: 'var(--hover-bg)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1,
        }}
      >×</button>

      {/* Title */}
      <div style={{ padding: '28px 24px 0' }}>
        <div style={{ fontSize: 24, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', margin: '0 0 6px' }}>
          还没有圆桌讨论？
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>
          创建一个吧
        </div>
      </div>

      {/* Create button */}
      <div style={{ padding: '24px 24px 28px' }}>
        <button
          onClick={() => onCreateRoundtable(activeMode)}
          data-testid="empty-channel-panel-create"
          style={{
            width: '100%', padding: '14px 0', borderRadius: 28, fontSize: 15, fontWeight: 500,
            background: 'var(--btn-mono-bg)', color: 'var(--btn-mono-text)',
            border: '1px solid var(--border-default)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 300 }}>+</span> 创建圆桌讨论
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0 24px' }} />

      {/* "圆桌模式" label */}
      <div style={{ padding: '28px 24px 0', flexShrink: 0 }}>
        <span style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>圆桌模式</span>
      </div>

      {/* Cards area: vertically centered between 圆桌模式 and bottom text */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', overflow: 'hidden', margin: '0 24px' }}>
        {/* Vertical tabs */}
        <div style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          gap: 40, width: 44, flexShrink: 0, zIndex: 5,
        }}>
          {MODES.map((m) => {
            const isActive = activeMode === m.key;
            return (
              <button
                className="empty-channel-mode"
                key={m.key}
                onClick={() => setActiveMode(m.key)}
                data-testid={`empty-channel-mode-${m.key}`}
                style={{
                  width: 44, height: 100,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? 'var(--hover-bg-strong)' : 'transparent',
                  borderRadius: isActive ? 21 : 0,
                  border: 'none', cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  padding: 0,
                }}
              >
                <span style={{
                  display: 'block',
                  transform: 'rotate(-90deg)',
                  whiteSpace: 'nowrap',
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontFamily: 'Inter, sans-serif',
                }}>
                  {m.tabLabel}
                </span>
              </button>
            );
          })}
        </div>

        {/* Fan cards — keyed by mode so each card animates between slots */}
        <div style={{ flex: 1, position: 'relative', height: 340, alignSelf: 'center' }}>
          {modeOrder.map((mode) => {
            const slot = modeToSlot[mode]!;
            const cs = CASE_STUDIES[mode];
            const cc = CARD_COLORS[mode];
            return (
              <div
                className="empty-channel-card"
                key={mode}
                data-testid={`empty-channel-card-${mode}`}
                onClick={() => { if (!slot.isMid) setActiveMode(mode); }}
                style={{
                  position: 'absolute',
                  width: 340, height: 200,
                  right: slot.right, top: slot.top,
                  background: cc.bg, borderRadius: 20,
                  transform: `rotate(${slot.rotate}deg) scale(${slot.isMid ? 1 : 0.95})`,
                  transformOrigin: 'right center',
                  boxShadow: slot.isMid
                    ? '0 8px 24px rgba(0,0,0,0.1)'
                    : '0 4px 16px rgba(0,0,0,0.06)',
                  padding: '16px 18px 14px',
                  display: 'flex', flexDirection: 'column',
                  gap: 7, overflow: 'hidden',
                  cursor: slot.isMid ? 'default' : 'pointer',
                  zIndex: slot.z,
                  transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease, top 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), right 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), z-index 0.3s step-end',
                }}
              >
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'var(--ch-card-badge-bg, rgba(255,255,255,0.5))', borderRadius: 6,
                  padding: '3px 8px', fontSize: 10, fontWeight: 600,
                  color: 'var(--ch-card-title, var(--text-primary))', alignSelf: 'flex-start',
                  fontFamily: 'Inter, sans-serif',
                }}>
                  {cs.badge}
                </span>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ch-card-title, var(--text-primary))', letterSpacing: -0.3, fontFamily: 'Inter, sans-serif' }}>
                  {cs.title}
                </div>
                <div style={{
                  fontSize: 11, color: cc.textMuted,
                  lineHeight: 1.45, whiteSpace: 'pre-line',
                  fontFamily: 'Inter, sans-serif',
                }}>
                  {cs.desc}
                </div>
                {cs.statusText && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'var(--ch-card-status-bg, rgba(255,255,255,0.4))', borderRadius: 12,
                    padding: '4px 10px', fontSize: 10, color: 'var(--ch-card-status-text, var(--text-muted))',
                    alignSelf: 'flex-start', fontFamily: 'Inter, sans-serif',
                  }}>
                    {cs.statusText}
                  </div>
                )}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginTop: 'auto',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {[0, 1, 2].map(j => (
                      <div key={j} style={{
                        width: 20, height: 20, borderRadius: 10,
                        background: ['#667eea', '#f472b6', '#34d399'][j],
                        border: '2px solid ' + cc.bg,
                        marginLeft: j > 0 ? -6 : 0,
                      }} />
                    ))}
                    <span style={{ fontSize: 10, color: 'var(--ch-card-footer-text, var(--text-muted))', marginLeft: 6, fontFamily: 'Inter, sans-serif' }}>{cs.footerLeft}</span>
                  </div>
                  {cs.footerRight && (
                    <span style={{ fontSize: 10, color: 'var(--ch-card-footer-text, var(--text-muted))', fontFamily: 'Inter, sans-serif' }}>● {cs.footerRight}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom */}
      <div style={{
        padding: '10px 24px 14px', textAlign: 'center', flexShrink: 0,
        fontSize: 11, color: 'var(--text-muted)', opacity: 0.4,
        fontFamily: 'Inter, sans-serif',
      }}>
        Agent 也可以在对话中自行发起讨论
      </div>
    </div>
  );
}

export { ORB_PALETTES, getOrbStyle, MODE_LABELS, MODE_SHORT };
