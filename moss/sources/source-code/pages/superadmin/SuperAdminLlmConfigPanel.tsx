import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Edit,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Star,
  X,
} from 'lucide-react';
import {
  superAdminLlmConfigApi,
  type SaLlmConfigItem,
  type SaLlmConfigRequest,
  type SaLlmModelOption,
  type SaLlmRuntimeConfig,
} from '../../api/superadminLlmConfigApi';
import { SuperAdminLlmModelSearch } from './SuperAdminLlmModelSearch';
import { Alert } from './SuperAdminLlmConfigUi';
import { LlmConfigTable } from './LlmConfigTable';
import { LlmRuntimeTruthPanel } from './LlmRuntimeTruthPanel';
import { SuperAdminSelect } from './SuperAdminSelect';

type Draft = {
  name: string;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: string;
  maxTokens: string;
  streamMode: string;
  thinkingMode: 'disabled' | 'auto' | 'enabled';
  clearApiKey: boolean;
};

type DrawerState = { mode: 'create' } | { mode: 'edit'; id: string };

const iconSize = 15;
const CUSTOM_OPENAI_PROVIDER = 'custom-openai-compatible';
const OPENAI_PROVIDER = 'openai';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

const providerPresets = [
  { value: 'dashscope', label: 'DashScope', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { value: OPENAI_PROVIDER, label: 'OpenAI', baseUrl: OPENAI_BASE_URL },
  { value: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { value: 'moonshot', label: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1' },
  { value: 'doubao', label: 'Doubao', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
  { value: 'zhipu', label: 'Zhipu', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { value: 'anthropic', label: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1' },
  { value: CUSTOM_OPENAI_PROVIDER, label: '自定义（OpenAI 兼容）', baseUrl: '' },
];

const emptyDraft: Draft = {
  name: '',
  provider: 'dashscope',
  model: '',
  apiKey: '',
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  temperature: '0.7',
  maxTokens: '20000',
  streamMode: 'full',
  thinkingMode: 'auto',
  clearApiKey: false,
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
  width: '100%',
};

function fieldStyle(disabled: boolean): React.CSSProperties {
  return {
    ...inputStyle,
    opacity: disabled ? 0.65 : 1,
    cursor: disabled ? 'not-allowed' : 'text',
  };
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minWidth: 0,
};

const labelTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
};

function buttonStyle(kind: 'primary' | 'secondary' | 'danger'): React.CSSProperties {
  const common: React.CSSProperties = {
    height: 34,
    borderRadius: 8,
    padding: '0 12px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
  if (kind === 'primary') {
    return {
      ...common,
      border: '1px solid var(--border-subtle)',
      background: 'var(--btn-mono-bg)',
      color: 'var(--btn-mono-text)',
    };
  }
  if (kind === 'danger') {
    return {
      ...common,
      border: '1px solid var(--danger-border-soft)',
      background: 'var(--danger-bg-soft)',
      color: 'var(--danger)',
    };
  }
  return {
    ...common,
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  };
}

function pillStyle(kind: 'success' | 'warning' | 'muted' | 'info'): React.CSSProperties {
  if (kind === 'success') {
    return {
      border: '1px solid var(--success-border-soft)',
      background: 'var(--success-bg-soft)',
      color: 'var(--success)',
    };
  }
  if (kind === 'warning') {
    return {
      border: '1px solid var(--warning-border-soft)',
      background: 'var(--warning-bg-soft)',
      color: 'var(--warning)',
    };
  }
  if (kind === 'info') {
    return {
      border: '1px solid var(--info-border-soft)',
      background: 'var(--info-bg-soft)',
      color: 'var(--info)',
    };
  }
  return {
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-primary)',
    color: 'var(--text-muted)',
  };
}

function Pill({ kind, children }: { kind: 'success' | 'warning' | 'muted' | 'info'; children: React.ReactNode }) {
  return (
    <span style={{
      ...pillStyle(kind),
      borderRadius: 999,
      padding: '2px 8px',
      fontSize: 12,
      lineHeight: '18px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

function normalizeBaseUrl(value?: string | null): string {
  const trimmed = (value ?? '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return trimmed;
  }
}

function effectiveProvider(provider: string): string {
  return provider === CUSTOM_OPENAI_PROVIDER ? OPENAI_PROVIDER : provider;
}

function resolvedBaseUrl(provider: string, baseUrl?: string | null): string {
  const explicit = normalizeBaseUrl(baseUrl);
  if (explicit) return explicit;
  return normalizeBaseUrl(providerPresets.find((preset) => preset.value === provider)?.baseUrl);
}

function isCustomOpenAiConfig(item: SaLlmConfigItem): boolean {
  return item.provider.toLowerCase() === OPENAI_PROVIDER
    && !!item.baseUrl
    && normalizeBaseUrl(item.baseUrl) !== normalizeBaseUrl(OPENAI_BASE_URL);
}

function hasSameCredentialScope(item: SaLlmConfigItem, draft: Draft): boolean {
  const itemProvider = item.provider.toLowerCase();
  const itemBaseUrl = resolvedBaseUrl(itemProvider, item.baseUrl);
  return itemProvider === effectiveProvider(draft.provider).toLowerCase()
    && itemBaseUrl === resolvedBaseUrl(draft.provider, draft.baseUrl);
}

function toDraft(item: SaLlmConfigItem): Draft {
  return {
    name: item.name,
    provider: isCustomOpenAiConfig(item) ? CUSTOM_OPENAI_PROVIDER : item.provider,
    model: item.model,
    apiKey: '',
    baseUrl: item.baseUrl ?? '',
    temperature: String(item.temperature ?? 0.7),
    maxTokens: String(item.maxTokens ?? 20000),
    streamMode: item.streamMode || 'full',
    thinkingMode: item.thinkingMode || 'auto',
    clearApiKey: false,
  };
}

export const SuperAdminLlmConfigPanel: React.FC = () => {
  const [items, setItems] = useState<SaLlmConfigItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [modelOptions, setModelOptions] = useState<SaLlmModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsFetched, setModelsFetched] = useState(false);
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [runtimeConfig, setRuntimeConfig] = useState<SaLlmRuntimeConfig | null>(null);
  const [runtimeLoading, setRuntimeLoading] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const editingItem = useMemo(
    () => drawer?.mode === 'edit' ? items.find((item) => item.id === drawer.id) ?? null : null,
    [drawer, items],
  );
  const defaultItem = useMemo(() => items.find((item) => item.isDefault) ?? null, [items]);
  const configDisabled = editingItem?.enabled === false;
  const credentialScopeChanged = !!editingItem && !hasSameCredentialScope(editingItem, draft);
  const canReuseSavedApiKey = !!editingItem?.hasApiKey && !draft.clearApiKey && !credentialScopeChanged;
  const customOpenAiCompatible = draft.provider === CUSTOM_OPENAI_PROVIDER;

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await superAdminLlmConfigApi.list();
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRuntimeConfig = useCallback(async () => {
    setRuntimeLoading(true);
    setRuntimeError(null);
    try {
      const data = await superAdminLlmConfigApi.getRuntimeConfig();
      setRuntimeConfig(data);
    } catch (err) {
      setRuntimeError(err instanceof Error ? err.message : '获取真实参数失败');
    } finally {
      setRuntimeLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfigs();
    void loadRuntimeConfig();
  }, [loadConfigs, loadRuntimeConfig]);

  useEffect(() => {
    const timer = setInterval(() => {
      void loadRuntimeConfig();
    }, 30000);
    return () => clearInterval(timer);
  }, [loadRuntimeConfig]);

  const resetModelLookup = () => {
    setModelOptions([]); setModelsFetched(false); setModelFetchError(null);
  };

  const openCreate = () => {
    setDrawer({ mode: 'create' });
    setDraft(emptyDraft);
    resetModelLookup();
    setError(null);
  };

  const openEdit = (item: SaLlmConfigItem) => {
    setDrawer({ mode: 'edit', id: item.id });
    setDraft(toDraft(item));
    resetModelLookup();
    setModelOptions([{ id: item.model, name: item.model }]);
    setError(null);
  };

  const closeDrawer = () => {
    setDrawer(null);
    resetModelLookup();
  };

  const updateDraft = (patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const changeProvider = (provider: string) => {
    const nextPreset = providerPresets.find((preset) => preset.value === provider);
    updateDraft({
      provider,
      baseUrl: nextPreset?.baseUrl ?? '',
      model: '',
      apiKey: '',
      clearApiKey: false,
    });
    resetModelLookup();
  };

  const selectModel = (model: string) => {
    const trimmed = model.trim();
    updateDraft({
      model,
      name: draft.name.trim() ? draft.name : trimmed ? `${effectiveProvider(draft.provider)}/${trimmed}` : draft.name,
    });
  };

  const fetchModels = async (force = false) => {
    if (!force && modelsFetched) return;
    if (!draft.apiKey.trim() && !canReuseSavedApiKey) {
      const message = '请先填写 API Key，填写后会自动拉取模型列表';
      setModelFetchError(message);
      return;
    }
    setModelsLoading(true);
    setModelFetchError(null);
    setError(null);
    try {
      const response = await superAdminLlmConfigApi.listModelOptions({
        configId: canReuseSavedApiKey ? editingItem?.id : undefined,
        provider: effectiveProvider(draft.provider).trim(),
        apiKey: draft.apiKey.trim() || undefined,
        baseUrl: draft.baseUrl.trim() || undefined,
      });
      setModelOptions(response.items);
      setModelsFetched(true);
    } catch (err) {
      const reason = err instanceof Error ? err.message : '拉取模型失败，请稍后重试';
      const message = `${reason}，可手动输入模型名称`;
      setModelsFetched(true);
      setModelFetchError(message);
    } finally {
      setModelsLoading(false);
    }
  };

  const buildRequest = (): SaLlmConfigRequest | null => {
    const temperature = Number(draft.temperature);
    const maxTokens = Number(draft.maxTokens);
    if (!draft.name.trim() || !draft.provider.trim() || !draft.model.trim()) {
      setError('请填写名称、Provider 和模型名称');
      return null;
    }
    if (draft.provider === CUSTOM_OPENAI_PROVIDER && !draft.baseUrl.trim()) {
      setError('自定义 OpenAI 兼容配置必须填写公网 HTTPS Base URL');
      return null;
    }
    if (editingItem?.hasApiKey && credentialScopeChanged && !draft.apiKey.trim() && !draft.clearApiKey) {
      setError('Provider 或 Base URL 已变更，请重新填写 API Key');
      return null;
    }
    if (Number.isNaN(temperature) || Number.isNaN(maxTokens)) {
      setError('temperature 和 maxTokens 必须是数字');
      return null;
    }
    return {
      name: draft.name.trim(),
      provider: effectiveProvider(draft.provider).trim(),
      model: draft.model.trim(),
      apiKey: draft.apiKey.trim() || undefined,
      baseUrl: draft.baseUrl.trim() || undefined,
      temperature,
      maxTokens,
      streamMode: draft.streamMode.trim() || 'full',
      thinkingMode: draft.thinkingMode,
      clearApiKey: draft.clearApiKey,
    };
  };

  const saveConfig = async () => {
    const request = buildRequest();
    if (!request) return;
    const id = editingItem?.id ?? 'new';
    setBusyId(id);
    setError(null);
    try {
      const saved = editingItem
        ? await superAdminLlmConfigApi.update(editingItem.id, request)
        : await superAdminLlmConfigApi.create(request);
      setItems((prev) => {
        if (!editingItem) {
          return [saved, ...prev];
        }
        return prev.map((item) => (item.id === saved.id ? saved : item));
      });
      closeDrawer();
      toast.success(editingItem ? '配置已保存' : '配置已新增');
      void loadRuntimeConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请稍后重试');
    } finally {
      setBusyId(null);
    }
  };

  const setDefault = async (item: SaLlmConfigItem) => {
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await superAdminLlmConfigApi.setDefault(item.id);
      setItems((prev) => prev.map((entry) => ({
        ...(entry.id === updated.id ? updated : entry),
        isDefault: entry.id === updated.id,
      })));
      toast.success(`${updated.name} 已设为主对话模型`);
      void loadRuntimeConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : '切换失败，请稍后重试');
    } finally {
      setBusyId(null);
    }
  };

  const setEnabled = async (item: SaLlmConfigItem, enabled: boolean) => {
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await superAdminLlmConfigApi.setEnabled(item.id, enabled);
      setItems((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      if (drawer?.mode === 'edit' && drawer.id === updated.id) {
        setDraft(toDraft(updated));
      }
      toast.success(`${updated.name} 已${enabled ? '启用' : '停用'}`);
      void loadRuntimeConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : '切换失败，请稍后重试');
    } finally {
      setBusyId(null);
    }
  };

  const setThinkingMode = async (item: SaLlmConfigItem, mode: SaLlmConfigItem['thinkingMode']) => {
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await superAdminLlmConfigApi.update(item.id, {
        name: item.name,
        provider: item.provider,
        model: item.model,
        baseUrl: item.baseUrl ?? undefined,
        temperature: item.temperature,
        maxTokens: item.maxTokens,
        streamMode: item.streamMode,
        thinkingMode: mode,
      });
      setItems((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      if (drawer?.mode === 'edit' && drawer.id === updated.id) {
        setDraft(toDraft(updated));
      }
      toast.success(`${updated.name} 思考模式已切换`);
      void loadRuntimeConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : '切换失败，请稍后重试');
    } finally {
      setBusyId(null);
    }
  };

  const removeConfig = async (item: SaLlmConfigItem) => {
    if (!window.confirm(`确认删除 ${item.name}？`)) {
      return;
    }
    setBusyId(item.id);
    setError(null);
    try {
      await superAdminLlmConfigApi.remove(item.id);
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
      if (drawer?.mode === 'edit' && drawer.id === item.id) {
        closeDrawer();
      }
      toast.success(`${item.name} 已删除`);
      void loadRuntimeConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败，请稍后重试');
    } finally {
      setBusyId(null);
    }
  };

  const renderDrawerHeader = () => (
    <div
      data-testid="superadmin-llm-config-drawer-header"
      style={{
        height: 58,
        padding: '0 18px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
          {editingItem ? '编辑 LLM 配置' : '新增 LLM 配置'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {providerPresets.find((preset) => preset.value === draft.provider)?.label ?? draft.provider ?? 'provider'} / {draft.model || 'model'}
        </div>
      </div>
      <button type="button" onClick={closeDrawer} title="关闭" style={buttonStyle('secondary')}>
        <X size={iconSize} />
      </button>
    </div>
  );

  const renderDrawerBody = () => (
    <div data-testid="superadmin-llm-config-drawer-body" style={{ padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {error && <Alert kind="danger">{error}</Alert>}
      {configDisabled && (
        <Alert kind="warning">
          当前配置已停用，运行时不会读取，也不能修改任何字段。请在列表中启用后再编辑。
        </Alert>
      )}
      {editingItem?.hasApiKey && credentialScopeChanged && !draft.clearApiKey && (
        <Alert kind="warning">
          Provider 或 Base URL 已变更，原 API Key 不会复用，请重新填写。
        </Alert>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Provider</span>
          <SuperAdminSelect
            value={draft.provider}
            disabled={configDisabled}
            onChange={changeProvider}
            ariaLabel="Provider"
            options={providerPresets}
            style={{ width: '100%' }}
            triggerStyle={{ height: 38 }}
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>模型</span>
          {customOpenAiCompatible ? (
            <input
              value={draft.model}
              disabled={configDisabled}
              onChange={(event) => selectModel(event.target.value)}
              placeholder="请输入模型名称"
              style={fieldStyle(configDisabled)}
            />
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <SuperAdminLlmModelSearch
                value={draft.model}
                options={modelOptions}
                loading={modelsLoading}
                disabled={configDisabled}
                error={modelFetchError}
                onChange={selectModel}
                onOpen={() => void fetchModels(false)}
                onRefresh={() => void fetchModels(true)}
              />
              <button
                type="button"
                onClick={() => void fetchModels(true)}
                disabled={modelsLoading || configDisabled}
                title="刷新模型"
                style={{
                  ...buttonStyle('secondary'),
                  width: 86,
                  opacity: modelsLoading || configDisabled ? 0.6 : 1,
                  cursor: modelsLoading || configDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                {modelsLoading ? <Loader2 size={iconSize} /> : <RefreshCw size={iconSize} />}
                刷新
              </button>
            </div>
          )}
        </label>
      </div>

      <label style={labelStyle}>
        <span style={labelTextStyle}>名称</span>
        <input
          value={draft.name}
          disabled={configDisabled}
          onChange={(event) => updateDraft({ name: event.target.value })}
          style={fieldStyle(configDisabled)}
        />
      </label>

      <label style={labelStyle}>
        <span style={labelTextStyle}>API Key</span>
        <input
          type="password"
          value={draft.apiKey}
          disabled={configDisabled}
          onChange={(event) => {
            updateDraft({ apiKey: event.target.value, clearApiKey: false });
            resetModelLookup();
          }}
          style={fieldStyle(configDisabled)}
        />
      </label>

      {editingItem?.hasApiKey && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={draft.clearApiKey}
            disabled={editingItem.isDefault || configDisabled}
            onChange={(event) => {
              updateDraft({
                clearApiKey: event.target.checked,
                apiKey: event.target.checked ? '' : draft.apiKey,
              });
              resetModelLookup();
            }}
          />
          清空当前 API Key（{editingItem.maskedApiKey ?? '已配置'}）
        </label>
      )}

      <label style={labelStyle}>
        <span style={labelTextStyle}>Base URL</span>
        <input
          value={draft.baseUrl}
          disabled={configDisabled}
          onChange={(event) => {
            updateDraft({ baseUrl: event.target.value, apiKey: '', clearApiKey: false });
            resetModelLookup();
          }}
          placeholder={draft.provider === CUSTOM_OPENAI_PROVIDER ? 'https://models.example.com/v1' : undefined}
          style={fieldStyle(configDisabled)}
        />
      </label>

      <details style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>
          高级参数
        </summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Temperature</span>
            <input
              value={draft.temperature}
              disabled={configDisabled}
              onChange={(event) => updateDraft({ temperature: event.target.value })}
              style={fieldStyle(configDisabled)}
            />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Max Tokens</span>
            <input
              value={draft.maxTokens}
              disabled={configDisabled}
              onChange={(event) => updateDraft({ maxTokens: event.target.value })}
              style={fieldStyle(configDisabled)}
            />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Stream Mode</span>
            <SuperAdminSelect
              value={draft.streamMode}
              disabled={configDisabled}
              onChange={(streamMode) => updateDraft({ streamMode })}
              ariaLabel="Stream Mode"
              options={[
                { value: 'full', label: 'full' },
                { value: 'incremental', label: 'incremental' },
              ]}
              style={{ width: '100%' }}
              triggerStyle={{ height: 38 }}
            />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Thinking Mode</span>
            <SuperAdminSelect
              value={draft.thinkingMode}
              onChange={(thinkingMode) => updateDraft({ thinkingMode })}
              ariaLabel="Thinking Mode"
              options={[
                { value: 'disabled', label: '快速' },
                { value: 'auto', label: '自动' },
                { value: 'enabled', label: '深度思考' },
              ]}
              style={{ width: '100%' }}
              triggerStyle={{ height: 38 }}
            />
          </label>
        </div>
      </details>
    </div>
  );

  const renderDrawerFooter = () => (
    <div
      data-testid="superadmin-llm-config-drawer-footer"
      style={{
        padding: 14,
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 8,
      }}
    >
      <button type="button" onClick={closeDrawer} style={buttonStyle('secondary')}>
        取消
      </button>
      <button
        type="button"
        onClick={() => void saveConfig()}
        disabled={busyId !== null || configDisabled}
        style={{
          ...buttonStyle('primary'),
          opacity: busyId !== null || configDisabled ? 0.6 : 1,
          cursor: busyId !== null || configDisabled ? 'not-allowed' : 'pointer',
        }}
      >
        {busyId === (editingItem?.id ?? 'new') ? <Loader2 size={iconSize} /> : <Save size={iconSize} />}
        保存
      </button>
    </div>
  );

  const renderDrawer = () => (
    <div
      data-testid="superadmin-llm-config-drawer"
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'var(--modal-backdrop)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <aside
        data-testid="superadmin-llm-config-drawer-panel"
        role="dialog"
        aria-modal="true"
        style={{
          width: 'min(560px, 100vw)',
          height: '100%',
          background: 'var(--modal-bg)',
          borderLeft: '1px solid var(--modal-border)',
          boxShadow: 'var(--modal-shadow)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {renderDrawerHeader()}
        {renderDrawerBody()}
        {renderDrawerFooter()}
      </aside>
    </div>
  );

  function primaryMetric(label: string, value: React.ReactNode) {
    return (
      <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
      </div>
    );
  }

  const primaryCard = defaultItem ? (
    <div
      style={{
        border: '1px solid var(--success-border-soft)',
        borderLeft: '4px solid var(--success)',
        borderRadius: 12,
        background: 'var(--success-bg-soft)',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <Pill kind="success">
          <Star size={12} />
          主对话
        </Pill>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 3 }}>当前主对话模型</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, wordBreak: 'break-word' }}>
            {defaultItem.name}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
            {defaultItem.provider} / {defaultItem.model}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexShrink: 0 }}>
        {primaryMetric('Temperature', defaultItem.temperature ?? 0.7)}
        {primaryMetric('Max Tokens', defaultItem.maxTokens ?? 20000)}
        {primaryMetric('Stream', defaultItem.streamMode || 'full')}
        <Pill kind={defaultItem.thinkingMode === 'enabled' ? 'info' : defaultItem.thinkingMode === 'auto' ? 'warning' : 'muted'}>
          {defaultItem.thinkingMode === 'enabled' ? '深度思考' : defaultItem.thinkingMode === 'disabled' ? '快速' : '自动'}
        </Pill>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
        {defaultItem.hasApiKey ? (
          <Pill kind="success">
            <KeyRound size={12} />
            {defaultItem.maskedApiKey ?? '已配置'}
          </Pill>
        ) : (
          <Pill kind="warning">未配置 API Key</Pill>
        )}
        <button type="button" onClick={() => openEdit(defaultItem)} style={buttonStyle('secondary')}>
          <Edit size={iconSize} />
          编辑主模型
        </button>
      </div>
    </div>
  ) : (
    <div
      style={{
        border: '1px dashed var(--warning-border-soft)',
        borderRadius: 12,
        background: 'var(--warning-bg-soft)',
        padding: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        color: 'var(--warning)',
        fontSize: 14,
      }}
    >
      <Star size={18} />
      尚未设置主对话模型，请在下方候选配置中选择一个并点击星标。
    </div>
  );

  return (
    <div data-testid="superadmin-llm-config-panel" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div data-testid="superadmin-llm-config-header" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => void loadConfigs()}
            disabled={loading || busyId !== null}
            title="刷新"
            style={{
              ...buttonStyle('secondary'),
              opacity: loading || busyId !== null ? 0.6 : 1,
              cursor: loading || busyId !== null ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? <Loader2 size={iconSize} /> : <RefreshCw size={iconSize} />}
            刷新
          </button>
          <button type="button" onClick={openCreate} style={buttonStyle('primary')}>
            <Plus size={iconSize} />
            新增配置
          </button>
        </div>
      </div>

      {error && <Alert kind="danger">{error}</Alert>}

      <LlmRuntimeTruthPanel
        config={runtimeConfig}
        loading={runtimeLoading}
        error={runtimeError}
        onRefresh={() => void loadRuntimeConfig()}
      />

      {primaryCard}

      <div data-testid="superadmin-llm-config-table-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>模型配置</div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 22,
              height: 20,
              borderRadius: 999,
              padding: '0 7px',
              fontSize: 12,
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
            }}
          >
            {items.length}
          </span>
        </div>
        {items.length === 0 && !loading && (
          <div
            style={{
              border: '1px dashed var(--border-subtle)',
              borderRadius: 12,
              padding: 24,
              color: 'var(--text-muted)',
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            暂无配置
          </div>
        )}
        {items.length > 0 && (
          <LlmConfigTable
            items={items}
            busyId={busyId}
            onEdit={openEdit}
            onToggleEnabled={setEnabled}
            onToggleThinking={setThinkingMode}
            onSetDefault={setDefault}
            onDelete={removeConfig}
          />
        )}
        {loading && items.length === 0 && (
          <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
            加载中...
          </div>
        )}
      </div>

      {drawer && renderDrawer()}
    </div>
  );
};

export default SuperAdminLlmConfigPanel;
