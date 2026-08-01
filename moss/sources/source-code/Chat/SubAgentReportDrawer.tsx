import React, { memo, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { AlertCircle, X } from 'lucide-react';
import type { SubAgentExecution, SubAgentReport } from '../../types';
import {
  SubAgentEvidenceList,
  SubAgentLimitationList,
  SubAgentStructuredContent,
} from './SubAgentStructuredContent';
import { SubAgentTimeline } from './SubAgentTimeline';
import { SubAgentLiveActivity } from './SubAgentLiveActivity';
import { ArtifactList } from './SubAgentArtifacts';
import { isActiveSubAgentStatus, subAgentDisplayTask } from '../../lib/subagentResults';

type DetailsLocale = 'zh' | 'en';

function detailsLocale(): DetailsLocale {
  const language = typeof document !== 'undefined'
    ? document.documentElement.lang || navigator.language
    : 'zh-CN';
  return language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

const DETAILS_COPY = {
  zh: {
    title: '执行详情', close: '关闭执行详情', overview: '概要', status: '状态', duration: '总耗时',
    rounds: '轮次', tokens: 'Token 消耗', quality: '交付质量', assets: '运行资产', tools: '工具',
    skills: '技能', artifacts: '产出文件', process: '执行记录', executionSummary: '执行摘要',
    data: '历史结构化数据', evidence: '历史证据', limitations: '限制说明',
    degraded: '报告交付存在限制', roundUnit: '轮', itemUnit: '个',
    statuses: { queued: '排队中', claimed: '正在准备', running: '执行中', retrying: '重试中', waiting_dependency: '等待前置任务', waiting_input: '等待输入', paused: '已暂停', completed: '已完成', failed: '失败', cancelled: '已取消', timed_out: '已超时' },
  },
  en: {
    title: 'Execution details', close: 'Close execution details', overview: 'Overview', status: 'Status', duration: 'Duration',
    rounds: 'Rounds', tokens: 'Token usage', quality: 'Quality status', assets: 'Runtime assets', tools: 'Tools',
    skills: 'Skills', artifacts: 'Output files', process: 'Execution history', executionSummary: 'Execution summary',
    data: 'Historical structured data', evidence: 'Historical evidence', limitations: 'Limitations',
    degraded: 'Report delivery limited', roundUnit: 'rounds', itemUnit: '',
    statuses: { queued: 'Queued', claimed: 'Preparing', running: 'Running', retrying: 'Retrying', waiting_dependency: 'Waiting for dependency', waiting_input: 'Waiting for input', paused: 'Paused', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled', timed_out: 'Timed out' },
  },
};
function hasReportDetail(report: SubAgentReport | undefined): boolean {
  return Boolean(
    report?.content
    || report?.data
    || report?.evidence?.length
    || report?.limitations?.length,
  );
}

/**
 * 执行详情 Drawer 的可见性判断：report / 结论之外，
 * 轮次时间线、执行摘要、token、registry identity 也算有效详情。
 */
export function hasSubAgentDetails(subAgent: SubAgentExecution): boolean {
  return hasReportDetail(subAgent.report)
    || Boolean(subAgent.coreConclusion || subAgent.outputPreview)
    || Boolean(subAgent.executionSummary)
    || Boolean(
      subAgent.iterations?.length
      || subAgent.toolSteps?.length
      || (subAgent.iteration ?? 0) > 0,
    )
    || subAgent.tokensUsed != null
    || subAgent.registryId != null
    || subAgent.registryVersion != null
    || Boolean(subAgent.runtimeTools?.length || subAgent.runtimeSkills?.length);
}

function formatDuration(ms: number | undefined, startedAt: string | undefined, completedAt: string | undefined, locale: DetailsLocale): string | null {
  let sec: number | null = null;
  if (ms != null) sec = Math.round(ms / 1000);
  else if (startedAt && completedAt)
    sec = Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000);
  if (sec == null) return null;
  if (locale === 'en') return sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`;
  return sec >= 60 ? `${Math.floor(sec / 60)} 分 ${sec % 60} 秒` : `${sec} 秒`;
}

function formatTokens(value: number, locale: DetailsLocale): string {
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US').format(value);
}

const OverviewRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="subagent-structured-field">
    <div className="subagent-structured-key">{label}</div>
    <div className="subagent-structured-value">{children}</div>
  </div>
);

/**
 * 执行详情 Drawer — 人的视角组织：产物 → 过程 → 执行摘要，
 * 轮次/token/registry 等技术信息收进底部「技术细节」折叠区。
 * 完整任务文案只在 header 完整展示（行首只有一句话摘要）。
 */
export const SubAgentDetailsDrawer = memo(({
  subAgent,
  open,
  onClose,
  onArtifactOpen,
}: {
  subAgent: SubAgentExecution;
  open: boolean;
  onClose: () => void;
  onArtifactOpen?: (path: string) => void;
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;
  const locale = detailsLocale();
  const copy = DETAILS_COPY[locale];
  const report = subAgent.report;
  const isActive = isActiveSubAgentStatus(subAgent.status);
  const duration = formatDuration(subAgent.durationMs, subAgent.startedAt, subAgent.completedAt, locale);
  const rounds = subAgent.iterationsUsed ?? subAgent.iterations?.length ?? subAgent.iteration;
  const runtimeTools = subAgent.runtimeTools || [];
  const runtimeSkills = subAgent.runtimeSkills || [];
  const hasRegistry = subAgent.registryId != null
    || subAgent.registryVersion != null
    || runtimeTools.length > 0
    || runtimeSkills.length > 0;
  const hasArtifacts = Boolean(subAgent.artifacts && subAgent.artifacts.length > 0);
  const hasProcess = isActive || Boolean(
    subAgent.iterations?.length
    || subAgent.toolSteps?.length
    || (subAgent.iteration ?? 0) > 0,
  );
  const displayTask = subAgentDisplayTask(subAgent.task);
  const portalRoot = document.querySelector<HTMLElement>(
    '[data-testid="chat-container"], [data-testid="share-page-chat-column"]',
  ) || document.body;
  const contained = portalRoot !== document.body;

  return ReactDOM.createPortal(
    <>
      <button
        type="button"
        className={`subagent-report-backdrop${contained ? ' is-contained' : ''}`}
        aria-label={copy.close}
        onClick={onClose}
      />
      <aside
        className={`subagent-report-drawer${contained ? ' is-contained' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`subagent-report-title-${subAgent.taskId}`}
      >
        <header className="subagent-report-header">
          <div id={`subagent-report-title-${subAgent.taskId}`} className="subagent-report-title">
            {copy.title}
          </div>
          <button
            type="button"
            className="subagent-report-close"
            onClick={onClose}
            aria-label={copy.close}
          >
            <X size={18} />
          </button>
        </header>
        <div className="subagent-report-body">
          {displayTask && (
            <div className="subagent-report-subtitle">{displayTask}</div>
          )}

          {subAgent.degraded && (
            <div className="subagent-row-note subagent-report-degraded">
              <AlertCircle size={13} style={{ flexShrink: 0 }} />
              {copy.degraded}
            </div>
          )}

          <section className="subagent-report-section subagent-report-overview">
            <h3>{copy.overview}</h3>
            <div className="subagent-structured-object">
              <OverviewRow label={copy.status}>
                <span className={`subagent-overview-status is-${subAgent.status}`}>
                  {copy.statuses[subAgent.status]}
                </span>
              </OverviewRow>
              {duration && <OverviewRow label={copy.duration}>{duration}</OverviewRow>}
              {rounds != null && rounds > 0 && (
                <OverviewRow label={copy.rounds}>
                  {subAgent.maxIterations ? `${rounds} / ${subAgent.maxIterations} ${copy.roundUnit}` : `${rounds} ${copy.roundUnit}`}
                </OverviewRow>
              )}
              {subAgent.tokensUsed != null && (
                <OverviewRow label={copy.tokens}>{formatTokens(subAgent.tokensUsed, locale)}</OverviewRow>
              )}
              {report?.qualityState && <OverviewRow label={copy.quality}>{report.qualityState}</OverviewRow>}
              {hasRegistry && (
                <OverviewRow label={copy.assets}>
                  {subAgent.registryId != null && (
                    <div>Registry #{subAgent.registryId}{subAgent.registryVersion != null ? ` · v${subAgent.registryVersion}` : ''}</div>
                  )}
                  {(runtimeTools.length > 0 || runtimeSkills.length > 0) && (
                    <details className="subagent-raw-json">
                      <summary>{copy.tools} {runtimeTools.length} {copy.itemUnit} · {copy.skills} {runtimeSkills.length} {copy.itemUnit}</summary>
                      <div className="subagent-registry-list">
                        {runtimeTools.map((name) => <span key={`tool:${name}`} className="subagent-registry-chip">{name}</span>)}
                        {runtimeSkills.map((name) => <span key={`skill:${name}`} className="subagent-registry-chip">{name}</span>)}
                      </div>
                    </details>
                  )}
                </OverviewRow>
              )}
            </div>
          </section>

          {hasArtifacts && subAgent.artifacts && (
            <section className="subagent-report-section">
              <h3>{copy.artifacts} ({subAgent.artifacts.length})</h3>
              <ArtifactList
                artifacts={subAgent.artifacts}
                onArtifactOpen={onArtifactOpen}
                hideLabel
              />
            </section>
          )}

          {hasProcess && (
            <section className="subagent-report-section subagent-report-execution">
              <h3>{copy.process}</h3>
              {isActive && <SubAgentLiveActivity sa={subAgent} />}
              <SubAgentTimeline subAgent={subAgent} />
            </section>
          )}

          {subAgent.executionSummary && (
            <section className="subagent-report-section subagent-report-summary">
              <h3>{copy.executionSummary}</h3>
              <div className="subagent-result-copy">{subAgent.executionSummary}</div>
            </section>
          )}

          {/* 旧协议历史数据：新协议不再产出这些字段，仅读取历史会话时出现 */}
          {report?.data && (
            <section className="subagent-report-section">
              <h3>{copy.data}</h3>
              <SubAgentStructuredContent value={report.data} />
            </section>
          )}
          {report?.evidence && report.evidence.length > 0 && (
            <section className="subagent-report-section">
              <h3>{copy.evidence}</h3>
              <SubAgentEvidenceList items={report.evidence} />
            </section>
          )}
          {report?.limitations && report.limitations.length > 0 && (
            <section className="subagent-report-section">
              <h3>{copy.limitations}</h3>
              <SubAgentLimitationList items={report.limitations} />
            </section>
          )}
        </div>
      </aside>
    </>,
    portalRoot,
  );
});
SubAgentDetailsDrawer.displayName = 'SubAgentDetailsDrawer';
