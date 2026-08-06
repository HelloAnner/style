/**
 * 智能体监管 > 自动化任务 Tab（管理员视角）。
 *
 * 功能：
 * - 顶部 KPI 卡片：总自动化数 / 活跃自动化数 / 今日执行次数（仅初始加载一次）
 * - 列表：10 列明细（名称/智能体/创建人/触发方式/创建时间/执行次数/成功次数/最近执行时间/积分/状态）
 * - 5 个筛选条件（创建人/智能体/触发方式/状态/创建时间）
 * - 强制停止按钮 + 二次确认 Modal
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  listAdminPipelines,
  getAdminAutomationDashboard,
  adminDisablePipeline,
} from '../../../api/automations';
import type { AdminPipelineItem, AdminDashboardResponse } from '../../../api/automations';
import { RefreshIconButton } from '../../../components/common/RefreshIconButton';
import { MultiSelectFilterField } from './RecordFilterFields';
import { UsageRecordsPagination } from './UsageRecordsControls';
import './usage-records.css';

// ── 工具函数 ──

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

/**
 * 将「创建时间」筛选枚举解析成后端需要的 ISO-8601 时间窗口。
 * - today: 今日 00:00 ~ 当前
 * - last_7d: 7 天前 ~ 当前
 * - last_30d: 30 天前 ~ 当前
 * - 其他 / 空值：不筛选
 */
function resolveCreatedDateRange(
  values: string[],
): { from?: string; to?: string } {
  if (values.length === 0) return {};
  const now = new Date();
  let from: Date | null = null;
  for (const value of values) {
    let candidate: Date | null = null;
    if (value === 'today') {
      candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (value === 'last_7d') {
      candidate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (value === 'last_30d') {
      candidate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    if (candidate && (!from || candidate < from)) {
      from = candidate;
    }
  }
  if (!from) return {};
  return { from: from.toISOString(), to: now.toISOString() };
}

// ── 类型 ──

type FilterKey = 'createdBy' | 'agentId' | 'triggerType' | 'status' | 'createdDate';

interface Filters {
  createdBy: string[];
  agentId: string[];
  triggerType: string[];
  status: string[];
  createdDate: string[];
}

type FilterOption = { value: string; label: string };

const TRIGGER_TYPE_LABELS: Record<string, string> = {
  cron: '定时',
};

const STATUS_LABELS: Record<string, string> = {
  active: '运行中',
  paused: '已暂停',
  admin_disabled: '已强制停止',
};

function mergeFilterOptions(
  prev: FilterOption[],
  next: FilterOption[],
): FilterOption[] {
  if (next.length === 0) return prev;
  const seen = new Set<string>();
  const merged: FilterOption[] = [];
  for (const opt of [...prev, ...next]) {
    if (!opt.value || seen.has(opt.value)) continue;
    seen.add(opt.value);
    merged.push(opt);
  }
  return merged;
}

// ── 公共样式 ──

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 12,
  padding: 24,
  background: 'var(--bg-secondary)',
};

const tableHeaderCellStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  borderBottom: '1px solid var(--border-subtle)',
  background: 'var(--bg-secondary)',
  whiteSpace: 'nowrap',
};

const tableBodyCellStyle: React.CSSProperties = {
  padding: '12px 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border-subtle)',
  verticalAlign: 'middle',
  maxWidth: 160,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// ── KPI 卡片 ──

interface KpiCardProps {
  label: string;
  value: number | null;
  loading: boolean;
}

function KpiCard({ label, value, loading }: KpiCardProps) {
  return (
    <div style={{
      ...cardStyle,
      flex: '1 1 160px',
      minWidth: 140,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
        {loading ? '—' : value != null ? formatNumber(value) : '—'}
      </div>
    </div>
  );
}

// ── 状态 Badge ──

function StatusBadge({ status }: { status: string }) {
  let color = 'var(--text-secondary)';
  if (status === 'active') color = 'var(--color-success)';
  else if (status === 'paused') color = 'var(--color-warning)';
  else if (status === 'admin_disabled') color = 'var(--color-danger)';

  return (
    <span style={{ fontSize: 12, fontWeight: 500, color }}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ── 强制停止确认 Modal ──

interface AdminDisableConfirmModalProps {
  pipeline: AdminPipelineItem;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

function AdminDisableConfirmModal({ pipeline, onCancel, onConfirm }: AdminDisableConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    /* 遮罩层 */
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      {/* 卡片 */}
      <div
        style={{
          background: 'var(--bg-primary)',
          borderRadius: 16,
          padding: '32px 28px 24px',
          width: 420,
          maxWidth: '90vw',
          boxShadow: '0 16px 48px rgba(0,0,0,0.16)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 标题 */}
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
          确认强制停止
        </div>

        {/* 内容 */}
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
          你即将强制停止自动化：
        </div>
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          background: 'var(--bg-secondary)',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 16,
        }}>
          {pipeline.displayName || pipeline.name}
        </div>
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          background: 'var(--danger-bg-soft)',
          border: '1px solid var(--danger-border-soft)',
          fontSize: 13,
          color: 'var(--color-danger)',
          lineHeight: 1.6,
          marginBottom: 28,
        }}>
          强制停止后，用户不可自行恢复，需联系管理员重新启用。
        </div>

        {/* 按钮区 */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '8px 20px',
              border: '1px solid var(--border-default)',
              borderRadius: 8,
              background: 'transparent',
              fontSize: 14,
              color: 'var(--text-secondary)',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{
              padding: '8px 20px',
              border: '1px solid var(--color-danger)',
              borderRadius: 8,
              background: 'var(--color-danger)',
              color: 'var(--btn-primary-text)',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '处理中…' : '强制停止'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 主组件 ──

const AutomationTab: React.FC = () => {
  // KPI（仅初始加载一次）
  const [kpi, setKpi] = useState<AdminDashboardResponse | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);

  // 筛选
  const [filters, setFilters] = useState<Filters>({
    createdBy: [],
    agentId: [],
    triggerType: [],
    status: [],
    createdDate: [],
  });
  const [agentOptions, setAgentOptions] = useState<FilterOption[]>([]);
  const [creatorOptions, setCreatorOptions] = useState<FilterOption[]>([]);

  // 列表
  const [pipelines, setPipelines] = useState<AdminPipelineItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 强制停止
  const [confirmPipeline, setConfirmPipeline] = useState<AdminPipelineItem | null>(null);

  // 加载 KPI（仅一次）
  useEffect(() => {
    setKpiLoading(true);
    getAdminAutomationDashboard()
      .then(setKpi)
      .catch(() => setKpi(null))
      .finally(() => setKpiLoading(false));
  }, []);

  // 加载列表
  const loadPipelines = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = resolveCreatedDateRange(filters.createdDate);
      const result = await listAdminPipelines({
        status: filters.status.length > 0 ? filters.status : undefined,
        agentId: filters.agentId.length > 0 ? filters.agentId : undefined,
        triggerType: filters.triggerType.length > 0 ? filters.triggerType : undefined,
        createdBy: filters.createdBy.length > 0 ? filters.createdBy : undefined,
        createdAtFrom: from,
        createdAtTo: to,
        includeFilterOptions: true,
        page,
        pageSize,
      });
      const hasServerFilterOptions = !!result.filterOptions;
      const nextAgentOptions = result.filterOptions?.agents ?? (
        result.items
          .filter(item => item.agentId && item.agentName)
          .map(item => ({ value: item.agentId, label: item.agentName }))
      );
      const nextCreatorOptions = result.filterOptions?.creators ?? (
        result.items
          .filter(item => item.createdByUserId && item.createdByName)
          .map(item => ({ value: item.createdByUserId!, label: item.createdByName }))
      );
      setAgentOptions(prev =>
        mergeFilterOptions(hasServerFilterOptions ? [] : prev, nextAgentOptions),
      );
      setCreatorOptions(prev =>
        mergeFilterOptions(hasServerFilterOptions ? [] : prev, nextCreatorOptions),
      );
      setPipelines(result.items);
      setTotal(result.total);
    } catch {
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    void loadPipelines();
  }, [loadPipelines]);

  // 筛选变更时重置分页
  const updateFilter = (key: FilterKey, val: string[]) => {
    setFilters(prev => ({ ...prev, [key]: val }));
    setPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  // 强制停止确认
  const handleDisableConfirm = async () => {
    if (!confirmPipeline) return;
    await adminDisablePipeline(confirmPipeline.id);
    setConfirmPipeline(null);
    // 刷新列表
    void loadPipelines();
  };

  // 筛选选项（从已加载数据中动态提取，实际场景可由后端提供枚举）
  const statusOptions = Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }));
  const triggerTypeOptions = Object.entries(TRIGGER_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }));

  return (
    <div className="usage-records-shell" style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }} data-testid="agent-supervision-automation-tab">
      {/* KPI 卡片区 */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }} data-testid="agent-supervision-automation-kpis">
        <KpiCard label="总自动化数" value={kpi?.totalPipelines ?? null} loading={kpiLoading} />
        <KpiCard label="活跃自动化数" value={kpi?.activePipelines ?? null} loading={kpiLoading} />
        <KpiCard label="今日执行次数" value={kpi?.todayExecutedCount ?? null} loading={kpiLoading} />
      </div>

      {/* 标题 + 刷新；筛选条件独立一行，避免与表头粘连 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
          自动化列表
        </span>
        <RefreshIconButton
          onClick={() => void loadPipelines()}
          loading={loading}
        />
      </div>

      <div
        data-testid="agent-supervision-automation-filters"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '10px 8px',
          marginTop: -14,
        }}
      >
        <MultiSelectFilterField
          label="创建人"
          values={filters.createdBy}
          options={creatorOptions}
          onChange={val => updateFilter('createdBy', val)}
          width={120}
        />
        <MultiSelectFilterField
          label="智能体"
          values={filters.agentId}
          options={agentOptions}
          onChange={val => updateFilter('agentId', val)}
          width={120}
        />
        <MultiSelectFilterField
          label="触发方式"
          values={filters.triggerType}
          options={triggerTypeOptions}
          onChange={val => updateFilter('triggerType', val)}
          width={120}
        />
        <MultiSelectFilterField
          label="状态"
          values={filters.status}
          options={statusOptions}
          onChange={val => updateFilter('status', val)}
          width={120}
        />
        <MultiSelectFilterField
          label="创建时间"
          values={filters.createdDate}
          options={[
            { value: 'today', label: '今日' },
            { value: 'last_7d', label: '近 7 天' },
            { value: 'last_30d', label: '近 30 天' },
          ]}
          onChange={val => updateFilter('createdDate', val)}
          width={120}
        />
      </div>

      {/* 列表卡片 */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }} data-testid="agent-supervision-automation-table">
        {/* 表格 */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead>
              <tr>
                {[
                  '自动化名称', '所属智能体', '创建人', '触发方式',
                  '创建时间', '执行次数', '成功次数', '最近执行时间',
                  '累计消耗积分', '状态', '操作',
                ].map(h => (
                  <th key={h} style={tableHeaderCellStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ ...tableBodyCellStyle, textAlign: 'center', color: 'var(--text-tertiary)', padding: 48 }}>
                    加载中…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={11} style={{ ...tableBodyCellStyle, textAlign: 'center', color: 'var(--color-danger)', padding: 48 }}>
                    {error}
                  </td>
                </tr>
              ) : pipelines.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ ...tableBodyCellStyle, textAlign: 'center', color: 'var(--text-tertiary)', padding: 48 }}>
                    暂无数据
                  </td>
                </tr>
              ) : (
                pipelines.map(pipeline => (
                  <tr
                    key={pipeline.id}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...tableBodyCellStyle, fontWeight: 500 }} title={pipeline.displayName || pipeline.name}>
                      {pipeline.displayName || pipeline.name}
                    </td>
                    <td style={tableBodyCellStyle} title={pipeline.agentName}>
                      {pipeline.agentName || '—'}
                    </td>
                    <td style={tableBodyCellStyle} title={pipeline.createdByName}>
                      {pipeline.createdByName || '—'}
                    </td>
                    <td style={tableBodyCellStyle}>
                      {TRIGGER_TYPE_LABELS[pipeline.triggerType] ?? pipeline.triggerType ?? '—'}
                    </td>
                    <td style={tableBodyCellStyle}>
                      {formatDateTime(pipeline.createdAt)}
                    </td>
                    <td style={{ ...tableBodyCellStyle, fontVariantNumeric: 'tabular-nums' }}>
                      {formatNumber(pipeline.executionCount)}
                    </td>
                    <td style={{ ...tableBodyCellStyle, fontVariantNumeric: 'tabular-nums' }}>
                      {formatNumber(pipeline.successCount)}
                    </td>
                    <td style={tableBodyCellStyle}>
                      {formatDateTime(pipeline.lastRunAt)}
                    </td>
                    <td style={{ ...tableBodyCellStyle, fontVariantNumeric: 'tabular-nums' }}>
                      {formatNumber(pipeline.creditsUsed)}
                    </td>
                    <td style={tableBodyCellStyle}>
                      <StatusBadge status={pipeline.status} />
                    </td>
                    <td style={tableBodyCellStyle}>
                      {(pipeline.status === 'active' || pipeline.status === 'paused') && (
                        <button
                          onClick={() => setConfirmPipeline(pipeline)}
                          style={{
                            padding: '4px 12px',
                            border: '1px solid var(--color-danger)',
                            borderRadius: 6,
                            background: 'transparent',
                            color: 'var(--color-danger)',
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          强制停止
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* 分页 */}
      {!loading && !error && total > 0 && (
        <UsageRecordsPagination
          page={page - 1}
          pageSize={pageSize}
          total={total}
          onPageChange={nextPage => setPage(nextPage + 1)}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      {/* 强制停止确认 Modal */}
      {confirmPipeline && (
        <AdminDisableConfirmModal
          pipeline={confirmPipeline}
          onCancel={() => setConfirmPipeline(null)}
          onConfirm={handleDisableConfirm}
        />
      )}
    </div>
  );
};

export default AutomationTab;
