import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, RefreshCcw, Save } from 'lucide-react';
import {
  superAdminApi,
  type DashboardConfigResponse,
  type DashboardPromptConfigItem,
} from '../../api/superadmin';
import { useFrontendConfigStore } from '../../stores/frontendConfigStore';
import { SuperAdminConfigShell } from './SuperAdminConfigShell';

type PromptDraft = Record<string, string>;

const BATCH_QUERY_MAX_SYNC_NAMES_DEFAULT = 500;
const BATCH_QUERY_MAX_SYNC_NAMES_MIN = 1;
const BATCH_QUERY_MAX_SYNC_NAMES_MAX = 500;

function promptKey(item: DashboardPromptConfigItem): string {
  return `${item.dashboardKey}::${item.promptKey}`;
}

function toPromptDraft(items: DashboardPromptConfigItem[]): PromptDraft {
  return Object.fromEntries(items.map((item) => [promptKey(item), item.effectivePrompt || item.defaultPrompt || '']));
}

function customPromptForSave(item: DashboardPromptConfigItem, draftValue: string): string {
  const draft = draftValue.trim();
  const defaultPrompt = (item.defaultPrompt || '').trim();
  if (!draft || draft === defaultPrompt) return '';
  return draftValue;
}

const fixedDashboardAskAppend = `固定附加要求由代码自动追加，管理员只能编辑上方 Prompt：
- 说明本次请求来自智能看板，当前内容是当前会话的看板快照，不是实时数据库全量。
- 要求模型回答前主动调用一次 get_current_dashboard_context 读取当前看板上下文。
- 调用输入由前端按当前子看板决定；不在支持范围内的看板会使用 {"sub_dashboard":"current"}。
- 要求模型按快照局限回答，不编造未出现在快照中的事实。`;

const content: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 32,
  minWidth: 0,
};

const actions: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
};

const panel: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 12,
};

const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '18px 20px',
  minWidth: 0,
};

const rowBody: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
};

const rowTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text-primary)',
  lineHeight: '22px',
};

const rowDesc: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-muted)',
  lineHeight: '20px',
};

const divider: React.CSSProperties = {
  height: 1,
  background: 'var(--border-default)',
  margin: '0 20px',
};

const sectionTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--text-primary)',
};

const sectionDesc: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-muted)',
  lineHeight: '20px',
};

const textarea: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  resize: 'vertical',
  minHeight: 320,
  height: 'clamp(320px, 42vh, 520px)',
  borderRadius: 8,
  border: '1px solid var(--border-default)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  padding: 16,
  fontSize: 13,
  lineHeight: 1.7,
  outline: 'none',
};

const numberInput: React.CSSProperties = {
  width: 112,
  height: 34,
  boxSizing: 'border-box',
  borderRadius: 8,
  border: '1px solid var(--border-default)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  padding: '0 10px',
  fontSize: 13,
  outline: 'none',
};

const buttonPrimary: React.CSSProperties = {
  height: 34,
  padding: '0 14px',
  borderRadius: 8,
  border: '1px solid var(--btn-primary-bg)',
  background: 'var(--btn-primary-bg)',
  color: 'var(--btn-primary-text)',
  fontSize: 13,
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const buttonSecondary: React.CSSProperties = {
  height: 32,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid var(--border-default)',
  background: 'transparent',
  color: 'var(--text-primary)',
  fontSize: 13,
  fontWeight: 500,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const textButton: React.CSSProperties = {
  height: 28,
  padding: '0 8px',
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: 12,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  cursor: 'pointer',
};

const alert: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  fontSize: 13,
  lineHeight: '20px',
};

const ToggleSwitch: React.FC<{
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}> = ({ checked, disabled = false, onChange }) => (
  <button
    type="button"
    aria-pressed={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    style={{
      width: 40,
      height: 22,
      borderRadius: 999,
      border: 'none',
      background: checked ? 'var(--toggle-active-bg)' : 'var(--toggle-bg)',
      padding: 2,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      display: 'flex',
      justifyContent: checked ? 'flex-end' : 'flex-start',
      alignItems: 'center',
      flexShrink: 0,
      transition: 'background 150ms ease',
    }}
  >
    <span
      aria-hidden="true"
      style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        // 开关滑块固定白色，深浅主题通用
        background: '#fff',
      }}
    />
  </button>
);

const PromptItem: React.FC<{
  item: DashboardPromptConfigItem;
  draftValue: string;
  expanded: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ item, draftValue, expanded, onToggle, onChange, disabled = false }) => {
  const savedCustomPrompt = item.customPrompt || '';
  const customPrompt = customPromptForSave(item, draftValue);
  const isOverridden = customPrompt.length > 0;
  const isModified = customPrompt !== savedCustomPrompt;

  return (
    <div
      style={{
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '16px 20px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {item.label}
            </span>
            {isOverridden && (
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--accent-color)',
                  fontWeight: 500,
                }}
              >
                {isModified ? '已编辑' : '已覆盖'}
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {item.dashboardKey} / {item.promptKey}
          </span>
        </div>
        <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <textarea
            value={draftValue}
            onChange={(event) => onChange(event.target.value)}
            placeholder={item.defaultPrompt}
            rows={14}
            disabled={disabled}
            style={{
              ...textarea,
              borderColor: isOverridden ? 'var(--accent-bg)' : 'var(--border-default)',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {draftValue.length} 字符
            </span>
            <details style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              <summary style={{ cursor: 'pointer', listStyle: 'none' }}>查看代码默认 Prompt 和固定附加要求</summary>
              <pre
                style={{
                  margin: '10px 0 0',
                  padding: 12,
                  borderRadius: 8,
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {item.defaultPrompt}
{'\n\n---\n'}
{fixedDashboardAskAppend}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
};

export const SuperAdminDashboardConfigPage: React.FC = () => {
  const setDashboardEnabled = useFrontendConfigStore((state) => state.setDashboardEnabled);
  const [config, setConfig] = useState<DashboardConfigResponse | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [batchQueryMaxSyncNames, setBatchQueryMaxSyncNames] = useState(String(BATCH_QUERY_MAX_SYNC_NAMES_DEFAULT));
  const [promptDraft, setPromptDraft] = useState<PromptDraft>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await superAdminApi.dashboardConfig();
      setConfig(data);
      setEnabled(data.enabled);
      setBatchQueryMaxSyncNames(String(data.batchQueryMaxSyncNames ?? BATCH_QUERY_MAX_SYNC_NAMES_DEFAULT));
      setPromptDraft(toPromptDraft(data.prompts));
      setDashboardEnabled(data.enabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载智能看板配置失败');
    } finally {
      setLoading(false);
    }
  }, [setDashboardEnabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const parsedBatchQueryMaxSyncNames = useMemo(() => {
    if (!/^\d+$/.test(batchQueryMaxSyncNames.trim())) return null;
    return Number.parseInt(batchQueryMaxSyncNames, 10);
  }, [batchQueryMaxSyncNames]);

  const batchQueryMaxSyncNamesInvalid = parsedBatchQueryMaxSyncNames == null
    || parsedBatchQueryMaxSyncNames < BATCH_QUERY_MAX_SYNC_NAMES_MIN
    || parsedBatchQueryMaxSyncNames > BATCH_QUERY_MAX_SYNC_NAMES_MAX;

  const dirty = useMemo(() => {
    if (!config) return false;
    if (enabled !== config.enabled) return true;
    if (!batchQueryMaxSyncNamesInvalid && parsedBatchQueryMaxSyncNames !== config.batchQueryMaxSyncNames) return true;
    return config.prompts.some(
      (item) => customPromptForSave(item, promptDraft[promptKey(item)] || '') !== (item.customPrompt || ''),
    );
  }, [batchQueryMaxSyncNamesInvalid, config, enabled, parsedBatchQueryMaxSyncNames, promptDraft]);

  const dirtyCount = useMemo(() => {
    if (!config) return 0;
    return (
      config.prompts.filter(
        (item) => customPromptForSave(item, promptDraft[promptKey(item)] || '') !== (item.customPrompt || ''),
      ).length
      + (enabled !== config.enabled ? 1 : 0)
      + (!batchQueryMaxSyncNamesInvalid && parsedBatchQueryMaxSyncNames !== config.batchQueryMaxSyncNames ? 1 : 0)
    );
  }, [batchQueryMaxSyncNamesInvalid, config, enabled, parsedBatchQueryMaxSyncNames, promptDraft]);

  const handleSave = async () => {
    if (!config) return;
    if (batchQueryMaxSyncNamesInvalid || parsedBatchQueryMaxSyncNames == null) {
      setError(`批量查询企业上限必须在 ${BATCH_QUERY_MAX_SYNC_NAMES_MIN}-${BATCH_QUERY_MAX_SYNC_NAMES_MAX} 之间`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await superAdminApi.updateDashboardConfig({
        enabled,
        batchQueryMaxSyncNames: parsedBatchQueryMaxSyncNames,
        prompts: config.prompts.map((item) => ({
          dashboardKey: item.dashboardKey,
          promptKey: item.promptKey,
          customPrompt: customPromptForSave(item, promptDraft[promptKey(item)] || ''),
        })),
      });
      setConfig(result);
      setEnabled(result.enabled);
      setBatchQueryMaxSyncNames(String(result.batchQueryMaxSyncNames ?? BATCH_QUERY_MAX_SYNC_NAMES_DEFAULT));
      setPromptDraft(toPromptDraft(result.prompts));
      setDashboardEnabled(result.enabled);
      toast.success('智能看板配置已保存');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存智能看板配置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleResetCache = async () => {
    if (!window.confirm('确认清空全部智能看板参数缓存？清空后会在后续查询中逐渐重建。')) return;
    setResetting(true);
    setError(null);
    try {
      const result = await superAdminApi.resetDashboardParameterCache();
      toast.success(`已重置参数缓存，失效 ${result.invalidatedCount} 条记录`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '重置参数缓存失败');
    } finally {
      setResetting(false);
    }
  };

  const handleRestoreAll = () => {
    setPromptDraft(Object.fromEntries((config?.prompts ?? []).map((item) => [promptKey(item), item.defaultPrompt || ''])));
  };

  const togglePrompt = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const prompts = config?.prompts ?? [];

  return (
    <SuperAdminConfigShell activeKey="dashboard" testId="superadmin-dashboard-config-page">
      <div data-testid="superadmin-dashboard-config-content" style={content}>
        <div style={actions}>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || batchQueryMaxSyncNamesInvalid || saving || loading}
            data-testid="superadmin-dashboard-config-save"
            style={{
              ...buttonPrimary,
              opacity: !dirty || batchQueryMaxSyncNamesInvalid || saving || loading ? 0.5 : 1,
              cursor: !dirty || batchQueryMaxSyncNamesInvalid || saving || loading ? 'not-allowed' : 'pointer',
            }}
          >
            <Save size={14} aria-hidden="true" />
            {saving ? '保存中' : dirty ? `保存${dirtyCount > 0 ? ` (${dirtyCount})` : ''}` : '已保存'}
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div
            data-testid="superadmin-dashboard-config-error"
            style={{
              ...alert,
              color: 'var(--danger)',
              background: 'var(--danger-bg-soft)',
              border: '1px solid var(--danger-border-soft)',
            }}
          >
            {error}
          </div>
        )}


        {/* Settings panel */}
        <section style={panel}>
          <div style={row}>
            <div style={rowBody}>
              <div style={rowTitle}>前端入口与 Core Tool</div>
              <div style={rowDesc}>关闭后普通前端不展示智能看板入口，tool-search core tools 会同步禁用 get_current_dashboard_context。</div>
            </div>
            <ToggleSwitch checked={enabled} disabled={loading || saving} onChange={setEnabled} />
          </div>

          <div style={divider} />

          <div style={row}>
            <div style={rowBody}>
              <div style={rowTitle}>批量查询企业上限</div>
              <div style={rowDesc}>
                识别到的企业数超过该值时直接拦截并提示拆分文件，避免同步查询长时间占用。
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
              <input
                type="number"
                min={BATCH_QUERY_MAX_SYNC_NAMES_MIN}
                max={BATCH_QUERY_MAX_SYNC_NAMES_MAX}
                step={1}
                value={batchQueryMaxSyncNames}
                disabled={loading || saving}
                data-testid="superadmin-dashboard-batch-query-limit"
                onChange={(event) => setBatchQueryMaxSyncNames(event.target.value)}
                style={{
                  ...numberInput,
                  borderColor: batchQueryMaxSyncNamesInvalid ? 'var(--danger)' : 'var(--border-default)',
                  opacity: loading || saving ? 0.5 : 1,
                }}
              />
              <span style={{ fontSize: 12, color: batchQueryMaxSyncNamesInvalid ? 'var(--danger)' : 'var(--text-muted)' }}>
                {BATCH_QUERY_MAX_SYNC_NAMES_MIN}-{BATCH_QUERY_MAX_SYNC_NAMES_MAX} 家
              </span>
            </div>
          </div>

          <div style={divider} />

          <div style={row}>
            <div style={rowBody}>
              <div style={rowTitle}>参数缓存</div>
              <div style={rowDesc}>当前有效 PG 缓存：{loading ? '-' : config?.activeParameterCacheCount ?? 0} 条。</div>
            </div>
            <button
              type="button"
              onClick={handleResetCache}
              disabled={loading || resetting}
              data-testid="superadmin-dashboard-cache-reset"
              style={{
                ...buttonSecondary,
                opacity: loading || resetting ? 0.5 : 1,
                cursor: loading || resetting ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCcw size={14} aria-hidden="true" />
              {resetting ? '重置中' : '一键重置'}
            </button>
          </div>
        </section>

        {/* Prompt overrides */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={sectionTitle}>Prompt 覆盖</div>
              <div style={sectionDesc}>文本框展示并编辑自动洞察的可配置前半段；保存后非默认值会覆盖到数据库，固定附加要求由代码自动追加。</div>
            </div>
            <button
              type="button"
              onClick={handleRestoreAll}
              disabled={loading || saving}
              style={{
                ...textButton,
                opacity: loading || saving ? 0.5 : 1,
                cursor: loading || saving ? 'not-allowed' : 'pointer',
              }}
            >
              全部恢复默认
            </button>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              加载中…
            </div>
          ) : (
            <div style={panel}>
              {prompts.map((item) => {
                const key = promptKey(item);
                return (
                  <PromptItem
                    key={key}
                    item={item}
                    draftValue={promptDraft[key] || ''}
                    expanded={expandedKeys.has(key)}
                    onToggle={() => togglePrompt(key)}
                    onChange={(value) => setPromptDraft((prev) => ({ ...prev, [key]: value }))}
                    disabled={saving}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </SuperAdminConfigShell>
  );
};

export default SuperAdminDashboardConfigPage;
