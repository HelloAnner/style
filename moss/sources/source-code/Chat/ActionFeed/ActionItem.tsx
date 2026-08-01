/**
 * ActionItem - 单个行动项组件
 *
 * 展示一个工具调用的简洁信息：
 * - 状态指示（进行中/已完成/失败）
 * - 工具名称和行动描述
 * - 卡片模式（带图片的自定义工具）
 *
 * 生产模式下不展示参数和结果（已由后端过滤）。
 */

import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ToolDisplayCard } from './ToolDisplayCard';
import { useAuthStore } from '../../../stores/authStore';
import { useToolActionDisplay } from './useToolActionDisplay';
import { useAgentStore } from '../../../stores/agentStore';
import { useFrontendConfigStore } from '../../../stores/frontendConfigStore';
import { resolveTaskOperation } from './toolDisplayConfig';

// ========== 类型定义 ==========

export interface ActionItemData {
  id: string;
  toolName: string;
  displayName?: string;
  arguments: Record<string, unknown>;
  argumentsPreview?: Record<string, unknown>;
  status: 'pending' | 'running' | 'streaming' | 'completed' | 'failed';
  iteration: number;
  traceEventSeq?: number;
  durationMs?: number;
  delegateKind?: 'auto' | 'subagent' | 'derived' | 'main' | 'temp';
  delegateLabel?: string;
  taskPreview?: string;
  /** 并行委派多个任务时，逐项的任务描述（首项与 taskPreview 相同） */
  taskPreviews?: string[];
}

/** TodoItem 类型（用于 todo_write 统计） */
interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

interface ActionItemProps {
  data: ActionItemData;
  /** 是否显示展开按钮 */
  showExpandButton?: boolean;
  /** 最新的合并 todos（用于 todo_write 统计显示） */
  latestTodos?: TodoItem[];
}

type TimelineIconKind = 'read' | 'search' | 'draw' | 'warning' | 'loading';

// These are the product-specific timeline icons. Render at their native dimensions
// inside the fixed slot instead of replacing them with generic icons or scaling all
// of them to 14x14; that keeps the original visual language and reduces edge breakup.
const timelineIconPaths: Record<Exclude<TimelineIconKind, 'loading'>, { width: number; height: number; viewBox: string; d: string }> = {
  read: {
    width: 12.5,
    height: 14,
    viewBox: '0 0 12.5 14',
    d: 'M10.5 0C11.6046 0 12.5 0.895431 12.5 2V12C12.5 13.1046 11.6046 14 10.5 14H2C0.895431 14 0 13.1046 0 12V2C0 0.895431 0.895431 0 2 0H10.5ZM2.125 1.125C1.57272 1.125 1.125 1.57272 1.125 2.125V11.875C1.125 12.4273 1.57272 12.875 2.125 12.875H3.25V1.125H2.125ZM4.375 12.875H10.375C10.9273 12.875 11.375 12.4273 11.375 11.875V2.125C11.375 1.57272 10.9273 1.125 10.375 1.125H4.375V12.875ZM9.3125 5.875C9.62316 5.875 9.875 6.12684 9.875 6.4375C9.875 6.74816 9.62316 7 9.3125 7H6.4375C6.12684 7 5.875 6.74816 5.875 6.4375C5.875 6.12684 6.12684 5.875 6.4375 5.875H9.3125ZM9.3125 3.25C9.62316 3.25 9.875 3.50184 9.875 3.8125C9.875 4.12316 9.62316 4.375 9.3125 4.375H6.4375C6.12684 4.375 5.875 4.12316 5.875 3.8125C5.875 3.50184 6.12684 3.25 6.4375 3.25H9.3125Z',
  },
  search: {
    width: 13.1413,
    height: 13.0021,
    viewBox: '0 0 13.1413 13.0021',
    d: 'M3.32065 0.871903C6.26543 -0.828269 9.9875 0.0377366 11.8977 2.77598L12.2974 2.54518C12.5665 2.38985 12.9105 2.48203 13.0658 2.75107C13.2212 3.02011 13.129 3.36413 12.8599 3.51946L12.4602 3.75026C13.8765 6.77365 12.7654 10.4301 9.82065 12.1302C6.87586 13.8304 3.15379 12.9644 1.24361 10.2262L0.843844 10.457C0.574804 10.6123 0.230785 10.5201 0.0754546 10.2511C-0.0798755 9.98203 0.0123043 9.63801 0.281344 9.48268L0.681109 9.25187C-0.735191 6.22848 0.37586 2.57208 3.32065 0.871903ZM5.45422 7.79515C6.22611 9.01897 7.08917 9.97165 7.86282 10.5561C8.30094 10.887 8.66496 11.0656 8.92927 11.1364C9.05711 11.1706 9.14283 11.1746 9.19246 11.171C9.2378 11.1677 9.25412 11.1583 9.25815 11.156C9.26217 11.1536 9.27844 11.1442 9.30399 11.1066C9.33195 11.0654 9.37135 10.9892 9.40563 10.8613C9.47648 10.5971 9.50386 10.1925 9.4363 9.64764C9.317 8.68541 8.92348 7.46164 8.24957 6.18126L5.45422 7.79515ZM2.22227 9.66112C3.47547 11.39 5.61584 12.1822 7.6426 11.7695C6.60158 11.1219 5.45517 9.91506 4.47931 8.35802L2.22227 9.66112ZM9.22448 5.6184C10.085 7.24205 10.5569 8.83828 10.5972 10.0637C11.968 8.51475 12.3522 6.26504 11.4815 4.31529L9.22448 5.6184ZM2.544 2.93846C1.17323 4.48736 0.78913 6.73711 1.65977 8.68684L3.91681 7.38374C3.05629 5.76008 2.58435 4.16384 2.544 2.93846ZM3.88315 1.84618C3.87912 1.84851 3.86285 1.85795 3.8373 1.89556C3.80934 1.93672 3.76994 2.01296 3.73567 2.14079C3.66481 2.40508 3.63743 2.8096 3.70499 3.3545C3.82429 4.31672 4.21781 5.54049 4.89172 6.82087L7.68707 5.20698C6.91518 3.98317 6.05212 3.03048 5.27846 2.44605C4.84035 2.11509 4.47633 1.93655 4.21202 1.86576C4.08418 1.83153 3.99846 1.82753 3.94883 1.83116C3.90349 1.83448 3.88717 1.84386 3.88315 1.84618ZM5.4986 1.23262C6.53964 1.88024 7.6861 3.08704 8.66198 4.64412L10.919 3.34102C9.66581 1.61213 7.52539 0.819919 5.4986 1.23262Z',
  },
  draw: {
    width: 12.6922,
    height: 12.9905,
    viewBox: '0 0 12.6922 12.9905',
    d: 'M3.52533 5.99049C3.83598 5.99049 4.08782 6.24234 4.08783 6.55299C4.08783 6.86365 3.83599 7.11549 3.52533 7.11549H2.09375C1.55873 7.11549 1.12501 7.54922 1.125 8.08424C1.125 8.61927 1.55872 9.05299 2.09375 9.05299H10.7188C11.8061 9.05299 12.6875 9.93444 12.6875 11.0217C12.6875 12.109 11.8061 12.9905 10.7188 12.9905H5.49585C5.18519 12.9905 4.93335 12.7386 4.93335 12.428C4.93336 12.1173 5.18519 11.8655 5.49585 11.8655H10.7188C11.1847 11.8655 11.5625 11.4877 11.5625 11.0217C11.5625 10.5558 11.1847 10.178 10.7188 10.178H2.09375C0.937403 10.178 0 9.24058 0 8.08424C0 6.9279 0.937409 5.99049 2.09375 5.99049H3.52533ZM8.89917 0.458262C9.50892 -0.152416 10.498 -0.152807 11.1082 0.457408L12.2344 1.58363C12.8445 2.1938 12.8449 3.18344 12.2352 3.79408L9.16394 6.87013C8.87191 7.1626 8.47596 7.32738 8.06281 7.32838L6.93469 7.33113C6.06955 7.33321 5.36749 6.63115 5.36896 5.76539L5.37091 4.63636C5.37162 4.22298 5.53597 3.82674 5.82794 3.53431L8.89917 0.458262ZM10.3133 1.25349C10.1424 1.08263 9.86543 1.0827 9.6947 1.25367L6.62347 4.32972C6.54172 4.4116 6.49568 4.52263 6.49548 4.63838L6.49365 5.76728C6.49324 6.00969 6.68977 6.20628 6.93201 6.2057L8.06012 6.20295C8.17579 6.20266 8.28665 6.15654 8.36841 6.07466L11.4396 2.99861C11.6104 2.82763 11.6103 2.5505 11.4395 2.37965L10.3133 1.25349Z',
  },
  warning: {
    width: 14,
    height: 14,
    viewBox: '0 0 14 14',
    d: 'M7 0C10.866 0 14 3.13401 14 7C14 10.866 10.866 14 7 14C3.13401 14 0 10.866 0 7C0 3.13401 3.13401 0 7 0ZM7 1.125C3.75533 1.125 1.125 3.75533 1.125 7C1.125 10.2447 3.75533 12.875 7 12.875C10.2447 12.875 12.875 10.2447 12.875 7C12.875 3.75533 10.2447 1.125 7 1.125ZM7 9.375C7.55228 9.375 8 9.82272 8 10.375C8 10.9273 7.55228 11.375 7 11.375C6.44772 11.375 6 10.9273 6 10.375C6 9.82272 6.44772 9.375 7 9.375ZM7 2.625C7.41421 2.625 7.75 2.96079 7.75 3.375V6.875C7.75 7.28921 7.41421 7.625 7 7.625C6.58579 7.625 6.25 7.28921 6.25 6.875V3.375C6.25 2.96079 6.58579 2.625 7 2.625Z',
  },
};

// ========== 主组件 ==========
// 注意：todo_write 的展示由 ActionFeed 中的 GlobalTodoDisplay 统一管理

/** 需要特殊展示的工具 */
const TODO_TOOLS = ['todo_write'];

function buildTaskDelegatePrefix(data: ActionItemData): string | null {
  switch (data.delegateKind) {
    case 'derived':
      return '派生分身';
    case 'subagent':
      return '专业伙伴';
    case 'main':
      return '主智能体';
    case 'temp':
      return '临时伙伴';
    case 'auto':
      return '自动匹配伙伴';
    default:
      return null;
  }
}

/** task 工具只展示父级动作；每个委派任务的详细状态由 SubAgentCards 消费 subagent.* 事件展示。 */
function formatTaskDelegateAction(data: ActionItemData): string | null {
  if (data.toolName !== 'task') return null;
  if (resolveTaskOperation(data.arguments) !== 'create') return null;
  const delegateType = buildTaskDelegatePrefix(data);
  if (!delegateType) return null;

  const count = data.taskPreviews?.length || (data.taskPreview ? 1 : 0);
  const countText = count > 1 ? `${count} 个` : '';
  const targetText = data.delegateLabel && count <= 1
    ? `「${data.delegateLabel}」`
    : `${countText}${delegateType}`;

  return `发起${targetText}委派`;
}

function getTimelineIconKind(toolName: string, text: string, isRunning: boolean, isFailed: boolean): TimelineIconKind {
  if (isRunning) return 'loading';
  if (isFailed) return 'warning';
  const key = `${toolName} ${text}`.toLowerCase();
  if (key.includes('read') || key.includes('阅读')) return 'read';
  if (
    key.includes('write')
    || key.includes('edit')
    || key.includes('apply_patch')
    || key.includes('写入')
    || key.includes('编辑')
    || key.includes('修改')
  ) return 'draw';
  if (key.includes('draw') || key.includes('绘制') || key.includes('widget') || key.includes('图')) return 'draw';
  if (key.includes('warn') || key.includes('警告')) return 'warning';
  return 'search';
}

function TimelineIcon({ kind }: { kind: TimelineIconKind }) {
  if (kind === 'loading') {
    return (
      <span
        className="timeline-loading-icon"
        aria-hidden="true"
        style={{ width: 14, height: 14, '--action-feed-spinner-scale': '0.7' } as React.CSSProperties}
      />
    );
  }

  const icon = timelineIconPaths[kind];
  return (
    <svg
      width={icon.width}
      height={icon.height}
      viewBox={icon.viewBox}
      fill="none"
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <path d={icon.d} fill="currentColor" />
    </svg>
  );
}

function TimelineIconSlot({
  kind,
  color,
  showIcon = true,
}: {
  kind: TimelineIconKind;
  color: string;
  showIcon?: boolean;
}) {
  return (
    <span
      data-testid="timeline-icon-slot"
      aria-hidden="true"
      style={{
        width: 14,
        height: 30,
        alignSelf: 'stretch',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
        flexShrink: 0,
      }}
    >
      {showIcon && (
        <span style={{ display: 'inline-flex' }}>
          <TimelineIcon kind={kind} />
        </span>
      )}
    </span>
  );
}

function formatDuration(ms?: number): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function stringArg(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberArg(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function getWriteProgress(preview: Record<string, unknown> | undefined): {
  path: string | null;
  lineCount: number | null;
  contentLength: number | null;
} | null {
  const source = preview ? { ...preview } : {};
  const content = stringArg(source.content) ?? stringArg(source.file_text);
  const path = stringArg(source.path);
  const lineCount = numberArg(source.line_count) ?? (content ? content.split('\n').length : null);
  const contentLength = numberArg(source.content_length) ?? (content ? content.length : null);
  if (!path && lineCount == null && contentLength == null) return null;
  return { path, lineCount, contentLength };
}

function ProgressStats({ progress, label }: {
  progress: { lineCount: number | null; contentLength: number | null };
  label: string;
}) {
  return (
    <>
      {label}{' '}
      {progress.lineCount != null && (
        <>
          <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
            {formatCount(progress.lineCount)}
          </span>
          {' 行'}
        </>
      )}
      {progress.lineCount != null && progress.contentLength != null ? ' · ' : ''}
      {progress.contentLength != null && (
        <>
          <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
            {formatCount(progress.contentLength)}
          </span>
          {' 字符'}
        </>
      )}
    </>
  );
}

export const ActionItem: React.FC<ActionItemProps> = memo(({
  data,
  showExpandButton: _showExpandButton = true,
  latestTodos: _latestTodos,
}) => {
  const { toolName, arguments: args, status } = data;
  const showToolDurations = useFrontendConfigStore((state) => state.showToolDurations);

  const { actionText: baseActionText, displayCfg } =
    useToolActionDisplay(toolName, args, data.displayName);

  const tools = useAgentStore(s => s.tools);
  const toolInfo = useMemo(() => tools.find(t => t.name === toolName) ?? null, [tools, toolName]);
  const tenantId = useAuthStore(s => s.tenant?.id) || '';

  const isCardMode = displayCfg?.style === 'card';

  const useTodoDisplay = TODO_TOOLS.includes(toolName);
  const isOldTodo = useTodoDisplay && args._isOldTodo === true;

  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const isRunning = status === 'running' || status === 'streaming' || status === 'pending';
  const durationText = showToolDurations && !isRunning ? formatDuration(data.durationMs) : null;
  const [detailExpanded, setDetailExpanded] = useState(!isCompleted);

  const taskDelegateAction = useMemo(() => formatTaskDelegateAction(data), [data]);

  const actionText = useMemo(() => {
    if (isOldTodo) return `更新任务清单`;
    if (taskDelegateAction) return taskDelegateAction;
    return baseActionText;
  }, [isOldTodo, taskDelegateAction, baseActionText]);
  const writeProgress = toolName === 'write'
    ? getWriteProgress(data.argumentsPreview ?? args)
    : null;
  const hasProgressDetail = Boolean(writeProgress);
  const prevCompletedRef = useRef(isCompleted);

  useEffect(() => {
    if (isCompleted && !prevCompletedRef.current && hasProgressDetail) {
      setDetailExpanded(false);
    }
    prevCompletedRef.current = isCompleted;
  }, [hasProgressDetail, isCompleted]);

  const cardImageUrl = useMemo(() => {
    if (!isCardMode || !displayCfg?.card_image || !tenantId || !toolName) return undefined;
    const packParam = toolInfo?.pack ? `?pack=${encodeURIComponent(toolInfo.pack)}` : '';
    return `/api/v1/teams/${tenantId}/assets/tools/${encodeURIComponent(toolName)}/display-image${packParam}`;
  }, [isCardMode, displayCfg, tenantId, toolName, toolInfo?.pack]);

  const renderRow = (text: string, key?: string | number, showDuration = true, detail?: React.ReactNode) => {
    const iconKind = getTimelineIconKind(toolName, text, isRunning && !isCompleted && !isOldTodo, isFailed);
    const rowColor = isRunning ? 'var(--text-muted)' : 'var(--text-tertiary)';
    return (
      <div key={key} className="flex items-stretch" style={{ minHeight: 30, gap: 7 }}>
        <TimelineIconSlot kind={iconKind} color={rowColor} showIcon={!(taskDelegateAction && isRunning)} />

        <div
          style={{
            paddingTop: 5,
            flex: '1 1 auto',
            minWidth: 0,
          }}
        >
          <div className="flex items-start" style={{ gap: 6, minWidth: 0 }}>
            {detail && (
              <button
                type="button"
                aria-label={detailExpanded ? '收起执行进度' : '展开执行进度'}
                onClick={() => setDetailExpanded((prev) => !prev)}
                className="inline-flex items-center justify-center"
                style={{
                  width: 14,
                  height: 20,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <ChevronDown
                  size={12}
                  style={{
                    transform: detailExpanded ? 'rotate(180deg)' : undefined,
                    transition: 'transform 0.15s',
                  }}
                />
              </button>
            )}
            <span
              style={{
                color: rowColor,
                fontSize: 13,
                lineHeight: '20px',
                fontWeight: 400,
                overflowWrap: 'anywhere',
                flex: '1 1 auto',
                minWidth: 0,
              }}
            >
              {text}
            </span>
            {showDuration && durationText && (
              <span
                style={{
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  lineHeight: '20px',
                  marginLeft: 'auto',
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {durationText}
              </span>
            )}
          </div>
          {detail && detailExpanded && (
            <div
              className="mt-0.5 truncate"
              style={{
                color: 'var(--text-muted)',
                fontSize: 11,
                lineHeight: '16px',
              }}
            >
              {detail}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="group">
      {renderRow(actionText, undefined, true, writeProgress ? (
        writeProgress.lineCount == null && writeProgress.contentLength == null ? (
          <span>{writeProgress.path ? `准备写入 ${writeProgress.path}` : null}</span>
        ) : (
          <>
            {writeProgress.path ? `${writeProgress.path} · ` : ''}
            <ProgressStats progress={writeProgress} label="已写入" />
          </>
        )
      ) : null)}

      {/* 卡片模式 */}
      {isCardMode && (
        <ToolDisplayCard
          imageUrl={cardImageUrl}
          description={displayCfg?.card_description}
          isLoading={isRunning}
        />
      )}
    </div>
  );
});

ActionItem.displayName = 'ActionItem';
