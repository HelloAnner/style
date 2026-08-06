/**
 * 智能体监管 > 用量管理 Tab。
 *
 * 功能：
 * - 顶部：三卡片（套餐状态 / 资源使用情况 / 增购与商务支持）
 * - 底部：用户用量明细列表，含时间范围筛选与用户搜索
 *
 * 样式：全内联 + CSS 变量，无 className 依赖；三卡片对齐原型
 *   docs/frontend-platform/changes/20260410-platform-pages-redesign/
 *   prototype/admin-and-user-settings.html 的 `.stats` 布局。
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getBillingCredits, listUserUsage } from '../../../api/platformBilling';
import type { BillingCreditsResponse, UserUsageItem } from '../../../api/platformBilling';
import { WorkspaceSalesConsultModal } from '../../../components/Billing/WorkspaceSalesConsultModal';
import { isFeishuWorkspace, useTenantStore } from '../../../stores/tenantStore';

// ── 工具函数 ──

function formatCredits(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('zh-CN');
}

// ── 类型 ──

type TimeRange = 'today' | 'last_7d' | 'last_30d' | 'custom';

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  today: '今日',
  last_7d: '近 7 天',
  last_30d: '近 30 天',
  custom: '自定义',
};

const TIME_RANGE_OPTIONS: TimeRange[] = ['today', 'last_7d', 'last_30d', 'custom'];

const PAGE_SIZE = 20;

// ── 公共样式常量 ──

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 12,
  padding: 24,
  background: 'var(--bg-secondary)',
};

const tableHeaderCellStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  borderBottom: '1px solid var(--border-subtle)',
  background: 'var(--bg-secondary)',
  whiteSpace: 'nowrap',
};

const tableBodyCellStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 14,
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border-subtle)',
  verticalAlign: 'middle',
};

// ── 三卡片：套餐状态 / 资源使用 / 增购与商务 ──
//
// 对齐原型 docs/frontend-platform/changes/20260410-platform-pages-redesign/
//   prototype/admin-and-user-settings.html 中的 `.stats` 三卡片布局。

const statLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
  marginBottom: 7,
};

const statSubStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
  marginTop: 3,
};

function resolvePlanTypeLabel(planType: BillingCreditsResponse['planType']): string {
  return planType === 'official' ? '正式版' : '试用版';
}

function resolvePlanStatusLabel(planStatus: BillingCreditsResponse['planStatus']): string {
  if (planStatus === 'expired') return '已过期';
  if (planStatus === 'exhausted') return '已耗尽';
  return '生效中';
}

function isExternalQuotaSnapshot(credits: BillingCreditsResponse): boolean {
  return credits.displayMode === 'external_quota_snapshot' || credits.creditSource === 'feishu_ai_package';
}

function PlanStatusCard({ credits }: { credits: BillingCreditsResponse }) {
  const isTrialPlan = credits.planType === 'trial';
  const isActive = credits.planStatus === 'active';

  const subText = isTrialPlan
    ? '试用期永久有效'
    : credits.daysToExpire != null && credits.planExpiresAt
      ? `剩余 ${credits.daysToExpire} 天 · 到期 ${formatDate(credits.planExpiresAt)}`
      : credits.planExpiresAt
        ? `到期 ${formatDate(credits.planExpiresAt)}`
        : '';

  return (
    <div style={cardStyle}>
      <div style={statLabelStyle}>套餐状态</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '6px 0' }}>
        <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--accent)' }}>
          {resolvePlanTypeLabel(credits.planType)}
        </span>
        <span
          style={{
            fontSize: 11,
            padding: '1px 6px',
            borderRadius: 4,
            background: isActive ? 'var(--success-bg-soft)' : 'var(--danger-bg-soft)',
            color: isActive ? 'var(--success)' : 'var(--danger)',
          }}
        >
          {resolvePlanStatusLabel(credits.planStatus)}
        </span>
      </div>
      {subText && <div style={statSubStyle}>{subText}</div>}
    </div>
  );
}

function ResourceUsageCard({ credits }: { credits: BillingCreditsResponse }) {
  if (isExternalQuotaSnapshot(credits)) {
    return (
      <div style={cardStyle}>
        <div style={{ ...statLabelStyle, margin: 0 }}>飞书 AI 包额度</div>
        <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', margin: '4px 0 0' }}>
          可用额度 {formatCredits(credits.balance)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 8 }}>
          显示飞书侧当前可用额度快照。
        </div>
      </div>
    );
  }

  const usedPercent =
    credits.totalCredits > 0
      ? Math.min(100, (credits.usedCredits / credits.totalCredits) * 100)
      : 0;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ ...statLabelStyle, margin: 0 }}>资源使用情况</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
          已使用 {usedPercent.toFixed(2)}%
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', margin: '4px 0 0' }}>
        已消耗 {formatCredits(credits.usedCredits)}{' '}
        <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>
          / {formatCredits(credits.totalCredits)}
        </span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 4,
          background: 'var(--bg-tertiary)',
          overflow: 'hidden',
          marginTop: 10,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${usedPercent}%`,
            borderRadius: 4,
            background: 'var(--text-primary)',
            transition: 'width 0.3s',
          }}
        />
      </div>
    </div>
  );
}

function ContactSalesCard({ onOpenSales }: { onOpenSales: () => void }) {
  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div style={statLabelStyle}>增购与商务支持</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 4 }}>
          补充积分包或开通正式版，请联系销售
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenSales}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          marginTop: 10,
          alignSelf: 'flex-start',
          padding: '6px 14px',
          fontSize: 12,
          fontWeight: 500,
          border: 'none',
          borderRadius: 8,
          background: 'var(--btn-mono-bg)',
          color: 'var(--btn-mono-text)',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--btn-mono-hover-bg)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--btn-mono-bg)';
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.9a16 16 0 0 0 6.1 6.1l.95-.95a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
        联系销售
      </button>
    </div>
  );
}

function BillingOverviewSection() {
  const [credits, setCredits] = useState<BillingCreditsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [salesOpen, setSalesOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    getBillingCredits()
      .then(setCredits)
      .catch(() => setCredits(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14,
          marginBottom: 18,
        }}
      >
        {loading ? (
          <div style={{ ...cardStyle, gridColumn: '1 / -1', color: 'var(--text-tertiary)', fontSize: 14 }}>
            加载中…
          </div>
        ) : !credits ? (
          <div style={{ ...cardStyle, gridColumn: '1 / -1', color: 'var(--text-tertiary)', fontSize: 14 }}>
            暂无数据
          </div>
        ) : (
          <>
            <PlanStatusCard credits={credits} />
            <ResourceUsageCard credits={credits} />
            <ContactSalesCard onOpenSales={() => setSalesOpen(true)} />
          </>
        )}
      </div>
      <WorkspaceSalesConsultModal open={salesOpen} onClose={() => setSalesOpen(false)} />
    </>
  );
}

// ── 子组件：时间范围下拉选择 ──

interface TimeRangeSelectProps {
  value: TimeRange;
  onChange: (v: TimeRange) => void;
}

function TimeRangeSelect({ value, onChange }: TimeRangeSelectProps) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as TimeRange)}
      style={{
        padding: '6px 28px 6px 12px',
        borderRadius: 8,
        border: '1px solid var(--border-default)',
        background:
          "var(--bg-primary) url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\") no-repeat right 10px center",
        fontSize: 13,
        color: 'var(--text-primary)',
        cursor: 'pointer',
        outline: 'none',
        appearance: 'none',
        WebkitAppearance: 'none',
        MozAppearance: 'none',
      }}
    >
      {TIME_RANGE_OPTIONS.map(opt => (
        <option key={opt} value={opt}>
          {TIME_RANGE_LABELS[opt]}
        </option>
      ))}
    </select>
  );
}

function formatLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── 主组件 ──

const UsageTab: React.FC = () => {
  const currentWorkspace = useTenantStore((s) => s.currentWorkspace);
  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [userSearch, setUserSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<UserUsageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 搜索防抖
  const handleSearchChange = (val: string) => {
    setUserSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  };

  const loadData = useCallback(async () => {
    // 自定义时间范围尚未填写，跳过请求避免 400
    if (timeRange === 'custom' && (!customFrom || !customTo)) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await listUserUsage({
        timeRange,
        from: timeRange === 'custom' ? new Date(customFrom).toISOString() : undefined,
        to: timeRange === 'custom' ? new Date(customTo).toISOString() : undefined,
        keyword: debouncedSearch || undefined,
        page: page - 1,
        pageSize: PAGE_SIZE,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch {
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [timeRange, customFrom, customTo, debouncedSearch, page]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showFeishuAiPackage = isFeishuWorkspace(currentWorkspace);
  const usageColumnCount = showFeishuAiPackage ? 4 : 3;

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }} data-testid="agent-supervision-usage-tab">
      {/* 三卡片：套餐状态 / 资源使用 / 增购与商务 */}
      <div data-testid="agent-supervision-usage-overview">
        <BillingOverviewSection />
      </div>

      {/* 用户用量明细 — 标题 + 筛选条放在表格卡片外，避免和表头混淆 */}
      <div data-testid="agent-supervision-usage-table-section">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            用户用量明细
          </span>

          <TimeRangeSelect
            value={timeRange}
            onChange={r => { setTimeRange(r); setPage(1); }}
          />

          {timeRange === 'custom' && (
            <>
              <input
                type="datetime-local"
                value={customFrom}
                max={customTo || formatLocalInput(new Date())}
                onChange={e => { setCustomFrom(e.target.value); setPage(1); }}
                style={{
                  padding: '6px 10px',
                  border: '1px solid var(--border-default)',
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  background: 'var(--bg-primary)',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>至</span>
              <input
                type="datetime-local"
                value={customTo}
                min={customFrom || undefined}
                max={formatLocalInput(new Date())}
                onChange={e => { setCustomTo(e.target.value); setPage(1); }}
                style={{
                  padding: '6px 10px',
                  border: '1px solid var(--border-default)',
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  background: 'var(--bg-primary)',
                  outline: 'none',
                }}
              />
            </>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <input
              value={userSearch}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="搜索用户昵称/手机号/ID"
              style={{
                padding: '6px 12px',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                fontSize: 13,
                color: 'var(--text-primary)',
                background: 'var(--bg-primary)',
                outline: 'none',
                width: 180,
              }}
            />
          </div>
        </div>

        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          {/* 表格 */}
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: showFeishuAiPackage ? 760 : 640, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: showFeishuAiPackage ? '34%' : '42%' }} />
              <col style={{ width: showFeishuAiPackage ? '18%' : '24%' }} />
              {showFeishuAiPackage && <col style={{ width: '24%' }} />}
              <col style={{ width: showFeishuAiPackage ? '24%' : '34%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={tableHeaderCellStyle}>用户</th>
                <th style={{ ...tableHeaderCellStyle, textAlign: 'right' }}>总使用次数</th>
                {showFeishuAiPackage && (
                  <th style={{ ...tableHeaderCellStyle, textAlign: 'right' }}>总消耗飞书 AI 包点数</th>
                )}
                <th style={{ ...tableHeaderCellStyle, textAlign: 'right' }}>总消耗 MOSS 积分</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={usageColumnCount} style={{ ...tableBodyCellStyle, textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>
                    加载中…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={usageColumnCount} style={{ ...tableBodyCellStyle, textAlign: 'center', color: 'var(--color-danger)', padding: 40 }}>
                    {error}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={usageColumnCount} style={{ ...tableBodyCellStyle, textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>
                    暂无数据
                  </td>
                </tr>
              ) : (
                items.map(item => (
                  <tr key={item.userId} style={{ transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={tableBodyCellStyle}>
                      <div style={{ fontWeight: 500 }}>{item.userName || item.userId}</div>
                      {item.userName && item.userId !== item.userName && (
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {item.userId}
                        </div>
                      )}
                    </td>
                    <td style={{ ...tableBodyCellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {item.questionCount}
                    </td>
                    {showFeishuAiPackage && (
                      <td style={{ ...tableBodyCellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCredits(item.totalFeishuAiPackagePoints)}
                      </td>
                    )}
                    <td style={{ ...tableBodyCellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCredits(item.totalMossCredits)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {!loading && !error && total > 0 && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
              共 {total} 条
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  padding: '5px 14px',
                  border: '1px solid var(--border-default)',
                  borderRadius: 8,
                  background: 'transparent',
                  fontSize: 13,
                  color: page === 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                }}
              >
                上一页
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', minWidth: 60, textAlign: 'center' }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  padding: '5px 14px',
                  border: '1px solid var(--border-default)',
                  borderRadius: 8,
                  background: 'transparent',
                  fontSize: 13,
                  color: page === totalPages ? 'var(--text-tertiary)' : 'var(--text-primary)',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                下一页
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default UsageTab;
