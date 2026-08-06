import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  superAdminApi,
  type SaExternalServiceItem,
  type SaExternalServiceMetrics,
  type SaExternalServiceSummary,
} from '../../api/superadmin';

const SERVICE_COLORS: Record<string, string> = {
  up: 'var(--success)',
  down: 'var(--danger)',
  unknown: 'var(--text-tertiary)',
};

function healthLabel(status: string): string {
  if (status === 'up') return '正常';
  if (status === 'down') return '异常';
  return '未知';
}

function fmtPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function fmtMs(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${value}ms`;
}

function fmtDateTime(value: string): string {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function formatHourLabel(iso: string): string {
  try {
    // 显式使用 Asia/Shanghai 时区，避免浏览器时区偏移
    const hours = new Date(iso).toLocaleString('zh-CN', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Asia/Shanghai',
    });
    return hours + ':00';
  } catch {
    return iso;
  }
}

// ── Sub-components ──────────────────────────────────────────────

const ServiceHealthCard: React.FC<{ item: SaExternalServiceItem }> = ({ item }) => {
  const statusColor = SERVICE_COLORS[item.healthStatus] ?? SERVICE_COLORS.unknown;
  return (
    <article
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        background: 'var(--bg-tertiary)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>{item.label}</strong>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: statusColor,
            padding: '2px 8px',
            borderRadius: 999,
            border: `1px solid ${statusColor}`,
            background: 'var(--bg-primary)',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {healthLabel(item.healthStatus)}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {item.healthDetail ?? '-'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        延迟 {item.healthLatencyMs}ms · 24h 调用 {item.metrics24h.totalCalls.toLocaleString()}
      </div>
    </article>
  );
};

const OverviewCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <article
    style={{
      border: '1px solid var(--border-subtle)',
      borderRadius: 12,
      background: 'var(--bg-tertiary)',
      padding: '12px 14px',
    }}
  >
    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginTop: 6 }}>
      {value}
    </div>
  </article>
);

/**
 * 构建 SigNoz Logs Explorer 链接，使用与后端一致的 composite query 格式。
 *
 * @param signozLogsUrl 后端返回的 SigNoz Logs Explorer 基 URL（可能含 /logs-explorer 后缀）
 * @param extService 外部服务标识（bocha / tinyfish / querit / qila / zhongzhou / coze）
 * @param mossEnv 部署环境标识（dev / hotfix），匹配 SigNoz 中 Alloy 注入的 moss.env 属性
 */
function buildSignozLogsUrl(signozLogsUrl: string, extService: string, mossEnv?: string): string {
  const baseUrl = signozLogsUrl.replace(/\/logs-explorer\/?$/, '').replace(/\/$/, '');

  // 拼接 filter：外部服务 + 部署环境
  let expression = `ext_service = '${extService}'`;
  if (mossEnv) {
    expression += ` AND moss.env = '${mossEnv}'`;
  }

  const compositeQuery = {
    queryType: 'builder',
    builder: {
      queryData: [
        {
          dataSource: 'logs',
          queryName: 'A',
          aggregateOperator: 'noop',
          aggregateAttribute: { key: '', dataType: '', id: '----' },
          filter: { expression },
          filters: { items: [], op: 'AND' },
          expression: 'A',
          disabled: false,
          orderBy: [{ columnName: 'timestamp', order: 'desc' }],
          having: [],
          groupBy: [],
          legend: '',
          reduceTo: 'avg',
        },
      ],
      queryFormulas: [],
    },
  };
  const encoded = encodeURIComponent(JSON.stringify(compositeQuery));
  return `${baseUrl}/logs-explorer?panelTypes=%5B%22list%22%5D&compositeQuery=${encoded}`;
}

const AlertsSection: React.FC<{
  alerts: SaExternalServiceSummary['recentAlerts'];
  signozLogsUrl?: string;
  mossEnv?: string;
}> = ({ alerts, signozLogsUrl, mossEnv }) => {
  if (!alerts || alerts.length === 0) return null;
  return (
    <section
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        background: 'var(--bg-tertiary)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>最近告警</div>
      {alerts.slice(0, 10).map((a, i) => (
        <div
          key={i}
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            fontSize: 12,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-primary)',
          }}
        >
          <span
            style={{
              fontWeight: 600,
              color: a.level === 'critical' ? 'var(--danger)' : 'var(--warning)',
              marginRight: 6,
            }}
          >
            [{a.level === 'critical' ? '严重' : '警告'}]
          </span>
          <span style={{ color: 'var(--text-primary)' }}>{a.service}</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{a.message}</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{fmtDateTime(a.triggeredAt)}</span>
          {signozLogsUrl && (
            <a
              href={buildSignozLogsUrl(signozLogsUrl, a.service, mossEnv)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 11,
                color: 'var(--blue-500, #3B82F6)',
                marginLeft: 8,
                whiteSpace: 'nowrap',
                textDecoration: 'none',
              }}
            >
              在 SigNoz 中查看 →
            </a>
          )}
        </div>
      ))}
    </section>
  );
};

const ServiceDetail: React.FC<{
  service: string;
  metrics: SaExternalServiceMetrics | null;
  loading: boolean;
  signozLogsUrl?: string;
  mossEnv?: string;
}> = ({ service, metrics, loading, signozLogsUrl, mossEnv }) => {
  if (loading) {
    return <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>加载中...</div>;
  }
  if (!metrics || !metrics.buckets || metrics.buckets.length === 0) {
    return <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>暂无数据</div>;
  }

  const chartData = metrics.buckets.map((b) => ({
    ...b,
    hour: formatHourLabel(b.time),
  }));
  const normalizedMossEnv = mossEnv?.trim().toLowerCase() ?? '';
  const supportsXilaEnvironmentBreakdown = normalizedMossEnv === 'dev'
    || normalizedMossEnv === 'hotfix'
    || normalizedMossEnv.startsWith('dev-')
    || normalizedMossEnv.startsWith('hotfix-');
  const xilaEnvironmentCalls = service !== 'qila'
    ? []
    : supportsXilaEnvironmentBreakdown
      ? metrics.xilaEnvironmentCalls ?? []
      : (metrics.xilaEnvironmentCalls ?? []).filter((item) => item.environment === 'prod');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 0' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
        {service} · 最近 24 小时
      </div>
      <div style={{ height: 180 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>调用量趋势（24h）</div>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis dataKey="hour" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={40} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--text-primary)',
              }}
            />
            <Area type="monotone" dataKey="totalCalls" stroke="var(--blue-500, #3B82F6)" fill="var(--blue-100, rgba(59,130,246,0.15))" name="总调用" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {xilaEnvironmentCalls.length > 0 && (
        <section
          data-testid="qila-xila-environment-calls"
          style={{
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            background: 'var(--bg-primary)',
            padding: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            Xila 账号环境调用量（近 24 小时）
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
            {xilaEnvironmentCalls.map((item) => (
              <div key={item.environment} style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                <span>{item.environment}</span>
                <strong style={{ color: 'var(--text-primary)', display: 'block', fontSize: 18, marginTop: 2 }}>
                  {item.totalCalls.toLocaleString()}
                </strong>
              </div>
            ))}
          </div>
          {xilaEnvironmentCalls.some((item) => item.environment === 'unknown') && (
            <div style={{ color: 'var(--warning)', fontSize: 12, marginTop: 8 }}>
              unknown 为字段上线前的历史记录，不能按账号环境追溯或计费。
            </div>
          )}
        </section>
      )}
      <div style={{ height: 180 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>延迟分布（24h）</div>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis dataKey="hour" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={50} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--text-primary)',
              }}
            />
            <Area type="monotone" dataKey="p50LatencyMs" stroke="var(--green-500, #22C55E)" fill="none" name="P50" strokeWidth={1} strokeDasharray="4 4" />
            <Area type="monotone" dataKey="p95LatencyMs" stroke="var(--yellow-500, #EAB308)" fill="var(--yellow-100, rgba(234,179,8,0.12))" name="P95" />
            <Area type="monotone" dataKey="p99LatencyMs" stroke="var(--danger)" fill="none" name="P99" strokeWidth={1} strokeDasharray="2 2" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {signozLogsUrl && (
        <a
          href={buildSignozLogsUrl(signozLogsUrl, service, mossEnv)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12,
            color: 'var(--blue-500, #3B82F6)',
            textDecoration: 'none',
            display: 'inline-block',
            marginTop: 8,
          }}
        >
          在 SigNoz 中查看服务日志 →
        </a>
      )}
    </div>
  );
};

// ── Main Panel ─────────────────────────────────────────────────

interface ExternalServiceMonitorPanelProps {
  /** SigNoz 日志查询页面的基 URL。未配置时不渲染跳转链接。 */
  signozLogsUrl?: string;
  /** 部署环境标识（dev / hotfix），用于过滤共享 SigNoz 中当前环境的日志。 */
  mossEnv?: string;
}

export const ExternalServiceMonitorPanel: React.FC<ExternalServiceMonitorPanelProps> = ({
  signozLogsUrl,
  mossEnv,
}) => {
  const [summary, setSummary] = useState<SaExternalServiceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsData, setMetricsData] = useState<SaExternalServiceMetrics | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      setSummary(await superAdminApi.externalServiceSummary());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  // auto-refresh every 30s
  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadSummary();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [loadSummary]);

  const loadMetrics = useCallback(async (service: string) => {
    setMetricsLoading(true);
    setMetricsData(null);
    try {
      setMetricsData(await superAdminApi.externalServiceMetrics(service));
    } catch {
      setMetricsData(null);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  const handleToggleExpand = useCallback(
    (service: string) => {
      if (expandedService === service) {
        setExpandedService(null);
        setMetricsData(null);
      } else {
        setExpandedService(service);
        void loadMetrics(service);
      }
    },
    [expandedService, loadMetrics],
  );

  const overviewCards = useMemo(() => {
    if (!summary || !summary.services.length) return [];
    const totalCalls = summary.services.reduce((sum, s) => sum + s.metrics24h.totalCalls, 0);
    const totalErrors = summary.services.reduce((sum, s) => sum + s.metrics24h.errorCount, 0);
    const avgSuccessRate =
      summary.services.length > 0
        ? summary.services.reduce((sum, s) => sum + s.metrics24h.successRate, 0) / summary.services.length
        : 0;
    const maxP95 = summary.services.reduce(
      (max, s) => Math.max(max, s.metrics24h.p95LatencyMs),
      0,
    );
    return [
      { label: '24h 总调用量', value: totalCalls.toLocaleString() },
      { label: '平均成功率', value: fmtPercent(avgSuccessRate) },
      { label: 'P95 延迟（最差）', value: fmtMs(maxP95) },
      { label: '24h 总错误数', value: totalErrors.toLocaleString() },
    ];
  }, [summary]);

  if (loading && !summary) {
    return <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>加载中...</div>;
  }

  return (
    <div data-testid="external-service-monitor-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* service health cards */}
      <section data-testid="external-service-monitor-health">
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
          服务健康总览
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: 12,
          }}
        >
          {(summary?.services ?? []).map((item) => (
            <ServiceHealthCard key={item.key} item={item} />
          ))}
        </div>
      </section>

      {/* 24h overview */}
      {overviewCards.length > 0 && (
        <section data-testid="external-service-monitor-overview">
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
            24h 调用概览
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            {overviewCards.map((card) => (
              <OverviewCard key={card.label} label={card.label} value={card.value} />
            ))}
          </div>
        </section>
      )}

      {/* recent alerts */}
      {summary && <AlertsSection alerts={summary.recentAlerts} signozLogsUrl={signozLogsUrl} mossEnv={mossEnv} />}

      {/* per-service details */}
      <section data-testid="external-service-monitor-details">
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
          分服务详情
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(summary?.services ?? []).map((item) => {
            const expanded = expandedService === item.key;
            const statusColor = SERVICE_COLORS[item.healthStatus] ?? SERVICE_COLORS.unknown;
            return (
              <article
                key={item.key}
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  background: 'var(--bg-tertiary)',
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => handleToggleExpand(item.key)}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{expanded ? '▼' : '▶'}</span>
                    <strong style={{ fontSize: 14, flexShrink: 0 }}>{item.label}</strong>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: statusColor,
                        padding: '1px 6px',
                        borderRadius: 999,
                        border: `1px solid ${statusColor}`,
                        flexShrink: 0,
                      }}
                    >
                      {healthLabel(item.healthStatus)}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
                      调用 {item.metrics24h.totalCalls.toLocaleString()} · 成功率 {fmtPercent(item.metrics24h.successRate)} · P95 {fmtMs(item.metrics24h.p95LatencyMs)}
                    </span>
                  </div>
                </button>
                {expanded && (
                  <div style={{ padding: '0 14px 14px' }}>
                    <ServiceDetail
                      service={item.key}
                      metrics={metricsData}
                      loading={metricsLoading}
                      signozLogsUrl={signozLogsUrl}
                      mossEnv={mossEnv}
                    />
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      限流触发 {item.metrics24h.rateLimitHits} 次 · 错误 {item.metrics24h.errorCount} 次
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default ExternalServiceMonitorPanel;
