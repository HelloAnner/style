import { memo, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
} from 'lucide-react';
import type { SubAgentExecution, SubAgentIteration, ToolStep } from '../../types';
import { useFrontendConfigStore } from '../../stores/frontendConfigStore';
import { useToolActionDisplay } from './ActionFeed/useToolActionDisplay';

/** 后端聚合 SQL 给每轮的兜底文案：没有信息增量，展示时改从工具调用推导。 */
const GENERIC_ACTION_SUMMARIES = new Set([
  '正在处理本轮任务',
  '已核对本轮工具返回的信息',
  '已完成本轮分析',
]);

function formatDuration(ms?: number): string {
  if (ms == null) return '';
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function fallbackIterations(subAgent: SubAgentExecution): SubAgentIteration[] {
  const byIteration = new Map<number, ToolStep[]>();
  for (const tool of subAgent.toolSteps || []) {
    const tools = byIteration.get(tool.iteration) || [];
    tools.push(tool);
    byIteration.set(tool.iteration, tools);
  }
  const highest = Math.max(subAgent.iteration || 0, ...byIteration.keys(), 0);
  if (highest === 0) return [];
  return Array.from({ length: highest }, (_, index) => {
    const number = index + 1;
    const isCurrent = number === highest && [
      'running',
      'retrying',
      'claimed',
      'waiting_dependency',
      'waiting_input',
      'paused',
    ].includes(subAgent.status);
    return {
      number,
      status: isCurrent ? 'running' : 'completed',
      actionSummary: undefined,
      toolCalls: byIteration.get(number) || [],
    };
  });
}

/**
 * 每轮主文案：优先用后端给的业务摘要；泛化兜底文案则改从工具调用推导
 * 「这一轮做了什么」（联网搜索、阅读文件…），让用户一眼看到动作而非轮次编号。
 */
function iterationSummary(iteration: SubAgentIteration): string {
  if (iteration.actionSummary && !GENERIC_ACTION_SUMMARIES.has(iteration.actionSummary)) {
    return iteration.actionSummary;
  }
  const names: string[] = [];
  for (const tool of iteration.toolCalls) {
    const name = tool.displayName || tool.name;
    if (name && !names.includes(name)) names.push(name);
    if (names.length >= 3) break;
  }
  if (names.length > 0) {
    const doing = names.join('、');
    return iteration.status === 'running' ? `正在${doing}` : `已完成${doing}`;
  }
  if (iteration.status === 'running') return '正在分析本轮任务';
  if (iteration.status === 'failed') return '本轮执行出现异常';
  return '本轮处理完成';
}

const LiveIterationDuration = memo(({ iteration }: { iteration: SubAgentIteration }) => {
  const [duration, setDuration] = useState(() => iteration.durationMs || 0);
  useEffect(() => {
    if (iteration.status !== 'running' || !iteration.startedAt) {
      setDuration(iteration.durationMs || 0);
      return;
    }
    const startedAt = new Date(iteration.startedAt).getTime();
    if (!Number.isFinite(startedAt)) return;
    const tick = () => setDuration(Math.max(0, Date.now() - startedAt));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [iteration.durationMs, iteration.startedAt, iteration.status]);
  return duration > 0 ? <>{formatDuration(duration)}</> : null;
});
LiveIterationDuration.displayName = 'LiveIterationDuration';

const TimelineToolRow = memo(({ tool }: { tool: ToolStep }) => {
  const showToolDurations = useFrontendConfigStore((state) => state.showToolDurations);
  const { Icon, iconColorClass, actionText } = useToolActionDisplay(
    tool.name,
    tool.arguments || {},
    tool.displayName,
  );
  const running = tool.status === 'running';
  const failed = tool.status === 'failed';
  return (
    <li className="subagent-timeline-tool">
      <span className={`subagent-timeline-tool-icon ${iconColorClass}`} aria-hidden="true">
        <Icon size={13} />
      </span>
      <span className="subagent-timeline-tool-copy">
        <span className="subagent-timeline-tool-name">{actionText}</span>
        {tool.querySummary && (
          <span className="subagent-timeline-tool-summary">{tool.querySummary}</span>
        )}
        {tool.resultSummary && !running && (
          <span className="subagent-timeline-tool-result">{tool.resultSummary}</span>
        )}
        {(tool.error || failed) && (
          <span className="subagent-timeline-tool-error">
            {tool.error || '工具执行失败'}
          </span>
        )}
      </span>
      <span className="subagent-timeline-tool-meta">
        {running ? (
          <span className="subagent-dot-working subagent-dot-working-sm" aria-label="执行中" />
        ) : failed ? (
          <AlertCircle size={12} aria-label="失败" />
        ) : (
          <CheckCircle2 size={12} aria-label="完成" />
        )}
        {showToolDurations && tool.durationMs != null && (
          <span className="subagent-tabular">{formatDuration(tool.durationMs)}</span>
        )}
      </span>
    </li>
  );
});
TimelineToolRow.displayName = 'TimelineToolRow';

const IterationStatusIcon = memo(({ status }: { status: SubAgentIteration['status'] }) => {
  if (status === 'running') {
    return <span className="subagent-dot-working" aria-label="执行中" />;
  }
  if (status === 'failed') return <AlertCircle size={13} aria-label="异常" />;
  if (status === 'cancelled') return <Clock3 size={13} aria-label="已取消" />;
  return <CheckCircle2 size={13} aria-label="完成" />;
});
IterationStatusIcon.displayName = 'IterationStatusIcon';

const IterationRow = memo(({
  iteration,
  expanded,
  onToggle,
}: {
  iteration: SubAgentIteration;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const controlsId = `subagent-iteration-${iteration.number}-${iteration.startedAt || 'row'}`;
  const current = iteration.status === 'running';
  return (
    <li
      className={`subagent-iteration-row${current ? ' is-current' : ''}`}
      aria-live={current ? 'polite' : undefined}
    >
      <button
        type="button"
        className="subagent-iteration-trigger"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={controlsId}
      >
        <span className="subagent-iteration-rail" aria-hidden="true" />
        <span className="subagent-iteration-state">
          <IterationStatusIcon status={iteration.status} />
        </span>
        <span className="subagent-iteration-copy">
          <span className="subagent-iteration-summary">{iterationSummary(iteration)}</span>
          <span className="subagent-iteration-title">第 {iteration.number} 轮</span>
        </span>
        <span className="subagent-iteration-duration subagent-tabular">
          {current
            ? <LiveIterationDuration iteration={iteration} />
            : formatDuration(iteration.durationMs)}
        </span>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {expanded && (
        <div id={controlsId} className="subagent-iteration-detail">
          {iteration.toolCalls.length > 0 ? (
            <ol className="subagent-timeline-tools">
              {iteration.toolCalls.map((tool, index) => (
                <TimelineToolRow
                  key={tool.id || `${iteration.number}:${tool.name}:${index}`}
                  tool={tool}
                />
              ))}
            </ol>
          ) : (
            <div className="subagent-iteration-empty">
              {current ? '正在形成这一轮的行动计划…' : '这一轮没有调用工具'}
            </div>
          )}
          {iteration.error && (
            <div className="subagent-iteration-error" role="alert">{iteration.error}</div>
          )}
        </div>
      )}
    </li>
  );
});
IterationRow.displayName = 'IterationRow';

/**
 * 过程时间线（仅渲染列表本体；section 标题由 Drawer 统一出）。
 * 默认展开「运行中轮」和「最近一轮」的工具明细，历史轮次收起；
 * 超过 3 轮的已完成历史收进「查看之前 N 轮」。
 */
export const SubAgentTimeline = memo(({
  subAgent,
}: {
  subAgent: SubAgentExecution;
}) => {
  const iterations = useMemo(() => (
    subAgent.iterations?.length ? subAgent.iterations : fallbackIterations(subAgent)
  ), [subAgent]);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());

  if (iterations.length === 0) return null;

  return (
    <div className="subagent-timeline-body" aria-label="执行轮次">
      <ol className="subagent-iteration-list">
        {iterations.map((iteration) => (
          <IterationRow
            key={iteration.number}
            iteration={iteration}
            expanded={expanded.has(iteration.number)}
            onToggle={() => setExpanded((current) => {
              const next = new Set(current);
              if (next.has(iteration.number)) next.delete(iteration.number);
              else next.add(iteration.number);
              return next;
            })}
          />
        ))}
      </ol>
    </div>
  );
});
SubAgentTimeline.displayName = 'SubAgentTimeline';
