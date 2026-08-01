import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ListTree,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AnimatePresence } from '../../lib/motion';
import type { SubAgentExecution } from '../../types';
import {
  activeSubAgentStatusText,
  isActiveSubAgentStatus,
  isSubAgentFormatRepair,
  subAgentDisplayTask,
  subAgentRowName,
} from '../../lib/subagentResults';
import { SubAgentElapsedTimer, SubAgentLiveActivity } from './SubAgentLiveActivity';
import { SubAgentDetailsDrawer } from './SubAgentReportDrawer';
import './subAgentCards.css';

export {
  ArtifactList,
  isInternalSubagentArtifact,
  isOffloadedConclusionPointer,
  subAgentArtifactPreviewTarget,
} from './SubAgentArtifacts';

type Locale = 'zh' | 'en';

function locale(): Locale {
  const language = typeof document !== 'undefined'
    ? document.documentElement.lang || navigator.language
    : 'zh-CN';
  return language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

const COPY = {
  zh: {
    details: '打开执行详情',
    degraded: '部分证据受限',
    rounds: (count: number) => `${count} 轮`,
    tools: (count: number) => `${count} 个工具`,
    group: (count: number) => `${count} 个伙伴`,
    complete: (done: number, total: number) => `${done}/${total} 完成`,
    failed: (count: number) => `${count} 失败`,
    statuses: {
      queued: '等待执行', claimed: '正在准备', running: '正在处理', retrying: '正在重试',
      waiting_dependency: '等待前置任务', waiting_input: '等待输入', paused: '已暂停',
      completed: '执行成功', failed: '执行失败', cancelled: '已取消', timed_out: '执行超时',
    },
  },
  en: {
    details: 'Open execution details',
    degraded: 'Limited evidence',
    rounds: (count: number) => `${count} ${count === 1 ? 'round' : 'rounds'}`,
    tools: (count: number) => `${count} ${count === 1 ? 'tool' : 'tools'}`,
    group: (count: number) => `${count} ${count === 1 ? 'partner' : 'partners'}`,
    complete: (done: number, total: number) => `${done}/${total} completed`,
    failed: (count: number) => `${count} failed`,
    statuses: {
      queued: 'Queued', claimed: 'Preparing', running: 'Running', retrying: 'Retrying',
      waiting_dependency: 'Waiting for dependency', waiting_input: 'Waiting for input', paused: 'Paused',
      completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled', timed_out: 'Timed out',
    },
  },
};

function fmtDuration(ms?: number, startedAt?: string, completedAt?: string): string | null {
  let seconds: number | null = null;
  if (ms != null) seconds = Math.floor(ms / 1000);
  else if (startedAt && completedAt) {
    seconds = Math.floor((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000);
  }
  if (seconds == null) return null;
  return seconds >= 60
    ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
    : `${seconds}s`;
}

/** 与研发原版一致：单行最多 60 字，超出后直接截断。 */
export function compactDerivedTask(task: string, max = 60): string {
  const normalized = subAgentDisplayTask(task).replace(/\s+/g, ' ').trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max)}...`;
}

function executionStats(sa: SubAgentExecution): { rounds: number; tools: number } {
  return {
    rounds: sa.iterations?.length || sa.iteration || 0,
    tools: sa.toolSteps?.length
      || sa.iterations?.reduce((sum, iteration) => sum + iteration.toolCalls.length, 0)
      || 0,
  };
}

const StatusDot = memo(({ status }: { status: SubAgentExecution['status'] }) => {
  if (['queued', 'waiting_dependency', 'waiting_input', 'paused'].includes(status)) {
    return <Clock3 size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />;
  }
  if (isActiveSubAgentStatus(status)) {
    return <span className="subagent-dot-working" role="img" aria-label="执行中" />;
  }
  if (status === 'completed') {
    return <CheckCircle2 size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />;
  }
  if (status === 'cancelled') {
    return <Ban size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />;
  }
  return <AlertCircle size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />;
});
StatusDot.displayName = 'StatusDot';

const PartnerCard = memo(({
  sa,
  testId,
  onArtifactOpen,
}: {
  sa: SubAgentExecution;
  testId?: string;
  onArtifactOpen?: (path: string) => void;
}) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const copy = COPY[locale()];
  const active = isActiveSubAgentStatus(sa.status);
  const queued = sa.status === 'queued';
  const duration = active || queued
    ? null
    : fmtDuration(sa.durationMs, sa.startedAt, sa.completedAt);
  const { rounds, tools } = executionStats(sa);
  const showTime = active ? Boolean(sa.startedAt) : Boolean(duration);
  const fullTask = subAgentDisplayTask(sa.task);
  const statusText = sa.status === 'completed' && sa.degraded
    ? copy.degraded
    : sa.status === 'retrying' && isSubAgentFormatRepair(sa)
      ? activeSubAgentStatusText(sa)
      : copy.statuses[sa.status];
  const name = subAgentRowName(sa);
  const openDetails = useCallback(() => setDetailsOpen(true), []);

  return (
    <div className="subagent-derived-wrap">
      <div
        className="subagent-derived-card"
        role="button"
        tabIndex={0}
        aria-label={`${copy.details}: ${name}`}
        onClick={openDetails}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openDetails();
          }
        }}
        data-testid={testId || `subagent-card-${sa.taskId}`}
      >
        <div className="subagent-derived-primary">
          <span className="subagent-row-status"><StatusDot status={sa.status} /></span>
          <span className="subagent-derived-name">{name}</span>
          {fullTask && (
            <span className="subagent-derived-task" title={fullTask}>
              {compactDerivedTask(fullTask)}
            </span>
          )}
        </div>
        <div className="subagent-derived-divider" />
        <div className="subagent-derived-meta">
          <span className={`subagent-derived-status is-${sa.status}`}>{statusText}</span>
          {active && <SubAgentLiveActivity sa={sa} variant="inline" />}
          {showTime && (
            <span className="subagent-derived-tail">
              <span className="subagent-derived-process">
                <ListTree size={13} aria-hidden="true" />
                <span>{copy.rounds(rounds)}</span>
                <span aria-hidden="true">·</span>
                <span>{copy.tools(tools)}</span>
              </span>
              <span className="subagent-derived-time">
                {active
                  ? <SubAgentElapsedTimer startedAt={sa.startedAt} running={sa.status !== 'paused'} />
                  : duration}
              </span>
            </span>
          )}
        </div>
      </div>
      <SubAgentDetailsDrawer
        subAgent={sa}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        onArtifactOpen={onArtifactOpen}
      />
    </div>
  );
});
PartnerCard.displayName = 'PartnerCard';

function sortQueuedLast(subAgents: SubAgentExecution[]): SubAgentExecution[] {
  return subAgents
    .map((subAgent, index) => ({ subAgent, index }))
    .sort((a, b) => (
      Number(a.subAgent.status === 'queued') - Number(b.subAgent.status === 'queued')
      || a.index - b.index
    ))
    .map(({ subAgent }) => subAgent);
}

function groupSubAgents(subAgents: SubAgentExecution[]): Array<
  | { kind: 'single'; sub: SubAgentExecution }
  | { kind: 'group'; parentTaskId: string; subs: SubAgentExecution[] }
> {
  const buckets = new Map<string, SubAgentExecution[]>();
  const orderedKeys: string[] = [];
  for (const sa of subAgents) {
    const key = sa.parentTaskId || `__solo__:${sa.taskId}`;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      orderedKeys.push(key);
    }
    buckets.get(key)!.push(sa);
  }
  return orderedKeys.map((key) => {
    const subs = sortQueuedLast(buckets.get(key)!);
    return key.startsWith('__solo__:') || subs.length === 1
      ? { kind: 'single' as const, sub: subs[0] }
      : { kind: 'group' as const, parentTaskId: key, subs };
  });
}

const PartnerGroup = memo(({
  parentTaskId,
  subAgents,
  onArtifactOpen,
}: {
  parentTaskId: string;
  subAgents: SubAgentExecution[];
  onArtifactOpen?: (path: string) => void;
}) => {
  const copy = COPY[locale()];
  const completed = subAgents.filter((sa) => sa.status === 'completed').length;
  const failed = subAgents.filter((sa) => sa.status === 'failed' || sa.status === 'timed_out').length;
  const active = subAgents.some((sa) => isActiveSubAgentStatus(sa.status));
  const [open, setOpen] = useState(true);
  const queued = subAgents.some((sa) => sa.status === 'queued');
  const groupStatus: SubAgentExecution['status'] = active
    ? 'running'
    : queued
      ? 'queued'
      : failed === subAgents.length
        ? 'failed'
        : 'completed';
  const startedAt = subAgents.map((sa) => sa.startedAt).filter(Boolean).sort()[0];
  const completedAt = subAgents.map((sa) => sa.completedAt).filter(Boolean).sort().at(-1);
  const duration = !active && !queued ? fmtDuration(undefined, startedAt, completedAt) : null;

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <motion.div
      className="subagent-group-card"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid={`subagent-group-card-${parentTaskId}`}
    >
      <div
        className="subagent-group-header"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={open ? '收起子任务列表' : '展开子任务列表'}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen((value) => !value);
          }
        }}
      >
        <span className="subagent-row-status"><StatusDot status={groupStatus} /></span>
        <span className="subagent-group-name">{copy.group(subAgents.length)}</span>
        <span className="subagent-group-count">
          {copy.complete(completed, subAgents.length)}
          {failed > 0 && <span style={{ color: 'var(--danger)' }}> · {copy.failed(failed)}</span>}
        </span>
        <span className={`subagent-row-right${open ? ' is-open' : ''}`}>
          {active
            ? <SubAgentElapsedTimer startedAt={startedAt} running />
            : duration && <span className="subagent-row-duration">{duration}</span>}
          <ChevronDown
            size={13}
            style={{
              color: 'var(--text-muted)',
              transform: open ? 'rotate(180deg)' : undefined,
              transition: 'transform 0.15s ease',
            }}
          />
        </span>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="subagent-group-items">
              {subAgents.map((sa) => (
                <PartnerCard
                  key={sa.taskId}
                  sa={sa}
                  testId={`subagent-group-item-${sa.taskId}`}
                  onArtifactOpen={onArtifactOpen}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
PartnerGroup.displayName = 'PartnerGroup';

export const SubAgentCardsSection: React.FC<{
  subAgents: SubAgentExecution[];
  onArtifactOpen?: (path: string) => void;
}> = memo(({ subAgents, onArtifactOpen }) => {
  const grouped = useMemo(() => groupSubAgents(subAgents), [subAgents]);
  if (grouped.length === 0) return null;
  return (
    <div className="space-y-2 w-full" data-testid="chat-subagent-cards">
      <AnimatePresence>
        {grouped.map((entry) => (
          entry.kind === 'group'
            ? (
              <PartnerGroup
                key={`group:${entry.parentTaskId}`}
                parentTaskId={entry.parentTaskId}
                subAgents={entry.subs}
                onArtifactOpen={onArtifactOpen}
              />
            )
            : (
              <motion.div
                key={entry.sub.taskId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <PartnerCard sa={entry.sub} onArtifactOpen={onArtifactOpen} />
              </motion.div>
            )
        ))}
      </AnimatePresence>
    </div>
  );
});
SubAgentCardsSection.displayName = 'SubAgentCardsSection';
