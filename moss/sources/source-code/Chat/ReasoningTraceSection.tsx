import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { track } from '../../utils/track';
import { ActionFeed, type ActionItemData } from './ActionFeed';
import type { ConversationExecution } from '../../types';
import type { SubAgentExecution } from '../../types';
import type { ProcessTraceNoteVM, ToolCallVM } from '../../conversation/model/viewTypes';
import { SubAgentCardsSection } from './SubAgentCards';
import { resolveSubAgentTimelinePlacement } from './ActionFeed/subagentTimeline';
import {
  visibleReasoningActionItems,
} from './assistantMessageUtils';

const ACTIONFEED_LRU_MAX = 3;
const ACTIONFEED_RELEASE_DELAY = 60_000;
const DIRECT_TOOL_PLACEHOLDER = '调用工具进行深度洞察...';

type EvictCallback = () => void;
const lruOrder: string[] = [];
const lruCallbacks = new Map<string, EvictCallback>();

function actionFeedLruRegister(id: string, onEvict: EvictCallback) {
  const idx = lruOrder.indexOf(id);
  if (idx !== -1) lruOrder.splice(idx, 1);
  lruOrder.push(id);
  lruCallbacks.set(id, onEvict);

  while (lruOrder.length > ACTIONFEED_LRU_MAX) {
    const evictedId = lruOrder.shift()!;
    const cb = lruCallbacks.get(evictedId);
    lruCallbacks.delete(evictedId);
    cb?.();
  }
}

function actionFeedLruUnregister(id: string) {
  const idx = lruOrder.indexOf(id);
  if (idx !== -1) lruOrder.splice(idx, 1);
  lruCallbacks.delete(id);
}

interface ReasoningTraceSectionProps {
  messageId: string;
  traceKey?: string;
  isLast: boolean;
  isRunning: boolean;
  thinkingContent: string;
  processTraceNotes?: ProcessTraceNoteVM[];
  useRuntimeTools: boolean;
  runtimeTools?: ToolCallVM[];
  relatedExecution?: ConversationExecution;
  terminalStatus?: string;
  durationSeconds?: number;
  processingStarted?: boolean;
  sourceCount?: number;
  onSourcesClick?: () => void;
  subAgents?: SubAgentExecution[];
}

function formatDuration(seconds?: number): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  const mins = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest > 0 ? `${mins}m ${rest}s` : `${mins}m`;
}

function CompletionChevronDownIcon({ expanded }: { expanded?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ transform: expanded ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.37944 4.37944C4.13536 4.62352 3.73964 4.62352 3.49556 4.37944L0.183058 1.06694C-0.0610195 0.822864 -0.0610194 0.427136 0.183058 0.183058C0.427136 -0.0610195 0.822864 -0.0610194 1.06694 0.183058L3.9375 3.05362L6.80806 0.183059C7.05214 -0.0610189 7.44786 -0.0610188 7.69194 0.183059C7.93602 0.427137 7.93602 0.822865 7.69194 1.06694L4.37944 4.37944Z"
        fill="currentColor"
        opacity="0.72"
        transform="translate(4.0625 5.6875)"
      />
    </svg>
  );
}

function CompletedReasoningToggle({
  durationText,
  terminalStatus,
  expanded,
  onClick,
  sourceCount = 0,
  onSourcesClick,
}: {
  durationText: string | null;
  terminalStatus?: string;
  expanded: boolean;
  onClick: () => void;
  sourceCount?: number;
  onSourcesClick?: () => void;
}) {
  const text = terminalStatus === 'timeout'
    ? '任务执行超时'
    : terminalStatus === 'failed'
      ? '任务执行失败'
      : terminalStatus === 'cancelled'
        ? '任务已取消'
        : durationText
          ? `已完成，耗时${durationText}`
          : '已完成';
  const hasSources = sourceCount > 0 && Boolean(onSourcesClick);
  return (
    <div className="inline-flex items-center" style={{ height: 34, gap: 8 }}>
      <button
        type="button"
        onClick={onClick}
        title="展开或收起工作过程"
        className="inline-flex items-center transition-opacity cursor-pointer hover:opacity-80"
        style={{
          color: 'var(--text-muted)',
          background: 'transparent',
          border: 'none',
          padding: '4px 0',
          height: 34,
          gap: 4,
          fontSize: 14,
          lineHeight: '22px',
          fontWeight: 500,
        }}
      >
        <span>{text}</span>
        <CompletionChevronDownIcon expanded={expanded} />
      </button>
      {hasSources && (
        <button
          type="button"
          onClick={onSourcesClick}
          title="查看信息来源"
          className="inline-flex items-center transition-opacity cursor-pointer hover:opacity-80"
          style={{
            color: 'var(--accent-color)',
            background: 'transparent',
            border: 'none',
            borderRadius: 2,
            padding: '0 4px',
            height: 22,
            fontSize: 14,
            lineHeight: '22px',
            fontWeight: 400,
          }}
        >
          {sourceCount} 信息来源
        </button>
      )}
    </div>
  );
}

export const ReasoningTraceSection = memo(function ReasoningTraceSection({
  messageId,
  traceKey,
  isLast,
  isRunning,
  thinkingContent,
  processTraceNotes,
  useRuntimeTools,
  runtimeTools,
  relatedExecution,
  terminalStatus,
  durationSeconds,
  processingStarted = false,
  sourceCount = 0,
  onSourcesClick,
  subAgents = [],
}: ReasoningTraceSectionProps) {
  const [collapsed, setCollapsed] = useState(!isLast || !isRunning);
  const [mounted, setMounted] = useState(isLast && isRunning);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expansionScrollFrameRef = useRef<number | null>(null);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const userManuallyExpandedRef = useRef(false);
  const actionItemsTraceKeyRef = useRef(traceKey || messageId);
  const stableActionItemsRef = useRef<ActionItemData[]>([]);
  const thinking = thinkingContent.trim();

  const currentActionItems = useMemo((): ActionItemData[] => {
    return visibleReasoningActionItems(
      useRuntimeTools ? runtimeTools : undefined,
      relatedExecution,
    );
  }, [relatedExecution, runtimeTools, useRuntimeTools]);
  const actionItemsTraceKey = traceKey || messageId;
  if (actionItemsTraceKeyRef.current !== actionItemsTraceKey) {
    actionItemsTraceKeyRef.current = actionItemsTraceKey;
    stableActionItemsRef.current = [];
  }
  if (currentActionItems.length > 0) {
    stableActionItemsRef.current = currentActionItems;
  }
  const stableActionItems = currentActionItems.length > 0
    ? currentActionItems
    : stableActionItemsRef.current;
  const subAgentPlacement = useMemo(
    () => resolveSubAgentTimelinePlacement(stableActionItems, subAgents),
    [stableActionItems, subAgents],
  );
  const actionAttachments = useMemo(() => new Map(
    Array.from(subAgentPlacement.byActionId.entries()).map(([actionId, anchoredSubAgents]) => [
      actionId,
      <SubAgentCardsSection
        key={`subagent-anchor:${actionId}`}
        subAgents={anchoredSubAgents}
      />,
    ]),
  ), [subAgentPlacement.byActionId]);
  const trailingAttachment = subAgentPlacement.unanchored.length > 0
    ? <SubAgentCardsSection subAgents={subAgentPlacement.unanchored} />
    : undefined;
  const attachmentVersion = useMemo(() => subAgents.map(subAgent => [
    subAgent.taskId,
    subAgent.status,
    subAgent.iteration,
    subAgent.toolSteps?.length ?? 0,
    subAgent.artifacts?.length ?? 0,
  ].join(':')).join('|'), [subAgents]);
  const hasProcessTraceNotes = Boolean(processTraceNotes?.length);
  const fallbackThinking = !thinking && !hasProcessTraceNotes && stableActionItems.length > 0
    ? DIRECT_TOOL_PLACEHOLDER
    : '';
  const visibleThinking = thinking || fallbackThinking;
  const actionCount = (processTraceNotes?.length || (visibleThinking ? 1 : 0)) + stableActionItems.length;
  const hasActionFeed = actionCount > 0 || subAgents.length > 0 || (isRunning && processingStarted);
  const actionItems = mounted ? stableActionItems : [];

  useEffect(() => {
    if (!isLast) return;
    if (isRunning) {
      setCollapsed(false);
      setMounted(true);
      userManuallyExpandedRef.current = false;
      return;
    }
    if (hasActionFeed && !userManuallyExpandedRef.current) {
      setCollapsed(true);
    }
  }, [hasActionFeed, isLast, isRunning]);

  useEffect(() => () => {
    actionFeedLruUnregister(messageId);
    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    if (expansionScrollFrameRef.current != null) {
      cancelAnimationFrame(expansionScrollFrameRef.current);
    }
  }, [messageId]);

  const scrollExpandedTraceToStart = useCallback(() => {
    if (expansionScrollFrameRef.current != null) {
      cancelAnimationFrame(expansionScrollFrameRef.current);
    }
    expansionScrollFrameRef.current = requestAnimationFrame(() => {
      expansionScrollFrameRef.current = requestAnimationFrame(() => {
        expansionScrollFrameRef.current = null;
        sectionRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    });
  }, []);

  const toggle = useCallback(() => {
    if (isRunning) return;
    setCollapsed((prev) => {
      const willExpand = prev;
      if (willExpand) {
        track('execution_chain_expand', { trace_id: traceKey || messageId });
      }
      const willCollapse = !prev;
      userManuallyExpandedRef.current = !willCollapse;
      if (willCollapse) {
        if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
        releaseTimerRef.current = setTimeout(() => {
          setMounted(false);
          actionFeedLruUnregister(messageId);
        }, ACTIONFEED_RELEASE_DELAY);
      } else {
        if (releaseTimerRef.current) {
          clearTimeout(releaseTimerRef.current);
          releaseTimerRef.current = null;
        }
        setMounted(true);
        actionFeedLruRegister(messageId, () => {
          setCollapsed(true);
          setMounted(false);
        });
        scrollExpandedTraceToStart();
      }
      return willCollapse;
    });
  }, [isRunning, messageId, scrollExpandedTraceToStart]);

  if (!hasActionFeed) return null;
  const durationText = formatDuration(durationSeconds);

  return (
    <div
      ref={sectionRef}
      className="w-full"
      style={{ paddingLeft: 0, boxSizing: 'border-box' }}
      data-testid="reasoning-trace-section"
    >
      {!isRunning && (
        <CompletedReasoningToggle
          durationText={durationText}
          terminalStatus={terminalStatus}
          expanded={!collapsed}
          onClick={toggle}
          sourceCount={sourceCount}
          onSourcesClick={onSourcesClick}
        />
      )}
      {!collapsed && (
        <ActionFeed
          actions={actionItems}
          thinkingContent={visibleThinking}
          processTraceNotes={processTraceNotes}
          running={isRunning}
          processingStarted={processingStarted}
          collapsed={collapsed}
          onToggleCollapse={toggle}
          showToggle={false}
          actionAttachments={actionAttachments}
          trailingAttachment={trailingAttachment}
          attachmentVersion={attachmentVersion}
        />
      )}
    </div>
  );
});
