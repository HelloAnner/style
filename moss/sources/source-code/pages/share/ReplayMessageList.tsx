/**
 * ReplayMessageList — 回放消息列表
 *
 * 流序：Agent placeholder → 工具逐个落入(展开态) → 自动收起 → 文本打字机
 * 特殊交互对标真实产品：QuestionCard / PlanReviewCard / TodoDrawer / SubAgent 伙伴卡片 / 圆桌
 */

import React, { useRef, useEffect, useMemo, useState, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from '../../lib/motion';
import { Avatar } from '../../components/common/Avatar';
import SidebarAgentIcon from '../../components/Sidebar/SidebarAgentIcon';
import { getToolDisplayConfig } from '../../components/Chat/ActionFeed/toolDisplayConfig';
import { useToolActionDisplay } from '../../components/Chat/ActionFeed/useToolActionDisplay';
import { SubAgentCardsSection } from '../../components/Chat/SubAgentCards';
import { resolveSubAgentTimelinePlacement } from '../../components/Chat/ActionFeed/subagentTimeline';
import type { ActionItemData } from '../../components/Chat/ActionFeed/ActionItem';
import { AnswerSourcesDrawer } from '../../components/Chat/AnswerSourcesDrawer';
import { ToolApprovalCard } from '../../components/Chat/ToolApprovalCard';
import { DashboardAskChip, dashboardDisplayParts } from '../../components/Chat/DashboardAskChip';
import { getAgentDisplayName } from '../../types/platform';
import { buildWidgetShellHtml } from '../../lib/widgetTheme';
import { MARKER_PATTERNS } from '../../lib/wsContentParsers';
import { normalizeQuestionOptions } from '../../lib/questionOptions';
import { useFrontendConfigStore } from '../../stores/frontendConfigStore';
import type {
  AnswerSource,
  ChatMessage,
  PlanReviewData,
  QuestionData,
  QuestionItem,
  SubAgentExecution,
  ToolUsePendingPayload,
} from '../../types';
import type { ReplayState, TodoItem, SubAgentState } from './ReplayEngine';

const MarkdownContent = React.lazy(() =>
  import('../../components/Chat/MarkdownContent').then((m) => ({ default: m.MarkdownContent })),
);

function cleanContent(content: string): string {
  let result = content;
  for (const pattern of MARKER_PATTERNS) result = result.replace(pattern, '');
  return result.trim();
}

function formatTimestamp(ts: any): string {
  if (!ts) return '';
  try {
    const date = typeof ts === 'string' ? new Date(ts) : ts instanceof Date ? ts : new Date();
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function formatToolResult(tc: any): string | null {
  const name = tc.name || '';
  const args = tc.arguments || {};
  const result = tc.result;
  try {
    const config = getToolDisplayConfig(name);
    if (config?.showResult && config?.formatResult && result !== undefined) return config.formatResult(result, args);
  } catch { /* fallback */ }
  return null;
}

function formatToolDuration(ms: unknown): string | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function replayToolDisplayName(tc: any): string | undefined {
  const candidates = [
    tc?.display_name,
    tc?.displayName,
    tc?.display?.display_name,
    tc?.display?.displayName,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  return undefined;
}

function toChatSubAgentExecution(sa: SubAgentState): SubAgentExecution {
  const execution = { ...sa };
  delete execution.sourceToolCallId;
  delete execution.executionId;
  delete execution.messageId;
  return {
    ...execution,
    agentKind: execution.agentKind || 'main',
    displayName: execution.displayName || execution.agentType,
    anchorToolCallId: execution.anchorToolCallId || sa.sourceToolCallId,
  };
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const QuestionnaireIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)' }}>
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <path d="M9 12h6" /><path d="M9 16h6" />
  </svg>
);

const TodoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}>
    <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CheckCircleIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const CircleIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', opacity: 0.4 }}>
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const LoaderIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-secondary)', animation: 'spin 1s linear infinite' }}>
    <path d="M21 12a9 9 0 11-6.219-8.56" />
  </svg>
);

const XCircleIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface AutomationInfo {
  name: string;
  description: string;
  trigger_config: any;
  trigger_count: number;
  agent_name: string;
}

interface ReplayMessageListProps {
  state: ReplayState;
  agentName?: string;
  agentAvatarId?: string | null;
  automation?: AutomationInfo | null;
  onFileClick?: (fileName: string) => void;
}

function cronToLabel(config: any): string {
  if (!config) return '';
  const type = config.type as string;
  const cron = config.cron_expr as string;
  if (config.once) return '单次执行';
  if (!cron && !type) return '';
  if (cron) {
    const parts = cron.split(/\s+/);
    if (parts.length >= 5) {
      const [min, hour, , , dow] = parts;
      const dowMap: Record<string, string> = { '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六', '0': '日', '7': '日' };
      let dayStr = '';
      if (dow !== '*') {
        const days = dow.split(',').map(d => dowMap[d] || d).join(',');
        dayStr = `每周${days}`;
      } else {
        dayStr = '每天';
      }
      const times = hour !== '*' ? hour.split(',').map(h => `${h}:${min.padStart(2, '0')}`).join(',') : '';
      return times ? `${dayStr} ${times}` : dayStr;
    }
  }
  return type || '';
}

export const ReplayMessageList: React.FC<ReplayMessageListProps> = ({ state, agentName, agentAvatarId, automation, onFileClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const programmaticScrollRef = useRef(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [sourceDrawerSources, setSourceDrawerSources] = useState<AnswerSource[] | null>(null);
  const rafIdRef = useRef<number>(0);

  const isAutomationTask = useMemo(() => {
    return !!automation || !state.events.some(e => e.type === 'user_message');
  }, [automation, state.events]);

  const toolCallCount = useMemo(() => {
    let count = 0;
    state.displayedToolCalls.forEach((v) => { count += v.length; });
    return count;
  }, [state.displayedToolCalls]);

  const widgetCount = useMemo(() => {
    let count = 0;
    state.visibleWidgets.forEach((v) => { count += v.length; });
    return count;
  }, [state.visibleWidgets]);

  const subAgentCount = state.activeSubAgents.length;
  const subAgentCompletedCount = state.activeSubAgents.filter(sa => sa.status === 'completed').length;

  const checkIfAtBottom = useCallback(() => {
    const c = containerRef.current;
    if (!c) return true;
    return c.scrollHeight - c.scrollTop - c.clientHeight < 80;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    programmaticScrollRef.current = !smooth;
    stickToBottomRef.current = true;
    setIsAtBottom(true);
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
    if (!smooth) {
      requestAnimationFrame(() => {
        programmaticScrollRef.current = false;
      });
    }
  }, []);

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    let lastY = 0;
    const handleScroll = () => {
      if (rafIdRef.current) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = 0;
        const atBottom = checkIfAtBottom();
        setIsAtBottom(atBottom);
        const currentY = c.scrollTop;
        if (programmaticScrollRef.current) {
          if (atBottom) {
            stickToBottomRef.current = true;
          }
          lastY = currentY;
          return;
        }
        if (currentY < lastY && !atBottom) {
          stickToBottomRef.current = false;
        }
        if (atBottom) stickToBottomRef.current = true;
        lastY = currentY;
      });
    };
    c.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      c.removeEventListener('scroll', handleScroll);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [checkIfAtBottom]);

  useEffect(() => {
    if (stickToBottomRef.current) {
      requestAnimationFrame(() => {
        scrollToBottom(false);
      });
    }
  }, [state.displayedMessages.length, state.typingText, toolCallCount, subAgentCount, subAgentCompletedCount, scrollToBottom]);

  const prevWidgetCountRef = useRef(0);
  useEffect(() => {
    if (widgetCount > prevWidgetCountRef.current) {
      const c = containerRef.current;
      if (c) {
        const viewportH = c.clientHeight;
        const scrollTarget = viewportH / 3;
        const maxScroll = c.scrollHeight - c.scrollTop - viewportH;
        const amount = Math.min(scrollTarget, maxScroll);
        if (amount > 10) {
          c.scrollBy({ top: amount, behavior: 'smooth' });
        } else {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
    prevWidgetCountRef.current = widgetCount;
  }, [widgetCount]);

  useEffect(() => {
    const c = containerRef.current;
    if (!c || !onFileClick) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('[title="点击在我的文件中预览"]') as HTMLElement | null;
      if (!link) return;
      e.preventDefault();
      e.stopPropagation();
      const filePath = link.dataset.filePath || link.textContent?.trim() || '';
      if (filePath) onFileClick(filePath);
    };
    c.addEventListener('click', handleClick, true);
    return () => c.removeEventListener('click', handleClick, true);
  }, [onFileClick]);

  return (
    <div
      ref={containerRef}
      className="share-replay-message-list h-full overflow-y-auto px-6 py-4"
      style={{ position: 'relative' }}
      data-testid="replay-message-list"
    >
      <div className="space-y-4 mx-auto" style={{ maxWidth: 880 }} data-testid="replay-message-list-content">

        {/* Automation task overview card */}
        {isAutomationTask && (
          <AutomationHeader automation={automation} agentName={agentName} agentAvatarId={agentAvatarId} />
        )}

        {state.displayedMessages.map((msg, index) => (
          <motion.div
            key={msg.id ?? `${msg.role}-${index}`}
            className="replay-message-item"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            data-testid={`replay-message-${msg.role}-${msg.id ?? index}`}
          >
            {msg.role === 'user' ? (
              <UserMessage message={msg} onFileClick={onFileClick} />
            ) : (
              <AgentReplayMessage
                message={msg}
                isTyping={state.typingMessageId === msg.id}
                typingText={state.typingMessageId === msg.id ? state.typingText : null}
                toolCalls={state.displayedToolCalls}
                expandedToolExecIds={state.expandedToolExecIds}
                widgets={state.visibleWidgets.get(msg.id)}
                roundtables={state.visibleRoundtables.get(msg.id) || replayMessageRoundtables(msg)}
                subAgents={state.activeSubAgents}
                isLastMsg={index === state.displayedMessages.length - 1}
                agentName={agentName}
                agentAvatarId={agentAvatarId}
                onSourcesOpen={setSourceDrawerSources}
                onFileClick={onFileClick}
              />
            )}
          </motion.div>
        ))}

        <div ref={bottomRef} data-testid="replay-message-list-scroll-bottom" />
      </div>

      {/* Floating scroll-to-bottom button */}
      <AnimatePresence>
        {!isAtBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onClick={() => scrollToBottom(true)}
            style={{
              position: 'sticky',
              bottom: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="滚动到底部"
            data-testid="replay-message-list-scroll-button"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {sourceDrawerSources && (
        <AnswerSourcesDrawer
          sources={sourceDrawerSources}
          onClose={() => setSourceDrawerSources(null)}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes widgetShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .replay-action-scroll::-webkit-scrollbar { display: none; }
        .replay-action-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

function replayMessageRoundtables(message: ChatMessage): any[] | undefined {
  const list = (message as any).roundtableDataList;
  if (Array.isArray(list) && list.length > 0) return list;
  const single = (message as any).roundtableData;
  return single ? [single] : undefined;
}

// ---------------------------------------------------------------------------
// User message
// ---------------------------------------------------------------------------

interface ParsedReplayUserContent {
  textParts: string[];
  uploadedFiles: string[];
  fileRefs: Array<{ name: string; lineRange?: string; fileId?: string }>;
}

function normalizeReplayFileName(raw: string): string {
  let name = raw.trim();
  name = name.replace(/^文件:\s*/, '').replace(/^File:\s*/i, '');
  const pipeIdx = name.indexOf(' | 路径: ');
  if (pipeIdx !== -1) name = name.slice(0, pipeIdx);
  const englishPipeIdx = name.indexOf(' | Path: ');
  if (englishPipeIdx !== -1) name = name.slice(0, englishPipeIdx);
  const toolHintIdx = name.indexOf(' → ');
  if (toolHintIdx !== -1) name = name.slice(0, toolHintIdx);
  const parenIdx = name.indexOf(' (execute_python');
  if (parenIdx !== -1) name = name.slice(0, parenIdx);
  return name.trim();
}

function parseReplayUserContent(content: string): ParsedReplayUserContent {
  type Part =
    | { type: 'text'; content: string }
    | { type: 'uploaded'; name: string }
    | { type: 'ref'; name: string; lineRange?: string; fileId?: string };

  let processed = content;
  const uploadedBlockRegex = /\[\[UPLOADED_FILES\]\]\n([\s\S]*?)(?=\n\n|$)/g;
  processed = processed.replace(uploadedBlockRegex, (_match, body: string) => {
    const files = String(body)
      .split('\n')
      .filter((line) => line.trim().startsWith('- '))
      .map((line) => normalizeReplayFileName(line.trim().slice(2)))
      .filter((name) => name && !name.startsWith('提示'));
    return files.map((name) => `[[UPLOADED_FILE:${name}]]`).join('\n');
  });

  processed = processed.replace(/\[\[REF_CONTEXT\]\][\s\S]*?\[\[\/REF_CONTEXT\]\]/g, '');
  processed = processed.replace(/(\[\[FILE_REF:\s*[^\]]+\]\])\n\(文件路径:[^\)]*\)\n?/g, '$1');
  processed = processed.replace(/(\[\[FILE_REF:\s*[^\]]+\]\])\n\(read:[^\)]*\)\n?/g, '$1');
  processed = processed.replace(
    /\[\[FILE_SEGMENT:\s*([^\]]+?)\s+(L\d+-\d+)\]\]\n[\s\S]*?(?=\n\n|\[\[|$)/g,
    '[[FILE_SEGMENT:$1:$2]]',
  );

  const tokenRegex = /\[\[UPLOADED_FILE:([^\]]+)\]\]|\[\[FILE_REF:([^:\]]+)(?::([^\]]+))?\]\]|\[\[FILE_SEGMENT:([^:]+):(L\d+-\d+)(?::([^\]]+))?\]\]/g;
  const parts: Part[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(processed)) !== null) {
    if (match.index > lastIndex) {
      const text = processed.slice(lastIndex, match.index).trim();
      if (text) parts.push({ type: 'text', content: text });
    }
    if (match[1]) {
      parts.push({ type: 'uploaded', name: normalizeReplayFileName(match[1]) });
    } else if (match[2]) {
      const fileId = match[3]?.startsWith('f_') ? match[3] : undefined;
      parts.push({ type: 'ref', name: normalizeReplayFileName(match[2]), fileId });
    } else if (match[4]) {
      const fileId = match[6]?.startsWith('f_') ? match[6] : undefined;
      parts.push({ type: 'ref', name: normalizeReplayFileName(match[4]), lineRange: match[5], fileId });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < processed.length) {
    const text = processed.slice(lastIndex).trim();
    if (text) parts.push({ type: 'text', content: text });
  }

  const textParts: string[] = [];
  const uploadedFiles: string[] = [];
  const fileRefs: ParsedReplayUserContent['fileRefs'] = [];
  for (const part of parts) {
    if (part.type === 'text') textParts.push(part.content);
    if (part.type === 'uploaded' && part.name) uploadedFiles.push(part.name);
    if (part.type === 'ref' && part.name) {
      fileRefs.push({ name: part.name, lineRange: part.lineRange, fileId: part.fileId });
    }
  }
  return { textParts, uploadedFiles, fileRefs };
}

function replayFileDisplayName(path: string): string {
  return path.split('/').pop() || path;
}

const ReplayFileChip: React.FC<{
  name: string;
  label?: string;
  onFileClick?: (fileName: string) => void;
}> = ({ name, label, onFileClick }) => (
  <button
    type="button"
    onClick={() => onFileClick?.(name)}
    className="inline-flex items-center"
    style={{
      gap: 6,
      maxWidth: 260,
      minWidth: 0,
      padding: '4px 9px',
      borderRadius: 6,
      border: '1px solid var(--border-subtle)',
      background: 'var(--bg-tertiary)',
      color: 'var(--text-secondary)',
      cursor: onFileClick ? 'pointer' : 'default',
      fontSize: 12,
      fontWeight: 500,
    }}
    data-testid="share-user-file-chip"
    title={name}
  >
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M9 2H4.5A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V6L9 2Z" />
      <path d="M9 2v4h4" />
    </svg>
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {label || replayFileDisplayName(name)}
    </span>
  </button>
);

const UserMessage: React.FC<{ message: ChatMessage; onFileClick?: (fileName: string) => void }> = ({ message, onFileClick }) => {
  const hasQReply = !!(message as any).questionnaireReply;
  const content = message.content || '';
  const displayContent = typeof (message as any).displayContent === 'string' ? (message as any).displayContent : '';
  const isDashboardChip = Boolean(dashboardDisplayParts(displayContent || content));
  const isDisplayOnly = Boolean(displayContent.trim()) || isDashboardChip;

  return (
    <div className="share-replay-user-row flex flex-row-reverse" style={{ gap: 12 }} data-testid="replay-user-message">
      <div className="share-replay-user-avatar">
        <Avatar type="user" size="md" name="你" />
      </div>
      <div className="share-replay-message-body flex flex-col items-end">
        <div className="share-replay-user-header flex items-center flex-row-reverse" style={{ gap: 8, marginBottom: 6, paddingRight: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>你</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatTimestamp((message as any).timestamp)}</span>
        </div>
        <div
          className="share-replay-user-card"
          style={{
            padding: isDisplayOnly ? 0 : '10px 14px',
            borderRadius: isDisplayOnly ? 0 : 16,
            background: isDisplayOnly ? 'transparent' : 'var(--bubble-user)',
            color: 'var(--text-secondary)',
            maxWidth: 640,
          }}
        >
          <div className="break-words" style={{ fontSize: 14, lineHeight: 1.6 }}>
            {hasQReply ? (
              <QuestionnaireReplyDisplay data={(message as any).questionnaireReply} />
            ) : (
              <UserContentDisplay content={content} displayContent={displayContent} onFileClick={onFileClick} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const UserContentDisplay: React.FC<{ content: string; displayContent?: string; onFileClick?: (fileName: string) => void }> = ({ content, displayContent, onFileClick }) => {
  const parsed = useMemo(() => parseReplayUserContent(content), [content]);
  const visibleContent = (displayContent || content || '').trim();
  const dashboardChip = dashboardDisplayParts(visibleContent);
  if (dashboardChip) {
    return <DashboardAskChip text={visibleContent} />;
  }
  if ((displayContent || '').trim()) {
    return <div style={{ whiteSpace: 'pre-wrap' }} data-testid="share-user-message-display-text">{visibleContent}</div>;
  }
  const hasFiles = parsed.uploadedFiles.length > 0 || parsed.fileRefs.length > 0;
  const hasText = parsed.textParts.length > 0;
  if (!hasFiles && !hasText) return null;
  return (
    <div data-testid="share-user-message-content">
      {hasFiles && (
        <div
          className="flex flex-wrap"
          style={{ gap: 6, marginBottom: hasText ? 8 : 0 }}
          data-testid="share-user-file-list"
        >
          {parsed.uploadedFiles.map((file, index) => (
            <ReplayFileChip
              key={`uploaded-${file}-${index}`}
              name={file}
              onFileClick={onFileClick}
            />
          ))}
          {parsed.fileRefs.map((file, index) => (
            <ReplayFileChip
              key={`ref-${file.name}-${index}`}
              name={file.name}
              label={file.lineRange ? `${replayFileDisplayName(file.name)} ${file.lineRange}` : undefined}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
      {parsed.textParts.map((text, index) => (
        <div key={index} style={{ whiteSpace: 'pre-wrap' }}>
          {text}
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Agent message
// ---------------------------------------------------------------------------

interface AgentReplayMessageProps {
  message: ChatMessage;
  isTyping: boolean;
  typingText: string | null;
  toolCalls: Map<string, any[]>;
  expandedToolExecIds: Set<string>;
  widgets?: any[];
  roundtables?: any[];
  subAgents: SubAgentState[];
  isLastMsg: boolean;
  agentName?: string;
  agentAvatarId?: string | null;
  onSourcesOpen?: (sources: AnswerSource[]) => void;
  onFileClick?: (path: string) => void;
}

const AgentReplayMessage: React.FC<AgentReplayMessageProps> = ({
  message, isTyping, typingText, toolCalls, expandedToolExecIds, widgets, roundtables, subAgents, isLastMsg, agentName, agentAvatarId, onSourcesOpen, onFileClick,
}) => {
  const rawContent = isTyping ? (typingText || '') : (message.content || '');
  const displayContent = useMemo(() => cleanContent(rawContent), [rawContent]);
  const hasQuestionData = !!(message as any).questionData;
  const hasWidgets = Boolean(widgets?.length);
  const hasPlanReview = !!(message as any).planReviewData;
  const hasToolApproval = !!(message as any).toolApprovalData;
  const sources = useMemo(() => {
    const value = (message as any).sources;
    return Array.isArray(value) ? value.filter(Boolean) as AnswerSource[] : [];
  }, [message]);
  const execId = (message as any).executionId;
  const tcs = execId ? toolCalls.get(execId) : undefined;
  const chatSubAgents = useMemo(() => {
    const persisted = Array.isArray((message as any).subagentResults)
      ? (message as any).subagentResults as SubAgentExecution[]
      : [];
    if (!isLastMsg) return persisted;
    const sourceToolCallIds = new Set(
      (tcs || [])
        .map((tc: any) => String(tc.__replayToolCallId || tc.id || ''))
        .filter(Boolean),
    );
    const live = subAgents
      .filter((sa) => {
        if (sa.messageId && sa.messageId === message.id) return true;
        if (execId && sa.executionId === execId) return true;
        if (sa.sourceToolCallId && sourceToolCallIds.has(sa.sourceToolCallId)) return true;
        return Array.from(sourceToolCallIds).some((id) => sa.taskId.startsWith(`${id}-sa-`));
      })
      .map(toChatSubAgentExecution);
    const seen = new Set(persisted.map((sa) => sa.taskId));
    return [...persisted, ...live.filter((sa) => !seen.has(sa.taskId))];
  }, [isLastMsg, message, subAgents, tcs]);
  const actionCount = tcs?.length || 0;
  const toolsExpanded = execId ? expandedToolExecIds.has(execId) : false;
  const showContent = displayContent || isTyping;
  const questionnaireBody = hasQuestionData ? (
    <QuestionnaireReadOnlyDisplay data={(message as any).questionData} />
  ) : null;

  return (
    <div className="share-replay-agent-row flex flex-row" style={{ gap: 12 }} data-testid="replay-agent-message">
      <div className="share-replay-agent-avatar">
        <SidebarAgentIcon agent={{ name: agentName || 'Agent', avatar_url: agentAvatarId ?? null }} size={32} />
      </div>
      <div className="share-replay-message-body flex flex-col items-start" style={{ maxWidth: '85%', minWidth: 0, ...(widgets && widgets.length > 0 ? { width: '85%' } : {}) }}>
        <div className="share-replay-agent-header flex items-center" style={{ gap: 8, marginBottom: 6, paddingLeft: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{agentName || 'Moss'}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatTimestamp((message as any).timestamp)}</span>
        </div>

        {/* Tool operations before text */}
        {(actionCount > 0 || chatSubAgents.length > 0) && (
          <div className="w-full mb-2" style={{ paddingLeft: 2 }} data-testid="replay-agent-message-actions">
            <ReplayActionFeed
              actions={tcs || []}
              isExpanded={toolsExpanded}
              subAgents={chatSubAgents}
              onSubAgentArtifactOpen={onFileClick}
            />
          </div>
        )}

        {sources.length > 0 && (
          <button
            type="button"
            onClick={() => onSourcesOpen?.(sources)}
            className="inline-flex items-center gap-1.5 rounded-md mb-2"
            style={{
              padding: '4px 8px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              fontSize: 12,
              cursor: 'pointer',
            }}
            data-testid="replay-agent-message-sources"
          >
            <span>{sources.length} 信息来源</span>
          </button>
        )}

        {showContent && !hasToolApproval && (
          <div
            className="share-replay-agent-card relative mb-2"
            style={{ padding: 14, borderRadius: 16, background: 'var(--bubble-agent)', border: '1px solid var(--border-muted)', color: 'var(--text-secondary)', maxWidth: '100%' }}
            data-testid="replay-agent-message-content"
          >
            <div className="break-words" style={{ fontSize: 14, lineHeight: 1.6 }}>
              <React.Suspense fallback={<span style={{ whiteSpace: 'pre-wrap' }}>{displayContent}</span>}>
                <MarkdownContent content={displayContent} />
              </React.Suspense>
              {isTyping && (
                <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="inline-block w-0.5 h-4 ml-1 align-text-bottom" style={{ backgroundColor: 'var(--text-muted)' }} />
              )}
            </div>
          </div>
        )}

        {!hasWidgets && questionnaireBody}

        {/* Plan review panel */}
        {hasPlanReview && (message as any).planReviewData && (
          <div className="w-full mb-2" data-testid="replay-agent-message-plan-review">
            <PlanReviewDisplay data={(message as any).planReviewData} />
          </div>
        )}

        {hasToolApproval && (
          <div className="w-full mb-2">
            <ToolApprovalCard
              data={(message as any).toolApprovalData as ToolUsePendingPayload}
              decided={(message as any).toolApprovalDecided}
              isLast={false}
              onResolve={() => undefined}
              testId="replay-agent-message-tool-approval"
            />
          </div>
        )}

        {hasWidgets && (
          <div
            style={{ alignSelf: 'stretch', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}
            data-testid="replay-agent-message-widgets"
          >
            {widgets?.map((w: any, i: number) => (
              <WidgetCard key={i} data={w} index={i} />
            ))}
          </div>
        )}

        {hasWidgets && questionnaireBody}

        {/* Roundtable channels — centered like in real chat */}
        {roundtables && roundtables.length > 0 && (
          <div
            style={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%' }}
            data-testid="replay-agent-message-roundtables"
          >
            {roundtables.map((rt: any, i: number) => (
              <RoundtableCard key={i} data={rt} agentAvatarId={agentAvatarId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Widget card — shimmer loading → reveal with animation (matches real WidgetRenderer)
// ---------------------------------------------------------------------------

const WidgetCard: React.FC<{ data: any; index: number }> = ({ data, index }) => {
  const [shimmerDone, setShimmerDone] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const shellReadyRef = useRef(false);
  const pendingCodeRef = useRef<string | null>(null);
  const lastSentCodeRef = useRef<string | null>(null);
  const [height, setHeight] = useState(280);
  const loaded = shimmerDone && iframeReady;

  const srcdoc = useMemo(() => {
    if (!data.code) return '';
    return buildWidgetShellHtml('light');
  }, [data.code]);

  const sendToIframe = useCallback((message: object) => {
    iframeRef.current?.contentWindow?.postMessage(message, '*');
  }, []);

  const flushCode = useCallback((code: string) => {
    if (lastSentCodeRef.current === code) return;
    lastSentCodeRef.current = code;
    sendToIframe({ type: 'widget-replace', html: code });
    sendToIframe({ type: 'widget-finalize' });
  }, [sendToIframe]);

  const handleIframeLoad = useCallback(() => {
    shellReadyRef.current = true;
    setIframeReady(true);
    sendToIframe({ type: 'widget-set-theme', theme: 'light' });
    if (pendingCodeRef.current) {
      flushCode(pendingCodeRef.current);
      pendingCodeRef.current = null;
    }
  }, [flushCode, sendToIframe]);

  useEffect(() => {
    if (!data.code) return;
    if (shellReadyRef.current) {
      flushCode(data.code);
    } else {
      pendingCodeRef.current = data.code;
    }
  }, [data.code, flushCode]);

  useEffect(() => {
    const timer = setTimeout(() => setShimmerDone(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || e.source !== iframeRef.current?.contentWindow) return;
      if (e.data.type === 'widget-resize') {
        const h = Math.min(Math.max(e.data.height || 280, 60), 50000);
        setHeight(h);
      }
      if (e.data.type === 'widget-fullscreen') {
        const el = iframeRef.current;
        if (!el) return;
        if (e.data.enter) {
          el.requestFullscreen?.().catch(() => {});
        } else if (document.fullscreenElement) {
          document.exitFullscreen?.();
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    const onFSChange = () => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'widget-fullscreen-change', isFullscreen: !!document.fullscreenElement },
        '*'
      );
    };
    document.addEventListener('fullscreenchange', onFSChange);
    document.addEventListener('webkitfullscreenchange', onFSChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFSChange);
      document.removeEventListener('webkitfullscreenchange', onFSChange);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="replay-widget-card my-3 rounded-xl overflow-hidden"
      style={{
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)',
        position: 'relative',
        boxShadow: loaded ? '0 4px 20px rgba(0,0,0,0.06)' : 'none',
        transition: 'box-shadow 0.6s ease',
      }}
      data-testid={`replay-widget-card-${index}`}
    >
      {data.title && (
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
          data-testid="replay-widget-card-header"
        >
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
            {data.title}
          </span>
        </div>
      )}

      <div style={{ position: 'relative', minHeight: loaded ? undefined : height }} data-testid="replay-widget-card-body">
        {!loaded && (
          <div
            style={{
              position: 'absolute', inset: 0, zIndex: 1,
              background: 'var(--bg-secondary)', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            data-testid="replay-widget-card-loading"
          >
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(100deg, transparent 30%, rgba(128,128,128,0.07) 50%, transparent 70%)',
              animation: 'widgetShimmer 2s ease-in-out infinite',
            }} />
            <span style={{ display: 'none' }} />
          </div>
        )}

        {srcdoc ? (
          <iframe
            ref={iframeRef}
            srcDoc={srcdoc}
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            allowFullScreen
            onLoad={handleIframeLoad}
            style={{
              width: '100%', height, border: 'none', display: 'block',
              opacity: loaded ? 1 : 0,
              transition: 'opacity 0.8s ease',
            }}
            title={data.title || 'Widget'}
            data-testid="replay-widget-card-frame"
          />
        ) : (
          <div
            style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}
            data-testid="replay-widget-card-empty"
          >
            可视化组件
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Automation task header — overview card for tasks with no user input
// ---------------------------------------------------------------------------

const AutomationHeader: React.FC<{
  automation?: AutomationInfo | null;
  agentName?: string;
  agentAvatarId?: string | null;
}> = ({ automation, agentName }) => {
  const triggerText = automation ? cronToLabel(automation.trigger_config) : '';
  const desc = automation?.description || '';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        padding: '24px 28px',
        borderRadius: 16,
        background: 'var(--text-primary)',
        position: 'relative',
        overflow: 'hidden',
      }}
      data-testid="replay-automation-header"
    >
      {/* Texture overlays */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 20% 50%, rgba(255,255,255,0.06), transparent 60%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 90% 20%, rgba(255,255,255,0.04), transparent 50%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.06)', pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative' }}>
        <div className="flex items-center" style={{ gap: 10, marginBottom: 12 }} data-testid="replay-automation-header-meta">
          <span
            style={{
              fontSize: 10, fontWeight: 700,
              padding: '3px 8px', borderRadius: 4,
              background: 'rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            自动化任务
          </span>
          {triggerText && (
            <span
              className="flex items-center"
              style={{ gap: 4, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}
              data-testid="replay-automation-header-trigger"
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" />
              </svg>
              {triggerText}
            </span>
          )}
          {automation && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              {getAgentDisplayName(automation.agent_name || agentName, 'Agent')} · 已执行 {automation.trigger_count} 次
            </span>
          )}
        </div>

        {desc && (
          <div style={{
            fontSize: 14, lineHeight: 1.7,
            color: 'rgba(255,255,255,0.75)',
            display: '-webkit-box', WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
          }} data-testid="replay-automation-header-description">
            {desc}
          </div>
        )}
        {!desc && !automation && (
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }} data-testid="replay-automation-header-empty">
            自动化任务已启动，Agent 正在执行...
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// ActionFeed
// ---------------------------------------------------------------------------

function replayActionId(action: any, index: number): string {
  return String(action?.__replayToolCallId || action?.id || `replay-tool-${index}`);
}

function replayPlacementActions(actions: any[]): ActionItemData[] {
  return actions.map((action, index) => ({
    id: replayActionId(action, index),
    toolName: String(action?.name || ''),
    arguments: action?.arguments && typeof action.arguments === 'object' ? action.arguments : {},
    status: action?.status === 'failed' ? 'failed' : 'completed',
    iteration: typeof action?.iteration === 'number' ? action.iteration : 1,
  }));
}

const ReplayInlineAttachment: React.FC<{ children: React.ReactNode; actionId?: string }> = ({ children, actionId }) => (
  <div
    data-testid="replay-action-inline-attachment"
    data-action-id={actionId}
    style={{
      width: 'calc(100% - 30px)',
      maxWidth: 640,
      marginLeft: 30,
      marginTop: 6,
      marginBottom: 10,
    }}
  >
    {children}
  </div>
);

const ReplayActionFeed: React.FC<{
  actions: any[];
  isExpanded: boolean;
  subAgents: SubAgentExecution[];
  onSubAgentArtifactOpen?: (path: string) => void;
}> = ({ actions, isExpanded, subAgents, onSubAgentArtifactOpen }) => {
  const [userExpanded, setUserExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const placement = useMemo(
    () => resolveSubAgentTimelinePlacement(replayPlacementActions(actions), subAgents),
    [actions, subAgents],
  );
  const subAgentVersion = useMemo(() => subAgents.map(subAgent => (
    `${subAgent.taskId}:${subAgent.status}:${subAgent.iteration}`
  )).join('|'), [subAgents]);

  useEffect(() => {
    if (isExpanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [actions.length, isExpanded, subAgentVersion]);

  const renderActionList = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {actions.map((tc: any, i: number) => {
        const actionId = replayActionId(tc, i);
        const anchoredSubAgents = placement.byActionId.get(actionId);
        return (
          <React.Fragment key={actionId}>
            <ReplayActionItem tc={tc} index={i} />
            {anchoredSubAgents && (
              <ReplayInlineAttachment actionId={actionId}>
                <SubAgentCardsSection
                  subAgents={anchoredSubAgents}
                  onArtifactOpen={onSubAgentArtifactOpen}
                />
              </ReplayInlineAttachment>
            )}
          </React.Fragment>
        );
      })}
      {placement.unanchored.length > 0 && (
        <ReplayInlineAttachment>
          <SubAgentCardsSection
            subAgents={placement.unanchored}
            onArtifactOpen={onSubAgentArtifactOpen}
          />
        </ReplayInlineAttachment>
      )}
    </div>
  );

  return (
    <div data-testid="replay-action-feed">
      <AnimatePresence mode="wait">
        {isExpanded ? (
          <motion.div key="items" initial={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
            <div
              ref={scrollRef}
              className="replay-action-scroll"
              style={{ maxHeight: '50vh', overflowY: 'auto' }}
              data-testid="replay-action-feed-list"
            >
              {renderActionList()}
            </div>
          </motion.div>
        ) : (
          <motion.div key="collapsed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
            {!userExpanded ? (
              <button
                onClick={() => setUserExpanded(true)}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs hover:bg-zinc-800/50 transition-colors cursor-pointer"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}
                data-testid="replay-action-feed-expand"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                <span>{actions.length > 0 ? `${actions.length} 个操作` : `${subAgents.length} 个伙伴`}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            ) : (
              <div>
                <button
                  onClick={() => setUserExpanded(false)}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs hover:bg-zinc-800/50 transition-colors cursor-pointer mb-2"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}
                  data-testid="replay-action-feed-collapse"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  <span>{actions.length > 0 ? `${actions.length} 个操作` : `${subAgents.length} 个伙伴`}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
                <div
                  className="replay-action-scroll"
                  style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}
                  data-testid="replay-action-feed-list"
                >
                  {renderActionList()}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ReplayActionItem: React.FC<{ tc: any; index: number }> = ({ tc, index }) => {
  const showToolDurations = useFrontendConfigStore((state) => state.showToolDurations);
  const [itemExpanded, setItemExpanded] = useState(false);
  const resultText = formatToolResult(tc);
  const durationText = showToolDurations ? formatToolDuration(tc.duration_ms) : null;
  const name = tc.name || '';
  const args = tc.arguments || {};
  const { Icon: IconComp, actionText } = useToolActionDisplay(name, args, replayToolDisplayName(tc));
  const isFailed = tc.status === 'failed' || Boolean(tc.error);
  const statusText = tc.error?.code === 'EXECUTION_CANCELLED'
    ? '已取消'
    : isFailed ? '失败' : null;

  const hasExpandableContent = ['write', 'edit', 'multi_edit', 'bash', 'execute_code', 'execute_python', 'python_repl', 'read'].includes(name);
  const expandContent = useMemo(() => {
    const args = tc.arguments || {};
    if (name === 'read') return tc.result ? String(tc.result).slice(0, 500) : null;
    if (name === 'write') return (args.file_text || args.content || '') as string;
    if (name === 'edit' || name === 'multi_edit') {
      const oldStr = (args.old_str || '') as string;
      const newStr = (args.new_str || '') as string;
      if (oldStr || newStr) return `- ${oldStr.split('\n').length} 行\n+ ${newStr.split('\n').length} 行`;
      return null;
    }
    if (['bash', 'execute_code', 'execute_python', 'python_repl'].includes(name)) return (args.command || args.code || '') as string;
    return null;
  }, [tc, name]);

  return (
    <motion.div
      className="replay-action-item"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.2,
        delay: index * 0.02,
        ease: 'easeOut',
      }}
      data-testid={`replay-action-item-${tc.id || index}`}
    >
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-zinc-500/5 transition-colors"
        style={{ fontSize: 13, cursor: hasExpandableContent ? 'pointer' : 'default' }}
        onClick={() => hasExpandableContent && setItemExpanded(!itemExpanded)}
        data-testid="replay-action-item-summary"
      >
        {hasExpandableContent ? (
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, transform: itemExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        ) : isFailed ? (
          <XCircleIcon size={12} />
        ) : (
          <motion.svg
            width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: index * 0.02 + 0.15, type: 'spring', stiffness: 500, damping: 20 }}
          >
            <path d="M20 6L9 17l-5-5" />
          </motion.svg>
        )}
        {IconComp && <IconComp size={13} />}
        <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 auto', minWidth: 0 }}>{actionText}</span>
        {(statusText || resultText || durationText) && (
          <span
            style={{
              fontSize: 11,
              color: isFailed ? 'var(--danger)' : 'var(--text-muted)',
              marginLeft: 'auto',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
            }}
          >
            {statusText && <span>{statusText}</span>}
            {resultText && <span>→ {resultText}</span>}
            {durationText && <span>{resultText ? `/ ${durationText}` : durationText}</span>}
          </span>
        )}
      </div>
      <AnimatePresence>
        {itemExpanded && expandContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
            data-testid="replay-action-item-expanded"
          >
            <pre style={{
              margin: '4px 0 4px 26px', padding: '8px 10px', fontSize: 11, lineHeight: 1.5,
              fontFamily: 'var(--font-mono, monospace)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              background: 'var(--code-block-bg, rgba(0,0,0,0.03))', borderRadius: 8, maxHeight: 144, overflow: 'auto',
              color: 'var(--text-secondary)', border: '1px solid var(--border-muted)',
            }}>
              {expandContent.slice(0, 800)}
              {expandContent.length > 800 && '...'}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Questionnaire — read-only public replay rendering
// ---------------------------------------------------------------------------

const QuestionnaireReadOnlyDisplay: React.FC<{ data: QuestionData }> = ({ data }) => {
  const questions = normalizeQuestionItems(data);
  const submittedAnswers = data.submittedAnswers || {};
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl overflow-hidden rounded-xl mb-2"
      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}
      data-testid="replay-questionnaire-card"
    >
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }} data-testid="replay-questionnaire-header">
        <div className="flex items-center gap-2">
          <QuestionnaireIcon />
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>发起问卷</span>
          <span className="px-1.5 py-0.5 text-xs rounded" style={{ background: 'var(--questionnaire-element-bg)', color: 'var(--questionnaire-element-text)' }}>
            {questions.length} 个问题
          </span>
          {(data.submitted || data.skipped) && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {data.submitted ? '已提交' : '已跳过'}
            </span>
          )}
        </div>
        {data.context && (
          <div className="mt-2 text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }} data-testid="replay-questionnaire-context">
            {data.context}
          </div>
        )}
      </div>
      <div
        className="px-4 py-3"
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        data-testid="replay-questionnaire-questions"
      >
        {questions.map((question, index) => (
          <div
            key={question.id || index}
            className="replay-questionnaire-question"
            style={{ display: 'flex', gap: 10 }}
            data-testid={`replay-questionnaire-question-${question.id || index}`}
          >
            <span
              className="flex-shrink-0"
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: 'var(--bg-secondary)',
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {index + 1}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.6, fontWeight: 500 }}>
                {question.question}
                {question.required !== false && <span style={{ color: 'var(--danger)', marginLeft: 4 }}>*</span>}
              </div>
              {question.type === 'multiple_choice' && (
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>可多选</div>
              )}
              {question.options?.length ? (
                <div
                  className="replay-questionnaire-options flex flex-wrap mt-2"
                  style={{ gap: 6 }}
                  data-testid={`replay-questionnaire-options-${question.id}`}
                >
                  {normalizeQuestionOptions(question.options).map((option, optionIndex) => {
                    const selected = answerContains(submittedAnswers[question.id], option.value);
                    return (
                      <span
                        key={`${option.value}-${optionIndex}`}
                        className="replay-questionnaire-option rounded-md"
                        style={{
                          padding: '4px 8px',
                          border: '1px solid var(--border-subtle)',
                          background: selected ? 'var(--questionnaire-element-bg)' : 'var(--bg-secondary)',
                          color: selected ? 'var(--questionnaire-element-text)' : 'var(--text-secondary)',
                          fontSize: 12,
                          lineHeight: '18px',
                        }}
                        data-testid={`replay-questionnaire-option-${question.id}-${optionIndex}`}
                      >
                        {option.label}
                      </span>
                    );
                  })}
                </div>
              ) : null}
              {submittedAnswers[question.id] && !question.options?.length ? (
                <div className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {Array.isArray(submittedAnswers[question.id])
                    ? (submittedAnswers[question.id] as string[]).join('、')
                    : submittedAnswers[question.id]}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

function normalizeQuestionItems(data: QuestionData): QuestionItem[] {
  if (Array.isArray(data.questions)) return data.questions;
  const legacy = data as unknown as { question?: string; options?: QuestionItem['options'] };
  if (legacy.question) {
    return [{
      id: 'q_0',
      type: 'text',
      question: legacy.question,
      options: legacy.options || [],
    }];
  }
  return [];
}

function answerContains(answer: string | string[] | undefined, option: string): boolean {
  if (Array.isArray(answer)) return answer.includes(option);
  return answer === option;
}

// ---------------------------------------------------------------------------
// PlanReviewCard — read-only public replay rendering
// ---------------------------------------------------------------------------

const PlanReviewDisplay: React.FC<{ data: PlanReviewData }> = ({ data }) => {
  const [contentExpanded, setContentExpanded] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl overflow-hidden rounded-xl"
      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}
      data-testid="replay-plan-review-card"
    >
      {/* Header */}
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }} data-testid="replay-plan-review-header">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="px-2 py-0.5 text-xs font-medium rounded"
                style={{ background: 'var(--questionnaire-element-bg)', color: 'var(--questionnaire-element-text)' }}
              >
                方案回放
              </span>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {data.task_name || '执行方案'}
              </span>
            </div>
            {data.summary && (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{data.summary}</p>
            )}
          </div>
        </div>
      </div>

      {/* Expandable content */}
      {data.content && (
        <div data-testid="replay-plan-review-content">
          <button
            onClick={() => setContentExpanded(!contentExpanded)}
            className="w-full flex items-center justify-between px-5 py-3 transition-colors"
            style={{ background: 'transparent', borderBottom: contentExpanded ? '1px solid var(--border-subtle)' : 'none', border: 'none', cursor: 'pointer' }}
            data-testid="replay-plan-review-toggle"
          >
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>方案详情</span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
              style={{ transition: 'transform 0.2s', transform: contentExpanded ? 'rotate(180deg)' : 'none' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <AnimatePresence>
            {contentExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <div className="px-5 py-4 overflow-auto" style={{ maxHeight: 400, background: 'var(--bg-secondary)' }}>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <React.Suspense fallback={<span>{data.content}</span>}><MarkdownContent content={data.content} /></React.Suspense>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Approved footer */}
      <div
        className="px-5 py-3 flex items-center gap-2"
        style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
        data-testid="replay-plan-review-footer"
      >
        <CheckCircleIcon size={14} />
        <span className="text-sm">方案内容已记录</span>
      </div>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// TodoDrawer — 对标真实产品 TodoDrawer
// ---------------------------------------------------------------------------

export const ReplayTodoDrawer = memo<{ todos: TodoItem[]; isExpanded: boolean; onToggle: () => void }>(({ todos, isExpanded, onToggle }) => {
  const completed = todos.filter((t) => t.status === 'completed').length;
  const total = todos.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const currentTask = todos.find((t) => t.status === 'in_progress') || todos.find((t) => t.status === 'pending');

  const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
    switch (status) {
      case 'completed': return <CheckCircleIcon />;
      case 'in_progress': return <LoaderIcon />;
      case 'cancelled': return <XCircleIcon />;
      default: return <CircleIcon />;
    }
  };

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-muted)' }}
      data-testid="replay-todo-drawer"
    >
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={onToggle}
        style={{ borderBottom: isExpanded ? '1px solid var(--border-subtle)' : 'none' }}
        data-testid="replay-todo-drawer-toggle"
      >
        <TodoIcon />
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>任务清单</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{completed}/{total}</span>

        <svg width="14" height="14" viewBox="0 0 14 14" className="flex-shrink-0">
          <circle cx="7" cy="7" r="5" fill="none" stroke="var(--bg-tertiary)" strokeWidth="2" />
          <circle
            cx="7" cy="7" r="5" fill="none"
            stroke={progress === 100 ? 'var(--text-muted)' : 'var(--text-tertiary)'}
            strokeWidth="2" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 5}
            strokeDashoffset={2 * Math.PI * 5 * (1 - progress / 100)}
            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 0.3s' }}
          />
        </svg>

        {!isExpanded && currentTask && (
          <span className="text-xs truncate flex-1 text-right" style={{ color: 'var(--text-muted)' }} data-testid="replay-todo-drawer-current-task">
            {currentTask.content}
          </span>
        )}

        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ flexShrink: 0 }}>
          {isExpanded ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
        </svg>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
            data-testid="replay-todo-drawer-expanded"
          >
            <div className="px-2 py-1.5 space-y-0.5 max-h-48 overflow-y-auto" data-testid="replay-todo-drawer-list">
              {todos.map((todo, index) => (
                <motion.div
                  key={todo.id || index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`replay-todo-item flex items-start gap-2 px-2 py-1.5 rounded transition-colors ${todo.status === 'in_progress' ? 'bg-zinc-500/5' : ''}`}
                  data-testid={`replay-todo-item-${todo.id || index}`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <StatusIcon status={todo.status} />
                  </div>
                  <span
                    className={`text-xs leading-relaxed flex-1 ${
                      todo.status === 'completed' || todo.status === 'cancelled' ? 'line-through opacity-50' : ''
                    }`}
                    style={{ color: todo.status === 'in_progress' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                  >
                    {todo.content}
                  </span>
                  {todo.status === 'in_progress' && (
                    <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                      进行中
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
ReplayTodoDrawer.displayName = 'ReplayTodoDrawer';

// ---------------------------------------------------------------------------
// Roundtable card — 对标真实产品 RoundtableCard.tsx 三种模式
// ---------------------------------------------------------------------------


const RT_MODE_META: Record<string, { label: string; desc: string; icon: React.ReactNode }> = {
  moderator: {
    label: '主持人模式', desc: '主持人引导每轮讨论',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ width: 10, height: 10 }}><path d="M12 2l2.09 6.26L21 9.27l-5 3.64L17.18 20 12 16.77 6.82 20 8 12.91l-5-3.64 6.91-1.01z" /></svg>,
  },
  ordered: {
    label: '轮流发言', desc: '按固定顺序依次发言',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ width: 10, height: 10 }}><path d="M17 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2z" /><path d="M9 7h6M9 11h6M9 15h4" /></svg>,
  },
  free: {
    label: '自由模式', desc: '所有参与者自由发言',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ width: 10, height: 10 }}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>,
  },
};

function rtNameToGradient(name: string): string {
  const h = (name.charCodeAt(0) * 37 + (name.charCodeAt(1) || 0) * 17) % 360;
  return `radial-gradient(circle at 40% 40%, hsl(${h},60%,72%), hsl(${(h + 40) % 360},50%,48%))`;
}

const RTHostBackground = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ background: 'radial-gradient(ellipse at 72% 42%, rgba(192,132,252,0.05) 0%, transparent 50%)' }}>
    <div className="absolute right-0 top-0 bottom-0" style={{ width: '65%', opacity: 'var(--rt-bg-art-opacity, 0.28)' }}>
      <div style={{ position: 'absolute', right: 20, top: 10, width: 0, height: 0, borderLeft: '70px solid transparent', borderRight: '70px solid transparent', borderBottom: '120px solid rgba(129,140,248,0.7)', filter: 'blur(1px)', borderRadius: 12, transform: 'rotate(-12deg)', animation: 'rt-tri-h1 14s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', right: 55, top: 25, width: 0, height: 0, borderLeft: '55px solid transparent', borderRight: '55px solid transparent', borderBottom: '95px solid rgba(192,132,252,0.5)', filter: 'blur(1px)', borderRadius: 10, transform: 'rotate(8deg)', animation: 'rt-tri-h2 11s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', right: 140, bottom: 25, width: 0, height: 0, borderLeft: '30px solid transparent', borderRight: '30px solid transparent', borderBottom: '52px solid rgba(244,114,182,0.35)', filter: 'blur(0.5px)', borderRadius: 8, transform: 'rotate(-25deg)', animation: 'rt-tri-h3 10s ease-in-out infinite' }} />
    </div>
  </div>
);

const RTOrderedBackground = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ background: 'radial-gradient(ellipse at 76% 38%, rgba(96,165,250,0.05) 0%, transparent 50%)' }}>
    <div className="absolute right-0 top-0 bottom-0" style={{ width: '65%', opacity: 'var(--rt-bg-art-opacity, 0.28)' }}>
      <div style={{ position: 'absolute', right: 15, top: '50%', width: 115, height: 115, marginTop: -65, borderRadius: 22, background: 'linear-gradient(140deg, rgba(96,165,250,0.7) 0%, rgba(129,140,248,0.55) 100%)', filter: 'blur(0.5px)', transform: 'rotate(12deg)', animation: 'rt-sq-1 12s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', right: 65, top: '50%', width: 95, height: 95, marginTop: -35, borderRadius: 18, background: 'linear-gradient(160deg, rgba(129,140,248,0.55) 0%, rgba(165,180,252,0.4) 100%)', filter: 'blur(0.5px)', transform: 'rotate(32deg)', animation: 'rt-sq-2 10s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', right: 130, top: '50%', width: 72, height: 72, marginTop: -5, borderRadius: 14, background: 'linear-gradient(180deg, rgba(147,197,253,0.45) 0%, rgba(96,165,250,0.3) 100%)', filter: 'blur(0.5px)', transform: 'rotate(52deg)', animation: 'rt-sq-3 15s ease-in-out infinite' }} />
    </div>
  </div>
);

const RTFreeBackground = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ background: 'radial-gradient(ellipse at 75% 40%, rgba(52,211,153,0.05) 0%, transparent 45%)' }}>
    <div className="absolute right-0 top-0 bottom-0" style={{ width: '65%', opacity: 'var(--rt-bg-art-opacity, 0.28)', filter: 'blur(0.3px)' }}>
      <div style={{ position: 'absolute', right: 30, top: 15, width: 80, height: 80, borderRadius: '50% 50% 40% 60% / 55% 45% 55% 45%', background: 'linear-gradient(135deg, #34D399 0%, #60A5FA 100%)', animation: 'rt-morph-1 7s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', right: 160, top: 60, width: 55, height: 55, borderRadius: '45% 55% 50% 50%', background: 'linear-gradient(160deg, #6EE7B7 0%, #34D399 100%)', opacity: 0.6, animation: 'rt-morph-2 9s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', right: 90, bottom: 20, width: 65, height: 65, borderRadius: '55% 45% 50% 50% / 45% 55% 45% 55%', background: 'linear-gradient(200deg, #60A5FA 0%, #34D399 100%)', opacity: 0.45, animation: 'rt-morph-3 11s ease-in-out infinite' }} />
    </div>
  </div>
);

const RTLiveIndicator: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-center ml-auto" style={{ gap: 5, fontSize: 10, fontWeight: 500, color: 'var(--text-muted)' }}>
    <span style={{ position: 'relative', width: 5, height: 5, borderRadius: '50%', background: '#34D399' }}>
      <span style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: '1px solid rgba(52,211,153,0.25)', animation: 'rt-live-pulse 2s infinite' }} />
    </span>
    {text}
  </div>
);

const RoundtableCard: React.FC<{ data: any; agentAvatarId?: string | null }> = ({ data }) => {
  const concluded = data._replayStatus === 'concluded';
  const participants = data.participants || data.members || [];
  const mode = data.speaking_mode || 'free';
  const meta = RT_MODE_META[mode] || RT_MODE_META.free;
  const topColor = mode === 'moderator'
    ? 'linear-gradient(90deg, #F472B6 0%, #C084FC 40%, #818CF8 100%)'
    : mode === 'ordered'
      ? 'linear-gradient(90deg, #818CF8 0%, #60A5FA 50%, #93C5FD 100%)'
      : 'linear-gradient(90deg, #34D399 0%, #6EE7B7 40%, #60A5FA 100%)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="replay-roundtable-card rt-card relative overflow-hidden"
      style={{
        width: '100%', maxWidth: 580,
        height: 190, borderRadius: 16,
        background: 'var(--rt-card-bg)',
        border: 'var(--rt-card-border)',
        boxShadow: 'var(--rt-card-shadow)',
      }}
      data-testid={`replay-roundtable-card-${data.session_id || data.id || data.display_name || 'default'}`}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ zIndex: 3, background: topColor, opacity: 'var(--rt-topline-opacity, 0.5)' }} />

      {mode === 'moderator' && <RTHostBackground />}
      {mode === 'ordered' && <RTOrderedBackground />}
      {mode === 'free' && <RTFreeBackground />}

      <div className="relative h-full flex flex-col" style={{ zIndex: 2, padding: '20px 22px' }} data-testid="replay-roundtable-card-content">
          <div className="inline-flex items-center gap-1 px-2 rounded-full text-[10px] font-semibold mb-2 w-fit" style={{
          padding: '3px 8px',
          background: mode === 'moderator' ? 'var(--rt-tag-host-bg)' : mode === 'ordered' ? 'var(--rt-tag-ord-bg)' : 'var(--rt-tag-free-bg)',
          color: mode === 'moderator' ? 'var(--rt-tag-host-color)' : mode === 'ordered' ? 'var(--rt-tag-ord-color)' : 'var(--rt-tag-free-color)',
        }}>
          {meta.icon}
          {meta.label}
          {concluded && <span style={{ marginLeft: 4, opacity: 0.7 }}>· 已结束</span>}
        </div>

          <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.01em', color: 'var(--text-primary)', marginBottom: 4 }}>
          {data.display_name || '圆桌讨论'}
          </div>

          {data.topic && (
          <div style={{ fontSize: 11, lineHeight: 1.45, color: 'var(--text-muted)' }}>
            {data.topic.length > 50 ? data.topic.slice(0, 50) + '…' : data.topic}
          </div>
        )}

          {!concluded && (
          <div className="my-auto flex items-center" style={{ gap: 6 }}>
            {mode === 'free' ? (
              <>
                <div className="flex items-center" style={{ gap: 2, height: 18 }}>
                  {[6, 14, 9, 16, 7, 11].map((h, i) => (
                    <div key={i} style={{ width: 2.5, height: h, borderRadius: 1.5, background: '#34D399', animation: `rt-wave 1.2s ease-in-out infinite ${i * 0.1}s` }} />
                  ))}
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>讨论进行中</span>
              </>
            ) : (
              <div className="flex items-center gap-2 rounded-full" style={{ padding: '5px 12px 5px 5px', background: 'var(--rt-bar-bg)', border: '1px solid var(--rt-bar-border)' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', inset: 0, background: rtNameToGradient(participants[0]?.display_name || '参与者'), filter: 'blur(2px) saturate(1.3)' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>讨论中</span>
                <div className="flex" style={{ gap: 2, marginLeft: 2 }}>
                  {[0, 1, 2].map(i => <i key={i} style={{ display: 'block', width: 3, height: 3, borderRadius: '50%', background: 'var(--rt-typing-dot)', animation: `rt-typing 1.2s infinite ${i * 0.15}s` }} />)}
                </div>
              </div>
            )}
          </div>
        )}

          {concluded && <div className="flex-1" />}

          <div className="flex items-center mt-auto" style={{ gap: 12, paddingTop: 12 }}>
          <div className="flex">
            {participants.slice(0, 5).map((p: any, i: number) => (
              <div
                className="replay-roundtable-participant"
                key={p.id || p.name || i}
                style={{ marginLeft: i > 0 ? -7 : 0, position: 'relative', zIndex: 5 - i, width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--rt-card-bg)', overflow: 'hidden' }}
                data-testid={`replay-roundtable-participant-${p.id || p.name || i}`}
              >
                <div style={{ position: 'absolute', inset: 0, background: rtNameToGradient(p.display_name || p.name || `P${i}`), filter: 'blur(3px) saturate(1.3)' }} />
              </div>
            ))}
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{participants.length} 人</span>

          {!concluded && <RTLiveIndicator text="进行中" />}
          {concluded && (
            <span className="ml-auto" style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999, color: 'var(--text-muted)', background: 'var(--rt-chip-bg)', border: '1px solid var(--rt-chip-border)' }}>
              讨论完成
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Questionnaire reply in user message
// ---------------------------------------------------------------------------

const QuestionnaireReplyDisplay: React.FC<{ data: any }> = ({ data }) => {
  if (!data?.items?.length) return <span>问卷回复</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="replay-questionnaire-reply">
      {data.items.map((item: any, i: number) => (
        <div key={i} className="replay-questionnaire-reply-item" data-testid={`replay-questionnaire-reply-item-${i}`}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{item.question}</div>
          <div style={{ fontWeight: 500 }}>
            {item.omitted ? '未填写（可选）' : Array.isArray(item.answer) ? item.answer.join(', ') : item.answer}
          </div>
        </div>
      ))}
    </div>
  );
};
