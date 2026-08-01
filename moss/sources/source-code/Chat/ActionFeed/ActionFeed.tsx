import React, { memo, useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { ChevronDown, Circle, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { ActionItem, type ActionItemData } from './ActionItem';
import type { ProcessTraceNoteVM } from '../../../conversation/model/viewTypes';

// ========== 常量 ==========

/** 容器最大高度（px）— 统一上限，超出后滚动 */
const MAX_HEIGHT = 528;

/** Todo 相关工具 */
const TODO_TOOLS = ['todo_write'];

const PREVIEW_TEXT_MAX_WIDTH = 96;

const THINKING_PREVIEW_COPY = {
  zh: {
    more: '更多',
    showFullContent: '展示完整思考内容',
  },
  en: {
    more: 'More',
    showFullContent: 'Show full reasoning',
  },
} as const;

export function resolveThinkingPreviewCopy(language?: string) {
  const browserLanguage = language ?? (
    typeof navigator === 'undefined'
      ? 'zh'
      : navigator.language || navigator.languages?.[0] || ''
  );
  return browserLanguage.toLowerCase().startsWith('zh')
    ? THINKING_PREVIEW_COPY.zh
    : THINKING_PREVIEW_COPY.en;
}

// ========== 类型定义 ==========

export interface SubAgentState {
  taskId: string;
  task: string;
  agentType?: string;
  agentKind?: string;
  displayName?: string;
  status: 'running' | 'completed' | 'failed';
  iteration: number;
  thoughtPreview?: string;
  toolSummary?: string;
  outputPreview?: string;
  /** 同一 task 工具调用的并行子任务共享此 id（来自后端 parent_task_id）。 */
  parentTaskId?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  /** PRD §08 四层结构化返回 */
  executionSummary?: string;
  coreConclusion?: string;
  artifacts?: Array<{ path: string; size_bytes?: number; mime_type?: string; category?: string; summary?: string }>;
  durationMs?: number;
  iterationsUsed?: number;
  tokensUsed?: number;
  degraded?: boolean;
  /** PRD §11 重试 */
  retryCount?: number;
  retryReason?: string;
}

export interface ActionFeedProps {
  /** 行动数据列表 */
  actions: ActionItemData[];
  /** 深度思考内容 */
  thinkingContent?: string;
  /** 由正文迁移或工具直启生成的过程节点 */
  processTraceNotes?: ProcessTraceNoteVM[];
  /** 整体是否仍在运行中，用于顶部状态动效 */
  running?: boolean;
  /** 是否已进入处理期：正文或执行链任一出现后为 true */
  processingStarted?: boolean;
  /** 是否折叠模式（只显示徽章） */
  collapsed?: boolean;
  /** 折叠/展开回调 */
  onToggleCollapse?: () => void;
  /** 是否显示展开/折叠按钮 */
  showToggle?: boolean;
  /** 以工具调用 ID 为锚点的特殊展示内容，例如子智能体执行看板。 */
  actionAttachments?: ReadonlyMap<string, React.ReactNode>;
  /** 无法归因的旧数据兼容展示，仍保留在思考链内部。 */
  trailingAttachment?: React.ReactNode;
  /** 附件状态变化标识，用于保持运行态自动滚动。 */
  attachmentVersion?: string;
}

// ========== 折叠徽章组件 ==========

interface CollapsedBadgeProps {
  actionCount: number;
  onClick?: () => void;
}

const CollapsedBadge: React.FC<CollapsedBadgeProps> = memo(({
  actionCount,
  onClick,
}) => {
  if (actionCount === 0) return null;
  
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm transition-opacity cursor-pointer"
      style={{
        color: 'var(--text-muted)',
        lineHeight: '22px',
        background: 'transparent',
        border: 'none',
        padding: 0,
      }}
    >
      <span>{actionCount > 0 ? '已完成' : '正在处理'}</span>
      <ChevronDown size={12} />
    </button>
  );
});

CollapsedBadge.displayName = 'CollapsedBadge';

type ProcessNoteStatus = 'running' | 'completed' | 'failed';

// Shared CSS spinner for process rows and todo rows. It keeps the tapered tail and
// rotation direction consistent without relying on small raster or stroked icons.
function ActionFeedSpinnerIcon({
  size = 14,
  className,
  style,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { size?: number }) {
  const classes = [
    'action-feed-loading-spinner',
    className ?? '',
  ].filter(Boolean).join(' ');
  const spinnerStyle = {
    width: size,
    height: size,
    color: 'var(--text-secondary)',
    '--action-feed-spinner-scale': String(size / 20),
    ...style,
  } as React.CSSProperties;

  return (
    <span
      className={classes}
      style={spinnerStyle}
      aria-hidden="true"
      {...props}
    />
  );
}

function ProcessTerminalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="8" fill="currentColor" />
      <path
        d="M4.25 8.1L6.75 10.5L11.75 5.5"
        stroke="var(--bg-primary)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProcessWarningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 0C10.866 0 14 3.13401 14 7C14 10.866 10.866 14 7 14C3.13401 14 0 10.866 0 7C0 3.13401 3.13401 0 7 0ZM7 1.125C3.75533 1.125 1.125 3.75533 1.125 7C1.125 10.2447 3.75533 12.875 7 12.875C10.2447 12.875 12.875 10.2447 12.875 7C12.875 3.75533 10.2447 1.125 7 1.125ZM7 9.375C7.55228 9.375 8 9.82272 8 10.375C8 10.9273 7.55228 11.375 7 11.375C6.44772 11.375 6 10.9273 6 10.375C6 9.82272 6.44772 9.375 7 9.375ZM7 2.625C7.41421 2.625 7.75 2.96079 7.75 3.375V6.875C7.75 7.28921 7.41421 7.625 7 7.625C6.58579 7.625 6.25 7.28921 6.25 6.875V3.375C6.25 2.96079 6.58579 2.625 7 2.625Z"
        fill="currentColor"
      />
    </svg>
  );
}

const ProcessNoteIconSlot: React.FC<{ status?: ProcessNoteStatus }> = memo(({ status = 'completed' }) => {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'relative',
        width: 16,
        height: 30,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'inline-flex',
          width: 16,
          height: 16,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {status === 'running' ? (
          <ActionFeedSpinnerIcon
            size={15}
            data-testid="process-note-icon-slot"
            data-process-note-status={status}
          />
        ) : status === 'failed' ? (
          <span data-testid="process-note-icon-slot" data-process-note-status={status}>
            <ProcessWarningIcon />
          </span>
        ) : (
          <span data-testid="process-note-icon-slot" data-process-note-status={status}>
            <ProcessTerminalIcon />
          </span>
        )}
      </span>
    </span>
  );
});

ProcessNoteIconSlot.displayName = 'ProcessNoteIconSlot';

const ThinkingActionCard: React.FC<{
  content: string;
  status?: ProcessNoteStatus;
  animateMigration?: boolean;
}> = memo(({
  content,
  status = 'completed',
  animateMigration = false,
}) => {
  const fullContent = content.trim();
  const plainText = useMemo(() => markdownToPlainText(fullContent), [fullContent]);
  const expandedPlainText = useMemo(() => markdownToPlainText(fullContent, true), [fullContent]);
  const previewText = useMemo(() => buildThinkingPreviewFromPlainText(plainText), [plainText]);
  const [expanded, setExpanded] = useState(false);
  const hasOverflow = previewTextDisplayWidth(plainText) > PREVIEW_TEXT_MAX_WIDTH;
  const showMoreButton = hasOverflow && !expanded;
  const copy = resolveThinkingPreviewCopy();

  return (
    <motion.div
      initial={animateMigration ? { height: 0, opacity: 0, y: 12 } : false}
      animate={{ height: 'auto', opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="mb-0"
      style={{ overflow: 'hidden' }}
    >
      <div className="flex items-start" style={{ minHeight: 30, gap: 8 }}>
        <ProcessNoteIconSlot status={status} />
        <span
          style={{
            color: 'var(--text-secondary)',
            fontSize: 14,
            lineHeight: '22px',
            fontWeight: 400,
            paddingTop: 4,
            paddingBottom: 4,
            flex: '1 1 auto',
            minWidth: 0,
            overflowWrap: 'anywhere',
          }}
        >
          {expanded ? (
            <span data-testid="thinking-preview-full" style={{ whiteSpace: 'pre-wrap' }}>
              {expandedPlainText}
            </span>
          ) : (
            <span>{previewText}</span>
          )}
          {showMoreButton && (
            <button
              type="button"
              data-testid="thinking-preview-more"
              aria-label={copy.showFullContent}
              onClick={(event) => {
                event.stopPropagation();
                setExpanded(true);
              }}
              style={{
                display: 'inline',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-disabled)',
                fontSize: 13,
                lineHeight: '22px',
                marginLeft: 4,
                padding: 0,
                cursor: 'pointer',
                verticalAlign: 'baseline',
              }}
            >
              {copy.more}
            </button>
          )}
        </span>
      </div>
    </motion.div>
  );
});

ThinkingActionCard.displayName = 'ThinkingActionCard';

export function buildThinkingPreview(markdown: string): string {
  return buildThinkingPreviewFromPlainText(markdownToPlainText(markdown));
}

function buildThinkingPreviewFromPlainText(text: string): string {
  if (!text) return '';
  if (previewTextDisplayWidth(text) <= PREVIEW_TEXT_MAX_WIDTH) return text;
  const sentences = splitPlainSentences(text);
  let preview = '';
  for (const sentence of sentences) {
    const next = `${preview}${sentence}`;
    if (previewTextDisplayWidth(next) > PREVIEW_TEXT_MAX_WIDTH) break;
    preview = next;
  }
  return preview || slicePreviewText(text, PREVIEW_TEXT_MAX_WIDTH);
}

function previewTextDisplayWidth(text: string): number {
  return Array.from(text).length;
}

function slicePreviewText(text: string, maxLength: number): string {
  return Array.from(text).slice(0, maxLength).join('').trimEnd();
}

function splitPlainSentences(text: string): string[] {
  return text.match(/[^。！？!?；;]+[。！？!?；;]?/g)?.map(sentence => sentence.trim()).filter(Boolean) ?? [];
}

function markdownToPlainText(markdown: string, preserveLineBreaks = false): string {
  const plainText = markdown
    .replace(/```[\s\S]*?```/g, block => block.replace(/```[^\n]*\n?/g, '').replace(/```/g, ' '))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(^|[^\w])_([^_\n]+)_($|[^\w])/g, '$1$2$3')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/\\([\\`*_{}\[\]()#+\-.!>])/g, '$1');

  if (!preserveLineBreaks) {
    return plainText.replace(/\s+/g, ' ').trim();
  }

  return plainText
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const RunningStatusHeader: React.FC<{ mode: 'thinking' | 'processing' }> = memo(({ mode }) => (
  <div
    className="inline-flex items-center"
    style={{
      height: 22,
      padding: 0,
      marginBottom: 6,
      color: 'var(--text-muted)',
      fontSize: 14,
      lineHeight: '22px',
      fontWeight: 500,
    }}
  >
    <span className="action-feed-running-status">
      {mode === 'processing' ? '正在处理中...' : '正在思考...'}
    </span>
  </div>
));

RunningStatusHeader.displayName = 'RunningStatusHeader';

function splitThinkingLines(content: string): string[] {
  return content.split(/\n+/).map(line => line.trim()).filter(Boolean);
}

interface ProcessTraceGroup {
  note?: ProcessTraceNoteVM & { status: ProcessNoteStatus };
  actions: ActionItemData[];
}

function buildProcessTraceGroups(
  actions: ActionItemData[],
  processTraceNotes: ProcessTraceNoteVM[] | undefined,
  thinkingContent: string,
  running: boolean,
  processingStarted: boolean,
): ProcessTraceGroup[] {
  const explicitNotes = (processTraceNotes ?? [])
    .filter(note => note.content.trim())
    .slice()
    .sort((a, b) => a.eventSeq - b.eventSeq);
  const legacyNotes = explicitNotes.length > 0
    ? []
    : splitThinkingLines(thinkingContent).map((content, index) => ({
        id: `legacy-thinking-${index}`,
        content,
        eventSeq: Number.MIN_SAFE_INTEGER + index,
      }));
  const notes = [...explicitNotes, ...legacyNotes];

  if (notes.length === 0) {
    return actions.length > 0 ? [{ actions }] : [];
  }

  const hasActionEventSeq = actions.some(action => typeof action.traceEventSeq === 'number');
  if (!hasActionEventSeq) {
    return notes.map((note, index) => ({
      note: {
        ...note,
        status: processNoteStatus(
          index === 0 ? actions : [],
          running,
          index < notes.length - 1 || processingStarted || !running,
        ),
      },
      actions: index === 0 ? actions : [],
    }));
  }

  const groups: ProcessTraceGroup[] = [];
  const firstNoteSeq = notes[0].eventSeq;
  const beforeFirst = actions.filter(action => actionEventSeq(action) < firstNoteSeq);
  if (beforeFirst.length > 0) {
    groups.push({ actions: beforeFirst });
  }

  for (let index = 0; index < notes.length; index += 1) {
    const note = notes[index];
    const nextSeq = notes[index + 1]?.eventSeq ?? Number.POSITIVE_INFINITY;
    const groupedActions = actions.filter((action) => {
      const seq = actionEventSeq(action);
      return seq >= note.eventSeq && seq < nextSeq;
    });
    groups.push({
      note: {
        ...note,
        status: processNoteStatus(
          groupedActions,
          running,
          index < notes.length - 1 || processingStarted || !running,
        ),
      },
      actions: groupedActions,
    });
  }

  return groups;
}

function actionEventSeq(action: ActionItemData): number {
  return typeof action.traceEventSeq === 'number' ? action.traceEventSeq : Number.MAX_SAFE_INTEGER;
}

function processNoteStatus(
  actions: ActionItemData[],
  running: boolean,
  closedByNonToolMessage: boolean,
): ProcessNoteStatus {
  if (actions.some(action => action.status === 'pending' || action.status === 'running' || action.status === 'streaming')) {
    return 'running';
  }
  if (actions.length > 0) return closedByNonToolMessage ? 'completed' : 'running';
  return closedByNonToolMessage || !running ? 'completed' : 'running';
}

const PROCESS_TRACE_ACTIONS_STYLE: React.CSSProperties = {
  marginLeft: 7.5,
  marginTop: 1,
  paddingLeft: 15.5,
};

const PROCESS_TRACE_CONNECTOR_STYLE: React.CSSProperties = {
  position: 'absolute',
  left: 7.5,
  top: 29.5,
  width: 1.25,
  background: 'var(--border-default)',
  pointerEvents: 'none',
};

const TimelineAttachment: React.FC<{
  children: React.ReactNode;
  actionId?: string;
}> = memo(({ children, actionId }) => (
  <div
    data-testid="action-feed-inline-attachment"
    data-action-id={actionId}
    style={{
      position: 'relative',
      width: 'calc(100% - 21px)',
      marginLeft: 21,
      marginTop: 0,
      marginBottom: 2,
    }}
  >
    {actionId && (
      <span
        aria-hidden="true"
        data-testid="action-feed-delegation-connector"
        style={{
          position: 'absolute',
          top: -2,
          bottom: -2,
          left: -13.5,
          width: 1.25,
          borderRadius: 1,
          background: 'var(--border-default)',
          pointerEvents: 'none',
        }}
      />
    )}
    {children}
  </div>
));

TimelineAttachment.displayName = 'TimelineAttachment';

// ========== 全局任务清单组件（todo_write 专用） ==========

interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

interface GlobalTodoDisplayProps {
  todos: TodoItem[];
}

const GlobalTodoDisplay: React.FC<GlobalTodoDisplayProps> = memo(({ todos }) => {
  if (!todos || todos.length === 0) return null;
  
  // 统计
  const stats = useMemo(() => {
    const result = { total: 0, completed: 0, inProgress: 0, pending: 0, cancelled: 0 };
    for (const todo of todos) {
      result.total++;
      if (todo.status === 'completed') result.completed++;
      else if (todo.status === 'in_progress') result.inProgress++;
      else if (todo.status === 'cancelled') result.cancelled++;
      else result.pending++;
    }
    return result;
  }, [todos]);
  
  // 进度百分比
  const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  
  // 状态图标
  const StatusIcon: React.FC<{ status: string; size?: number }> = ({ status, size = 14 }) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={size} style={{ color: 'var(--text-muted)' }} />;
      case 'in_progress':
        return <ActionFeedSpinnerIcon size={size} />;
      case 'cancelled':
        return <XCircle size={size} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />;
      default:
        return <Circle size={size} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />;
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="mt-2 rounded-lg border overflow-hidden"
      style={{ 
        background: 'var(--bg-tertiary)',
        borderColor: 'var(--border-subtle)',
        maxWidth: '400px', // 卡片独立宽度，不跟随父容器
      }}
    >
      {/* 进度条头部 */}
      <div 
        className="px-3 py-2 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            任务清单
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {stats.completed}/{stats.total}
          </span>
        </div>
        {/* 进度条 */}
        <div 
          className="w-20 h-1.5 rounded-full overflow-hidden"
          style={{ background: 'var(--bg-secondary)' }}
        >
          <motion.div 
            className="h-full rounded-full"
            style={{ 
              background: progress === 100 
                ? 'var(--text-muted)' 
                : 'var(--text-tertiary)',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
      
      {/* 任务列表 */}
      <div className="px-2 py-1.5 space-y-0.5 max-h-64 overflow-y-auto">
        {todos.map((todo, index) => (
          <motion.div
            key={todo.id || index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            className={`flex items-start gap-2 px-2 py-1.5 rounded transition-colors ${
              todo.status === 'in_progress' 
                ? 'bg-zinc-500/5' 
                : ''
            }`}
          >
            {/* 状态图标 */}
            <div className="flex-shrink-0 mt-0.5">
              <StatusIcon status={todo.status} size={14} />
            </div>
            
            {/* 任务内容 */}
            <span 
              className={`text-xs leading-relaxed flex-1 ${
                todo.status === 'completed' || todo.status === 'cancelled'
                  ? 'line-through opacity-50'
                  : ''
              }`}
              style={{ 
                color: todo.status === 'in_progress' 
                  ? 'var(--text-primary)' 
                  : 'var(--text-secondary)'
              }}
            >
              {todo.content}
            </span>
            
            {/* 状态标签（仅进行中显示） */}
            {todo.status === 'in_progress' && (
              <span 
                className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded"
                style={{ 
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-muted)',
                }}
              >
                进行中
              </span>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
});

GlobalTodoDisplay.displayName = 'GlobalTodoDisplay';

// ========== 主组件 ==========

export const ActionFeed: React.FC<ActionFeedProps> = memo(({
  actions,
  thinkingContent = '',
  processTraceNotes,
  running = false,
  processingStarted = false,
  collapsed = false,
  onToggleCollapse,
  actionAttachments,
  trailingAttachment,
  attachmentVersion,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const runningMode = processingStarted || actions.length > 0 ? 'processing' : 'thinking';
  
  // ========== 全局任务清单逻辑 ==========
  // 找出所有 todo_write 调用，标记非最新的为 _isOldTodo
  // 【修改】现在按原始顺序显示，不再将 todo 移到最后
  const { 
    processedActions,   // 处理后的 actions，保持原始顺序
    latestTodos,        // 最新 todo_write 的 todos 数据（用于统计）
  } = useMemo(() => {
    const todoActions: ActionItemData[] = [];
    
    // 收集所有 todo_write
    for (const action of actions) {
      if (TODO_TOOLS.includes(action.toolName)) {
        todoActions.push(action);
      }
    }
    
    // 如果没有 todo_write，直接返回所有 actions
    if (todoActions.length === 0) {
      return {
        processedActions: actions,
        latestTodos: [],
      };
    }
    
    // 最新的 todo_write
    const latestTodo = todoActions[todoActions.length - 1];
    
    // 合并 todos 数据（从所有 todo_write 中合并）
    const mergedTodos = new Map<string, TodoItem>();
    for (const todoAction of todoActions) {
      const todos = todoAction.arguments.todos as TodoItem[] | undefined;
      if (todos) {
        for (const todo of todos) {
          mergedTodos.set(todo.id, todo);
        }
      }
    }
    
    // 构建 processedActions：保持原有顺序，标记旧的 todo_write
    const result: ActionItemData[] = [];
    for (const action of actions) {
      if (TODO_TOOLS.includes(action.toolName)) {
        // 标记是否是旧的 todo_write
        const isOld = action.id !== latestTodo.id;
        result.push({
          ...action,
          arguments: { ...action.arguments, _isOldTodo: isOld },
        });
      } else {
        result.push(action);
      }
    }
    
    return {
      processedActions: result,
      latestTodos: Array.from(mergedTodos.values()),
    };
  }, [actions]);
  
  // 无需动态计算 — 统一使用 MAX_HEIGHT 作为上限

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container || collapsed) return;
    container.scrollTop = container.scrollHeight;
  }, [collapsed]);

  // 数据变化时先滚到底部；内容高度动画和异步卡片布局由下方 ResizeObserver 继续跟随。
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToBottom();
    }
  }, [processedActions, thinkingContent, processTraceNotes, scrollToBottom, attachmentVersion]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => {
      if (shouldAutoScrollRef.current) {
        scrollToBottom();
      }
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [scrollToBottom]);
  
  // 处理滚动，检测用户是否手动滚动
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 10;
    shouldAutoScrollRef.current = isAtBottom;
  }, []);
  
  // 折叠模式：显示徽章
  const trimmedThinkingContent = thinkingContent.trim();
  const processTraceGroups = useMemo(
    () => buildProcessTraceGroups(
      processedActions,
      processTraceNotes,
      trimmedThinkingContent,
      running,
      processingStarted,
    ),
    [processedActions, processTraceNotes, trimmedThinkingContent, running, processingStarted],
  );
  const hasProcessTrace = processTraceGroups.some(group => group.note);
  const totalCount = actions.length + processTraceGroups.filter(group => group.note).length;

  if (collapsed) {
    return (
      <CollapsedBadge
        actionCount={totalCount}
        onClick={onToggleCollapse}
      />
    );
  }
  
  // 没有行动时不显示
  if (actions.length === 0 && !hasProcessTrace && !running) {
    return null;
  }
  
  return (
    <div
      className="relative"
      style={{
        maxWidth: '100%',
      }}
    >
      {/* 行动列表容器 - 固定高度，隐藏滚动条 */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-y-auto overflow-x-hidden scrollbar-hide"
        data-testid="action-feed-scroll-container"
        style={{
          maxHeight: MAX_HEIGHT,
          paddingLeft: 0,
          paddingRight: 8,
        }}
      >
        {running && <RunningStatusHeader mode={runningMode} />}
        <div
          ref={contentRef}
          data-testid="action-feed-chain"
          style={{ paddingLeft: 0, marginTop: 0 }}
        >
          {processTraceGroups.map((group, groupIndex) => {
            const hasFollowingNote = processTraceGroups
              .slice(groupIndex + 1)
              .some(nextGroup => nextGroup.note);
            const showConnector = Boolean(group.note && (group.actions.length > 0 || hasFollowingNote));

            return (
              <div
                key={group.note?.id ?? `direct-actions-${groupIndex}`}
                data-testid="process-trace-group"
                style={group.note ? { position: 'relative' } : undefined}
              >
                {showConnector && (
                  <span
                    aria-hidden="true"
                    data-testid="process-trace-connector"
                    style={{
                      ...PROCESS_TRACE_CONNECTOR_STYLE,
                      bottom: hasFollowingNote ? -0.5 : 1.5,
                    }}
                  />
                )}
                {group.note && (
                  <ThinkingActionCard
                    content={group.note.content}
                    status={group.note.status}
                    animateMigration={running && Boolean(group.note.segmentId)}
                  />
                )}
                {group.actions.length > 0 && (
                  <div style={group.note ? PROCESS_TRACE_ACTIONS_STYLE : undefined}>
                    {group.actions.map(action => (
                      <React.Fragment key={action.id}>
                        <ActionItem
                          data={action}
                          showExpandButton={true}
                          latestTodos={TODO_TOOLS.includes(action.toolName) ? latestTodos : undefined}
                        />
                        {actionAttachments?.get(action.id) && (
                          <TimelineAttachment actionId={action.id}>
                            {actionAttachments.get(action.id)}
                          </TimelineAttachment>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {trailingAttachment && (
            <TimelineAttachment>{trailingAttachment}</TimelineAttachment>
          )}
        </div>
      </div>
    </div>
  );
});

ActionFeed.displayName = 'ActionFeed';

// ========== 导出 ==========

export type { ActionItemData } from './ActionItem';
