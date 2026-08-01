/**
 * 消息列表组件
 * 
 * 【滚动策略】
 * - 用户发消息 → 该消息滚到视口顶部（仅当滚动条已存在时）
 * - 流式输出 → 不跟随，内容自然向下生长
 * - 内容超出可视范围 → 出现「滑到底部」按钮
 * - 会话加载/切换 → 滚到底部
 * - 底部空白占位区动态计算，使用户最新消息恰好能滚至视口顶部
 *   且用户手动下滑到极限时，该消息仍处于视口顶部（不会更低）
 *
 * 【性能优化 v3】
 * - 移除全列表 AnimatePresence，仅对最新 2 条消息做入场动画
 * - 历史消息直接渲染静态 div，避免 framer-motion 开销
 * - 滚动监听使用 rAF 节流
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from '../../lib/motion';
import { MessageBubble } from './MessageBubble';
import { AgentMessage } from './AgentMessage';
import { RoundtableCard } from './RoundtableCard';
import { PlanModeIndicator } from './PlanModeIndicator';
import type { AnswerSource, ChatMessage, FollowUpQuestionItem, FollowUpQuestionsData } from '../../types';
import type { SessionRuntimeStore } from '../../stores/sessionRuntimeStore';
import type { ChatAgentDisplay } from './chatDisplayContext';
import type { ChatMessageVM } from '../../conversation/model/viewTypes';

const ScrollDownIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path 
      d="M6 9l6 6 6-6" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

const ANIMATE_LAST_N = 2;
const BOTTOM_THRESHOLD = 100;

// 用户消息置顶时，顶部留白（px）
const USER_MSG_TOP_OFFSET = 30;

interface MessageListProps {
  messages: ChatMessage[];
  runtimeStore?: SessionRuntimeStore;
  runtimeMessages?: ChatMessageVM[];
  agentDisplay?: ChatAgentDisplay;
  sessionIdOverride?: string | null;
  onQuestionSubmit?: (answers: Record<string, string | string[]>, questionData?: import('../../types').QuestionData) => boolean | void | Promise<boolean | void>;
  onPlanApprove?: () => void;
  onPlanFeedback?: (feedback: string) => void;
  onOpenRoundtablePanel?: (sessionId: string) => void;
  /** 技能编辑助手 tool_use_pending 卡片决议回调 */
  onToolApproval?: (requestId: string, decision: { approved: boolean | 'refine'; refine_comment?: string }) => void;
  /** 查看 skill 详情（打开 SkillStudio preview 模式） */
  onViewSkillDetail?: (payload: import('../../types').ToolUsePendingPayload) => void;
  /** 重试（重新生成回答） */
  onRetry?: (messageId: string) => void;
  retryDisabled?: boolean;
  retryDisabledTitle?: string;
  onSourcesOpen?: (message: ChatMessage, sources: AnswerSource[]) => void;
  onFollowUpSelect?: (message: ChatMessage, item: FollowUpQuestionItem, followUpQuestions?: FollowUpQuestionsData) => void;
  /** 渲染在某条 assistant message 正文下方的交互卡片。 */
  messageTrailingContent?: (message: ChatMessage, runtimeMessage?: ChatMessageVM) => React.ReactNode;
  /** 渲染在消息流底部的会话级交互卡片,会占据滚动空间,避免遮挡正文。 */
  trailingContent?: React.ReactNode;
  /** 外部底部区域展开时,让最新消息持续贴住底部,形成整体上移的感觉。 */
  stickToBottomSignal?: number;
  stickToBottomDurationMs?: number;
  onHeaderGlassActiveChange?: (active: boolean) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  runtimeStore,
  runtimeMessages,
  agentDisplay,
  sessionIdOverride,
  onQuestionSubmit,
  onPlanApprove,
  onPlanFeedback,
  onOpenRoundtablePanel,
  onToolApproval,
  onViewSkillDetail,
  onRetry,
  retryDisabled = false,
  retryDisabledTitle,
  onSourcesOpen,
  onFollowUpSelect,
  messageTrailingContent,
  trailingContent,
  stickToBottomSignal = 0,
  stickToBottomDurationMs = 500,
  onHeaderGlassActiveChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement | null>(null);
  const lastUserMsgRef = useRef<HTMLDivElement | null>(null);
  const prevMessageCountRef = useRef(0);
  const lastSeenUserMessageIdRef = useRef<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const isPinnedToBottomRef = useRef(true);
  const programmaticScrollRef = useRef(false);
  const rafIdRef = useRef<number>(0);
  const [spacerHeight, setSpacerHeight] = useState(0);
  const spacerRef = useRef<HTMLDivElement>(null);
  const headerGlassActiveRef = useRef(false);
  const lastAssistantMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id;
    }
    return null;
  }, [messages]);
  const lastUserMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i].id;
    }
    return null;
  }, [messages]);
  const firstMessageId = messages[0]?.id ?? null;
  const lastMessageId = messages[messages.length - 1]?.id ?? null;
  const hasRunningAssistant = useMemo(() => {
    const runtimeRunning = (runtimeMessages ?? []).some((runtimeMessage) => (
      runtimeMessage.assistant.isStreaming ||
      runtimeMessage.assistant.phase === 'running' ||
      runtimeMessage.assistant.phase === 'execution_terminal_waiting_job'
    ));
    if (runtimeRunning) return true;
    return messages.some((message) => (
      message.role === 'assistant' &&
      (
        message.isStreaming === true ||
        message.status === 'running' ||
        message.status === 'cancelling'
      )
    ));
  }, [messages, runtimeMessages]);

  // ── 动态计算空白占位区高度（归零测量法）──
  // 1. 用 getBoundingClientRect 精确获取用户消息在滚动内容中的绝对位置
  // 2. 将 spacer 归零后测量 base scrollHeight，算出真正缺多少 → 补上
  // 这样不受 padding / space-y-4 gap / offsetParent 任何影响
  const recalcSpacer = useCallback(() => {
    const container = containerRef.current;
    const userMsg = lastUserMsgRef.current;
    const spacer = spacerRef.current;
    if (!container || !spacer) return;

    if (hasRunningAssistant) {
      spacer.style.height = '0px';
      setSpacerHeight(0);
      return;
    }

    if (!userMsg) return;

    const savedST = container.scrollTop;
    const cRect = container.getBoundingClientRect();
    const uRect = userMsg.getBoundingClientRect();
    const msgScrollPos = savedST + (uRect.top - cRect.top);
    const desiredMaxST = Math.max(0, msgScrollPos - USER_MSG_TOP_OFFSET);

    spacer.style.height = '0px';
    const baseScrollH = container.scrollHeight;

    // h = desiredMaxST + clientHeight - baseScrollH
    // 无论内容是否已溢出视口，该公式都能精确补齐所需空间
    const h = Math.max(0, desiredMaxST + container.clientHeight - baseScrollH);
    spacer.style.height = `${h}px`;
    container.scrollTop = savedST;
    setSpacerHeight(h);
  }, [hasRunningAssistant]);

  // 仅在视口尺寸变化时重算（窗口缩放等）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => recalcSpacer());
    ro.observe(container);
    return () => ro.disconnect();
  }, [recalcSpacer]);
  
  // 以 bottomRef 为锚点判断是否在「逻辑底部」（忽略空白占位区）
  const checkIfAtBottom = useCallback(() => {
    const container = containerRef.current;
    const anchor = bottomRef.current;
    if (!container || !anchor) return true;
    const anchorBottom = anchor.offsetTop + anchor.offsetHeight;
    const viewportBottom = container.scrollTop + container.clientHeight;
    return viewportBottom >= anchorBottom - BOTTOM_THRESHOLD;
  }, []);

  const hasScrollbar = useCallback(() => {
    const c = containerRef.current;
    return c ? c.scrollHeight > c.clientHeight : false;
  }, []);
  
  // 滚到真实底部：包含 bottom padding 和动态 spacer，避免初始状态还能继续向下滑。
  const scrollToBottom = useCallback((smooth = true) => {
    const container = containerRef.current;
    if (!container) return;

    programmaticScrollRef.current = true;
    isPinnedToBottomRef.current = true;
    setIsAtBottom(true);

    const targetTop = Math.max(0, container.scrollHeight - container.clientHeight);
    if (smooth) {
      container.scrollTo({ top: targetTop, behavior: 'smooth' });
      window.setTimeout(() => {
        programmaticScrollRef.current = false;
      }, 350);
      return;
    }

    container.scrollTop = targetTop;
    if (!smooth) {
      requestAnimationFrame(() => {
        programmaticScrollRef.current = false;
      });
    }
  }, []);

  // 将元素滚到视口顶部，留出 USER_MSG_TOP_OFFSET 的间距
  // 使用 getBoundingClientRect 保证与 recalcSpacer 计算公式完全一致
  const scrollElementToTop = useCallback((el: HTMLElement) => {
    const container = containerRef.current;
    if (!container) return;
    programmaticScrollRef.current = true;

    const cRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const targetTop = Math.max(0, container.scrollTop + (elRect.top - cRect.top) - USER_MSG_TOP_OFFSET);

    const current = container.scrollTop;
    const distance = targetTop - current;
    if (Math.abs(distance) < 2) {
      programmaticScrollRef.current = false;
      return;
    }
    const duration = Math.min(300, Math.max(100, Math.abs(distance) * 0.5));
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      container.scrollTop = current + distance * ease;
      if (t < 1) {
        requestAnimationFrame(step);
        return;
      }
      programmaticScrollRef.current = false;
    };
    requestAnimationFrame(step);
  }, []);
  
  // ── 滚动事件监听 ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const syncHeaderGlass = () => {
      const nextActive = container.scrollTop > 4;
      if (headerGlassActiveRef.current === nextActive) return;
      headerGlassActiveRef.current = nextActive;
      onHeaderGlassActiveChange?.(nextActive);
    };
    syncHeaderGlass();
    
    const handleScroll = () => {
      syncHeaderGlass();
      if (programmaticScrollRef.current) return;
      if (rafIdRef.current) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = 0;
        const atBottom = checkIfAtBottom();
        isPinnedToBottomRef.current = atBottom;
        setIsAtBottom(atBottom);
        if (atBottom) {
          programmaticScrollRef.current = false;
        }
      });
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [checkIfAtBottom, onHeaderGlassActiveChange]);

  useEffect(() => () => {
    onHeaderGlassActiveChange?.(false);
  }, [onHeaderGlassActiveChange]);

  // ── 消息数量变化时的滚动 ──
  useEffect(() => {
    if (messages.length <= prevMessageCountRef.current) {
      prevMessageCountRef.current = messages.length;
      lastSeenUserMessageIdRef.current = lastUserMessageId;
      return;
    }
    
    const delta = messages.length - prevMessageCountRef.current;
    const wasBulkLoad = prevMessageCountRef.current === 0 || delta > 2;
    const previousLastUserMessageId = lastSeenUserMessageIdRef.current;
    prevMessageCountRef.current = messages.length;
    lastSeenUserMessageIdRef.current = lastUserMessageId;
    if (messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    const isQuestionnaire = lastMessage.questionData && lastMessage.role === 'assistant';
    
    if (wasBulkLoad) {
      scrollToBottom(false);
      return;
    }
    
    if (isQuestionnaire) {
      requestAnimationFrame(() => {
        lastMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }

    if (!hasRunningAssistant && lastUserMessageId && lastUserMessageId !== previousLastUserMessageId) {
      requestAnimationFrame(() => {
        recalcSpacer();
        requestAnimationFrame(() => {
          if (hasScrollbar() && lastUserMsgRef.current) {
            scrollElementToTop(lastUserMsgRef.current);
          }
        });
      });
    }
  }, [messages.length, lastUserMessageId, scrollToBottom, scrollElementToTop, hasScrollbar, recalcSpacer, hasRunningAssistant]);

  // ── 会话加载/切换后校准到底部 ──
  // 首屏内容、Markdown 表格和动态 spacer 可能分多帧完成布局，需要在布局稳定后再补一次真实底部定位。
  useEffect(() => {
    if (messages.length === 0) return undefined;

    let rafId = 0;
    const timeoutIds: number[] = [];

    const pinToBottom = () => {
      recalcSpacer();
      scrollToBottom(false);
    };

    pinToBottom();
    rafId = requestAnimationFrame(() => {
      pinToBottom();
      rafId = requestAnimationFrame(pinToBottom);
    });
    timeoutIds.push(window.setTimeout(pinToBottom, 80));
    timeoutIds.push(window.setTimeout(pinToBottom, 240));

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      timeoutIds.forEach(window.clearTimeout);
    };
  }, [
    sessionIdOverride,
    messages.length,
    firstMessageId,
    lastMessageId,
    hasRunningAssistant,
    recalcSpacer,
    scrollToBottom,
  ]);
  
  // ── 流式输出：在底部时自动跟随，用户向上滚动后停止跟随 ──
  const lastContentRef = useRef('');
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    const content = typeof lastMessage.content === 'string' ? lastMessage.content : '';
    if (content === lastContentRef.current) return;
    lastContentRef.current = content;
    if (lastMessage.role === 'assistant' && containerRef.current) {
      setIsAtBottom(isPinnedToBottomRef.current);
      if (isPinnedToBottomRef.current) {
        scrollToBottom(false);
      }
    }
  }, [messages[messages.length - 1]?.content, scrollToBottom]);

  // ── ResizeObserver：内容区高度变化时自动跟随（覆盖工具链、按钮等非 content 变化）──
  useEffect(() => {
    const content = contentRef.current;
    const container = containerRef.current;
    if (!content || !container) return;
    let prevHeight = content.getBoundingClientRect().height;
    const observer = new ResizeObserver(() => {
      const newHeight = content.getBoundingClientRect().height;
      if (newHeight > prevHeight && isPinnedToBottomRef.current) {
        setIsAtBottom(true);
        scrollToBottom(false);
      }
      prevHeight = newHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    if (stickToBottomSignal <= 0) return undefined;

    const duration = Math.max(0, stickToBottomDurationMs);
    const start = performance.now();
    let rafId = 0;
    programmaticScrollRef.current = true;
    isPinnedToBottomRef.current = true;
    setIsAtBottom(true);

    const keepPinned = (now: number) => {
      scrollToBottom(false);
      if (now - start < duration) {
        rafId = requestAnimationFrame(keepPinned);
        return;
      }
      programmaticScrollRef.current = false;
    };

    rafId = requestAnimationFrame(keepPinned);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      programmaticScrollRef.current = false;
    };
  }, [stickToBottomDurationMs, stickToBottomSignal, scrollToBottom]);

  // 【性能优化】新会话首批消息不做入场动画
  // 当从 EmptyState 切换到 MessageList 时（prevCount=0），
  // motion.div 的 y:20 slide-in 配合 spacer 重算会造成可见的位移跳动
  const animateThreshold = prevMessageCountRef.current === 0 && messages.length > 0
    ? messages.length   // 首批消息全部静态渲染
    : messages.length - ANIMATE_LAST_N;
  const wrapperTypeRef = useRef<Map<string, 'motion' | 'div'>>(new Map());

  const filteredMessages = useMemo(
    () => messages.filter(m => {
      if (m.role === 'system') return false;
      if (m.role === 'user' && typeof m.content === 'string' && m.content.trimStart().startsWith('<system_reminder>')) return false;
      return true;
    }),
    [messages],
  );

  const runtimeMessageByKey = useMemo(() => {
    const map = new Map<string, ChatMessageVM>();
    for (const runtimeMessage of runtimeMessages ?? []) {
      map.set(runtimeMessage.assistant.jobId, runtimeMessage);
      if (runtimeMessage.assistant.responseMessageId) {
        map.set(runtimeMessage.assistant.responseMessageId, runtimeMessage);
      }
    }
    return map;
  }, [runtimeMessages]);

  return (
    <div className="h-full relative" data-testid="chat-message-list">
      <div
        ref={containerRef}
        className="h-full overflow-y-auto px-6"
        style={{
          background: 'transparent',
          // Header is outside this scroll container; keep only conversation breathing room here.
          paddingTop: 24,
          paddingBottom: 32,
          scrollbarGutter: 'stable both-edges',
        }}
        data-testid="chat-message-scroll"
      >
        <div
          ref={contentRef}
          className="space-y-6 mx-auto"
          style={{
            maxWidth: 900,
          }}
          data-testid="chat-message-content"
        >
          <PlanModeIndicator />
          
          {filteredMessages.flatMap((message, index, filtered) => {
            const isLast = index === filtered.length - 1;
            const isAgentMessage = message.role === 'assistant';
            const isUserMsg = message.role === 'user';
            const messageRetryDisabled = retryDisabled
              || (isAgentMessage && message.id !== lastAssistantMessageId);
            const runtimeMessage = isAgentMessage
              ? runtimeMessageByKey.get(message.job_id || message.id)
              : undefined;
            const messageExtra = isAgentMessage
              ? messageTrailingContent?.(message, runtimeMessage)
              : null;
            let wrapperType = wrapperTypeRef.current.get(message.id);
            if (!wrapperType) {
              wrapperType = index >= animateThreshold ? 'motion' : 'div';
              wrapperTypeRef.current.set(message.id, wrapperType);
            }
            const shouldAnimate = wrapperType === 'motion';

            const content = isAgentMessage ? (
              <AgentMessage
                message={message}
                runtimeMessage={runtimeMessage}
                isLast={isLast}
                runtimeStore={runtimeStore}
                agentDisplay={agentDisplay}
                sessionIdOverride={sessionIdOverride}
                onQuestionSubmit={onQuestionSubmit}
                onPlanApprove={onPlanApprove}
                onPlanFeedback={onPlanFeedback}
                onToolApproval={onToolApproval}
                onViewSkillDetail={onViewSkillDetail}
                onRetry={onRetry}
                retryDisabled={messageRetryDisabled}
                retryDisabledTitle={messageRetryDisabled && message.id !== lastAssistantMessageId
                  ? '只支持重试最后一轮回答'
                  : retryDisabledTitle}
                onSourcesOpen={onSourcesOpen}
                onFollowUpSelect={onFollowUpSelect}
                bodyExtra={messageExtra}
              />
            ) : (
              <MessageBubble
                message={message}
                isLast={isLast}
              />
            );

            const elements: React.ReactNode[] = [];
            
            const rtList = message.roundtableDataList || (message.roundtableData ? [message.roundtableData] : []);
            const hasRtCards = rtList.length > 0;

            const isLastUserInList = isUserMsg && (
              isLast ||
              (index === filtered.length - 2 && filtered[filtered.length - 1]?.role === 'assistant')
            );

            const setRef = (el: HTMLDivElement | null) => {
              if (isLast && !hasRtCards) lastMessageRef.current = el;
              if (isLastUserInList) lastUserMsgRef.current = el;
            };

            if (shouldAnimate) {
              elements.push(
                <motion.div
                  key={message.id}
                  ref={setRef}
                  className={`chat-message-row chat-message-row-${message.role}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  data-testid={`chat-message-${message.role}-${message.id}`}
                >
                  {content}
                </motion.div>
              );
            } else {
              elements.push(
                <div
                  key={message.id}
                  ref={setRef}
                  className={`chat-message-row chat-message-row-${message.role}`}
                  data-testid={`chat-message-${message.role}-${message.id}`}
                >
                  {content}
                </div>
              );
            }

            rtList.forEach((rtData, rtIdx) => {
              const isLastCard = isLast && rtIdx === rtList.length - 1;
              if (shouldAnimate) {
                elements.push(
                  <motion.div
                    key={`rt-${message.id}-${rtData.session_id}`}
                    ref={isLastCard ? lastMessageRef : undefined}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 * (rtIdx + 1) }}
                    className="chat-roundtable-card py-1 flex justify-center"
                    data-testid={`chat-roundtable-card-${rtData.session_id}`}
                  >
                    <RoundtableCard
                      data={rtData}
                      onOpenPanel={onOpenRoundtablePanel}
                    />
                  </motion.div>
                );
              } else {
                elements.push(
                  <div
                    key={`rt-${message.id}-${rtData.session_id}`}
                    ref={isLastCard ? lastMessageRef : undefined}
                    className="chat-roundtable-card py-1 flex justify-center"
                    data-testid={`chat-roundtable-card-${rtData.session_id}`}
                  >
                    <RoundtableCard
                      data={rtData}
                      onOpenPanel={onOpenRoundtablePanel}
                    />
                  </div>
                );
              }
            });

            return elements;
          })}

          {trailingContent}

          {/* 逻辑底部锚点 */}
          <div ref={bottomRef} />

          {/* 动态空白占位区 — 始终渲染 + marginTop:0 消除 space-y-4 的隐性 gap */}
          <div ref={spacerRef} style={{ height: spacerHeight, marginTop: 0 }} aria-hidden="true" />
        </div>
      </div>
      
      <AnimatePresence>
        {!isAtBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onClick={() => scrollToBottom(true)}
            className="absolute flex items-center justify-center transition-colors hover:opacity-80"
            style={{
              bottom: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--scroll-btn-bg)',
              border: '1px solid var(--scroll-btn-border)',
              boxShadow: 'var(--scroll-btn-shadow)',
              color: 'var(--scroll-btn-icon)',
              cursor: 'pointer',
              zIndex: 10,
            }}
            title="滚动到底部"
            data-testid="chat-scroll-bottom-btn"
          >
            <ScrollDownIcon size={12} />
          </motion.button>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes rt-breathe {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};
