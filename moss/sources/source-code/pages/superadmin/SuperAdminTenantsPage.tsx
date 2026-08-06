import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SuperAdminLayout } from './SuperAdminLayout';
import {
  superAdminApi,
  type SaBillingOrderItem,
  type SaEnterpriseWorkspaceItem,
  type SaTenantItem,
  type SaWorkspaceBillingActionRequest,
} from '../../api/superadmin';
import { SuperAdminSelect } from './SuperAdminSelect';

type TenantPlanTypeFilter = 'all' | 'trial' | 'official';
type TenantPlanStatusFilter = 'all' | 'active' | 'exhausted' | 'expired';
type BillingActionType = SaWorkspaceBillingActionRequest['actionType'];
type BillingOrderActionType = SaBillingOrderItem['actionType'];
type RecordsActionTypeFilter = 'all' | BillingOrderActionType;
type TenantsTab = 'operations' | 'records';

type WorkspaceFilters = {
  keyword: string;
  planType: TenantPlanTypeFilter;
  planStatus: TenantPlanStatusFilter;
};

type RecordsFilters = {
  enterpriseKeyword: string;
  operatorKeyword: string;
  actionType: RecordsActionTypeFilter;
  startDate: string;
  endDate: string;
};

type ActionDraft = {
  tenantId: string;
  workspaceName: string;
  enterpriseName: string;
  actionType: BillingActionType;
  amount: string;
  planTier: string;
  planExpiresOn: string;
  voucher: string;
  remark: string;
};

type ActionFieldKey = 'amount' | 'planTier' | 'planExpiresOn';
type ActionFieldErrors = Partial<Record<ActionFieldKey, string>>;

const PAGE_SIZE = 20;
const BILLING_ORDER_ACTION_TYPES: BillingOrderActionType[] = [
  'trial_init',
  'trial_grant',
  'activate_official',
  'topup',
  'adjustment',
];

function toDateTime(value: unknown): string {
  if (value == null || value === '') {
    return '-';
  }

  let dateValue: string | number | null = null;
  if (Array.isArray(value)) {
    const [year, month, day, hour = 0, minute = 0, second = 0, nano = 0] = value;
    if (
      typeof year === 'number'
      && typeof month === 'number'
      && typeof day === 'number'
      && typeof hour === 'number'
      && typeof minute === 'number'
      && typeof second === 'number'
      && typeof nano === 'number'
    ) {
      dateValue = Date.UTC(year, month - 1, day, hour, minute, second, Math.floor(nano / 1_000_000));
    }
  } else if (typeof value === 'number') {
    dateValue = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    dateValue = /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
  }

  const date = dateValue == null ? new Date(Number.NaN) : new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleString();
}

function buildZonedDayBoundary(
  dateText: string,
  boundary: 'start' | 'end',
  timezoneOffsetMinutes = new Date().getTimezoneOffset(),
): string {
  const sign = timezoneOffsetMinutes <= 0 ? '+' : '-';
  const absMinutes = Math.abs(timezoneOffsetMinutes);
  const offsetHours = String(Math.floor(absMinutes / 60)).padStart(2, '0');
  const offsetMinutes = String(absMinutes % 60).padStart(2, '0');
  const timeText = boundary === 'start' ? '00:00:00' : '23:59:59';
  return `${dateText}T${timeText}${sign}${offsetHours}:${offsetMinutes}`;
}

function defaultWorkspaceFilters(): WorkspaceFilters {
  return {
    keyword: '',
    planType: 'all',
    planStatus: 'all',
  };
}

function defaultRecordsFilters(): RecordsFilters {
  return {
    enterpriseKeyword: '',
    operatorKeyword: '',
    actionType: 'all',
    startDate: '',
    endDate: '',
  };
}

function toActionLabel(actionType: BillingActionType): string {
  if (actionType === 'activate_official') {
    return '转正式';
  }
  if (actionType === 'topup') {
    return '增购';
  }
  return '调整';
}

function toActionHint(actionType: BillingActionType): string {
  if (actionType === 'activate_official') {
    return '正式化将重置套餐与到期时间，请确认后提交。';
  }
  if (actionType === 'topup') {
    return '增购金额会直接加到当前余额，请确认金额单位。';
  }
  return '调整支持正负值，0 无效。';
}

function toPlanTypeLabel(planType: SaEnterpriseWorkspaceItem['planType']): string {
  return planType === 'official' ? '正式版' : '试用版';
}

function toPlanStatusLabel(planStatus: SaEnterpriseWorkspaceItem['planStatus']): string {
  if (planStatus === 'active') {
    return '有效';
  }
  if (planStatus === 'exhausted') {
    return '额度耗尽';
  }
  return '已过期';
}

function toChannelLabel(channel: SaEnterpriseWorkspaceItem['channel']): string {
  if (channel === 'aliyun') return '阿里云云市场';
  if (channel === 'feishu') return '飞书';
  return 'Moss';
}

function toBillingActionLabel(actionType: SaBillingOrderItem['actionType']): string {
  if (actionType === 'trial_init') {
    return '试用初始化';
  }
  if (actionType === 'trial_grant') {
    return '试用补发';
  }
  if (actionType === 'activate_official') {
    return '转正式';
  }
  if (actionType === 'topup') {
    return '增购';
  }
  return '调整';
}

function buildActionDraft(
  enterpriseName: string,
  workspace: SaTenantItem['workspaces'][number],
  actionType: BillingActionType,
): ActionDraft {
  return {
    tenantId: workspace.tenantId,
    workspaceName: workspace.workspaceName,
    enterpriseName,
    actionType,
    amount: actionType === 'activate_official' ? '1000' : '100',
    planTier: actionType === 'activate_official' ? 'pro' : '',
    planExpiresOn: '',
    voucher: '',
    remark: '',
  };
}

function buildActionFieldErrors(draft: ActionDraft): ActionFieldErrors {
  const errors: ActionFieldErrors = {};
  const amount = Number(draft.amount);

  if (!Number.isFinite(amount)) {
    errors.amount = draft.actionType === 'adjustment' ? '请输入非 0 数值' : '请输入大于 0 的数值';
  } else if (draft.actionType === 'adjustment') {
    if (amount === 0) {
      errors.amount = '请输入非 0 数值';
    }
  } else if (amount <= 0) {
    errors.amount = '请输入大于 0 的数值';
  }

  if (draft.actionType === 'activate_official') {
    if (!draft.planTier.trim()) {
      errors.planTier = '请输入套餐档位';
    }
    if (!draft.planExpiresOn.trim()) {
      errors.planExpiresOn = '请选择到期日期';
    }
  }

  return errors;
}

function hasActionFieldErrors(errors: ActionFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

function normalizeOptionalText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function buildBillingActionRequest(draft: ActionDraft): SaWorkspaceBillingActionRequest {
  return {
    actionType: draft.actionType,
    amount: Number(draft.amount),
    planTier: draft.actionType === 'activate_official' ? draft.planTier.trim() : undefined,
    planExpiresAt: draft.actionType === 'activate_official'
      ? buildZonedDayBoundary(draft.planExpiresOn.trim(), 'end')
      : undefined,
    voucher: normalizeOptionalText(draft.voucher),
    remark: normalizeOptionalText(draft.remark),
  };
}

export const SuperAdminTenantsPage: React.FC = () => {

  const [activeTab, setActiveTab] = useState<TenantsTab>('operations');
  const [workspaceFilters, setWorkspaceFilters] = useState<WorkspaceFilters>(defaultWorkspaceFilters);
  const [recordsFilters, setRecordsFilters] = useState<RecordsFilters>(defaultRecordsFilters);

  const [tenants, setTenants] = useState<SaTenantItem[]>([]);
  const [tenantTotal, setTenantTotal] = useState(0);
  const [tenantPage, setTenantPage] = useState(0);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);

  const [records, setRecords] = useState<SaBillingOrderItem[]>([]);
  const [recordTotal, setRecordTotal] = useState(0);
  const [recordPage, setRecordPage] = useState(0);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  const [actionDraft, setActionDraft] = useState<ActionDraft | null>(null);
  const [actionFieldErrors, setActionFieldErrors] = useState<ActionFieldErrors>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [actioningKey, setActioningKey] = useState<string | null>(null);

  const tenantTotalPages = useMemo(() => Math.max(Math.ceil(tenantTotal / PAGE_SIZE), 1), [tenantTotal]);
  const recordTotalPages = useMemo(() => Math.max(Math.ceil(recordTotal / PAGE_SIZE), 1), [recordTotal]);
  const actionLabel = actionDraft ? toActionLabel(actionDraft.actionType) : '';
  const actionHint = actionDraft ? toActionHint(actionDraft.actionType) : '';

  const loadTenants = useCallback(async (params: { page: number; filters: WorkspaceFilters }) => {
    setTenantLoading(true);
    setTenantError(null);
    try {
      const response = await superAdminApi.tenants({
        keyword: params.filters.keyword.trim() || undefined,
        planType: params.filters.planType === 'all' ? undefined : params.filters.planType,
        planStatus: params.filters.planStatus === 'all' ? undefined : params.filters.planStatus,
        page: params.page,
        size: PAGE_SIZE,
      });
      setTenants(response.items);
      setTenantTotal(response.total);
      setTenantPage(response.page);
    } catch (err) {
      setTenantError(err instanceof Error ? err.message : '请求失败，请稍后重试');
    } finally {
      setTenantLoading(false);
    }
  }, []);

  const loadBillingOrders = useCallback(async (params: { page: number; filters: RecordsFilters }) => {
    setRecordLoading(true);
    setRecordError(null);
    try {
      const response = await superAdminApi.billingOrders({
        enterpriseKeyword: params.filters.enterpriseKeyword.trim() || undefined,
        operatorKeyword: params.filters.operatorKeyword.trim() || undefined,
        actionType: params.filters.actionType === 'all' ? undefined : params.filters.actionType,
        startAt: params.filters.startDate ? buildZonedDayBoundary(params.filters.startDate, 'start') : undefined,
        endAt: params.filters.endDate ? buildZonedDayBoundary(params.filters.endDate, 'end') : undefined,
        page: params.page,
        size: PAGE_SIZE,
      });
      setRecords(response.items);
      setRecordTotal(response.total);
      setRecordPage(response.page);
    } catch (err) {
      setRecordError(err instanceof Error ? err.message : '请求失败，请稍后重试');
    } finally {
      setRecordLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTenants({ page: 0, filters: defaultWorkspaceFilters() });
  }, [loadTenants]);

  const closeActionDialog = () => {
    setActionDraft(null);
    setActionFieldErrors({});
    setActionError(null);
  };

  const updateActionDraftField = (field: keyof ActionDraft, value: string) => {
    setActionDraft((current) => (current ? { ...current, [field]: value } : current));
    setActionError(null);
    setActionFieldErrors((current) => {
      if (!(field in current)) {
        return current;
      }
      const next = { ...current };
      delete next[field as ActionFieldKey];
      return next;
    });
  };

  const handleConfirmAction = async () => {
    if (!actionDraft) {
      return;
    }

    const nextErrors = buildActionFieldErrors(actionDraft);
    if (hasActionFieldErrors(nextErrors)) {
      setActionFieldErrors(nextErrors);
      return;
    }

    setActionFieldErrors({});
    setActionError(null);
    const request = buildBillingActionRequest(actionDraft);
    const currentActioningKey = `${actionDraft.tenantId}:${actionDraft.actionType}`;
    setActioningKey(currentActioningKey);
    try {
      await superAdminApi.runWorkspaceBillingAction(actionDraft.tenantId, request);
      closeActionDialog();
      toast.success(`${toActionLabel(request.actionType)}操作已提交`);
      await loadTenants({ page: tenantPage, filters: workspaceFilters });
      if (activeTab === 'records') {
        await loadBillingOrders({ page: recordPage, filters: recordsFilters });
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '操作失败，请稍后重试');
    } finally {
      setActioningKey(null);
    }
  };

  return (
    <SuperAdminLayout testId="superadmin-tenants-page">
      <main className={`fi-superadmin-content${activeTab === 'records' ? ' fi-superadmin-list-page' : ''}`} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }} data-testid="superadmin-tenants-content">
        <div data-testid="superadmin-tenants-header">
          <div style={{ fontSize: 20, fontWeight: 600, lineHeight: '28px', color: 'var(--text-primary)' }}>租户运营</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            工作区账务操作与记录统一管理。
          </div>
        </div>

        <div className="sa-segmented-tabs" data-testid="superadmin-tenants-tabs">
          <button
            type="button"
            onClick={() => setActiveTab('operations')}
            className={activeTab === 'operations' ? 'is-active' : undefined}
          >
            工作区操作
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeTab !== 'records') {
                setActiveTab('records');
                void loadBillingOrders({ page: 0, filters: recordsFilters });
              }
            }}
            className={activeTab === 'records' ? 'is-active' : undefined}
          >
            操作记录
          </button>
        </div>

        {activeTab === 'operations' ? (
          <>
            <div className="sa-filter-bar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} data-testid="superadmin-tenants-operations-filters">
              <input
                value={workspaceFilters.keyword}
                onChange={(event) => setWorkspaceFilters((current) => ({ ...current, keyword: event.target.value }))}
                placeholder="企业 / 工作区名称 / 工作区 ID"
                style={{
                  minWidth: 320,
                  height: 36,
                  borderRadius: 8,
                  border: '1px solid var(--input-border)',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  padding: '0 10px',
                  outline: 'none',
                }}
              />
              <SuperAdminSelect
                value={workspaceFilters.planType}
                onChange={(planType) => setWorkspaceFilters((current) => ({ ...current, planType }))}
                ariaLabel="套餐类型"
                options={[
                  { value: 'all', label: '全部套餐类型' },
                  { value: 'trial', label: '试用版' },
                  { value: 'official', label: '正式版' },
                ]}
              />
              <SuperAdminSelect
                value={workspaceFilters.planStatus}
                onChange={(planStatus) => setWorkspaceFilters((current) => ({ ...current, planStatus }))}
                ariaLabel="套餐状态"
                options={[
                  { value: 'all', label: '全部套餐状态' },
                  { value: 'active', label: '有效' },
                  { value: 'exhausted', label: '额度耗尽' },
                  { value: 'expired', label: '已过期' },
                ]}
              />
              <button
                type="button"
                onClick={() => void loadTenants({ page: 0, filters: workspaceFilters })}
                style={{
                  height: 36,
                  padding: '0 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                搜索
              </button>
            </div>

            {tenantLoading && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>加载中...</div>}
            {tenantError && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#EF4444',
                  fontSize: 13,
                }}
              >
                {tenantError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tenants.map((enterprise) => (
                <article
                  key={enterprise.enterpriseId}
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
                  <header style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {enterprise.enterpriseName || enterprise.enterpriseId}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                        统一信用代码：{enterprise.creditCode || '-'}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      工作区数：{enterprise.workspaceCount}
                    </div>
                  </header>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {enterprise.workspaces.map((workspace) => (
                      <div
                        key={workspace.tenantId}
                        style={{
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 10,
                          background: 'var(--bg-primary)',
                          padding: 12,
                          display: 'grid',
                          gridTemplateColumns: 'minmax(280px, 1fr) auto auto',
                          gap: 12,
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>
                              {workspace.workspaceName}
                            </strong>
                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{workspace.tenantId}</span>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <span>渠道：{toChannelLabel(workspace.channel)}</span>
                            <span>成员数：{workspace.memberCount}</span>
                            <span>余额：{workspace.balance}</span>
                            <span>到期：{toDateTime(workspace.expiresAt)}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <span
                            style={{
                              fontSize: 12,
                              padding: '2px 8px',
                              borderRadius: 999,
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {toPlanTypeLabel(workspace.planType)}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              padding: '2px 8px',
                              borderRadius: 999,
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {toPlanStatusLabel(workspace.planStatus)}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              padding: '2px 8px',
                              borderRadius: 999,
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {workspace.tenantStatus === 'active' ? '工作区启用' : '工作区冻结'}
                          </span>
                        </div>

                        <div className="sa-tenants-row-actions">
                          <button
                            type="button"
                            disabled={Boolean(actioningKey)}
                            onClick={() => {
                              setActionError(null);
                              setActionFieldErrors({});
                              setActionDraft(buildActionDraft(enterprise.enterpriseName, workspace, 'activate_official'));
                            }}
                          >
                            转正式
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(actioningKey)}
                            onClick={() => {
                              setActionError(null);
                              setActionFieldErrors({});
                              setActionDraft(buildActionDraft(enterprise.enterpriseName, workspace, 'topup'));
                            }}
                          >
                            增购
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(actioningKey)}
                            onClick={() => {
                              setActionError(null);
                              setActionFieldErrors({});
                              setActionDraft(buildActionDraft(enterprise.enterpriseName, workspace, 'adjustment'));
                            }}
                          >
                            调整
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}

              {!tenantLoading && tenants.length === 0 && (
                <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  暂无数据
                </div>
              )}
            </div>

            <div className="sa-tenants-pagination">
              <button
                type="button"
                disabled={tenantPage <= 0}
                onClick={() => void loadTenants({ page: Math.max(tenantPage - 1, 0), filters: workspaceFilters })}
              >
                上一页
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                第 {tenantPage + 1} / {tenantTotalPages} 页
              </span>
              <button
                type="button"
                disabled={tenantPage + 1 >= tenantTotalPages}
                onClick={() => void loadTenants({
                  page: Math.min(tenantPage + 1, tenantTotalPages - 1),
                  filters: workspaceFilters,
                })}
              >
                下一页
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="sa-filter-bar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} data-testid="superadmin-tenants-records-filters">
              <input
                value={recordsFilters.enterpriseKeyword}
                onChange={(event) => setRecordsFilters((current) => ({ ...current, enterpriseKeyword: event.target.value }))}
                placeholder="企业关键词"
                style={{
                  minWidth: 220,
                  height: 36,
                  borderRadius: 8,
                  border: '1px solid var(--input-border)',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  padding: '0 10px',
                  outline: 'none',
                }}
              />
              <input
                value={recordsFilters.operatorKeyword}
                onChange={(event) => setRecordsFilters((current) => ({ ...current, operatorKeyword: event.target.value }))}
                placeholder="操作人关键词"
                style={{
                  minWidth: 180,
                  height: 36,
                  borderRadius: 8,
                  border: '1px solid var(--input-border)',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  padding: '0 10px',
                  outline: 'none',
                }}
              />
              <SuperAdminSelect
                value={recordsFilters.actionType}
                onChange={(actionType) => setRecordsFilters((current) => ({
                  ...current,
                  actionType,
                }))}
                ariaLabel="动作类型"
                style={{ minWidth: 150 }}
                options={[
                  { value: 'all', label: '全部动作' },
                  ...BILLING_ORDER_ACTION_TYPES.map((actionType) => ({
                    value: actionType,
                    label: toBillingActionLabel(actionType),
                  })),
                ]}
              />
              <input
                type="date"
                value={recordsFilters.startDate}
                onChange={(event) => setRecordsFilters((current) => ({ ...current, startDate: event.target.value }))}
                aria-label="开始日期"
                style={{
                  minWidth: 160,
                  height: 36,
                  borderRadius: 8,
                  border: '1px solid var(--input-border)',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  padding: '0 10px',
                  outline: 'none',
                }}
              />
              <input
                type="date"
                value={recordsFilters.endDate}
                onChange={(event) => setRecordsFilters((current) => ({ ...current, endDate: event.target.value }))}
                aria-label="结束日期"
                style={{
                  minWidth: 160,
                  height: 36,
                  borderRadius: 8,
                  border: '1px solid var(--input-border)',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  padding: '0 10px',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => void loadBillingOrders({ page: 0, filters: recordsFilters })}
                style={{
                  height: 36,
                  padding: '0 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                搜索
              </button>
            </div>

            {recordLoading && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>加载中...</div>}
            {recordError && <div className="fi-config-alert error">{recordError}</div>}

            <div
              className="sa-main-list-viewport"
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                background: 'var(--bg-tertiary)',
              }}
            >
              <table className="sa-table" style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['时间', '企业', '工作区', '动作类型', '操作人', '金额', '余额(后)'].map((title) => (
                      <th key={title}>{title}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((item) => (
                    <tr key={item.orderNo}>
                      <td>
                        {toDateTime(item.createdAt)}
                      </td>
                      <td>
                        {item.enterpriseName || item.enterpriseId || '-'}
                      </td>
                      <td>
                        {item.tenantName || item.tenantId}
                      </td>
                      <td>
                        {toBillingActionLabel(item.actionType)}
                      </td>
                      <td>
                        {item.operatorNameSnapshot || item.operatorType}
                      </td>
                      <td>
                        {item.amount}
                      </td>
                      <td>
                        {item.balanceAfter}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!recordLoading && records.length === 0 && (
                <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  暂无数据
                </div>
              )}
            </div>

            <div className="sa-tenants-pagination sa-main-list-footer">
              <button
                type="button"
                disabled={recordPage <= 0}
                onClick={() => void loadBillingOrders({ page: Math.max(recordPage - 1, 0), filters: recordsFilters })}
              >
                上一页
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                第 {recordPage + 1} / {recordTotalPages} 页
              </span>
              <button
                type="button"
                disabled={recordPage + 1 >= recordTotalPages}
                onClick={() => void loadBillingOrders({
                  page: Math.min(recordPage + 1, recordTotalPages - 1),
                  filters: recordsFilters,
                })}
              >
                下一页
              </button>
            </div>
          </>
        )}
      </main>

      {actionDraft && (
        <div
          role="presentation"
          onClick={closeActionDialog}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(680px, 100%)',
              borderRadius: 12,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-tertiary)',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
                {actionLabel} · {actionDraft.workspaceName}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                企业：{actionDraft.enterpriseName || '-'}
              </div>
            </div>

            <div
              style={{
                padding: '9px 10px',
                borderRadius: 8,
                border: '1px solid rgba(245, 158, 11, 0.25)',
                background: 'rgba(245, 158, 11, 0.08)',
                color: '#F59E0B',
                fontSize: 12,
              }}
            >
              {actionHint}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>金额</label>
                <input
                  value={actionDraft.amount}
                  onChange={(event) => updateActionDraftField('amount', event.target.value)}
                  style={{
                    height: 36,
                    borderRadius: 8,
                    border: actionFieldErrors.amount ? '1px solid #EF4444' : '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    padding: '0 10px',
                    outline: 'none',
                  }}
                />
                {actionFieldErrors.amount && <div style={{ fontSize: 12, color: '#EF4444' }}>{actionFieldErrors.amount}</div>}
              </div>

              {actionDraft.actionType === 'activate_official' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>套餐档位 *</label>
                  <input
                    value={actionDraft.planTier}
                    onChange={(event) => updateActionDraftField('planTier', event.target.value)}
                    style={{
                      height: 36,
                      borderRadius: 8,
                      border: actionFieldErrors.planTier ? '1px solid #EF4444' : '1px solid var(--input-border)',
                      background: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      padding: '0 10px',
                      outline: 'none',
                    }}
                  />
                  {actionFieldErrors.planTier && <div style={{ fontSize: 12, color: '#EF4444' }}>{actionFieldErrors.planTier}</div>}
                </div>
              )}

              {actionDraft.actionType === 'activate_official' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>到期日期 *</label>
                  <input
                    type="date"
                    value={actionDraft.planExpiresOn}
                    onChange={(event) => updateActionDraftField('planExpiresOn', event.target.value)}
                    style={{
                      height: 36,
                      borderRadius: 8,
                      border: actionFieldErrors.planExpiresOn ? '1px solid #EF4444' : '1px solid var(--input-border)',
                      background: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      padding: '0 10px',
                      outline: 'none',
                    }}
                  />
                  {actionFieldErrors.planExpiresOn && <div style={{ fontSize: 12, color: '#EF4444' }}>{actionFieldErrors.planExpiresOn}</div>}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>凭证（可选）</label>
                <input
                  value={actionDraft.voucher}
                  onChange={(event) => updateActionDraftField('voucher', event.target.value)}
                  style={{
                    height: 36,
                    borderRadius: 8,
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    padding: '0 10px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>备注（可选）</label>
                <textarea
                  value={actionDraft.remark}
                  onChange={(event) => updateActionDraftField('remark', event.target.value)}
                  rows={3}
                  style={{
                    borderRadius: 8,
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    padding: '8px 10px',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>

            {actionError && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#EF4444',
                  fontSize: 13,
                }}
              >
                {actionError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={closeActionDialog}
                style={{
                  height: 34,
                  padding: '0 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                type="button"
                disabled={Boolean(actioningKey)}
                onClick={() => void handleConfirmAction()}
                style={{
                  height: 34,
                  padding: '0 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--hover-bg)',
                  color: 'var(--text-primary)',
                  cursor: actioningKey ? 'not-allowed' : 'pointer',
                  opacity: actioningKey ? 0.6 : 1,
                }}
              >
                {actioningKey ? '提交中...' : (actionLabel || '确认')}
              </button>
            </div>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  );
};

export default SuperAdminTenantsPage;
