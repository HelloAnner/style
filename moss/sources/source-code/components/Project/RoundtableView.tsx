/**
 * RoundtableView — 圆桌频道面板（类 Slack 群聊视图）
 *
 * 通过 WebSocket 实时接收消息，支持人类输入和@选择器。
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { MarkdownContent } from '../Chat/MarkdownContent';
import { parseAvatarUrl, getAvatarById } from '../../types/platform';
import type { RoundtableMessageData } from '../../types';
import {
  getRoundtable,
  injectMessage,
  concludeRoundtable,
  type RoundtableSession,
} from '../../api/roundtable';
import { toast } from '../../utils/toast';

const MODE_LABELS: Record<string, string> = {
  moderator: '主持人控场',
  ordered: '轮序发言',
  free: '自由讨论',
};

interface RoundtableViewProps {
  sessionId: string;
  onClose?: () => void;
}

function ParticipantAvatar({ name, kind, avatarUrl, size = 28 }: {
  name: string; kind: string; avatarUrl?: string | null; size?: number;
}) {
  if (kind === 'main' && avatarUrl) {
    const parsed = parseAvatarUrl(avatarUrl);
    if (parsed) {
      const avatar = getAvatarById(parsed.avatarId);
      if (avatar) {
        return (
          <div
            style={{
              width: size, height: size, borderRadius: '50%',
              background: avatar.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: size * 0.38, fontWeight: 600, color: '#fff', flexShrink: 0,
            }}
          >
            {name.charAt(0)}
          </div>
        );
      }
    }
  }

  const colors = [
    'linear-gradient(135deg, #667eea, #764ba2)',
    'linear-gradient(135deg, #f093fb, #f5576c)',
    'linear-gradient(135deg, #4facfe, #00f2fe)',
    'linear-gradient(135deg, #43e97b, #38f9d7)',
    'linear-gradient(135deg, #fa709a, #fee140)',
    'linear-gradient(135deg, #a18cd1, #fbc2eb)',
  ];
  const idx = name.charCodeAt(0) % colors.length;

  return (
    <div
      style={{
        width: size, height: size,
        borderRadius: kind === 'subagent' ? 6 : '50%',
        background: colors[idx],
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.38, fontWeight: 600, color: '#fff', flexShrink: 0,
      }}
    >
      {name.charAt(0)}
    </div>
  );
}

const KIND_LABELS: Record<string, string> = {
  main: '主 Agent',
  subagent: '子代理',
  temp: '临时',
  derived: '派生',
};

export const RoundtableView: React.FC<RoundtableViewProps> = ({ sessionId, onClose }) => {
  const [session, setSession] = useState<RoundtableSession | null>(null);
  const [messages, setMessages] = useState<RoundtableMessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [mentionTarget, setMentionTarget] = useState('');
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [queuedMessages, setQueuedMessages] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadSession = useCallback(async () => {
    try {
      const data = await getRoundtable(sessionId);
      setSession(data);
      if (data.messages) {
        setMessages(data.messages.map((m: any) => ({
          ...m,
          display_name: m.display_name || '',
          identity_kind: m.identity_kind || '',
        })));
      }
    } catch (e) {
      console.error('加载频道失败:', e);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    const handleMessage = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.session_id !== sessionId) return;
      const msg = detail.message as RoundtableMessageData;
      if (msg) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    const handleStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.session_id !== sessionId) return;
      setSession(prev => prev ? { ...prev, status: detail.status, conclusion: detail.conclusion || prev.conclusion } : prev);
    };

    const handleHumanQueued = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.session_id !== sessionId) return;
      setQueuedMessages(prev => new Set([...prev, detail.content]));
    };

    const handleHumanSent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.session_id !== sessionId) return;
      setQueuedMessages(prev => {
        const next = new Set(prev);
        next.delete(detail.message_id);
        return next;
      });
    };

    window.addEventListener('roundtable-message', handleMessage);
    window.addEventListener('roundtable-status', handleStatus);
    window.addEventListener('roundtable-human-queued', handleHumanQueued);
    window.addEventListener('roundtable-human-sent', handleHumanSent);
    return () => {
      window.removeEventListener('roundtable-message', handleMessage);
      window.removeEventListener('roundtable-status', handleStatus);
      window.removeEventListener('roundtable-human-queued', handleHumanQueued);
      window.removeEventListener('roundtable-human-sent', handleHumanSent);
    };
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleInject = async () => {
    if (!input.trim() || sending) return;
    const content = mentionTarget ? `@${mentionTarget} ${input.trim()}` : input.trim();
    setSending(true);
    try {
      await injectMessage(sessionId, content);
      setInput('');
      setMentionTarget('');
    } catch (e: any) {
      toast.error(e.message || '发送失败');
    }
    setSending(false);
  };

  const handleConclude = async () => {
    try {
      await concludeRoundtable(sessionId);
      await loadSession();
    } catch (e: any) {
      toast.error(e.message || '结束失败');
    }
  };

  const participants = useMemo(() => session?.participants || [], [session?.participants]);
  const isActive = session?.status === 'active';
  const isConcluded = session?.status === 'concluded';
  const isFreeMode = session?.speaking_mode === 'free';

  const groupedMessages = useMemo(() => {
    const groups: { round: number; msgs: RoundtableMessageData[] }[] = [];
    let currentRound = -1;
    for (const m of messages) {
      if (m.round_num !== currentRound) {
        currentRound = m.round_num;
        groups.push({ round: currentRound, msgs: [] });
      }
      groups[groups.length - 1]?.msgs.push(m);
    }
    return groups;
  }, [messages]);

  if (loading) {
    return (
      <div data-testid="roundtable-view-loading" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-muted)', fontSize: 12 }}>
        加载中...
      </div>
    );
  }

  if (!session) {
    return (
      <div data-testid="roundtable-view-empty" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-muted)', fontSize: 12 }}>
        频道不存在
      </div>
    );
  }

  return (
    <div data-testid="roundtable-view" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div data-testid="roundtable-view-header" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {session.display_name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 4,
                background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
              }}>
                {MODE_LABELS[session.speaking_mode] || session.speaking_mode}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                第 {session.current_round} / {session.max_rounds || '∞'} 轮
              </span>
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 4,
                background: isActive ? 'rgba(245, 158, 11, 0.1)' : isConcluded ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: isActive ? 'rgb(245, 158, 11)' : isConcluded ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)',
              }}>
                {isActive ? '进行中' : isConcluded ? '已结束' : session.status}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {isActive && (
              <button
                data-testid="roundtable-view-conclude"
                onClick={handleConclude}
                style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 6,
                  background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.2)', cursor: 'pointer',
                }}
              >
                结束频道
              </button>
            )}
            {onClose && (
              <button
                data-testid="roundtable-view-close"
                onClick={onClose}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 16, lineHeight: 1, padding: 4,
                }}
              >×</button>
            )}
          </div>
        </div>

        {/* Topic */}
        {session.topic && (
          <div data-testid="roundtable-view-topic" style={{
            marginTop: 8, padding: '6px 10px', borderRadius: 6,
            background: 'var(--bg-secondary)', fontSize: 12,
            color: 'var(--text-secondary)', lineHeight: 1.5,
          }}>
            {session.topic}
          </div>
        )}

        {/* Participants */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }} data-testid="roundtable-view-participants">
          {participants.map((p: any) => (
            <div key={p.id} className="roundtable-view-participant" data-testid={`roundtable-view-participant-${p.id}`} title={p.perspective || p.display_name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ParticipantAvatar
                name={p.display_name || p.agent_id?.slice(0, 8) || '?'}
                kind={p.identity_kind || 'temp'}
                avatarUrl={p.avatar_url}
                size={22}
              />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {p.display_name || p.agent_id?.slice(0, 8)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div data-testid="roundtable-view-messages" style={{
        flex: 1, overflow: 'auto', padding: '12px 16px',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {messages.length === 0 ? (
          <div data-testid="roundtable-view-no-messages" style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 30 }}>
            {isActive ? '讨论即将开始...' : '暂无消息'}
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.round} className="roundtable-view-round-group" data-testid={`roundtable-view-round-${group.round}`}>
              {/* Round divider */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 0', marginTop: group.round > 1 ? 8 : 0,
              }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  第 {group.round} 轮
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
              </div>

              {group.msgs.map((msg) => {
                const isHuman = msg.message_type === 'human';
                const isSystem = msg.message_type === 'system' || msg.message_type === 'conclude';
                const speaker = msg.display_name || msg.agent_id?.slice(0, 8) || msg.user_id?.slice(0, 8) || '系统';
                const kind = msg.identity_kind || '';

                if (isSystem) {
                  return (
                    <div key={msg.id} data-testid={`roundtable-view-system-message-${msg.id}`} style={{
                      textAlign: 'center', padding: '4px 0',
                      fontSize: 11, color: 'var(--text-muted)',
                    }}>
                      {msg.content}
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="roundtable-view-message" data-testid={`roundtable-view-message-${msg.id}`} style={{
                    display: 'flex', gap: 8, padding: '6px 0',
                    animation: 'roundtable-fadein 0.3s ease',
                  }}>
                    <ParticipantAvatar
                      name={isHuman ? '用户' : speaker}
                      kind={isHuman ? 'human' : kind}
                      size={28}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{
                          fontSize: 12, fontWeight: 600,
                          color: isHuman ? 'rgb(245, 158, 11)' : 'var(--text-primary)',
                        }}>
                          {isHuman ? '用户' : speaker}
                        </span>
                        {kind && !isHuman && (
                          <span style={{
                            fontSize: 9, padding: '0 4px', borderRadius: 3,
                            background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                          }}>
                            {KIND_LABELS[kind] || kind}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        <MarkdownContent content={msg.content} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}

        {/* Queued human messages */}
        {queuedMessages.size > 0 && (
          <div style={{ padding: '4px 0' }} data-testid="roundtable-view-queued-messages">
            {[...queuedMessages].map((content, i) => (
              <div key={i} className="roundtable-view-queued-message" data-testid={`roundtable-view-queued-message-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 8px', borderRadius: 6,
                background: 'rgba(245, 158, 11, 0.05)',
                border: '1px solid rgba(245, 158, 11, 0.15)',
                fontSize: 12, color: 'var(--text-muted)',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
                <span>排队中: {content.slice(0, 50)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Conclusion */}
        {isConcluded && session.conclusion && (
          <div data-testid="roundtable-view-conclusion" style={{
            padding: '12px 14px', borderRadius: 10,
            background: 'rgba(59, 130, 246, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.15)',
            marginTop: 8,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#3b82f6', marginBottom: 6 }}>
              讨论结论
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              <MarkdownContent content={session.conclusion} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {isActive && (
        <div data-testid="roundtable-view-input-panel" style={{
          padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0,
        }}>
          {/* @ mention picker for free mode */}
          {isFreeMode && showMentionPicker && (
            <div style={{
              marginBottom: 6, display: 'flex', gap: 4, flexWrap: 'wrap',
            }} data-testid="roundtable-view-mention-picker">
              {participants.map((p: any) => (
                <button
                  key={p.id}
                  data-testid={`roundtable-view-mention-option-${p.id}`}
                  onClick={() => {
                    setMentionTarget(p.display_name || p.agent_id?.slice(0, 8));
                    setShowMentionPicker(false);
                    inputRef.current?.focus();
                  }}
                  style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 6,
                    background: mentionTarget === (p.display_name || p.agent_id?.slice(0, 8))
                      ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)', cursor: 'pointer',
                  }}
                >
                  @{p.display_name || p.agent_id?.slice(0, 8)}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isFreeMode && (
              <button
                data-testid="roundtable-view-mention-toggle"
                onClick={() => setShowMentionPicker(!showMentionPicker)}
                style={{
                  padding: '6px 8px', borderRadius: 6, fontSize: 13,
                  background: mentionTarget ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-tertiary)',
                  color: mentionTarget ? '#3b82f6' : 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)', cursor: 'pointer',
                  flexShrink: 0,
                }}
                title="选择@对象"
              >
                {mentionTarget ? `@${mentionTarget}` : '@'}
              </button>
            )}
            <input
              ref={inputRef}
              data-testid="roundtable-view-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleInject();
                }
              }}
              placeholder={isFreeMode ? '输入消息（自由模式需先@选择对象）...' : '输入消息参与讨论...'}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 13,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)', outline: 'none',
              }}
              disabled={sending}
            />
            <button
              data-testid="roundtable-view-send"
              onClick={handleInject}
              disabled={!input.trim() || sending || (isFreeMode && !mentionTarget)}
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 12,
                background: (input.trim() && (!isFreeMode || mentionTarget)) ? 'var(--text-primary)' : 'var(--bg-tertiary)',
                color: (input.trim() && (!isFreeMode || mentionTarget)) ? 'var(--bg-primary)' : 'var(--text-muted)',
                border: 'none',
                cursor: (input.trim() && (!isFreeMode || mentionTarget)) ? 'pointer' : 'default',
                flexShrink: 0,
              }}
            >
              发送
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes roundtable-fadein {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default RoundtableView;
