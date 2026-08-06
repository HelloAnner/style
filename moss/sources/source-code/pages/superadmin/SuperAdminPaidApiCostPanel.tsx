import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Save, Trash2 } from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid,
  ComposedChart, Legend, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  superAdminPaidApi,
  type PaidApiCostSummary,
  type PaidApiCostDetail,
  type BudgetStatus,
  type CostAlert,
  type ServiceBalance,
  type BudgetConfigItem,
  type AlertWebhookResponse,
  type ExternalDataCacheBenefit,
} from '../../api/superadminPaidApi';
import { SuperAdminSelect } from './SuperAdminSelect';

const SERVICE_LABEL_MAP: Record<string, string> = {
  bocha: 'Bocha',
  zhongzhou: 'Zhongzhou',
  tinyfish: 'TinyFish',
  coze: 'Coze',
};

/** 各服务快捷预算预设值（人民币） */
const BUDGET_PRESETS: Record<string, number[]> = {
  bocha: [100, 300, 500, 1000],
  zhongzhou: [100, 500, 1000, 2000],
  tinyfish: [],
  coze: [50, 100, 200, 500],
};

function budgetColor(usagePercent: number, hasBudget: boolean): string {
  if (!hasBudget) return 'var(--text-muted)';
  if (usagePercent >= 100) return 'var(--danger)';
  if (usagePercent >= 80) return 'var(--chart-amber, #f59e0b)';
  return 'var(--success)';
}

function trendIcon(trend: string): string {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

function trendColor(trend: string): string {
  if (trend === 'up') return 'var(--danger)';
  if (trend === 'down') return 'var(--success)';
  return 'var(--text-muted)';
}

function formatCost(value: number): string {
  return `¥${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** 服务展示模式：免费 / 未配置 / 正常计费 */
type ServiceDisplayMode = 'free' | 'unconfigured' | 'normal';

function getServiceDisplayMode(serviceKey: string): ServiceDisplayMode {
  if (serviceKey === 'tinyfish') return 'free';      // Search/Fetch 已确认免费
  if (serviceKey === 'coze') return 'unconfigured';   // COZE_TOKEN 未配置，未实际启用
  return 'normal';
}

const iconSize = 15;

export const SuperAdminPaidApiCostPanel: React.FC = () => {
  const [summary, setSummary] = useState<PaidApiCostSummary | null>(null);
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [alerts, setAlerts] = useState<CostAlert[]>([]);
  const [balances, setBalances] = useState<ServiceBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [costDays, setCostDays] = useState(30);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<PaidApiCostDetail | null>(null);
  const [cacheBenefit, setCacheBenefit] = useState<ExternalDataCacheBenefit | null>(null);
  const [cacheBenefitError, setCacheBenefitError] = useState<string | null>(null);

  // 预算配置（可编辑）
  const [budgetConfigs, setBudgetConfigs] = useState<BudgetConfigItem[]>([]);
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});
  const [busyBudgetService, setBusyBudgetService] = useState<string | null>(null);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  // 告警 webhook 配置
  const [webhookConfig, setWebhookConfig] = useState<AlertWebhookResponse | null>(null);
  const [webhookDraft, setWebhookDraft] = useState('');
  const [busyWebhook, setBusyWebhook] = useState(false);
  const [webhookFeedback, setWebhookFeedback] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setBudgetError(null);
    try {
      const [summaryData, alertData, balanceData, budgetConfigData] = await Promise.all([
        superAdminPaidApi.costSummary(costDays),
        superAdminPaidApi.costAlerts(),
        superAdminPaidApi.costBalances(),
        superAdminPaidApi.budgets(),
      ]);
      // 过滤 Qila（定价未确认，暂不展示）
      summaryData.services = summaryData.services.filter((s) => s.key !== 'qila');
      setSummary(summaryData);
      setBudgets(alertData.budgets.filter((b) => b.service !== 'qila'));
      setAlerts(alertData.alerts.filter((a) => a.service !== 'qila'));
      setBalances(balanceData);
      setBudgetConfigs(budgetConfigData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [costDays]);

  const loadCacheBenefit = useCallback(async () => {
    setCacheBenefitError(null);
    try {
      setCacheBenefit(await superAdminPaidApi.cacheBenefit(costDays));
    } catch (err) {
      setCacheBenefit(null);
      setCacheBenefitError(err instanceof Error ? err.message : '缓存收益暂不可用');
    }
  }, [costDays]);

  const loadWebhook = useCallback(async () => {
    try {
      const data = await superAdminPaidApi.getAlertWebhook();
      setWebhookConfig(data);
    } catch {
      setWebhookConfig(null);
      console.error('Failed to load webhook config');
    }
  }, []);

  const handleSaveWebhook = async () => {
    const trimmed = webhookDraft.trim();
    if (!trimmed) {
      setWebhookFeedback({ kind: 'danger', text: '请输入 webhook 地址' });
      return;
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      setWebhookFeedback({ kind: 'danger', text: '请输入有效的 URL（需包含 http:// 或 https://）' });
      return;
    }
    setBusyWebhook(true);
    setWebhookFeedback(null);
    try {
      const updated = await superAdminPaidApi.updateAlertWebhook(trimmed);
      setWebhookConfig(updated);
      setWebhookDraft('');
      setWebhookFeedback({ kind: 'success', text: 'Webhook 地址已更新' });
    } catch (err) {
      setWebhookFeedback({
        kind: 'danger',
        text: err instanceof Error ? err.message : '保存失败',
      });
    } finally {
      setBusyWebhook(false);
    }
  };

  useEffect(() => {
    void loadData();
    void loadCacheBenefit();
    void loadWebhook();
  }, [loadCacheBenefit, loadData, loadWebhook]);

  const loadDetail = async (service: string) => {
    if (expandedService === service) {
      setExpandedService(null);
      setDetailData(null);
      return;
    }
    setExpandedService(service);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const data = await superAdminPaidApi.costDetail(service, costDays, 'day');
      setDetailData(data);
    } catch {
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveBudget = async (service: string) => {
    const draft = budgetDrafts[service];
    if (draft === undefined || draft.trim() === '') {
      setBudgetError('请先输入预算金额');
      return;
    }

    const value = parseFloat(draft);
    if (isNaN(value) || value < 0) {
      setBudgetError('请输入有效的正数金额');
      return;
    }
    if (value > 999999.99) {
      setBudgetError('预算超出上限 ¥999,999.99');
      return;
    }

    const currentConfig = budgetConfigs.find((c) => c.service === service);
    setBusyBudgetService(service);
    setBudgetError(null);
    try {
      const updated = await superAdminPaidApi.updateBudget(service, {
        monthlyBudget: value,
        enabled: currentConfig?.enabled ?? true,
      });
      setBudgetConfigs((prev) =>
        prev.map((c) => (c.service === service ? updated : c))
      );
      setBudgetDrafts((prev) => {
        const next = { ...prev };
        delete next[service];
        return next;
      });
      // 刷新费用数据以更新进度条
      await loadData();
    } catch (err) {
      setBudgetError(err instanceof Error ? err.message : '保存失败，请重试');
    } finally {
      setBusyBudgetService(null);
    }
  };

  const handleResetBudget = async (service: string) => {
    const config = budgetConfigs.find((c) => c.service === service);
    if (!config) return;
    if (!config.isConfigured) {
      setBudgetError('当前已是默认值，无需重置');
      return;
    }
    const defaultLabel = `确定重置为默认值 ¥${config.monthlyBudget?.toFixed(2) ?? '0.00'} 吗？`;
    if (!window.confirm(defaultLabel)) return;

    setBusyBudgetService(service);
    setBudgetError(null);
    try {
      const updated = await superAdminPaidApi.resetBudget(service);
      setBudgetConfigs((prev) =>
        prev.map((c) => (c.service === service ? updated : c))
      );
      await loadData();
    } catch (err) {
      setBudgetError(err instanceof Error ? err.message : '重置失败，请重试');
    } finally {
      setBusyBudgetService(null);
    }
  };

  const handleToggleEnabled = async (service: string, newEnabled: boolean) => {
    const config = budgetConfigs.find((c) => c.service === service);
    if (!config) return;

    setBusyBudgetService(service);
    setBudgetError(null);
    try {
      const updated = await superAdminPaidApi.updateBudget(service, {
        monthlyBudget: config.monthlyBudget,
        enabled: newEnabled,
      });
      setBudgetConfigs((prev) =>
        prev.map((c) => (c.service === service ? updated : c))
      );
    } catch (err) {
      setBudgetError(err instanceof Error ? err.message : '切换失败，请重试');
    } finally {
      setBusyBudgetService(null);
    }
  };

  const handlePresetClick = (service: string, value: number) => {
    setBudgetDrafts((prev) => ({ ...prev, [service]: String(value) }));
  };

  if (loading && !summary) {
    return (
      <div data-testid="superadmin-paid-api-cost-loading" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> 加载费用数据...
      </div>
    );
  }

  return (
    <div data-testid="superadmin-paid-api-cost-panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 标题栏 */}
      <div data-testid="superadmin-paid-api-cost-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            扣费观测
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            外部服务费用统计与预算追踪。
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SuperAdminSelect
            value={costDays}
            onChange={setCostDays}
            ariaLabel="费用统计周期"
            options={[
              { value: 7, label: '最近 7 天' },
              { value: 30, label: '最近 30 天' },
              { value: 90, label: '最近 90 天' },
            ]}
          />
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            title="刷新"
            style={{
              height: 34, borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              padding: '0 10px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? <Loader2 size={iconSize} /> : <RefreshCw size={iconSize} />}
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          border: '1px solid var(--danger-border-soft)',
          background: 'var(--danger-bg-soft)',
          color: 'var(--danger)', borderRadius: 8,
          padding: '9px 10px', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* 总计 */}
      {summary && (
        <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
          统计周期总费用：<span style={{ fontSize: 20, fontWeight: 700 }}>{formatCost(summary.grandTotalCost)}</span>
        </div>
      )}

      {cacheBenefitError && (
        <div
          data-testid="superadmin-paid-api-cache-benefit-error"
          style={{
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-muted)',
            borderRadius: 8,
            padding: '9px 10px',
            fontSize: 12,
          }}
        >
          缓存收益暂不可用：{cacheBenefitError}
        </div>
      )}

      {cacheBenefit && (
        <section
          data-testid="superadmin-paid-api-cache-benefit"
          style={{
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            background: 'var(--bg-tertiary)',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              诉讼数据缓存收益
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              按当前单价 {formatCost(cacheBenefit.unitPrice)}/次预估，已尝试供应商后再降级的请求不计节省。
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            {[
              ['有效复用率', formatPercent(cacheBenefit.reuseRate)],
              ['避免调用', `${cacheBenefit.avoidedCalls.toLocaleString()} 次`],
              ['实际调用', `${cacheBenefit.upstreamCalls.toLocaleString()} 次`],
              ['预估节省', formatCost(cacheBenefit.estimatedSavedCost)],
            ].map(([label, value]) => (
              <div key={label} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
              </div>
            ))}
          </div>
          {cacheBenefit.datasets.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {cacheBenefit.datasets.map((item) => (
                <div key={item.dataset} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.dataset === 'litigation_detail' ? '诉讼明细' : '诉讼统计'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    复用率 {formatPercent(item.reuseRate)} · 避免 {item.avoidedCalls} 次 · 节省 {formatCost(item.estimatedSavedCost)}
                  </div>
                </div>
              ))}
            </div>
          )}
          {cacheBenefit.daily.length > 0 && (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={cacheBenefit.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v: string) => v.substring(5)} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                  }}
                />
                <Bar dataKey="avoidedCalls" name="避免调用" fill="var(--success)" />
                <Bar dataKey="upstreamCalls" name="实际调用" fill="var(--warning)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      )}

      {/* 每日费用趋势 */}
      {summary && summary.dailyCosts.length > 0 && (
        <div
          data-testid="superadmin-paid-api-daily-trend"
          style={{
          border: '1px solid var(--border-subtle)', borderRadius: 8,
          background: 'var(--bg-tertiary)', padding: 14,
        }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            每日费用趋势
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={summary.dailyCosts}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickFormatter={(v: string) => v.substring(5)}
              />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--text-primary)',
                }}
                formatter={(v: number) => [formatCost(v), '总费用']}
              />
              <Area
                type="monotone"
                dataKey="totalCost"
                stroke="var(--blue-500, #3B82F6)"
                fill="var(--blue-100, rgba(59,130,246,0.15))"
                name="总费用"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 真实账户余额（Bocha） */}
      {balances.length > 0 && (
        <div
          data-testid="superadmin-paid-api-balances"
          style={{
          border: '1px solid var(--border-subtle)', borderRadius: 8,
          background: 'var(--bg-tertiary)', padding: 14,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>真实账户余额</div>
          {balances.map((b) => (
            <div key={b.service} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, alignItems: 'center' }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {b.label ?? b.service}
              </span>
              {b.remaining != null ? (
                <span style={{
                  color: 'var(--success)', fontSize: 16, fontWeight: 700,
                }}>
                  {formatCost(b.remaining)}
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  {b.error ?? '查询失败'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 告警推送配置 */}
      <div
        data-testid="superadmin-paid-api-webhook-config"
        style={{
          border: '1px solid var(--border-subtle)', borderRadius: 8,
          background: 'var(--bg-tertiary)', padding: 14,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          告警推送配置
        </div>

        {webhookFeedback && (
          <div style={{
            border: `1px solid ${webhookFeedback.kind === 'success' ? 'var(--border-strong)' : 'var(--danger-border-soft)'}`,
            background: webhookFeedback.kind === 'success' ? 'var(--success-bg-soft)' : 'var(--danger-bg-soft)',
            color: webhookFeedback.kind === 'success' ? 'var(--success)' : 'var(--danger)',
            borderRadius: 8, padding: '8px 10px', fontSize: 12,
          }}>
            {webhookFeedback.text}
          </div>
        )}

        {/* 当前地址（脱敏） */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>企业微信 Webhook 地址</span>
          <div style={{
            fontSize: 12, color: 'var(--text-primary)',
            background: 'var(--hover-bg)', borderRadius: 6,
            padding: '8px 10px', wordBreak: 'break-all',
            fontFamily: 'monospace',
          }}>
            {webhookConfig?.maskedUrl || '加载中...'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {webhookConfig?.isConfigured
              ? `最后更新：${webhookConfig.updatedAt ? new Date(webhookConfig.updatedAt).toLocaleString() : '—'}`
              : '当前使用默认配置'}
          </div>
        </div>

        {/* 输入新地址 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>新地址</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
              disabled={busyWebhook}
              value={webhookDraft}
              onChange={(e) => setWebhookDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveWebhook();
              }}
              style={{
                flex: 1,
                height: 32,
                borderRadius: 6,
                border: '1px solid var(--input-border)',
                background: busyWebhook ? 'var(--hover-bg)' : 'var(--input-bg)',
                color: 'var(--text-primary)',
                padding: '0 8px',
                fontSize: 12,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => void handleSaveWebhook()}
              disabled={busyWebhook || !webhookDraft.trim()}
              style={{
                height: 32,
                borderRadius: 8,
                border: 'none',
                background: busyWebhook || !webhookDraft.trim()
                  ? 'var(--border-strong)'
                  : 'var(--text-primary)',
                color: 'var(--bg-primary)',
                padding: '0 12px',
                fontSize: 14, fontWeight: 500,
                lineHeight: '20px',
                cursor: busyWebhook || !webhookDraft.trim() ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap',
              }}
            >
              {busyWebhook ? (
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Save size={12} />
              )}
              保存
            </button>
          </div>
        </div>
      </div>

      {/* 月度预算配置卡片 */}
      {budgetConfigs.length > 0 && (
        <div data-testid="superadmin-paid-api-budget-section" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            月度预算概览
          </div>
          {budgetError && (
            <div style={{
              border: '1px solid var(--danger-border-soft)',
              background: 'var(--danger-bg-soft)',
              color: 'var(--danger)', borderRadius: 8,
              padding: '8px 10px', fontSize: 12,
            }}>
              {budgetError}
            </div>
          )}
          <div data-testid="superadmin-paid-api-budget-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {budgetConfigs.map((cfg) => {
              const budget = budgets.find((b) => b.service === cfg.service);
              const mode = getServiceDisplayMode(cfg.service);
              const hasBudget = cfg.monthlyBudget != null && cfg.monthlyBudget > 0;
              const usagePercent = budget?.usagePercent ?? 0;
              const pct = Math.min(usagePercent, 100);
              const isFree = mode === 'free';
              const isDisabled = !cfg.enabled || isFree;
              const isBusy = busyBudgetService === cfg.service;
              const presets = BUDGET_PRESETS[cfg.service] ?? [];
              const updatedAtLabel = cfg.updatedAt
                ? new Date(cfg.updatedAt).toLocaleString()
                : '默认值（来自配置文件）';

              return (
                <section
                  key={cfg.service}
                  className="superadmin-paid-api-budget-card"
                  data-testid={`superadmin-paid-api-budget-card-${cfg.service}`}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    background: 'var(--bg-tertiary)',
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    opacity: isDisabled ? 0.55 : 1,
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  {/* Header: 服务名 + 单价 + 启用开关 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {cfg.displayName}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {cfg.pricePerCall > 0
                          ? `${cfg.unitLabel === '元/次' ? `¥${cfg.pricePerCall}/次` : cfg.unitLabel}`
                          : '免费'}
                      </span>
                      {cfg.service === 'coze' && (
                        <span style={{
                          background: 'var(--warning-bg-soft)',
                          color: 'var(--warning)',
                          fontSize: 10, padding: '1px 5px', borderRadius: 3,
                        }}>占位价</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        padding: '2px 8px', borderRadius: 999,
                        background: cfg.enabled
                          ? 'var(--success-bg-soft)'
                          : 'var(--warning-bg-soft)',
                        color: cfg.enabled ? 'var(--success)' : 'var(--warning)',
                      }}>
                        {cfg.enabled ? '已启用' : '告警已暂停'}
                      </span>
                      {/* Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => void handleToggleEnabled(cfg.service, !cfg.enabled)}
                        disabled={isBusy}
                        style={{
                          width: 38, height: 22, borderRadius: 11,
                          border: `2px solid ${cfg.enabled ? 'var(--success)' : 'var(--text-muted)'}`,
                          background: cfg.enabled ? 'var(--success)' : 'transparent',
                          position: 'relative', cursor: isBusy ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          padding: 0, boxSizing: 'border-box',
                          boxShadow: cfg.enabled
                            ? '0 0 0 2px var(--success-bg-soft)'
                            : 'none',
                        }}
                        aria-label={cfg.enabled ? '关闭告警' : '启用告警'}
                      >
                        <span style={{
                          position: 'absolute',
                          top: 1,
                          right: cfg.enabled ? 1 : undefined,
                          left: cfg.enabled ? undefined : 1,
                          width: 16, height: 16, borderRadius: '50%',
                          background: cfg.enabled ? '#fff' : 'var(--text-muted)',
                          transition: 'all 0.2s',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                        }} />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {budget && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                        <span>本月已用</span>
                        <span style={{
                          color: hasBudget
                            ? budgetColor(budget.usagePercent, true)
                            : 'var(--text-muted)',
                          fontWeight: hasBudget ? 600 : 400,
                        }}>
                          {hasBudget
                            ? `${budget.usagePercent.toFixed(0)}%  ${formatCost(budget.currentCost)} / ${formatCost(budget.monthlyBudget!)}`
                            : isFree ? '免费服务' : '—'}
                        </span>
                      </div>
                      {hasBudget && mode !== 'unconfigured' && (
                        <div style={{
                          height: 6, borderRadius: 3,
                          background: 'var(--hover-bg)', overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%', width: `${pct}%`, borderRadius: 3,
                            background: budgetColor(budget.usagePercent, true),
                            transition: 'width 0.3s ease',
                            opacity: isDisabled ? 0.4 : 1,
                          }} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Current value + last modified */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>当前预算：{hasBudget ? formatCost(cfg.monthlyBudget!) : (isFree ? '无需预算' : '未设置')}</span>
                    <span>{updatedAtLabel}</span>
                  </div>

                  {/* Preset buttons */}
                  {presets.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>快捷</span>
                      {presets.map((val) => (
                        <button
                          key={val}
                          type="button"
                          disabled={isDisabled || isBusy}
                          onClick={() => handlePresetClick(cfg.service, val)}
                          style={{
                            padding: '2px 8px',
                            border: budgetDrafts[cfg.service] === String(val)
                              ? '1px solid var(--blue-500, #3B82F6)'
                              : '1px solid var(--border-subtle)',
                            borderRadius: 4,
                            background: budgetDrafts[cfg.service] === String(val)
                              ? 'var(--blue-50, #EFF6FF)'
                              : 'var(--bg-primary)',
                            fontSize: 11,
                            color: budgetDrafts[cfg.service] === String(val)
                              ? 'var(--blue-500, #3B82F6)'
                              : 'var(--text-secondary)',
                            cursor: isDisabled || isBusy ? 'not-allowed' : 'pointer',
                            fontWeight: budgetDrafts[cfg.service] === String(val) ? 600 : 400,
                          }}
                        >
                          ¥{val}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Input row: text field + save + reset */}
                  {!isFree && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="输入新预算值..."
                        disabled={isDisabled || isBusy}
                        value={budgetDrafts[cfg.service] ?? ''}
                        onChange={(e) =>
                          setBudgetDrafts((prev) => ({
                            ...prev,
                            [cfg.service]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleSaveBudget(cfg.service);
                        }}
                        style={{
                          flex: 1,
                          height: 32,
                          borderRadius: 6,
                          border: '1px solid var(--input-border)',
                          background: isDisabled ? 'var(--hover-bg)' : 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          padding: '0 8px',
                          fontSize: 12,
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void handleSaveBudget(cfg.service)}
                        disabled={
                          isDisabled || isBusy ||
                          !budgetDrafts[cfg.service] ||
                          budgetDrafts[cfg.service]?.trim() === ''
                        }
                        style={{
                          height: 32,
                          borderRadius: 6,
                          border: 'none',
                          background: isDisabled || isBusy
                            ? 'var(--border-strong)'
                            : 'var(--text-primary)',
                          color: 'var(--bg-primary)',
                          padding: '0 14px',
                          fontSize: 12, fontWeight: 600,
                          cursor: isDisabled || isBusy ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          whiteSpace: 'nowrap',
                          boxShadow: isDisabled || isBusy
                            ? 'none'
                            : '0 1px 3px rgba(0,0,0,0.25)',
                        }}
                      >
                        {isBusy ? (
                          <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <Save size={12} />
                        )}
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleResetBudget(cfg.service)}
                        disabled={isDisabled || isBusy || !cfg.isConfigured}
                        style={{
                          height: 32,
                          borderRadius: 6,
                          border: '1px solid var(--danger)',
                          background: isDisabled || isBusy || !cfg.isConfigured
                            ? 'var(--hover-bg)'
                            : 'var(--danger-bg-soft)',
                          color: isDisabled || isBusy || !cfg.isConfigured
                            ? 'var(--text-muted)'
                            : 'var(--danger)',
                          padding: '0 10px',
                          fontSize: 12, fontWeight: 500,
                          cursor: isDisabled || isBusy || !cfg.isConfigured
                            ? 'not-allowed'
                            : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Trash2 size={12} />
                        重置
                      </button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}

      {/* 分服务费用卡片 */}
      {summary && (
        <div data-testid="superadmin-paid-api-service-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {summary.services.map((svc) => {
            const mode = getServiceDisplayMode(svc.key);
            const isSpecial = mode === 'free' || mode === 'unconfigured';
            return (
            <button
              key={svc.key}
              type="button"
              data-testid={`superadmin-paid-api-service-card-${svc.key}`}
              onClick={() => void loadDetail(svc.key)}
              style={{
                border: expandedService === svc.key
                  ? '2px solid var(--border-subtle)'
                  : '1px solid var(--border-subtle)',
                borderRadius: 8, background: 'var(--bg-tertiary)', padding: 12,
                display: 'flex', flexDirection: 'column', gap: 6,
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{svc.label}</div>
                {mode === 'free' && (
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: 'var(--success)', background: 'var(--success-bg-soft)',
                    borderRadius: 999, padding: '1px 8px',
                  }}>免费</span>
                )}
                {mode === 'unconfigured' && (
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: 'var(--text-muted)', background: 'var(--hover-bg)',
                    borderRadius: 999, padding: '1px 8px',
                  }}>未配置</span>
                )}
              </div>
              {isSpecial ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  {mode === 'free' ? '无需计费' : '服务未启用'}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formatCost(svc.totalCost)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    成功 {svc.successCalls.toLocaleString()} 次 · 失败 {svc.errorCalls.toLocaleString()} 次
                  </div>
                  <div style={{ fontSize: 11, color: trendColor(svc.costTrend) }}>
                    {trendIcon(svc.costTrend)} {svc.costChangePercent >= 0 ? '+' : ''}{svc.costChangePercent.toFixed(1)}%
                  </div>
                </>
              )}
            </button>
            );
          })}
        </div>
      )}

      {/* 各服务费用对比 */}
      {summary && summary.services.filter(
        s => getServiceDisplayMode(s.key) === 'normal'
      ).length > 0 && (
        <div
          data-testid="superadmin-paid-api-service-comparison"
          style={{
          border: '1px solid var(--border-subtle)', borderRadius: 8,
          background: 'var(--bg-tertiary)', padding: 14,
        }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            各服务费用对比
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={summary.services.filter(
                s => getServiceDisplayMode(s.key) === 'normal'
              )}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickFormatter={(v: number) => `¥${v}`}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--text-primary)',
                }}
                formatter={(v: number) => [formatCost(v)]}
              />
              <Bar
                dataKey="totalCost"
                fill="var(--blue-500, #3B82F6)"
                name="费用"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 单服务费用明细（展开） */}
      {expandedService && (
        <div
          data-testid="superadmin-paid-api-service-detail"
          style={{
          border: '1px solid var(--border-subtle)', borderRadius: 8,
          background: 'var(--bg-tertiary)', padding: 14,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {summary?.services.find(s => s.key === expandedService)?.label ?? expandedService} — 费用明细
          </div>
          {detailLoading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>加载中...</div>}
          {detailData && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                单价：{detailData.unitPrice} {detailData.unitLabel}
              </div>
              {/* 调用量与费用趋势（双 Y 轴） */}
              {detailData.buckets.length > 0 && (
                <div style={{ height: 200 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                    调用量与费用趋势
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={detailData.buckets.slice(-14)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        tickFormatter={(v: string) => v.substring(0, 10)}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        tickFormatter={(v: number) => `¥${v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 8,
                          fontSize: 12,
                          color: 'var(--text-primary)',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar
                        yAxisId="left"
                        dataKey="totalCalls"
                        fill="var(--blue-200, rgba(59,130,246,0.3))"
                        name="调用量"
                        radius={[2, 2, 0, 0]}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="cost"
                        stroke="var(--danger)"
                        name="费用"
                        strokeWidth={2}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
              {/* 按日分桶表格 */}
              <div className="superadmin-paid-api-service-detail-table-wrap" style={{ overflow: 'auto', maxHeight: 200 }}>
                <table data-testid="superadmin-paid-api-service-detail-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['时间', '调用量', '成功', '失败', '重试', '费用'].map(h => (
                        <th key={h} style={{
                          textAlign: 'left', padding: '4px 8px',
                          color: 'var(--text-muted)', fontWeight: 600,
                          borderBottom: '1px solid var(--border-subtle)',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detailData.buckets.slice(-14).reverse().map((b, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '4px 8px', color: 'var(--text-primary)' }}>{b.time?.substring(0, 10)}</td>
                        <td style={{ padding: '4px 8px', color: 'var(--text-primary)' }}>{b.totalCalls.toLocaleString()}</td>
                        <td style={{ padding: '4px 8px', color: 'var(--success)' }}>{b.successCalls.toLocaleString()}</td>
                        <td style={{ padding: '4px 8px', color: 'var(--danger)' }}>{b.errorCalls.toLocaleString()}</td>
                        <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{b.totalRetries.toLocaleString()}</td>
                        <td style={{ padding: '4px 8px', color: 'var(--text-primary)', fontWeight: 500 }}>{formatCost(b.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Top 5 租户 */}
              {detailData.topTenants.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Top 租户费用
                  </div>
                  {detailData.topTenants.map((t, i) => (
                    <div key={t.tenantId} style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 12, padding: '2px 0',
                    }}>
                      <span style={{ color: 'var(--text-primary)' }}>#{i + 1} {t.tenantName}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {t.calls.toLocaleString()} 次 · {formatCost(t.cost)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {!detailLoading && !detailData && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>暂无明细数据</div>
          )}
        </div>
      )}

      {/* 最近费用告警 */}
      <div
        data-testid="superadmin-paid-api-alerts"
        style={{
        border: '1px solid var(--border-subtle)', borderRadius: 8,
        background: 'var(--bg-tertiary)', padding: 14,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>最近费用告警</div>
        {alerts.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>暂无费用告警</div>
        )}
        {alerts.slice().reverse().map((a, i) => {
          const timeStr = new Date(a.triggeredAt).toLocaleString();
          const levelIcon = a.level === 'critical' ? '\u{1F534}' : '⚠️';
          return (
            <div key={i} style={{
              display: 'flex', gap: 8, alignItems: 'flex-start',
              fontSize: 12, padding: '6px 8px', borderRadius: 6,
              background: a.level === 'critical'
                ? 'var(--danger-bg-soft)' : 'var(--warning-bg-soft)',
            }}>
              <span>{levelIcon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {SERVICE_LABEL_MAP[a.service] ?? a.service}{' '}— {a.message}
                </div>
                <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{timeStr}</div>
                {a.detail && (
                  <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                    当前 {formatCost(a.detail.currentCost)} / 预算 {formatCost(a.detail.monthlyBudget)}
                    {' · '}使用率 {a.detail.usagePercent.toFixed(0)}%
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SuperAdminPaidApiCostPanel;
