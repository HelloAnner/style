import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { superAdminApi, type SaOpsLinkItem, type SaOpsSummaryResponse } from '../../api/superadmin';
import { SuperAdminOpsHeader, type OpsTabKey } from './SuperAdminOpsHeader';
import { ExternalServiceMonitorPanel } from './ExternalServiceMonitorPanel';
import { SuperAdminLayout } from './SuperAdminLayout';
import { SuperAdminEmptyState } from './SuperAdminEmptyState';

const METRIC_KEYS = [
  { key: 'jobs_dispatch_attempt_total', label: '任务分发尝试' },
  { key: 'jobs_dispatch_publish_failed_total', label: '分发发布失败' },
  { key: 'jobs_dispatch_queued_stuck_total', label: '队列堆积' },
  { key: 'jobs_push_sse_rejected_draining_total', label: '排水拒绝推送' },
  { key: 'sse_connections_opened', label: 'SSE 建连数' },
  { key: 'sse_event_delivered', label: 'SSE 投递数' },
] as const;

const OBSERVABILITY_LINK_META: Record<string, { title: string; desc: string; order: number }> = {
  'moss-dashboard': {
    title: 'Moss 总览面板',
    desc: '平台核心健康与趋势聚合入口',
    order: 1,
  },
  'signoz-home': {
    title: 'SigNoz 首页',
    desc: '可观测平台入口',
    order: 2,
  },
  'signoz-traces': {
    title: 'SigNoz Traces',
    desc: '链路追踪查询入口',
    order: 3,
  },
  'signoz-logs': {
    title: 'SigNoz Logs',
    desc: '日志检索入口',
    order: 4,
  },
};

function sortObservabilityLinks(items: SaOpsLinkItem[]): SaOpsLinkItem[] {
  return [...items].sort((left, right) => {
    const leftOrder = OBSERVABILITY_LINK_META[left.key]?.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = OBSERVABILITY_LINK_META[right.key]?.order ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
}

function formatBytes(value: number): string {
  if (!value) {
    return '-';
  }
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString();
}

function formatSeconds(value: number | null): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (value < 60) {
    return `${value}s`;
  }
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function statusText(status: 'up' | 'down' | 'unknown'): string {
  if (status === 'up') {
    return '正常';
  }
  if (status === 'down') {
    return '异常';
  }
  return '未知';
}

/**
 * 超管运维中心页（主前端承接第九批）。
 *
 * 业务职责：
 * - 展示平台运维总览、可观测链路、服务状态、活跃作业与关键指标；
 * - 支持作业排障动作（修复分发 / 打开排水 / 关闭排水）。
 */
export const SuperAdminOpsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<OpsTabKey>('infrastructure');
  const [summary, setSummary] = useState<SaOpsSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await superAdminApi.opsSummary());
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  const runRepair = async () => {
    setActioning('repair');
    try {
      const result = await superAdminApi.repairOpsJobsDispatch();
      toast.success(`分发修复完成，本次修复 ${result.repaired} 个任务`);
      await loadSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败，请稍后重试');
    } finally {
      setActioning(null);
    }
  };

  const toggleDrain = async (enabled: boolean) => {
    setActioning(enabled ? 'drain-on' : 'drain-off');
    try {
      const result = await superAdminApi.toggleOpsJobsDrain(enabled);
      toast.success(result.draining ? '作业排水已开启' : '作业排水已关闭');
      await loadSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败，请稍后重试');
    } finally {
      setActioning(null);
    }
  };

  const servicesUp = useMemo(
    () => (summary ? summary.services.filter((item) => item.status === 'up').length : 0),
    [summary],
  );

  const observabilityLinks = useMemo(
    () => (summary ? sortObservabilityLinks(summary.links) : []),
    [summary],
  );

  const primaryCards = useMemo(
    () => (summary
      ? [
          { label: '平台注册用户', value: summary.users.registeredUserCount.toLocaleString() },
          { label: '当日新增用户', value: summary.users.dailyNewUserCount.toLocaleString() },
          { label: '当前在线用户', value: summary.users.onlineUserCount.toLocaleString() },
          { label: '运行中任务', value: summary.jobs.runningJobCount.toLocaleString() },
        ]
      : []),
    [summary],
  );

  const statusCards = useMemo(
    () => (summary
      ? [
          { label: '服务健康度', value: `${servicesUp}/${summary.services.length}` },
          { label: '任务排水状态', value: summary.jobs.draining ? '排水中' : '正常运行' },
          { label: '应用版本', value: summary.appVersion || '-' },
          { label: '部署环境', value: summary.environment || '-' },
        ]
      : []),
    [servicesUp, summary],
  );

  const freshnessCards = useMemo(
    () => (summary
      ? [
          { label: '最近窗口 Trace 数', value: summary.observability.recentTraceSampleCount?.toLocaleString() ?? '-' },
          { label: '最近 Trace 时间', value: formatDateTime(summary.observability.latestTraceAt) },
          { label: '最近窗口 Log 数', value: summary.observability.recentLogCount?.toLocaleString() ?? '-' },
          { label: '最近 Log 时间', value: formatDateTime(summary.observability.latestLogAt) },
        ]
      : []),
    [summary],
  );

  const hostItems = useMemo(
    () => (summary
      ? [
          `主机名：${summary.host.hostname}`,
          `CPU 核数：${summary.host.availableProcessors}`,
          `系统负载：${summary.host.systemLoadAverage.toFixed(2)}`,
          `内存占用：${formatBytes(summary.host.totalMemoryBytes - summary.host.freeMemoryBytes)} / ${formatBytes(summary.host.totalMemoryBytes)}`,
          `磁盘占用：${formatBytes(summary.host.diskTotalBytes - summary.host.diskFreeBytes)} / ${formatBytes(summary.host.diskTotalBytes)}`,
        ]
      : []),
    [summary],
  );

  const inflightCards = useMemo(
    () => (summary ? Object.entries(summary.jobs.inflightByStatus) : []),
    [summary],
  );

  return (
    <SuperAdminLayout testId="superadmin-ops-page">
      <main
        className="fi-superadmin-content"
        data-testid="superadmin-ops-main"
        style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div data-testid="superadmin-ops-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <SuperAdminOpsHeader activeTab={activeTab} onTabChange={setActiveTab} />
          {activeTab === 'infrastructure' && (
            <button
              type="button"
              onClick={() => void loadSummary()}
              disabled={loading}
              style={{
                height: 34,
                padding: '0 14px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                flexShrink: 0,
                marginTop: 4,
              }}
            >
              {loading ? '刷新中...' : '刷新'}
            </button>
          )}
        </div>

        {activeTab === 'external-services' && (
          <ExternalServiceMonitorPanel
            signozLogsUrl={
              summary?.links?.find((l) => l.key === 'signoz-logs')?.url
              ?? summary?.links?.find((l) => l.key === 'signoz-home')?.url
              ?? (import.meta.env.DEV ? 'https://signoz.example.com' : undefined)
            }
            mossEnv={summary?.mossEnv}
          />
        )}

        {activeTab === 'infrastructure' && (
          <>
            {error && <div className="fi-config-alert error">{error}</div>}

            {loading && !summary && (
              <div className="fi-config-loading-block" data-testid="superadmin-ops-loading">
                <div className="fi-config-loading-spinner" aria-hidden="true" />
                <span>正在加载运维数据...</span>
              </div>
            )}

            {!loading && !error && !summary && (
              <SuperAdminEmptyState
                title="暂无运维数据"
                description="当前未能获取运维概览，请稍后刷新或检查服务状态。"
              />
            )}

            {summary && (
          <>
            <section
              data-testid="superadmin-ops-primary-cards"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                gap: 12,
              }}
            >
              {primaryCards.map((card) => (
                <article
                  key={card.label}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 12,
                    background: 'var(--bg-tertiary)',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{card.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginTop: 6 }}>
                    {card.value}
                  </div>
                </article>
              ))}
            </section>

            <section
              data-testid="superadmin-ops-status-cards"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                gap: 12,
              }}
            >
              {statusCards.map((card) => (
                <article
                  key={card.label}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 12,
                    background: 'var(--bg-tertiary)',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{card.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginTop: 6 }}>
                    {card.value}
                  </div>
                </article>
              ))}
            </section>

            <section
              data-testid="superadmin-ops-host-overview"
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                background: 'var(--bg-tertiary)',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>主机概况</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {hostItems.map((item) => (
                  <span
                    key={item}
                    style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 999,
                      padding: '4px 10px',
                      background: 'var(--bg-primary)',
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </section>

            {observabilityLinks.length > 0 && (
              <section
                data-testid="superadmin-ops-observability-links"
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  background: 'var(--bg-tertiary)',
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>可观测入口</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                  {observabilityLinks.map((item) => {
                    const meta = OBSERVABILITY_LINK_META[item.key];
                    return (
                      <a
                        key={item.key}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          textDecoration: 'none',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 10,
                          padding: '10px 12px',
                          background: 'var(--bg-primary)',
                        }}
                      >
                        <strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>
                          {meta ? meta.title : item.label}
                        </strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                          {meta ? meta.desc : item.label}
                        </span>
                      </a>
                    );
                  })}
                </div>
              </section>
            )}

            <section
              data-testid="superadmin-ops-job-actions"
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                background: 'var(--bg-tertiary)',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>作业排障操作</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                    更新时间：{new Date(summary.generatedAt).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => void runRepair()}
                    disabled={actioning !== null}
                    style={{
                      height: 32,
                      padding: '0 10px',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      cursor: actioning ? 'not-allowed' : 'pointer',
                      opacity: actioning ? 0.6 : 1,
                    }}
                  >
                    {actioning === 'repair' ? '执行中...' : '修复分发'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleDrain(true)}
                    disabled={actioning !== null || summary.jobs.draining}
                    style={{
                      height: 32,
                      padding: '0 10px',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      cursor: actioning || summary.jobs.draining ? 'not-allowed' : 'pointer',
                      opacity: actioning || summary.jobs.draining ? 0.6 : 1,
                    }}
                  >
                    开启排水
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleDrain(false)}
                    disabled={actioning !== null || !summary.jobs.draining}
                    style={{
                      height: 32,
                      padding: '0 10px',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      cursor: actioning || !summary.jobs.draining ? 'not-allowed' : 'pointer',
                      opacity: actioning || !summary.jobs.draining ? 0.6 : 1,
                    }}
                  >
                    关闭排水
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10 }}>
                {METRIC_KEYS.map((metric) => (
                  <article
                    key={metric.key}
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 10,
                      background: 'var(--bg-primary)',
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{metric.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginTop: 6 }}>
                      {(summary.jobs.metrics[metric.key] ?? 0).toLocaleString()}
                    </div>
                  </article>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
                {inflightCards.map(([status, count]) => (
                  <article
                    key={status}
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 10,
                      background: 'var(--bg-primary)',
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{`进行中(${status})`}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginTop: 6 }}>
                      {count.toLocaleString()}
                    </div>
                  </article>
                ))}
                <article
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 10,
                    background: 'var(--bg-primary)',
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>最长运行时长</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginTop: 6 }}>
                    {formatSeconds(summary.jobs.oldestRunningSeconds)}
                  </div>
                </article>
              </div>
            </section>

            <section
              data-testid="superadmin-ops-live-sections"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <div
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  background: 'var(--bg-tertiary)',
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>活跃作业</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 500, overflow: 'auto' }}>
                  {summary.jobs.activeJobs.length === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>暂无数据</div>
                  )}
                  {summary.jobs.activeJobs.map((item) => (
                    <article
                      key={item.jobId}
                      style={{
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 10,
                        background: 'var(--bg-primary)',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>{item.jobId}</strong>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.status}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>阶段：{item.currentStage || '-'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>运行时长：{formatSeconds(item.runningSeconds)}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>会话：{item.conversationId}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>租户：{item.tenantId}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>开始时间：{formatDateTime(item.startedAt)}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Trace：{item.latestTraceId || '-'}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {item.jobQueryUrl && (
                          <a href={item.jobQueryUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                            按 Job 查看
                          </a>
                        )}
                        {item.conversationQueryUrl && (
                          <a href={item.conversationQueryUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                            按会话查看
                          </a>
                        )}
                        {item.traceQueryUrl && (
                          <a href={item.traceQueryUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                            按 Trace 查看
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  background: 'var(--bg-tertiary)',
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>服务状态</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {summary.services.map((service) => (
                    <article
                      key={service.key}
                      style={{
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 10,
                        background: 'var(--bg-primary)',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>{service.label}</strong>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{statusText(service.status)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{service.endpoint || '-'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{service.detail || '-'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{`延迟：${service.latencyMs}ms`}</div>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section
              data-testid="superadmin-ops-freshness-cards"
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                background: 'var(--bg-tertiary)',
                padding: 14,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                gap: 10,
              }}
            >
              {freshnessCards.map((card) => (
                <article
                  key={card.label}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 10,
                    background: 'var(--bg-primary)',
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{card.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 6 }}>
                    {card.value}
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
          </>
        )}
      </main>
    </SuperAdminLayout>
  );
};

export default SuperAdminOpsPage;
