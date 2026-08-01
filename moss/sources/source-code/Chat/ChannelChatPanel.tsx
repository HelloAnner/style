import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { MarkdownContent } from './MarkdownContent';
import type { RoundtableMessageData } from '../../types';
import {
  getRoundtable,
  injectMessage,
  type RoundtableSession,
  type RoundtableParticipant,
} from '../../api/roundtable';
import {
  getRoundtableChannelCache,
  replaceRoundtableChannelCache,
} from '../../lib/roundtableChannelCache';

const MODE_LABELS: Record<string, string> = {
  moderator: '主持人模式',
  ordered: '轮流模式',
  free: '自由模式',
};

const AVATAR_PALETTES = [
  { bg: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'rgba(102,126,234,0.3)' },
  { bg: 'linear-gradient(135deg, #f093fb, #f5576c)', border: 'rgba(240,147,251,0.3)' },
  { bg: 'linear-gradient(135deg, #4facfe, #00f2fe)', border: 'rgba(79,172,254,0.3)' },
  { bg: 'linear-gradient(135deg, #43e97b, #38f9d7)', border: 'rgba(67,233,123,0.3)' },
  { bg: 'linear-gradient(135deg, #fa709a, #fee140)', border: 'rgba(250,112,154,0.3)' },
  { bg: 'linear-gradient(135deg, #a18cd1, #fbc2eb)', border: 'rgba(161,140,209,0.3)' },
];

function Avatar({ name, size = 32, index }: { name: string; size?: number; index?: number }) {
  const idx = index ?? ((name.charCodeAt(0) || 0) % AVATAR_PALETTES.length);
  const p = AVATAR_PALETTES[idx % AVATAR_PALETTES.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: p.bg,
      border: `2px solid ${p.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: '#fff',
      letterSpacing: -0.5,
    }}>
      {name.charAt(0)}
    </div>
  );
}


interface ChannelChatPanelProps {
  sessionId: string;
  onClose: () => void;
}

const savedScrollPositions = new Map<string, number>();
const visitedSessions = new Set<string>();

/** REST 首屏时尚未收到 WS 时，根据模式推断本轮预计首位发言者（与后端 _expected_speaker_for_round 一致） */
function inferExpectedSpeaker(
  session: RoundtableSession,
  participants: RoundtableParticipant[],
): string | null {
  const active = participants.filter(p => p.role !== 'observer');
  if (!active.length) return null;
  const mode = session.speaking_mode;
  if (mode === 'moderator') {
    const mod = active.find(p => p.role === 'moderator');
    return (mod || active[0]).display_name || null;
  }
  if (mode === 'ordered') {
    const sorted = [...active].sort(
      (a, b) => (a.speaking_order ?? 0) - (b.speaking_order ?? 0),
    );
    return sorted[0]?.display_name ?? null;
  }
  const fs = (session.first_speaker || '').trim();
  if (fs) {
    const m = active.find(p => p.display_name === fs);
    if (m) return m.display_name;
  }
  return active[0]?.display_name ?? null;
}

function mapApiMessages(data: RoundtableSession): RoundtableMessageData[] {
  if (!data.messages?.length) return [];
  return data.messages.map(
    (m): RoundtableMessageData => ({
      ...m,
      display_name: m.display_name || '',
      identity_kind: m.identity_kind || '',
      agent_id: m.agent_id ?? undefined,
      user_id: m.user_id ?? undefined,
    }),
  );
}

/** 最近一条非人类/系统消息的发言者（REST 无 WS「正在发言」时的弱兜底） */
function lastAgentSpeakName(messages: RoundtableMessageData[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.message_type === 'human' || m.message_type === 'system') continue;
    if (m.message_type === 'conclude') continue;
    if (m.display_name) return m.display_name;
  }
  return null;
}

function resolveActiveSpeakerAfterFetch(
  sessionId: string,
  data: RoundtableSession,
  mapped: RoundtableMessageData[],
): string | null {
  if (data.status !== 'active') return null;
  const prev = getRoundtableChannelCache(sessionId);
  if (prev?.activeSpeaker) return prev.activeSpeaker;
  const participants = data.participants || [];
  const visible = mapped.filter(m => m.message_type !== 'system');
  if (visible.length === 0) {
    return inferExpectedSpeaker(data, participants);
  }
  return lastAgentSpeakName(mapped) ?? inferExpectedSpeaker(data, participants);
}

export const ChannelChatPanel: React.FC<ChannelChatPanelProps> = ({ sessionId, onClose }) => {
  const [session, setSession] = useState<RoundtableSession | null>(
    () => getRoundtableChannelCache(sessionId)?.session ?? null,
  );
  const [messages, setMessages] = useState<RoundtableMessageData[]>(
    () => getRoundtableChannelCache(sessionId)?.messages ?? [],
  );
  const [loading, setLoading] = useState(
    () => !getRoundtableChannelCache(sessionId),
  );
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(
    () => getRoundtableChannelCache(sessionId)?.activeSpeaker ?? null,
  );
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);
  /** 用户未向上滚动脱离底部时，新消息自动锚定底部 */
  const stickToBottomRef = useRef(true);
  const prevMessageLenRef = useRef(0);

  const loadSession = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const data = await getRoundtable(sessionId);
      const mapped = mapApiMessages(data);
      const sp = resolveActiveSpeakerAfterFetch(sessionId, data, mapped);
      setSession(data);
      setMessages(mapped);
      setActiveSpeaker(sp);
      replaceRoundtableChannelCache(sessionId, data, mapped, sp);
    } catch {
      if (!silent) {
        /* 首次加载失败保留 loading 结束后的空态 */
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    const cached = !!getRoundtableChannelCache(sessionId);
    loadSession({ silent: cached });
  }, [loadSession, sessionId]);

  // 切换频道时重置滚动与「钉在底部」状态，避免沿用上一次的 ref 导致的错滚动/滚到顶
  useEffect(() => {
    initialScrollDone.current = false;
    prevMessageLenRef.current = 0;
    stickToBottomRef.current = true;
    setIsAtBottom(true);
    setNewMsgCount(0);
  }, [sessionId]);

  // 活跃频道定期同步完整消息（防止 WS 推送丢失）
  useEffect(() => {
    const isActive = session?.status === 'active';
    if (!isActive) return;
    const timer = setInterval(() => loadSession({ silent: true }), 8000);
    return () => clearInterval(timer);
  }, [session?.status, loadSession]);

  useEffect(() => {
    const onMsg = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.session_id !== sessionId) return;
      const msg = d.message as RoundtableMessageData;
      if (msg) {
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        if (msg.display_name) setActiveSpeaker(msg.display_name);
      }
    };
    const onStatus = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.session_id !== sessionId) return;

      if (d.active_speaker) {
        setActiveSpeaker(d.active_speaker);
      }

      if (d.status) {
        setSession(prev => {
          if (!prev) return prev;
          const patch: Partial<RoundtableSession> = {};
          patch.status = d.status;
          if (d.conclusion) patch.conclusion = d.conclusion;
          if (d.current_round != null) patch.current_round = d.current_round;
          if (d.max_rounds != null) patch.max_rounds = d.max_rounds;
          return { ...prev, ...patch };
        });
        if (d.status === 'concluded' || d.status === 'concluding') {
          setActiveSpeaker(null);
          if (d.status === 'concluded') loadSession({ silent: true });
        }
      }
    };
    window.addEventListener('roundtable-message', onMsg);
    window.addEventListener('roundtable-status', onStatus);
    return () => {
      window.removeEventListener('roundtable-message', onMsg);
      window.removeEventListener('roundtable-status', onStatus);
    };
  }, [sessionId, loadSession]);

  // 首屏仅依赖 loading + sessionId：避免消息从 0→1 时重复跑初始逻辑引发布局抖动
  useEffect(() => {
    if (loading || !scrollRef.current) return;
    if (initialScrollDone.current) return;
    initialScrollDone.current = true;
    prevMessageLenRef.current = messages.length;

    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      const el = scrollRef.current;
      const isFirstVisit = !visitedSessions.has(sessionId);
      const savedPos = savedScrollPositions.get(sessionId);

      if (isFirstVisit || savedPos === undefined) {
        visitedSessions.add(sessionId);
        el.scrollTop = el.scrollHeight;
      } else {
        el.scrollTop = savedPos;
      }
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      setIsAtBottom(atBottom);
      stickToBottomRef.current = atBottom;
    });
  }, [loading, sessionId]);

  // 新消息：仅在用户停留在底部时自动滚到底（瞬时 scrollTop，避免 smooth 与用户手动滚动冲突）
  useEffect(() => {
    if (!initialScrollDone.current || !scrollRef.current) return;
    const prev = prevMessageLenRef.current;
    if (messages.length < prev) {
      prevMessageLenRef.current = messages.length;
      return;
    }
    if (messages.length === prev) return;

    const delta = messages.length - prev;
    prevMessageLenRef.current = messages.length;

    if (stickToBottomRef.current) {
      requestAnimationFrame(() => {
        if (!scrollRef.current) return;
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      });
      setNewMsgCount(0);
    } else {
      setNewMsgCount(c => c + delta);
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (scrollRef.current) {
        savedScrollPositions.set(sessionId, scrollRef.current.scrollTop);
      }
    };
  }, [sessionId]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setIsAtBottom(atBottom);
    stickToBottomRef.current = atBottom;
    if (atBottom) setNewMsgCount(0);
  }, []);

  const scrollToBottom = useCallback(() => {
    setNewMsgCount(0);
    stickToBottomRef.current = true;
    setIsAtBottom(true);
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, []);

  const [pendingMessages, setPendingMessages] = useState<string[]>([]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setSending(true);
    try {
      await injectMessage(sessionId, text);
      setInput('');
      setPendingMessages(prev => [...prev, text]);
    } catch { /* ignore */ }
    setSending(false);
  };

  // 当频道收到新消息时，清除已匹配的 pending 条目
  const prevMsgCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current && pendingMessages.length > 0) {
      const newMsgs = messages.slice(prevMsgCountRef.current);
      const isHumanMsg = newMsgs.some(m => m.agent_id === 'human' || m.display_name === '用户');
      if (isHumanMsg) {
        setPendingMessages(prev => prev.slice(1));
      }
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length, pendingMessages.length]);


  const participants: RoundtableParticipant[] = useMemo(() => session?.participants || [], [session?.participants]);

  const agentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of participants) {
      if (p.agent_id && p.display_name) map.set(p.agent_id, p.display_name);
    }
    return map;
  }, [participants]);

  const resolveSpeaker = useCallback((msg: RoundtableMessageData): string => {
    if (msg.display_name) return msg.display_name;
    if (msg.agent_id && agentNameMap.has(msg.agent_id)) return agentNameMap.get(msg.agent_id)!;
    return '系统';
  }, [agentNameMap]);

  const participantIndex = useMemo(() => {
    const map = new Map<string, number>();
    participants.forEach((p, i) => {
      if (p.display_name) map.set(p.display_name, i);
      if (p.agent_id) map.set(p.agent_id, i);
    });
    return map;
  }, [participants]);

  const isActive = session?.status === 'active';
  const isConcluded = session?.status === 'concluded';
  const isConcluding = (session?.status as string) === 'concluding';
  const roundInfo = session
    ? `第${session.current_round}/${session.max_rounds || '∞'}轮`
    : '';

  if (loading) {
    return (
      <div data-testid="channel-chat-panel-loading" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <div className="animate-spin" style={{ width: 18, height: 18, border: '2px solid var(--text-muted)', borderTopColor: 'transparent', borderRadius: '50%' }} />
      </div>
    );
  }

  if (!session) {
    return (
      <div data-testid="channel-chat-panel-empty" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        圆桌不存在
      </div>
    );
  }

  const visibleMessages = messages.filter(m => m.message_type !== 'system');

  const expectedSpeakerHint =
    activeSpeaker ||
    (isActive && visibleMessages.length === 0 ? inferExpectedSpeaker(session, participants) : null);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }} data-testid="channel-chat-panel">
      {/* ── Header：固定单态，避免滚动切换 Hero/Compact 导致列表高度剧变与闪屏 ── */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid var(--ch-header-border)' }} data-testid="channel-chat-panel-header">
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '12px 20px 0',
          gap: 6,
        }}>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={onClose} data-testid="channel-chat-panel-close" style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            color: 'var(--text-muted)', display: 'flex', borderRadius: 6,
          }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div style={{ padding: '6px 20px 14px' }}>
          <h2 style={{
            fontSize: 20, fontWeight: 700, color: 'var(--ch-hero-title)',
            margin: '0 0 4px', lineHeight: 1.3,
          }}>
            {session.display_name}
          </h2>
          <p style={{
            fontSize: 12.5, color: 'var(--ch-hero-subtitle)',
            margin: '0 0 10px', lineHeight: 1.5,
          }}>
            {session.topic || `${MODE_LABELS[session.speaking_mode]} · ${roundInfo}`}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex' }}>
              {participants.slice(0, 4).map((p, i) => (
                <div key={p.id} title={`${p.display_name}${p.perspective ? ' — ' + p.perspective : ''}`}
                  style={{ marginLeft: i > 0 ? -8 : 0, zIndex: 4 - i }}>
                  <Avatar name={p.display_name || '?'} size={26} index={i} />
                </div>
              ))}
            </div>
            <span style={{ fontSize: 12, color: 'var(--ch-hero-subtitle)' }}>
              {participants.length}人 · {roundInfo}
            </span>
          </div>
        </div>
      </div>

      {/* ── Messages ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        data-testid="channel-chat-panel-messages"
        className="ch-panel-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          padding: '12px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
      >
        {visibleMessages.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '48px 0', opacity: 0.65 }}>
            {isActive ? (
              expectedSpeakerHint ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-flex', gap: 2 }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor', animation: 'ch-typing 1.2s infinite', animationDelay: '0s' }} />
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor', animation: 'ch-typing 1.2s infinite', animationDelay: '0.2s' }} />
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor', animation: 'ch-typing 1.2s infinite', animationDelay: '0.4s' }} />
                  </span>
                  <strong style={{ color: 'var(--ch-msg-name)' }}>{expectedSpeakerHint}</strong>
                  正在组织发言…
                </span>
              ) : '正在同步圆桌状态…'
            ) : '暂无消息'}
          </div>
        ) : (
          visibleMessages.map((msg, idx) => {
            const isHuman = msg.message_type === 'human';
            const isConclude = msg.message_type === 'conclude';
            const speaker = resolveSpeaker(msg);
            const speakerIdx = participantIndex.get(speaker) ?? participantIndex.get(msg.agent_id || '') ?? 0;

            if (isConclude) {
              return (
                <div key={msg.id} style={{ padding: '16px 0 8px' }}>
                  <div className="channel-chat-conclusion" style={{
                    padding: '12px 14px', borderRadius: 12,
                    background: 'var(--ch-conclusion-bg)',
                    border: '1px solid var(--ch-conclusion-border)',
                  }} data-testid={`channel-chat-conclusion-${msg.id}`}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ch-hero-title)', marginBottom: 6, opacity: 0.7 }}>
                      讨论结论
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ch-msg-text)', lineHeight: 1.65 }}>
                      <MarkdownContent content={msg.content} />
                    </div>
                  </div>
                </div>
              );
            }

            const prevSpeaker = idx > 0 ? resolveSpeaker(visibleMessages[idx - 1]) : '';
            const isGrouped = idx > 0
              && prevSpeaker === speaker
              && prevSpeaker !== '系统'
              && !isHuman
              && visibleMessages[idx - 1].message_type !== 'conclude';

            const isNewSpeaker = idx > 0 && !isGrouped && visibleMessages[idx - 1].message_type !== 'conclude';

            return (
              <div key={msg.id}>
                {isNewSpeaker && (
                  <div style={{ height: 1, background: 'var(--ch-divider)', margin: '12px 0' }} />
                )}
                {isHuman ? (
                  <div className="ch-msg" style={{
                    display: 'flex', flexDirection: 'row-reverse',
                    alignItems: 'flex-start', gap: 10, padding: '8px 0',
                    background: 'var(--ch-user-msg-bg)',
                    borderRadius: 12, marginLeft: -6, marginRight: -6,
                    paddingLeft: 12, paddingRight: 12,
                  }}>
                    <Avatar name="你" size={32} index={5} />
                    <div style={{ maxWidth: '80%', minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, lineHeight: 1.6,
                        background: 'var(--ch-msg-bg-human)',
                        border: '1px solid var(--ch-msg-border-human)',
                        borderRadius: '14px 4px 14px 14px',
                        padding: '8px 12px',
                        color: 'var(--ch-hero-title)',
                      }}>
                        <MarkdownContent content={msg.content} />
                      </div>
                      {msg.created_at && (
                        <div style={{
                          fontSize: 10, color: 'var(--ch-msg-time)', marginTop: 3,
                          opacity: 0.5, textAlign: 'right',
                        }}>
                          {new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    className="channel-chat-message ch-msg"
                    data-testid={`channel-chat-message-${msg.id}`}
                    style={{
                      display: 'flex', alignItems: 'flex-start',
                      gap: 10,
                      padding: isGrouped ? '1px 0 2px 42px' : '8px 0',
                    }}
                  >
                    {!isGrouped && <Avatar name={speaker} size={32} index={speakerIdx} />}
                    <div style={{ maxWidth: '80%', minWidth: 0, flex: 1 }}>
                      {!isGrouped && (
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                          <span style={{
                            fontSize: 13, fontWeight: 700,
                            color: 'var(--ch-msg-name)',
                          }}>
                            {speaker}
                          </span>
                          {msg.created_at && (
                            <span style={{ fontSize: 11, color: 'var(--ch-msg-time)' }}>
                              {new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      )}
                      <div style={{
                        fontSize: 13, lineHeight: 1.65,
                        color: 'var(--ch-msg-text)',
                        whiteSpace: 'pre-wrap',
                      }}>
                        <MarkdownContent content={msg.content} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Conclusion card from session */}
        {isConcluded && session.conclusion && !visibleMessages.some(m => m.message_type === 'conclude') && (
          <div style={{ padding: '16px 0 8px' }}>
            <div style={{
              padding: '12px 14px', borderRadius: 12,
              background: 'var(--ch-conclusion-bg)',
              border: '1px solid var(--ch-conclusion-border)',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ch-hero-title)', marginBottom: 6, opacity: 0.7 }}>
                讨论结论
              </div>
              <div style={{ fontSize: 13, color: 'var(--ch-msg-text)', lineHeight: 1.65 }}>
                <MarkdownContent content={session.conclusion} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── New messages pill ── */}
      {newMsgCount > 0 && !isAtBottom && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0', flexShrink: 0 }}>
          <button
            onClick={scrollToBottom}
            data-testid="channel-chat-new-messages"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 14px', borderRadius: 16,
              background: 'var(--ch-send-bg)',
              color: 'var(--ch-send-icon)',
              border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 500,
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 14 }}>↓</span>
            {newMsgCount} 条新消息
          </button>
        </div>
      )}

      {/* ── Typing / Status indicator ── */}
      {isActive && activeSpeaker && (
        <div style={{
          padding: '4px 22px 2px', fontSize: 11, color: 'var(--ch-msg-time)',
          display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
        }}>
          <span style={{ display: 'inline-flex', gap: 2, marginRight: 2 }}>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ch-msg-time)', animation: 'ch-typing 1.2s infinite', animationDelay: '0s' }} />
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ch-msg-time)', animation: 'ch-typing 1.2s infinite', animationDelay: '0.2s' }} />
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ch-msg-time)', animation: 'ch-typing 1.2s infinite', animationDelay: '0.4s' }} />
          </span>
          {activeSpeaker} 正在发言...
        </div>
      )}
      {isConcluding && (
        <div style={{
          padding: '6px 22px 4px', fontSize: 11, color: 'var(--ch-msg-time)',
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        }}>
          <span style={{
            width: 14, height: 14, borderRadius: '50%',
            border: '2px solid var(--ch-msg-time)',
            borderTopColor: 'transparent',
            animation: 'ch-spin 0.8s linear infinite',
            flexShrink: 0,
          }} />
          讨论已结束，正在总结中…
        </div>
      )}

      {/* ── 待插入消息队列 ── */}
      {pendingMessages.length > 0 && (
        <div style={{ padding: '0 16px 4px', flexShrink: 0 }} data-testid="channel-chat-pending-list">
          <div style={{
            fontSize: 11, color: 'var(--ch-msg-time)', opacity: 0.7,
            marginBottom: 4, paddingLeft: 2,
          }}>
            等待当前发言结束后插入 ({pendingMessages.length} 条)
          </div>
          {pendingMessages.map((msg, i) => (
            <div className="channel-chat-pending" key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 10px', marginBottom: 3, borderRadius: 10,
              background: 'var(--ch-bar-bg, rgba(139,92,246,0.06))',
              border: '1px solid var(--ch-bar-border, rgba(139,92,246,0.12))',
            }} data-testid={`channel-chat-pending-${i}`}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'rgb(139,92,246)',
                animation: 'ch-typing 1.5s infinite',
                flexShrink: 0,
              }} />
              <span style={{
                flex: 1, fontSize: 12, color: 'var(--ch-hero-title)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {msg}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Capsule Input Bar ── */}
      {isActive && (
        <div style={{ padding: '4px 16px 12px', flexShrink: 0 }} data-testid="channel-chat-input-shell">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'transparent',
            border: '1px solid var(--ch-input-pill-border)',
            borderRadius: 20,
            padding: '5px 5px 5px 14px',
            transition: 'border-color 0.2s',
          }}>
            <span style={{ color: 'var(--ch-msg-time)', fontSize: 16, flexShrink: 0 }}>@</span>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="插入发言…"
              disabled={sending}
              data-testid="channel-chat-input"
              style={{
                flex: 1, border: 'none', outline: 'none',
                fontSize: 13, color: 'var(--ch-hero-title)',
                background: 'transparent',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              data-testid="channel-chat-send"
              style={{
                width: 30, height: 30, borderRadius: 15,
                background: input.trim() ? 'var(--ch-send-bg)' : 'transparent',
                border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: input.trim() ? 'pointer' : 'default',
                flexShrink: 0,
                transition: 'all 0.15s',
                opacity: input.trim() ? 1 : 0.3,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={input.trim() ? 'var(--ch-send-icon)' : 'var(--ch-msg-time)'}
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Concluded footer ── */}
      {isConcluded && (
        <div style={{
          padding: '10px 22px 16px', flexShrink: 0, textAlign: 'center',
          fontSize: 12, color: 'var(--ch-msg-time)', opacity: 0.6,
        }}>
          讨论已结束
        </div>
      )}
    </div>
  );
};

