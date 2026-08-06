import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, Loader2, RefreshCw, Save, Trash2 } from 'lucide-react';
import {
  superAdminPaidApi,
  type PaidApiKeyConfigItem,
  type PaidApiKeyName,
  type QueritComplianceScene,
  type WebSearchProviderPriorityConfigUpdate,
} from '../../api/superadminPaidApi';
import { SuperAdminPaidApiCostPanel } from './SuperAdminPaidApiCostPanel';

type DraftMap = Partial<Record<PaidApiKeyName, string>>;
type WebSearchProvider = keyof WebSearchProviderPriorityConfigUpdate;

const WEB_SEARCH_PROVIDER_LABELS: Record<WebSearchProvider, string> = {
  querit: 'Querit',
  tinyfish: 'TinyFish',
  bocha: 'Bocha',
  tavily: 'Tavily',
};

const inputStyle: React.CSSProperties = {
  height: 38,
  borderRadius: 8,
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  padding: '0 10px',
  outline: 'none',
  fontSize: 13,
};

const iconSize = 15;

function formatUpdatedAt(value: string | null): string {
  if (!value) {
    return '尚未保存';
  }
  return new Date(value).toLocaleString();
}

function statusStyle(configured: boolean): React.CSSProperties {
  return {
    border: configured
      ? '1px solid var(--success-border-soft)'
      : '1px solid var(--warning-border-soft)',
    background: configured ? 'var(--success-bg-soft)' : 'var(--warning-bg-soft)',
    color: configured ? 'var(--success)' : 'var(--warning)',
    borderRadius: 999,
    padding: '2px 8px',
    fontSize: 12,
    whiteSpace: 'nowrap',
  };
}

function commandButtonStyle(kind: 'primary' | 'secondary' | 'danger'): React.CSSProperties {
  if (kind === 'primary') {
    return {
      height: 34,
      borderRadius: 8,
      border: '1px solid var(--border-subtle)',
      background: 'var(--btn-mono-bg)',
      color: 'var(--btn-mono-text)',
      padding: '0 12px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      fontSize: 13,
      cursor: 'pointer',
    };
  }
  if (kind === 'danger') {
    return {
      height: 34,
      borderRadius: 8,
      border: '1px solid var(--danger-border-soft)',
      background: 'var(--danger-bg-soft)',
      color: 'var(--danger)',
      padding: '0 12px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      fontSize: 13,
      cursor: 'pointer',
    };
  }
  return {
    height: 34,
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    padding: '0 12px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontSize: 13,
    cursor: 'pointer',
  };
}

export const SuperAdminPaidApiConfigPanel: React.FC = () => {
  const [items, setItems] = useState<PaidApiKeyConfigItem[]>([]);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<PaidApiKeyName | null>(null);
  const [priorityDraft, setPriorityDraft] = useState<WebSearchProviderPriorityConfigUpdate>({
    querit: 100,
    tinyfish: 100,
    bocha: 100,
    tavily: 100,
  });
  const [savingPriority, setSavingPriority] = useState(false);
  const [queritComplianceScene, setQueritComplianceScene] = useState<QueritComplianceScene>('domestic');
  const [savingQueritComplianceScene, setSavingQueritComplianceScene] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [keys, priority, queritScene] = await Promise.all([
        superAdminPaidApi.list(),
        superAdminPaidApi.getWebSearchProviderPriority(),
        superAdminPaidApi.getQueritComplianceScene(),
      ]);
      setItems(keys.items);
      setPriorityDraft({
        querit: priority.querit,
        tinyfish: priority.tinyfish,
        bocha: priority.bocha,
        tavily: priority.tavily,
      });
      setQueritComplianceScene(queritScene.scene);
      setDrafts({});
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  const saveKey = async (item: PaidApiKeyConfigItem) => {
    const draft = drafts[item.key]?.trim() ?? '';
    if (!draft) {
      toast.error('请输入 API Key');
      return;
    }
    setBusyKey(item.key);
    setError(null);
    try {
      const updated = await superAdminPaidApi.update(item.key, draft);
      setItems((prev) => prev.map((entry) => (entry.key === item.key ? updated : entry)));
      setDrafts((prev) => ({ ...prev, [item.key]: '' }));
      toast.success(`${item.displayName} 已保存`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败，请稍后重试');
    } finally {
      setBusyKey(null);
    }
  };

  const removeKey = async (item: PaidApiKeyConfigItem) => {
    if (!window.confirm(`确认清空 ${item.displayName}？`)) {
      return;
    }
    setBusyKey(item.key);
    setError(null);
    try {
      const updated = await superAdminPaidApi.remove(item.key);
      setItems((prev) => prev.map((entry) => (entry.key === item.key ? updated : entry)));
      setDrafts((prev) => ({ ...prev, [item.key]: '' }));
      toast.success(`${item.displayName} 已清空`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '清空失败，请稍后重试');
    } finally {
      setBusyKey(null);
    }
  };

  const saveWebSearchProviderPriority = async () => {
    const valid = Object.values(priorityDraft).every(
      (score) => Number.isInteger(score) && score >= 0 && score <= 1000
    );
    if (!valid) {
      setError('搜索优先级必须是 0 到 1000 的整数');
      return;
    }
    setSavingPriority(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await superAdminPaidApi.updateWebSearchProviderPriority(priorityDraft);
      setPriorityDraft({
        querit: updated.querit,
        tinyfish: updated.tinyfish,
        bocha: updated.bocha,
        tavily: updated.tavily,
      });
      setNotice('搜索优先级已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索优先级保存失败，请稍后重试');
    } finally {
      setSavingPriority(false);
    }
  };

  const updateQueritComplianceScene = async (scene: QueritComplianceScene) => {
    setSavingQueritComplianceScene(true);
    setError(null);
    try {
      const updated = await superAdminPaidApi.updateQueritComplianceScene(scene);
      setQueritComplianceScene(updated.scene);
      toast.success(updated.scene === 'all' ? 'Querit 已开启混合搜索' : 'Querit 已切换为仅中文搜索');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Querit 检索范围保存失败，请稍后重试');
    } finally {
      setSavingQueritComplianceScene(false);
    }
  };

  return (
    <div data-testid="superadmin-paid-api-config-panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div data-testid="superadmin-paid-api-config-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            付费 API Key
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            搜索、网页抓取与诉讼查询。
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadConfigs()}
          disabled={loading || busyKey !== null || savingPriority || savingQueritComplianceScene}
          title="刷新配置"
          style={{
            ...commandButtonStyle('secondary'),
            opacity: loading || busyKey !== null || savingPriority || savingQueritComplianceScene ? 0.6 : 1,
            cursor: loading || busyKey !== null || savingPriority || savingQueritComplianceScene ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? <Loader2 size={iconSize} /> : <RefreshCw size={iconSize} />}
          刷新
        </button>
      </div>

      {error && (
        <div
          style={{
            border: '1px solid var(--danger-border-soft)',
            background: 'var(--danger-bg-soft)',
            color: 'var(--danger)',
            borderRadius: 8,
            padding: '9px 10px',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          style={{
            border: '1px solid var(--success-border-soft)',
            background: 'var(--success-bg-soft)',
            color: 'var(--success)',
            borderRadius: 8,
            padding: '9px 10px',
            fontSize: 13,
          }}
        >
          {notice}
        </div>
      )}



      <div data-testid="superadmin-paid-api-config-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {items.map((item) => {
          const busy = busyKey === item.key;
          const draft = drafts[item.key] ?? '';
          return (
            <section
              key={item.key}
              className="superadmin-paid-api-config-card"
              data-testid={`superadmin-paid-api-config-card-${item.key}`}
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                background: 'var(--bg-tertiary)',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                minWidth: 0,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 8, minWidth: 0 }}>
                  <KeyRound size={18} color="var(--text-secondary)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.displayName}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, wordBreak: 'break-word' }}>
                      {item.key}
                    </div>
                  </div>
                </div>
                <span style={statusStyle(item.configured)}>
                  {item.configured ? '已配置' : '未配置'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {item.description}
                </div>
                {item.key === 'QUERIT_API_KEY' && (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={queritComplianceScene === 'all'}
                      disabled={loading || savingQueritComplianceScene || busyKey !== null || savingPriority}
                      onChange={(event) => void updateQueritComplianceScene(event.target.checked ? 'all' : 'domestic')}
                    />
                    中英文混合搜索
                  </label>
                )}
              </div>
              {item.key === 'QUERIT_API_KEY' && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  关闭时仅中文搜索，开启后混合搜索。
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                当前值：{item.maskedValue ?? '空'} · 更新时间：{formatUpdatedAt(item.updatedAt)}
              </div>
              <input
                type="password"
                value={draft}
                placeholder={item.configured ? '输入新 Key 覆盖当前值' : '输入 API Key'}
                disabled={busy || (busyKey !== null && !busy)}
                onChange={(event) => setDrafts((prev) => ({ ...prev, [item.key]: event.target.value }))}
                style={inputStyle}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => void saveKey(item)}
                  disabled={!draft.trim() || busyKey !== null}
                  style={{
                    ...commandButtonStyle('primary'),
                    opacity: !draft.trim() || busyKey !== null ? 0.6 : 1,
                    cursor: !draft.trim() || busyKey !== null ? 'not-allowed' : 'pointer',
                  }}
                >
                  {busy ? <Loader2 size={iconSize} /> : <Save size={iconSize} />}
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => void removeKey(item)}
                  disabled={!item.configured || busyKey !== null}
                  style={{
                    ...commandButtonStyle('danger'),
                    opacity: !item.configured || busyKey !== null ? 0.6 : 1,
                    cursor: !item.configured || busyKey !== null ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Trash2 size={iconSize} />
                  清空
                </button>
              </div>
            </section>
          );
        })}
      </div>

      <section
        data-testid="web-search-provider-priority-panel"
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
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>搜索优先级</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.6 }}>
            分值越高越先执行；同分时固定按 Querit、TinyFish、Bocha、Tavily 的顺序尝试。0 表示禁用，该搜索方式会被跳过。
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {(Object.keys(WEB_SEARCH_PROVIDER_LABELS) as WebSearchProvider[]).map((provider) => {
            const inputId = `web-search-priority-${provider}`;
            return (
              <label key={provider} htmlFor={inputId} style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                {WEB_SEARCH_PROVIDER_LABELS[provider]} 优先级
                <input
                  id={inputId}
                  type="number"
                  min={0}
                  max={1000}
                  step={1}
                  value={priorityDraft[provider]}
                  disabled={loading || savingPriority || savingQueritComplianceScene || busyKey !== null}
                  onChange={(event) => setPriorityDraft((previous) => ({
                    ...previous,
                    [provider]: Number(event.target.value),
                  }))}
                  style={inputStyle}
                />
              </label>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => void saveWebSearchProviderPriority()}
              disabled={loading || savingPriority || savingQueritComplianceScene || busyKey !== null}
            style={{
              ...commandButtonStyle('primary'),
              opacity: loading || savingPriority || savingQueritComplianceScene || busyKey !== null ? 0.6 : 1,
              cursor: loading || savingPriority || savingQueritComplianceScene || busyKey !== null ? 'not-allowed' : 'pointer',
            }}
          >
            {savingPriority ? <Loader2 size={iconSize} /> : <Save size={iconSize} />}
            保存搜索优先级
          </button>
        </div>
      </section>

      {/* 分隔线 */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '8px 0' }} />

      {/* 扣费观测 + 告警面板 */}
      <SuperAdminPaidApiCostPanel />
    </div>
  );
};

export default SuperAdminPaidApiConfigPanel;
