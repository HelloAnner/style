import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  superAdminApi,
  type SaAccountAgentQuestionMode,
  type SaTenantAgentAccessBatchResponse,
} from '../../api/superadmin';
import { SuperAdminSelect } from './SuperAdminSelect';

const BUILTIN_AGENT_OPTIONS = [
  { value: 'business_insight', label: '客户洞察' },
  { value: 'risk_insight', label: '风险管理' },
  { value: 'opinion_insight', label: '舆情监控' },
];

export const SuperAdminTenantAgentBatchPanel: React.FC = () => {
  const [scope, setScope] = useState<'all' | 'partial'>('partial');
  const [tenantIds, setTenantIds] = useState('');
  const [questionMode, setQuestionMode] = useState<SaAccountAgentQuestionMode>('default');
  const [dryRun, setDryRun] = useState(true);
  const [enabledAgents, setEnabledAgents] = useState<Set<string>>(
    () => new Set(BUILTIN_AGENT_OPTIONS.map((item) => item.value)),
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SaTenantAgentAccessBatchResponse | null>(null);

  const toggleAgent = useCallback((businessId: string) => {
    setEnabledAgents((current) => {
      const next = new Set(current);
      if (next.has(businessId)) {
        next.delete(businessId);
      } else {
        next.add(businessId);
      }
      return next;
    });
  }, []);

  const setAllAgents = useCallback(() => {
    setEnabledAgents(new Set(BUILTIN_AGENT_OPTIONS.map((item) => item.value)));
  }, []);

  const parseTenantIds = useCallback(() => (
    tenantIds
      .split(/[\s,，]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  ), [tenantIds]);

  const runBatch = useCallback(async () => {
    const parsedTenantIds = parseTenantIds();
    if (enabledAgents.size === 0) {
      toast.error('至少保留一个智能体');
      return;
    }
    if (scope === 'partial' && parsedTenantIds.length === 0) {
      toast.error('请输入 tenant_id');
      return;
    }
    if (scope === 'all' && !dryRun && !window.confirm('确认全量更新所有工作区的内置智能体开通状态？')) {
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const response = await superAdminApi.updateTenantAgentAccess({
        all_tenants: scope === 'all',
        tenant_ids: scope === 'partial' ? parsedTenantIds : undefined,
        enabledBusinessIds: Array.from(enabledAgents),
        questionMode,
        dryRun,
      });
      setResult(response);
      toast.success(dryRun ? '预演完成' : '批量更新已执行');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '批量更新失败');
    } finally {
      setLoading(false);
    }
  }, [dryRun, enabledAgents, parseTenantIds, questionMode, scope]);

  return (
    <div data-testid="superadmin-tenant-agent-batch-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div data-testid="superadmin-tenant-agent-batch-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>租户智能体批量开通</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            可全量处理所有工作区，也可粘贴部分 tenant_id；已有推荐问不会被覆盖。
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setDryRun((value) => !value)}
            style={{
              height: 34,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              background: dryRun ? 'var(--warning-bg-soft)' : 'var(--bg-secondary)',
              color: dryRun ? 'var(--warning)' : 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            {dryRun ? '预演' : '实际写入'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void runBatch()}
            style={{
              height: 34,
              padding: '0 14px',
              borderRadius: 8,
              border: '1px solid var(--btn-primary-bg)',
              background: loading ? 'var(--bg-secondary)' : 'var(--btn-primary-bg)',
              color: loading ? 'var(--text-muted)' : 'var(--btn-primary-text)',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '处理中...' : '执行批量处理'}
          </button>
        </div>
      </div>

      <div data-testid="superadmin-tenant-agent-batch-form" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(260px, 0.8fr)', gap: 12 }}>
        <div className="superadmin-tenant-agent-batch-scope" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['partial', 'all'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setScope(item)}
                style={{
                  height: 32,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: `1px solid ${scope === item ? 'var(--btn-primary-bg)' : 'var(--border-subtle)'}`,
                  background: scope === item ? 'var(--info-bg-soft)' : 'var(--bg-secondary)',
                  color: scope === item ? 'var(--info)' : 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                {item === 'partial' ? '部分租户' : '全量租户'}
              </button>
            ))}
          </div>
          <textarea
            value={tenantIds}
            onChange={(event) => setTenantIds(event.target.value)}
            disabled={scope === 'all'}
            placeholder="粘贴 tenant_id，支持换行、空格、逗号分隔"
            style={{
              minHeight: 86,
              borderRadius: 8,
              border: '1px solid var(--input-border)',
              background: scope === 'all' ? 'var(--bg-secondary)' : 'var(--input-bg)',
              color: 'var(--text-primary)',
              padding: 10,
              outline: 'none',
              resize: 'vertical',
              opacity: scope === 'all' ? 0.65 : 1,
            }}
          />
        </div>

        <div className="superadmin-tenant-agent-batch-options" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {BUILTIN_AGENT_OPTIONS.map((item) => {
              const enabled = enabledAgents.has(item.value);
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => toggleAgent(item.value)}
                  style={{
                    height: 32,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: `1px solid ${enabled ? 'var(--success-border-soft)' : 'var(--border-subtle)'}`,
                    background: enabled ? 'var(--success-bg-soft)' : 'var(--bg-secondary)',
                    color: enabled ? 'var(--success)' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {item.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={setAllAgents}
              style={{
                height: 32,
                padding: '0 10px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              全部智能体
            </button>
          </div>
          <SuperAdminSelect
            value={questionMode}
            onChange={setQuestionMode}
            ariaLabel="推荐问模式"
            options={[
              { value: 'default', label: '默认推荐问' },
              { value: 'generated', label: '生成推荐问' },
            ]}
          />
        </div>
      </div>


      {result && (
        <div data-testid="superadmin-tenant-agent-batch-result" style={{ color: 'var(--text-primary)', fontSize: 13, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10 }}>
          {result.dryRun ? '预演完成' : '处理完成'}：租户 {result.tenantCount} 个，开通 {result.agentsEnabled} 次，屏蔽 {result.agentsHidden} 次，重建资产 {result.assetsRegenerated} 次，失败 {result.failedCount} 次。
        </div>
      )}
    </div>
  );
};

export default SuperAdminTenantAgentBatchPanel;
