import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { SaTrackingSummary, SaTrackingSummaryParams } from '../../api/superadmin';
import { FilterableSelect } from './FilterableSelect';
import type { FilterableSelectOption } from './FilterableSelect';

interface TrackingAnalyticsPanelProps {
  fetchSummary: (params: SaTrackingSummaryParams) => Promise<SaTrackingSummary>;
  category?: 'frontend' | 'dashboard';
  active?: boolean;
}

function toDatetimeLocal(value: Date): string {
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatTrendDate(date: string): string {
  const [, month, day] = date.split('-');
  return month && day ? `${month}/${day}` : date;
}

function formatNumber(value?: number | null): string {
  return Number(value ?? 0).toLocaleString();
}

const controlStyle: React.CSSProperties = {
  height: 36,
  borderRadius: 8,
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  padding: '0 10px',
  outline: 'none',
  fontSize: 13,
};

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 12,
  background: 'var(--bg-tertiary)',
};

type TooltipPayload = { name?: string; value?: number | string; color?: string };

const ChartTooltip: React.FC<{ active?: boolean; label?: string | number; payload?: TooltipPayload[] }> = ({
  active, label, payload,
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: entry.color }} />
          <span style={{ color: 'var(--text-primary)' }}>{entry.name}：{Number(entry.value ?? 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

const EVENT_NAME_CN: Record<string, string> = {
  send: '发送消息',
  case_center: '案例中心',
  session_favorite: '会话收藏',
  my_files: '我的文件',
  automation: '自动化',
  share_session: '分享会话',
  file_context_menu: '文件右键菜单',
  file_preview: '文件预览',
  user_menu: '用户菜单',
  space_overview_save: '空间概览保存',
  space_invite_member: '空间邀请成员',
  space_invite_copy: '空间邀请复制',
  agent_edit: '智能体编辑',
  open_integration: '开放集成',
  publish_update: '发布更新',
  custom_skill: '自定义技能',
  general_management: '通用管理',
  admin_tab: '管理标签',
  info_source: '信息来源',
  execution_chain_expand: '执行链展开',
  board_entry: '看板入口',
  board_query: '看板查询',
  board_save_snapshot: '保存快照',
  board_save_local_image: '保存本地图片',
  board_moss_insight: 'Moss洞察',
};

const cnName = (eventName: string) => EVENT_NAME_CN[eventName] ?? eventName;

const SUB_EVENT_CN: Record<string, string> = {
  // file_context_menu / file_preview
  maximize: '最大化',
  quote: '引用到会话',
  download: '下载',
  rename: '重命名',
  delete: '删除',
  share: '分享',
  cross_session_quote: '跨会话引用',
  favorite: '收藏',
  unfavorite: '取消收藏',
  // share_session
  share_entry: '分享入口',
  enterprise_share_copy: '企业内分享复制',
  public_share_copy: '公开分享复制',
  // user_menu
  tenant_name: '租户名称',
  personal_settings: '个人设置',
  admin: '管理后台',
  help_doc: '帮助文档',
  logout: '退出登录',
  // custom_skill
  save: '保存技能',
  publish: '发布技能',
  upload: '上传技能包',
  // admin_tab
  general: '通用管理',
  agent: '智能体管理',
  skills: '技能管理',
  space: '空间管理',
  // general_management
  usage: '用量管理',
  records: '使用记录',
  automation: '自动化任务',
};

const cnSubName = (subEvent?: string | null) => {
  if (!subEvent) return null;
  return SUB_EVENT_CN[subEvent] ?? subEvent;
};

// which sub_events belong to which event_names (for formatted labels)
// source of truth: actual track() calls across the frontend codebase
const SUB_EVENT_PARENT_MAP: Record<string, string[]> = {
  file_context_menu: ['quote', 'download', 'rename', 'delete', 'share', 'cross_session_quote'],
  file_preview: ['maximize', 'quote', 'download', 'share', 'rename', 'delete'],
  share_session: ['share_entry', 'enterprise_share_copy', 'public_share_copy'],
  user_menu: ['tenant_name', 'personal_settings', 'admin', 'help_doc', 'logout'],
  custom_skill: ['save', 'publish', 'upload'],
  general_management: ['usage', 'records', 'automation'],
  admin_tab: ['general', 'agent', 'space', 'skills'],
};

// event categories for per-tab filtering
const FRONTEND_EVENT_KEYS = [
  'send', 'case_center', 'session_favorite', 'my_files', 'automation',
  'share_session', 'file_context_menu', 'file_preview', 'user_menu',
  'space_overview_save', 'space_invite_member', 'space_invite_copy',
  'agent_edit', 'open_integration', 'publish_update', 'custom_skill',
  'general_management', 'admin_tab', 'info_source', 'execution_chain_expand',
];

const DASHBOARD_EVENT_KEYS = ['board_entry', 'board_query', 'board_save_snapshot', 'board_save_local_image', 'board_moss_insight'];

function buildEventOptions(category?: 'frontend' | 'dashboard'): FilterableSelectOption[] {
  const keys = category === 'dashboard' ? DASHBOARD_EVENT_KEYS : FRONTEND_EVENT_KEYS;
  return [
    { value: '', label: '全部' },
    ...keys.map(k => ({ value: k, label: EVENT_NAME_CN[k] ?? k })),
  ];
}

const GRANULARITY_OPTIONS = [
  { value: 'day' as const, label: '日' },
  { value: 'week' as const, label: '周' },
  { value: 'month' as const, label: '月' },
];

const TENANT_PAGE_SIZE = 10;

export const TrackingAnalyticsPanel: React.FC<TrackingAnalyticsPanelProps> = ({ fetchSummary, category, active = true }) => {
  const isDashboard = category === 'dashboard';
  const now = useMemo(() => new Date(), []);
  const initialStartAt = useMemo(() => toDatetimeLocal(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)), [now]);
  const initialEndAt = useMemo(() => toDatetimeLocal(now), [now]);

  const [tenantId, setTenantId] = useState('');
  const [eventName, setEventName] = useState('');
  const [subEvent, setSubEvent] = useState('');
  const [startAt, setStartAt] = useState(initialStartAt);
  const [endAt, setEndAt] = useState(initialEndAt);
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');
  const [data, setData] = useState<SaTrackingSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantPage, setTenantPage] = useState(0);
  const [countSort, setCountSort] = useState<'desc' | 'asc'>('desc');

  const initialLoadDone = useRef(false);

  const handleSearch = useCallback(async () => {
    if (startAt && endAt && startAt > endAt) {
      setError('开始时间不能晚于结束时间');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const toISO = (v: string) => v ? new Date(v).toISOString() : undefined;
      const result = await fetchSummary({
        tenantId: tenantId.trim() || undefined,
        eventName: eventName || undefined,
        subEvent: subEvent || undefined,
        startAt: toISO(startAt),
        endAt: toISO(endAt),
        granularity,
      });
      setData(result);
      setTenantPage(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [tenantId, eventName, subEvent, startAt, endAt, granularity, fetchSummary]);

  useEffect(() => {
    if (active && !initialLoadDone.current) {
      initialLoadDone.current = true;
      handleSearch();
    }
  }, [active, handleSearch]);

  const trendData = useMemo(
    () => data?.trends.map(item => ({ ...item, label: formatTrendDate(item.date) })) ?? [],
    [data]
  );

  const eventOptions = useMemo(() => buildEventOptions(category), [category]);

  // subEvent options with optional parent event prefix
  const subEventOptions: FilterableSelectOption[] = useMemo(() => {
    const base: FilterableSelectOption[] = [{ value: '', label: '全部' }];
    if (!eventName) {
      // no event selected: show all sub_events for global filtering
      for (const [en, cn] of Object.entries(SUB_EVENT_CN)) {
        base.push({ value: en, label: cn });
      }
      return base;
    }
    const parentMap = SUB_EVENT_PARENT_MAP[eventName];
    if (!parentMap) {
      // event has no sub_events: only "全部"
      return base;
    }
    for (const en of parentMap) {
      const cn = SUB_EVENT_CN[en];
      if (cn) base.push({ value: en, label: `${cnName(eventName)}-${cn}` });
    }
    return base;
  }, [eventName]);

  // sort + pagination
  const topTenants = data?.topTenants ?? [];
  const sortedTenants = useMemo(() => {
    const sorted = [...topTenants];
    sorted.sort((a, b) => countSort === 'desc' ? b.count - a.count : a.count - b.count);
    return sorted;
  }, [topTenants, countSort]);
  const tenantTotalPages = Math.max(1, Math.ceil(sortedTenants.length / TENANT_PAGE_SIZE));
  const safeTenantPage = Math.min(tenantPage, tenantTotalPages - 1);
  const pagedTenants = useMemo(
    () => sortedTenants.slice(safeTenantPage * TENANT_PAGE_SIZE, (safeTenantPage + 1) * TENANT_PAGE_SIZE),
    [sortedTenants, safeTenantPage]
  );

  const metricCards = (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
      <div style={{ ...panelStyle, padding: 14, minHeight: 92 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>总点击量</span>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--chart-blue)' }} />
        </div>
        <div style={{ marginTop: 10, color: 'var(--text-primary)', fontSize: 26, fontWeight: 700 }}>
          {data ? formatNumber(data.totalClicks) : '—'}
        </div>
      </div>
      <div style={{ ...panelStyle, padding: 14, minHeight: 92 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>活跃用户数</span>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--chart-teal)' }} />
        </div>
        <div style={{ marginTop: 10, color: 'var(--text-primary)', fontSize: 26, fontWeight: 700 }}>
          {data ? formatNumber(data.activeUserCount) : '—'}
        </div>
      </div>
      <div style={{ ...panelStyle, padding: 14, minHeight: 92 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>活跃租户数</span>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--chart-violet)' }} />
        </div>
        <div style={{ marginTop: 10, color: 'var(--text-primary)', fontSize: 26, fontWeight: 700 }}>
          {data ? formatNumber(data.activeTenantCount) : '—'}
        </div>
      </div>
    </section>
  );

  const headerTitle = isDashboard ? '智能看板分析' : '前端埋点分析';
  const headerDesc = isDashboard
    ? '看板入口、查询、保存（快照/本地图片）、Moss洞察等 5 项看板操作行为。'
    : '发送消息、文件操作、会话收藏与分享、空间与智能体管理、后台管理等 20 项前端交互行为。';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 600, lineHeight: '28px', color: 'var(--text-primary)' }}>{headerTitle}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{headerDesc}</div>
      </div>
      <form
        onSubmit={e => { e.preventDefault(); handleSearch(); }}
        style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}
      >
        <input
          value={tenantId}
          onChange={e => setTenantId(e.target.value)}
          placeholder="租户ID"
          style={{ ...controlStyle, minWidth: 160 }}
        />
        <FilterableSelect
          value={eventName}
          onChange={v => { setEventName(v); setSubEvent(''); }}
          options={eventOptions}
          placeholder="埋点名"
          style={{ minWidth: 160 }}
        />
        {!isDashboard && (
          <FilterableSelect
            value={subEvent}
            onChange={setSubEvent}
            options={subEventOptions}
            placeholder="子操作"
            style={{ minWidth: 140 }}
          />
        )}
        <input
          type="datetime-local"
          value={startAt}
          onChange={e => setStartAt(e.target.value || initialStartAt)}
          style={controlStyle}
        />
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>~</span>
        <input
          type="datetime-local"
          value={endAt}
          onChange={e => setEndAt(e.target.value || initialEndAt)}
          style={controlStyle}
        />
        <div style={{ display: 'inline-flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
          {GRANULARITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setGranularity(opt.value)}
              style={{
                height: 36, padding: '0 14px', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 500,
                background: granularity === opt.value ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            height: 36, padding: '0 16px', borderRadius: 8, cursor: 'pointer',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
            fontSize: 13,
          }}
        >
          搜索
        </button>
      </form>

      {loading && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>加载中...</div>}
      {error && (
        <div style={{
          padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--danger-border-soft)',
          background: 'var(--danger-bg-soft)', color: 'var(--danger)',
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {data && (
        <>
          {metricCards}

          <section style={{ ...panelStyle, padding: 16, minHeight: 320 }}>
            <div style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>趋势</div>
            {trendData.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>暂无趋势数据</div>
            ) : (
              <div style={{ height: 260 }}>
                <ResponsiveContainer>
                  <AreaChart data={trendData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="tracking-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-blue)" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="var(--chart-blue)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="4 8" vertical={false} />
                    <XAxis dataKey="label" stroke="var(--text-muted)" tickLine={false} axisLine={false} tickMargin={12} />
                    <YAxis orientation="right" stroke="var(--text-muted)" tickLine={false} axisLine={false} allowDecimals={false} width={42} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-default)', strokeWidth: 1 }} />
                    <Area type="monotone" dataKey="count" name="点击量" stroke="var(--chart-blue)" strokeWidth={3} fill="url(#tracking-fill)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section style={{ ...panelStyle, padding: 16, minHeight: 320 }}>
            <div style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>按租户汇总</div>
            {sortedTenants.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>暂无汇总数据</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* header */}
                <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) 100px', gap: 10, alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>#</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>埋点名 / 租户</span>
                  <span
                    onClick={() => setCountSort(s => s === 'desc' ? 'asc' : 'desc')}
                    style={{ color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                  >
                    次数 {countSort === 'desc' ? '↓' : '↑'}
                  </span>
                </div>
                {pagedTenants.map((item, i) => (
                  <div key={`${item.tenantId}_${item.eventName}_${item.subEvent ?? ''}_${i}`} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) 100px', gap: 10, alignItems: 'center' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{safeTenantPage * TENANT_PAGE_SIZE + i + 1}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, lineHeight: '22px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ color: 'var(--text-muted)' }}>埋点名：</span>
                        <span style={{ color: 'var(--text-primary)' }}>{cnName(item.eventName)}</span>
                        {item.subEvent && <span style={{ color: 'var(--text-muted)' }}> / {cnSubName(item.subEvent)}</span>}
                      </div>
                      <div style={{ fontSize: 13, lineHeight: '20px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ color: 'var(--text-muted)' }}>租户：</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{item.tenantName}</span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 10, fontSize: 12 }}>{item.tenantId}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', color: 'var(--text-primary)', fontWeight: 700, fontSize: 14 }}>{item.count.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
            {sortedTenants.length > TENANT_PAGE_SIZE && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 14 }}>
                <span>共 {formatNumber(sortedTenants.length)} 条，第 {safeTenantPage + 1} / {tenantTotalPages} 页</span>
                <span style={{ display: 'inline-flex', gap: 8 }}>
                  {safeTenantPage > 0 && (
                    <button type="button" disabled={loading} onClick={() => setTenantPage(0)}
                      style={{ ...controlStyle, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>
                      首页
                    </button>
                  )}
                  {safeTenantPage > 0 && (
                    <button type="button" disabled={loading} onClick={() => setTenantPage(Math.max(safeTenantPage - 1, 0))}
                      style={{ ...controlStyle, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>
                      上一页
                    </button>
                  )}
                  {safeTenantPage + 1 < tenantTotalPages && (
                    <button type="button" disabled={loading} onClick={() => setTenantPage(Math.min(safeTenantPage + 1, tenantTotalPages - 1))}
                      style={{ ...controlStyle, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>
                      下一页
                    </button>
                  )}
                  {safeTenantPage + 1 < tenantTotalPages && (
                    <button type="button" disabled={loading} onClick={() => setTenantPage(tenantTotalPages - 1)}
                      style={{ ...controlStyle, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>
                      尾页
                    </button>
                  )}
                </span>
              </div>
            )}
          </section>
        </>
      )}

      {!loading && !error && !data && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          点击"搜索"查看数据
        </div>
      )}
    </div>
  );
};
