import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, Building2, Building, Bot, Rocket, CornerDownLeft } from 'lucide-react';
import { SuperAdminLayout } from './SuperAdminLayout';
import { SuperAdminEmptyState } from './SuperAdminEmptyState';
import { superAdminApi, type SaStatsResponse } from '../../api/superadmin';

type TrendLine = {
  dataKey: string;
  name: string;
  stroke: string;
  dashed?: boolean;
};

type TrendDatum = {
  date: string;
  label: string;
  [key: string]: string | number;
};

type ChartTooltipPayload = {
  name?: string;
  value?: number | string;
  color?: string;
};

function formatTrendDate(date: string): string {
  const [, month, day] = date.split('-');
  return month && day ? `${month}/${day}` : date;
}

const CHART_LINES = {
  users: [
    { dataKey: 'newUsers', name: '新注册用户', stroke: 'var(--chart-blue)' },
    { dataKey: 'activeUsers', name: '活跃用户', stroke: 'var(--chart-violet)' },
    { dataKey: 'activeTenants', name: '活跃租户', stroke: 'var(--chart-teal)' },
  ],
  conversations: [
    { dataKey: 'conversationCount', name: '对话数', stroke: 'var(--chart-blue)' },
    { dataKey: 'successCount', name: '成功', stroke: 'var(--chart-teal)' },
    { dataKey: 'failedCount', name: '失败', stroke: 'var(--chart-rose)', dashed: true },
    { dataKey: 'timeoutCount', name: '超时', stroke: 'var(--chart-amber)', dashed: true },
    { dataKey: 'cancelledCount', name: '已取消', stroke: 'var(--chart-violet)', dashed: true },
  ],
} satisfies Record<string, TrendLine[]>;

const QUICK_ENTRIES = [
  {
    title: '子智能体管理',
    subtitle: '配置 researcher、code-reviewer 等平台伙伴，并在线验证 task 委派链路',
    path: '/superadmin/subagents',
  },
  {
    title: '主智能体管理',
    subtitle: '查看主智能体发布状态与工具策略，确认伙伴可见范围绑定对象',
    path: '/superadmin/agents',
  },
  {
    title: '对话记录',
    subtitle: '回看会话执行过程，排查子智能体启动与完成事件',
    path: '/superadmin/conversation-logs',
  },
  {
    title: '配置中心',
    subtitle: '统一管理通道、第三方接入、析拉、计费、LLM 等全局配置',
    path: '/superadmin/channel-settings',
  },
];

const DashboardSkeleton: React.FC = () => (
  <>
    <div className="fi-dashboard-stats">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="fi-dashboard-stat-card">
          <div className="fi-skeleton circle" style={{ width: 40, height: 40, flexShrink: 0 }} />
          <div className="fi-dashboard-stat-content" style={{ gap: 10 }}>
            <div className="fi-skeleton value" style={{ width: '60%' }} />
            <div className="fi-skeleton text" style={{ width: '40%' }} />
          </div>
        </div>
      ))}
    </div>
    <div className="fi-dashboard-chart-grid">
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="fi-dashboard-chart-card">
          <div className="fi-dashboard-chart-header">
            <div className="fi-skeleton title" style={{ width: 120 }} />
            <div className="fi-skeleton text" style={{ width: 280, marginTop: 8 }} />
          </div>
          <div className="fi-skeleton card" style={{ flex: 1, minHeight: 220 }} />
        </div>
      ))}
    </div>
  </>
);

const ChartTooltip: React.FC<{ active?: boolean; label?: string | number; payload?: ChartTooltipPayload[] }> = ({
  active,
  label,
  payload,
}) => {
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <div className="fi-dashboard-chart-tooltip">
      <div className="fi-dashboard-chart-tooltip-title">{label}</div>
      {payload.map((item) => (
        <div key={item.name} className="fi-dashboard-chart-tooltip-row">
          <span
            className="fi-dashboard-chart-tooltip-dot"
            style={{ background: item.color }}
            aria-hidden="true"
          />
          <span className="fi-dashboard-chart-tooltip-value" style={{ color: item.color }}>
            {item.name}: {Number(item.value ?? 0).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

const ChartLegend: React.FC<{ lines: TrendLine[] }> = ({ lines }) => (
  <div className="fi-dashboard-chart-legend" aria-hidden="true">
    {lines.map((line) => (
      <span key={line.dataKey} className="fi-dashboard-chart-legend-item">
        <span className="fi-dashboard-chart-legend-dot" style={{ background: line.stroke }} />
        {line.name}
      </span>
    ))}
  </div>
);

const ChartCard: React.FC<{ chartId: string; title: string; subtitle: string; data: TrendDatum[]; lines: TrendLine[] }> = ({
  chartId,
  title,
  subtitle,
  data,
  lines,
}) => (
  <section className="fi-dashboard-chart-card">
    <header className="fi-dashboard-chart-header">
      <div className="fi-dashboard-chart-title">{title}</div>
      <div className="fi-dashboard-chart-subtitle">{subtitle}</div>
    </header>
    <div className="fi-dashboard-chart-body">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 18, bottom: 0, left: 0 }}>
          <defs>
            {lines.map((line) => (
              <linearGradient key={line.dataKey} id={`${chartId}-${line.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={line.stroke} stopOpacity={0.16} />
                <stop offset="55%" stopColor={line.stroke} stopOpacity={0.06} />
                <stop offset="100%" stopColor={line.stroke} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="4 8" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="var(--text-tertiary)"
            tickLine={false}
            axisLine={false}
            tickMargin={12}
            minTickGap={24}
          />
          <YAxis
            orientation="right"
            stroke="var(--text-tertiary)"
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={44}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: 'var(--border-default)', strokeWidth: 1 }}
          />
          {lines.map((line) => (
            <Area
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.name}
              stroke={line.stroke}
              strokeDasharray={line.dashed ? '5 5' : undefined}
              strokeWidth={2.5}
              fill={`url(#${chartId}-${line.dataKey})`}
              dot={false}
              activeDot={{ r: 4, stroke: 'var(--bg-elevated)', strokeWidth: 2 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <ChartLegend lines={lines} />
  </section>
);

/**
 * 超管总览页（主前端承接首批）。
 *
 * 业务职责：
 * - 展示平台级核心统计卡片；
 * - 作为超管主路由收口入口，并提供其他超管页导航。
 */
export const SuperAdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<SaStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await superAdminApi.stats());
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStats();
  }, []);

  const cards = useMemo(
    () => (stats
      ? [
          { label: '累计用户', value: stats.totalUsers, icon: Users, tone: 'primary' },
          { label: '今日活跃用户', value: stats.activeUsers, icon: UserCheck, tone: 'success' },
          { label: '累计租户', value: stats.totalTenants, icon: Building2, tone: 'primary' },
          { label: '活跃租户', value: stats.activeTenants, icon: Building, tone: 'warning' },
          { label: '累计 Agent', value: stats.totalAgents, icon: Bot, tone: 'primary' },
          { label: '已发布 Agent', value: stats.publishedAgents, icon: Rocket, tone: 'success' },
        ]
      : []),
    [stats],
  );

  const overviewTrend = useMemo<TrendDatum[]>(
    () => (stats?.dailyOverviewTrend ?? []).map((item) => ({
      ...item,
      label: formatTrendDate(item.date),
    })),
    [stats],
  );

  return (
    <SuperAdminLayout testId="superadmin-dashboard-page">
      <main className="fi-superadmin-content fi-dashboard-page" data-testid="superadmin-dashboard-content">
        <header className="fi-dashboard-header" data-testid="superadmin-dashboard-header">
          <div className="fi-config-header-titles">
            <div className="fi-config-header-title">数据总览</div>
            <div className="fi-config-header-subtitle">平台级核心指标与用户趋势</div>
          </div>
          <button
            type="button"
            onClick={() => void loadStats()}
            disabled={loading}
            className="fi-config-button"
          >
            {loading ? '刷新中...' : '刷新'}
          </button>
        </header>

        {error && <div className="fi-config-alert error">{error}</div>}

        {loading && cards.length === 0 && (
          <DashboardSkeleton />
        )}

        {!loading && cards.length > 0 && (
          <div className="fi-dashboard-stats" data-testid="superadmin-dashboard-stats">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.label} className="fi-dashboard-stat-card">
                  <div className={`fi-dashboard-stat-icon ${card.tone}`}>
                    <Icon size={20} />
                  </div>
                  <div className="fi-dashboard-stat-content">
                    <div className="fi-dashboard-stat-value">{card.value.toLocaleString()}</div>
                    <div className="fi-dashboard-stat-label">{card.label}</div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!loading && !error && !stats && (
          <SuperAdminEmptyState
            title="暂无统计数据"
            description="当前没有可用的统计信息，请稍后刷新或检查服务状态。"
          />
        )}

        <section data-testid="superadmin-dashboard-quick-entries">
          <div className="fi-dashboard-section-title">能力入口</div>
          <div className="fi-dashboard-quick-entries">
            {QUICK_ENTRIES.map((entry) => (
              <button
                key={entry.path}
                type="button"
                onClick={() => navigate(entry.path)}
                className="fi-dashboard-quick-entry"
              >
                <div className="fi-dashboard-quick-entry-content">
                  <div className="fi-dashboard-quick-entry-title">{entry.title}</div>
                  <div className="fi-dashboard-quick-entry-subtitle">{entry.subtitle}</div>
                </div>
                <CornerDownLeft size={18} className="fi-dashboard-quick-entry-arrow" aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>

        {stats && (
          <div className="fi-dashboard-chart-grid" data-testid="superadmin-dashboard-charts">
            <ChartCard
              chartId="users"
              title="用户趋势"
              subtitle="近 30 天新注册用户、每日对话活跃用户与活跃租户"
              data={overviewTrend}
              lines={CHART_LINES.users}
            />
            <ChartCard
              chartId="conversations"
              title="对话质量"
              subtitle="每日对话任务、成功、失败、超时与取消数量"
              data={overviewTrend}
              lines={CHART_LINES.conversations}
            />
          </div>
        )}
      </main>
    </SuperAdminLayout>
  );
};

export default SuperAdminDashboardPage;
