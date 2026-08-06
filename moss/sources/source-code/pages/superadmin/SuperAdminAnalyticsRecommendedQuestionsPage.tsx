import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SuperAdminLayout } from './SuperAdminLayout';
import {
  superAdminApi,
  type SaRecommendedQuestionAnalyticsSummary,
} from '../../api/superadmin';
import type { JobStatus } from '../../api/jobApi';
import { SuperAdminSelect } from './SuperAdminSelect';

type SubmitStatusFilter = 'all' | 'submitted' | 'unsubmitted';
type EditStatusFilter = 'all' | 'edited' | 'unedited';
type JobStatusFilter = 'all' | JobStatus;
type FilterValues = {
  workspaceKeyword: string;
  userKeyword: string;
  agentKeyword: string;
  questionKeyword: string;
  submitStatus: SubmitStatusFilter;
  jobStatus: JobStatusFilter;
  editStatus: EditStatusFilter;
  startAt: string;
  endAt: string;
};

type TooltipPayload = {
  name?: string;
  value?: number | string;
  color?: string;
};

const HEATMAP_PAGE_SIZE = 20;

const controlStyle: React.CSSProperties = {
  height: 36,
  borderRadius: 8,
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  padding: '0 10px',
  outline: 'none',
};

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 12,
  background: 'var(--bg-tertiary)',
};

function toDatetimeLocal(value: Date): string {
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toIsoDateTime(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

function formatNumber(value?: number | null): string {
  return Number(value ?? 0).toLocaleString();
}

function formatRate(value?: number | null): string {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

function formatDuration(ms?: number | null): string {
  const value = Number(ms ?? 0);
  if (value <= 0) return '-';
  if (value < 1000) return `${value}ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(1)}s`;
  return `${(value / 60_000).toFixed(1)}min`;
}

function formatTrendDate(date: string): string {
  const [, month, day] = date.split('-');
  return month && day ? `${month}/${day}` : date;
}

const ChartTooltip: React.FC<{ active?: boolean; label?: string | number; payload?: TooltipPayload[] }> = ({
  active,
  label,
  payload,
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 10,
        boxShadow: 'var(--shadow-lg)',
        padding: '10px 12px',
      }}
    >
      <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((item) => (
        <div key={item.name} style={{ color: item.color, fontSize: 12, lineHeight: 1.8 }}>
          {item.name}: {formatNumber(Number(item.value ?? 0))}
        </div>
      ))}
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string; hint: string; accent?: string }> = ({
  label,
  value,
  hint,
  accent = 'var(--chart-blue)',
}) => (
  <section style={{ ...panelStyle, padding: 14, minHeight: 92 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{label}</span>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: accent }} />
    </div>
    <div style={{ marginTop: 10, color: 'var(--text-primary)', fontSize: 26, fontWeight: 700 }}>{value}</div>
    <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 12 }}>{hint}</div>
  </section>
);

export const RecommendedQuestionsContent: React.FC = () => {
  const now = useMemo(() => new Date(), []);
  const initialStartAt = useMemo(() => toDatetimeLocal(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)), [now]);
  const initialEndAt = useMemo(() => toDatetimeLocal(now), [now]);
  const [workspaceKeyword, setWorkspaceKeyword] = useState('');
  const [userKeyword, setUserKeyword] = useState('');
  const [agentKeyword, setAgentKeyword] = useState('');
  const [questionKeyword, setQuestionKeyword] = useState('');
  const [submitStatus, setSubmitStatus] = useState<SubmitStatusFilter>('all');
  const [jobStatus, setJobStatus] = useState<JobStatusFilter>('all');
  const [editStatus, setEditStatus] = useState<EditStatusFilter>('all');
  const [startAt, setStartAt] = useState(initialStartAt);
  const [endAt, setEndAt] = useState(initialEndAt);
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>({
    workspaceKeyword: '',
    userKeyword: '',
    agentKeyword: '',
    questionKeyword: '',
    submitStatus: 'all',
    jobStatus: 'all',
    editStatus: 'all',
    startAt: initialStartAt,
    endAt: initialEndAt,
  });
  const [summary, setSummary] = useState<SaRecommendedQuestionAnalyticsSummary | null>(null);
  const [heatmapPage, setHeatmapPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildParams = useCallback(() => ({
    workspaceKeyword: appliedFilters.workspaceKeyword.trim() || undefined,
    userKeyword: appliedFilters.userKeyword.trim() || undefined,
    agentKeyword: appliedFilters.agentKeyword.trim() || undefined,
    questionKeyword: appliedFilters.questionKeyword.trim() || undefined,
    submitStatus: appliedFilters.submitStatus,
    jobStatus: appliedFilters.jobStatus,
    editStatus: appliedFilters.editStatus,
    startAt: toIsoDateTime(appliedFilters.startAt),
    endAt: toIsoDateTime(appliedFilters.endAt),
  }), [appliedFilters]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summaryResponse = await superAdminApi.recommendedQuestionAnalyticsSummary(buildParams());
      setSummary(summaryResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSearch = useCallback(() => {
    setHeatmapPage(0);
    setAppliedFilters({
      workspaceKeyword,
      userKeyword,
      agentKeyword,
      questionKeyword,
      submitStatus,
      jobStatus,
      editStatus,
      startAt,
      endAt,
    });
  }, [agentKeyword, editStatus, endAt, jobStatus, questionKeyword, startAt, submitStatus, userKeyword, workspaceKeyword]);

  const trendData = useMemo(
    () => (summary?.trends ?? []).map((item) => ({
      ...item,
      label: formatTrendDate(item.date),
    })),
    [summary],
  );

  const overview = summary?.overview;
  const heatmapItems = summary?.heatmap ?? [];
  const heatmapTotalPages = useMemo(
    () => Math.max(Math.ceil(heatmapItems.length / HEATMAP_PAGE_SIZE), 1),
    [heatmapItems.length],
  );
  const safeHeatmapPage = Math.min(heatmapPage, heatmapTotalPages - 1);
  const pagedHeatmapItems = useMemo(
    () => heatmapItems.slice(
      safeHeatmapPage * HEATMAP_PAGE_SIZE,
      safeHeatmapPage * HEATMAP_PAGE_SIZE + HEATMAP_PAGE_SIZE,
    ),
    [heatmapItems, safeHeatmapPage],
  );
  const maxHeatmapClick = useMemo(
    () => Math.max(...heatmapItems.map((entry) => entry.clickCount), 1),
    [heatmapItems],
  );

  return (
    <>
      <div data-testid="superadmin-recommended-questions-header">
          <div style={{ fontSize: 20, fontWeight: 600, lineHeight: '28px', color: 'var(--text-primary)' }}>推荐问题分析</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            点击、提交、成功、首问与推荐问采用情况。
          </div>
        </div>

        <section className="sa-filter-bar" data-testid="superadmin-recommended-questions-filters" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input value={workspaceKeyword} onChange={(event) => setWorkspaceKeyword(event.target.value)} placeholder="工作区名称 / ID" style={{ ...controlStyle, minWidth: 170 }} />
            <input value={userKeyword} onChange={(event) => setUserKeyword(event.target.value)} placeholder="用户昵称 / 手机 / ID" style={{ ...controlStyle, minWidth: 180 }} />
            <input value={agentKeyword} onChange={(event) => setAgentKeyword(event.target.value)} placeholder="智能体名称 / ID" style={{ ...controlStyle, minWidth: 170 }} />
            <input value={questionKeyword} onChange={(event) => setQuestionKeyword(event.target.value)} placeholder="推荐问内容" style={{ ...controlStyle, minWidth: 220 }} />
            <SuperAdminSelect
              value={submitStatus}
              onChange={setSubmitStatus}
              ariaLabel="提交状态"
              options={[
                { value: 'all', label: '全部提交状态' },
                { value: 'submitted', label: '已提交' },
                { value: 'unsubmitted', label: '未提交' },
              ]}
            />
            <SuperAdminSelect
              value={jobStatus}
              onChange={setJobStatus}
              ariaLabel="任务状态"
              options={[
                { value: 'all', label: '全部任务状态' },
                { value: 'SUCCEEDED', label: '成功' },
                { value: 'FAILED', label: '失败' },
                { value: 'TIMEOUT', label: '超时' },
                { value: 'CANCELLED', label: '取消' },
              ]}
            />
            <SuperAdminSelect
              value={editStatus}
              onChange={setEditStatus}
              ariaLabel="改写状态"
              options={[
                { value: 'all', label: '全部改写状态' },
                { value: 'edited', label: '已改写' },
                { value: 'unedited', label: '未改写' },
              ]}
            />
            <input value={startAt} onChange={(event) => setStartAt(event.target.value)} type="datetime-local" style={controlStyle} />
            <input value={endAt} onChange={(event) => setEndAt(event.target.value)} type="datetime-local" style={controlStyle} />
            <button
              type="button"
              onClick={handleSearch}
              style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}
            >
              搜索
            </button>
        </section>

        {loading && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>加载中...</div>}
        {error && (
          <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--danger-border-soft)', background: 'var(--danger-bg-soft)', color: 'var(--danger)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <section data-testid="superadmin-recommended-questions-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <MetricCard label="推荐问点击" value={formatNumber(overview?.clickCount)} hint={`覆盖 ${formatNumber(overview?.uniqueUserCount)} 人`} accent="var(--chart-blue)" />
          <MetricCard label="点击后提交率" value={formatRate(overview?.submitRate)} hint={`${formatNumber(overview?.submittedCount)} 次提交`} accent="var(--chart-teal)" />
          <MetricCard label="提交任务成功率" value={formatRate(overview?.successRate)} hint={`${formatNumber(overview?.succeededJobCount)} 次成功`} accent="var(--chart-violet)" />
          <MetricCard label="注册当天首问比例" value={formatRate(overview?.sameDayAskRate)} hint={`${formatNumber(overview?.sameDayAskedUserCount)} / ${formatNumber(overview?.registeredUserCount)} 人`} accent="var(--chart-amber)" />
          <MetricCard label="提问用户使用推荐问比例" value={formatRate(overview?.askingUserRecommendedQuestionRate)} hint={`${formatNumber(overview?.askingUserRecommendedQuestionCount)} / ${formatNumber(overview?.askingUserCount)} 人`} accent="var(--chart-rose)" />
          <MetricCard label="平均提交耗时" value={formatDuration(overview?.avgSubmitElapsedMs)} hint={`改写率 ${formatRate(overview?.editRate)}`} accent="var(--chart-blue)" />
        </section>

        <section data-testid="superadmin-recommended-questions-charts" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.8fr)', gap: 12 }}>
          <div data-testid="superadmin-recommended-questions-trend-chart" style={{ ...panelStyle, padding: 16, minHeight: 320 }}>
            <div style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>趋势</div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <AreaChart data={trendData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="rq-click" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-blue)" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="var(--chart-blue)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="rq-submit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-teal)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--chart-teal)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="4 8" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--text-muted)" tickLine={false} axisLine={false} tickMargin={12} />
                  <YAxis orientation="right" stroke="var(--text-muted)" tickLine={false} axisLine={false} allowDecimals={false} width={42} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-default)', strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="clickCount" name="点击" stroke="var(--chart-blue)" strokeWidth={3} fill="url(#rq-click)" dot={false} />
                  <Area type="monotone" dataKey="submittedCount" name="提交" stroke="var(--chart-teal)" strokeWidth={3} fill="url(#rq-submit)" dot={false} />
                  <Area type="monotone" dataKey="succeededJobCount" name="成功" stroke="var(--chart-violet)" strokeWidth={3} fill="transparent" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div data-testid="superadmin-recommended-questions-funnel-chart" style={{ ...panelStyle, padding: 16, minHeight: 320 }}>
            <div style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>转化漏斗</div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={summary?.funnel ?? []} layout="vertical" margin={{ top: 8, right: 18, bottom: 8, left: 12 }}>
                  <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="4 8" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="label" width={86} stroke="var(--text-muted)" tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-elevated)' }} />
                  <Bar dataKey="count" name="数量" fill="var(--chart-blue)" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section data-testid="superadmin-recommended-questions-rankings" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
          <div data-testid="superadmin-recommended-questions-top-questions" style={{ ...panelStyle, padding: 16 }}>
            <div style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Top 推荐问</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(summary?.topQuestions ?? []).map((item, index) => (
                <div key={`${item.questionContent}_${index}`} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) 92px', gap: 10, alignItems: 'center' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{index + 1}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.5, whiteSpace: 'normal', wordBreak: 'break-word' }}>{item.questionContent}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3 }}>{item.questionGroupName} · 提交率 {formatRate(item.submitRate)}</div>
                  </div>
                  <div style={{ textAlign: 'right', color: 'var(--text-primary)', fontWeight: 700 }}>{formatNumber(item.clickCount)}</div>
                </div>
              ))}
            </div>
          </div>

          <div data-testid="superadmin-recommended-questions-top-agents" style={{ ...panelStyle, padding: 16 }}>
            <div style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>智能体推荐问使用排行</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(summary?.topAgents ?? []).map((item, index) => (
                <div key={`${item.agentId}_${index}`} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) 110px', gap: 10, alignItems: 'center' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{index + 1}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: 'var(--text-primary)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.agentName}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3 }}>{item.tenantName} · {formatNumber(item.uniqueUserCount)} 人</div>
                  </div>
                  <div style={{ textAlign: 'right', color: 'var(--text-primary)', fontSize: 12 }}>
                    <div>{formatNumber(item.clickCount)} 点击</div>
                    <div style={{ color: 'var(--text-muted)', marginTop: 3 }}>{formatRate(item.successRate)} 成功</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section data-testid="superadmin-recommended-questions-heatmap" style={{ ...panelStyle, padding: 16 }}>
          <div style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>工作区 × 智能体使用分布</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {pagedHeatmapItems.map((item) => {
              const maxClick = maxHeatmapClick;
              const intensity = maxClick > 1
                ? Math.log(item.clickCount) / Math.log(maxClick)
                : 0;
              const bgOpacity = 0.04 + intensity * 0.12; // 4% ~ 16% 背景透明度
              return (
                <div key={`${item.tenantId}_${item.agentId}`} style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: 10,
                  background: `color-mix(in srgb, var(--chart-blue) ${Math.round(bgOpacity * 100)}%, var(--bg-elevated))`,
                }}>
                  <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.agentName}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.tenantName}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, color: 'var(--text-muted)', fontSize: 12 }}>
                    <span>{formatNumber(item.clickCount)} 点击</span>
                    <span>{formatRate(item.submitRate)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div data-testid="superadmin-recommended-questions-heatmap-pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 14 }}>
            <span>共 {formatNumber(heatmapItems.length)} 个分布项，当前第 {safeHeatmapPage + 1} / {heatmapTotalPages} 页</span>
            <span style={{ display: 'inline-flex', gap: 8 }}>
              <button type="button" disabled={loading || safeHeatmapPage <= 0} onClick={() => setHeatmapPage(Math.max(safeHeatmapPage - 1, 0))} style={{ ...controlStyle, cursor: loading || safeHeatmapPage <= 0 ? 'not-allowed' : 'pointer', opacity: loading || safeHeatmapPage <= 0 ? 0.5 : 1 }}>上一页</button>
              <button type="button" disabled={loading || safeHeatmapPage + 1 >= heatmapTotalPages} onClick={() => setHeatmapPage(Math.min(safeHeatmapPage + 1, heatmapTotalPages - 1))} style={{ ...controlStyle, cursor: loading || safeHeatmapPage + 1 >= heatmapTotalPages ? 'not-allowed' : 'pointer', opacity: loading || safeHeatmapPage + 1 >= heatmapTotalPages ? 0.5 : 1 }}>下一页</button>
            </span>
          </div>
        </section>

    </>
  );
};

export const SuperAdminAnalyticsRecommendedQuestionsPage: React.FC = () => {
  return (
    <SuperAdminLayout>
      <main
        className="fi-superadmin-content"
        data-testid="superadmin-recommended-questions-page"
        style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <RecommendedQuestionsContent />
      </main>
    </SuperAdminLayout>
  );
};

export default SuperAdminAnalyticsRecommendedQuestionsPage;
