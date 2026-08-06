import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Loader2, RefreshCw, Save, Trash2, XCircle } from 'lucide-react';
import {
  agentChannelsApi,
  type AgentChannel,
  type AgentChannelConfig,
  type AgentChannelConnectionMode,
  type AgentChannelProvider,
} from '../../../api/agentChannels';
import { ApiError } from '../../../lib/api';
import { toast } from '../../../utils/toast';
import addIcon from '../../../assets/icons/admin/add.svg';
import closeIcon from '../../../assets/icons/file-panel/close.svg';
import { MossSwitch } from '../../../components/common/MossSwitch';
import { RefreshIconButton } from '../../../components/common/RefreshIconButton';
import drawerStyles from '../../../components/Workspace/WorkspaceDrawer.module.css';

interface OpenIntegrationPanelProps {
  agentId: string;
}

type ProviderMeta = {
  provider: AgentChannelProvider;
  label: string;
  defaultMode: AgentChannelConnectionMode;
};

type FormState = {
  id?: string;
  provider: AgentChannelProvider;
  name: string;
  welcomeEnabled: boolean;
  welcomeContent: string;
  appId: string;
  appSecret: string;
  appSecretConfigured: boolean;
  botId: string;
  secret: string;
  secretConfigured: boolean;
  dingtalkCardTemplateId: string;
};

const PROVIDERS: ProviderMeta[] = [
  { provider: 'feishu', label: '飞书', defaultMode: 'stream' },
  { provider: 'dingtalk', label: '钉钉', defaultMode: 'stream' },
  { provider: 'wework', label: '企业微信', defaultMode: 'websocket' },
];

const DEFAULT_WELCOME_CONTENT = '欢迎使用 Moss。我可以帮你查询信息、分析问题、处理工作任务。你可以直接发送问题开始使用。';
const ROBOT_ALREADY_BOUND_MESSAGE = '该机器人已被其他智能体绑定，请先停用或删除原渠道后再绑定';
const FEISHU_CREDENTIAL_ERROR_PREFIX = '飞书凭证校验失败';
const DINGTALK_CREDENTIAL_ERROR_PREFIX = '钉钉凭证校验失败';
const WEWORK_CREDENTIAL_ERROR_PREFIX = '企业微信凭证校验失败';
const PANEL_TOAST_OPTIONS = {
  position: 'top-right' as const,
  style: { marginTop: 56 },
};

const emptyForm = (provider: AgentChannelProvider): FormState => ({
  provider,
  name: `${providerLabel(provider)}开放集成`,
  welcomeEnabled: isWelcomeConfigSupported(provider),
  welcomeContent: DEFAULT_WELCOME_CONTENT,
  appId: '',
  appSecret: '',
  appSecretConfigured: false,
  botId: '',
  secret: '',
  secretConfigured: false,
  dingtalkCardTemplateId: '',
});

function providerMeta(provider: AgentChannelProvider): ProviderMeta {
  return PROVIDERS.find(item => item.provider === provider) ?? PROVIDERS[0];
}

function showPanelSuccess(message: string): void {
  toast.success(message, PANEL_TOAST_OPTIONS);
}

function showPanelError(message: string): void {
  toast.error(message, PANEL_TOAST_OPTIONS);
}

function providerLabel(provider: AgentChannelProvider | string): string {
  return PROVIDERS.find(item => item.provider === provider)?.label ?? provider;
}

function formatMode(mode?: string): string {
  const labels: Record<string, string> = {
    sdk: 'SDK',
    stream: '长连接',
    websocket: 'WebSocket',
    webhook: 'HTTP 回调',
  };
  return labels[mode || ''] ?? (mode || '-');
}

function formatRuntimeState(state?: string): string {
  const labels: Record<string, string> = {
    running: '已连接',
    starting: '连接中',
    reconnecting: '重连中',
    failed: '连接失败',
    standby: '已启用',
    stopped: '未连接',
    missing_credentials: '未配置',
    inactive: '已停用',
    not_managed: '未托管',
    unknown: '未知',
  };
  return labels[state || ''] ?? (state || '未知');
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function isGenericConflictMessage(message: string, statusText: string): boolean {
  const text = message.trim();
  return !text
    || /^conflict$/i.test(text)
    || text === statusText
    || /^请求失败[:：]\s*409$/.test(text);
}

function saveErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 409 && isGenericConflictMessage(error.message, error.statusText)) {
    return ROBOT_ALREADY_BOUND_MESSAGE;
  }
  if (error instanceof ApiError && error.status === 400 && error.message.includes(FEISHU_CREDENTIAL_ERROR_PREFIX)) {
    return localizeFeishuCredentialError(error.message);
  }
  if (error instanceof ApiError && error.status === 400 && error.message.includes(DINGTALK_CREDENTIAL_ERROR_PREFIX)) {
    return localizeDingTalkCredentialError(error.message);
  }
  if (error instanceof ApiError && error.status === 400 && error.message.includes(WEWORK_CREDENTIAL_ERROR_PREFIX)) {
    return localizeWeWorkCredentialError(error.message);
  }
  return error instanceof Error ? error.message : '开放集成保存失败';
}

function localizeFeishuCredentialError(_message: string): string {
  return '飞书凭证校验失败，请检查 App ID 和 App Secret 是否正确，并确认应用凭证仍然有效。';
}

function localizeDingTalkCredentialError(_message: string): string {
  return '钉钉凭证校验失败，请检查 App Key 和 App Secret 是否正确，并确认应用凭证仍然有效。';
}

function localizeWeWorkCredentialError(_message: string): string {
  return '企业微信凭证校验失败，请检查 Bot ID 和 Secret 是否正确，并确认机器人凭证仍然有效。';
}

function credentialSuccessMessage(provider: AgentChannelProvider): string {
  return `开放集成已保存，${providerLabel(provider)}鉴权已通过，长连接将自动启动`;
}

function readCredential(config: AgentChannelConfig, key: string): string {
  const value = config.credentials?.[key];
  return typeof value === 'string' ? value : '';
}

function readFirstCredential(config: AgentChannelConfig, ...keys: string[]): string {
  for (const key of keys) {
    const value = readCredential(config, key);
    if (value) return value;
  }
  return '';
}

function hasConfiguredCredential(config: AgentChannelConfig, ...keys: string[]): boolean {
  return keys.some(key => Boolean(readCredential(config, key)));
}

function secretPlaceholder(configured: boolean): string {
  return configured ? '********' : '留空不覆盖';
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function isWelcomeConfigSupported(provider: AgentChannelProvider): boolean {
  return provider !== 'dingtalk';
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function dingtalkCardTemplateId(config: AgentChannelConfig): string {
  return stringValue(
    config.dingtalk_card_template_id
      ?? config.ai_card?.template_id
      ?? config.ai_card?.card_template_id
  );
}

function toProvider(value: string): AgentChannelProvider {
  return PROVIDERS.some(item => item.provider === value) ? value as AgentChannelProvider : 'feishu';
}

function toTestIdSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function channelToForm(channel: AgentChannel): FormState {
  const provider = toProvider(channel.channel_type || channel.provider || 'feishu');
  const config = channel.config;
  const welcomeEnabled = config.welcome?.enabled ?? config.welcome_enabled;
  const welcomeContent = config.welcome?.content ?? config.welcome_content;
  const supportsWelcome = isWelcomeConfigSupported(provider);
  return {
    id: channel.id,
    provider,
    name: channel.name || `${providerLabel(provider)}开放集成`,
    welcomeEnabled: supportsWelcome ? booleanValue(welcomeEnabled, true) : false,
    welcomeContent: stringValue(welcomeContent, DEFAULT_WELCOME_CONTENT),
    appId: readFirstCredential(config, 'app_id', 'client_id', 'app_key', 'token'),
    appSecret: '',
    appSecretConfigured: hasConfiguredCredential(config, 'app_secret', 'client_secret', 'secret'),
    botId: readCredential(config, 'bot_id'),
    secret: '',
    secretConfigured: hasConfiguredCredential(config, 'secret'),
    dingtalkCardTemplateId: dingtalkCardTemplateId(config),
  };
}

function buildConfig(form: FormState): AgentChannelConfig {
  const credentials: Record<string, unknown> = {};
  if (form.provider === 'feishu') {
    if (form.appId.trim()) credentials.app_id = form.appId.trim();
    if (form.appSecret.trim()) credentials.app_secret = form.appSecret.trim();
  }
  if (form.provider === 'dingtalk') {
    if (form.appId.trim()) credentials.app_key = form.appId.trim();
    if (form.appSecret.trim()) credentials.app_secret = form.appSecret.trim();
  }
  if (form.provider === 'wework') {
    if (form.botId.trim()) credentials.bot_id = form.botId.trim();
    if (form.secret.trim()) credentials.secret = form.secret.trim();
  }

  const config: AgentChannelConfig = {
    provider: form.provider,
    enabled: true,
    connection_mode: providerMeta(form.provider).defaultMode,
    credentials,
    ...(form.provider === 'dingtalk' && form.dingtalkCardTemplateId.trim()
      ? { dingtalk_card_template_id: form.dingtalkCardTemplateId.trim() }
      : {}),
  };
  if (isWelcomeConfigSupported(form.provider)) {
    config.welcome = {
      enabled: form.welcomeEnabled,
      content: form.welcomeContent.trim() || undefined,
    };
  }
  return config;
}

function belongsToAgent(channel: AgentChannel, agentId: string): boolean {
  return channel.agent_id === agentId;
}

function upsertAgentChannel(items: AgentChannel[], channel: AgentChannel, agentId: string): AgentChannel[] {
  const scoped = items.filter(item => belongsToAgent(item, agentId));
  if (!belongsToAgent(channel, agentId)) return scoped;
  const exists = scoped.some(item => item.id === channel.id);
  return exists ? scoped.map(item => item.id === channel.id ? channel : item) : [channel, ...scoped];
}

export const OpenIntegrationPanel: React.FC<OpenIntegrationPanelProps> = ({ agentId }) => {
  const [channels, setChannels] = useState<AgentChannel[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<AgentChannelProvider>('feishu');
  const [editing, setEditing] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadSeq = useRef(0);

  const loadChannels = useCallback(async () => {
    const seq = ++loadSeq.current;
    const currentAgentId = agentId;
    setLoading(true);
    setError(null);
    try {
      const rows = await agentChannelsApi.list(currentAgentId);
      if (seq !== loadSeq.current) return;
      setChannels(rows.filter(channel => belongsToAgent(channel, currentAgentId)));
    } catch (err) {
      if (seq === loadSeq.current) {
        setError(err instanceof Error ? err.message : '开放集成加载失败');
      }
    } finally {
      if (seq === loadSeq.current) {
        setLoading(false);
      }
    }
  }, [agentId]);

  useEffect(() => {
    setEditing(null);
    setChannels([]);
    void loadChannels();
  }, [loadChannels]);

  const providerChannels = useMemo(
    () => channels.filter(channel => belongsToAgent(channel, agentId) && (channel.channel_type === selectedProvider || channel.provider === selectedProvider)),
    [agentId, channels, selectedProvider],
  );

  const saveForm = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      showPanelError('渠道名称不能为空');
      return;
    }
    setSaving(true);
    let savedChannel: AgentChannel | null = null;
    try {
      const config = buildConfig(editing);
      const saved = editing.id
        ? await agentChannelsApi.patch(agentId, editing.id, { name: editing.name.trim(), config })
        : await agentChannelsApi.create({
          agent_id: agentId,
          channel_type: editing.provider,
          name: editing.name.trim(),
          config,
        });
      savedChannel = saved;
      setChannels(current => upsertAgentChannel(current, saved, agentId));
      setSelectedProvider(editing.provider);
      setEditing(null);
      showPanelSuccess(credentialSuccessMessage(editing.provider));
    } catch (err) {
      const channel = savedChannel;
      if (channel) {
        setChannels(current => upsertAgentChannel(current, channel, agentId));
        setEditing(null);
      }
      showPanelError(channel ? (err instanceof Error ? err.message : '开放集成校验失败') : saveErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const patchActive = async (channel: AgentChannel, active: boolean) => {
    try {
      const saved = await agentChannelsApi.patch(agentId, channel.id, { is_active: active, config: { enabled: active } });
      setChannels(current => current
        .filter(item => belongsToAgent(item, agentId))
        .map(item => item.id === channel.id && belongsToAgent(saved, agentId) ? saved : item));
      showPanelSuccess(active ? '渠道已启用' : '渠道已停用');
    } catch (err) {
      showPanelError(err instanceof Error ? err.message : '渠道状态更新失败');
    }
  };

  const removeChannel = async (channel: AgentChannel) => {
    if (!window.confirm(`删除「${channel.name}」？`)) return;
    try {
      await agentChannelsApi.delete(agentId, channel.id);
      setChannels(current => current.filter(item => belongsToAgent(item, agentId) && item.id !== channel.id));
      showPanelSuccess('渠道已删除');
    } catch (err) {
      showPanelError(err instanceof Error ? err.message : '渠道删除失败');
    }
  };

  const regenerateToken = async (channel: AgentChannel) => {
    try {
      const saved = await agentChannelsApi.regenerateToken(agentId, channel.id);
      setChannels(current => current
        .filter(item => belongsToAgent(item, agentId))
        .map(item => item.id === channel.id && belongsToAgent(saved, agentId) ? saved : item));
      showPanelSuccess('Token 已重新生成');
    } catch (err) {
      showPanelError(err instanceof Error ? err.message : 'Token 重新生成失败');
    }
  };

  return (
    <div
      data-testid="open-integration-panel"
      style={{
      background: 'var(--bg-primary)',
      padding: '12px 20px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      <div data-testid="open-integration-panel-header" style={panelToolbarStyle}>
        <button
          type="button"
          onClick={() => setEditing(emptyForm('feishu'))}
          data-testid="open-integration-create-button"
          style={addChannelButtonStyle}
        >
          <img src={addIcon} alt="" aria-hidden="true" style={addChannelIconStyle} />
          新增渠道
        </button>
        <div style={panelToolbarMetaStyle}>
          <RefreshIconButton
            onClick={() => void loadChannels()}
            aria-label="刷新"
            loading={loading}
          />
        </div>
      </div>

      <div role="tablist" aria-label="开放集成渠道" data-testid="open-integration-provider-tabs" style={providerTabsStyle}>
        {PROVIDERS.map(item => {
          const active = item.provider === selectedProvider;
          return (
            <button
              key={item.provider}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setSelectedProvider(item.provider);
                setEditing(null);
              }}
              style={{
                ...providerTabStyle,
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottomColor: active ? 'var(--text-primary)' : 'transparent',
                fontWeight: active ? 600 : 500,
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ padding: 10, borderRadius: 8, border: '1px solid var(--danger-border-soft)', background: 'var(--danger-bg-soft)', color: 'var(--danger)', fontSize: 12 }}>
          {error}
        </div>
      )}

      {editing && (
        <ChannelFormModal
          form={editing}
          saving={saving}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={() => void saveForm()}
        />
      )}

      <div data-testid="open-integration-channel-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>加载中...</div>}
        {!loading && providerChannels.length === 0 && !editing && (
          <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: 13 }}>
            暂无{providerLabel(selectedProvider)}渠道。
          </div>
        )}
        {providerChannels.map(channel => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            onEdit={() => setEditing(channelToForm(channel))}
            onActiveChange={(active) => void patchActive(channel, active)}
            onDelete={() => void removeChannel(channel)}
            onRegenerateToken={() => void regenerateToken(channel)}
          />
        ))}
      </div>
    </div>
  );
};

const ChannelFormModal: React.FC<{
  form: FormState;
  saving: boolean;
  onChange: (form: FormState) => void;
  onCancel: () => void;
  onSave: () => void;
}> = ({ form, saving, onChange, onCancel, onSave }) => {
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => onChange({ ...form, [key]: value });
  const setProvider = (provider: AgentChannelProvider) => {
    if (provider === form.provider) return;
    onChange(emptyForm(provider));
  };
  const welcomeSupported = isWelcomeConfigSupported(form.provider);
  const title = form.id ? '编辑渠道' : '新增渠道';
  return createPortal(
    <div
      data-testid="channel-form-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      style={modalBackdropStyle}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="channel-form-modal"
        style={modalShellStyle}
      >
        <header data-testid="open-integration-form-header" style={modalHeaderStyle}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
          <button
            type="button"
            onClick={onCancel}
            className={drawerStyles.iconBtn}
            title="关闭"
            aria-label="关闭"
          >
            <img src={closeIcon} alt="" aria-hidden="true" className={drawerStyles.headerActionIcon} />
          </button>
        </header>
        <div style={modalBodyStyle}>
          <div style={channelFormFieldsStyle}>
            {!form.id && (
              <ProviderRadioGroup
                value={form.provider}
                onChange={setProvider}
              />
            )}
            <Field label="渠道名称">
              <input value={form.name} onChange={(event) => set('name', event.target.value)} style={inputStyle} />
            </Field>
            {form.provider === 'feishu' && (
              <>
                <Field label="App ID"><input value={form.appId} onChange={(event) => set('appId', event.target.value)} style={inputStyle} /></Field>
                <Field label="App Secret"><input value={form.appSecret} onChange={(event) => set('appSecret', event.target.value)} type="password" placeholder={secretPlaceholder(form.appSecretConfigured)} style={inputStyle} /></Field>
              </>
            )}
            {form.provider === 'dingtalk' && (
              <>
                <Field label="App Key"><input value={form.appId} onChange={(event) => set('appId', event.target.value)} style={inputStyle} /></Field>
                <Field label="App Secret"><input value={form.appSecret} onChange={(event) => set('appSecret', event.target.value)} type="password" placeholder={secretPlaceholder(form.appSecretConfigured)} style={inputStyle} /></Field>
                <Field label="AI 卡片模板 ID">
                  <input
                    value={form.dingtalkCardTemplateId}
                    onChange={(event) => set('dingtalkCardTemplateId', event.target.value)}
                    placeholder="请输入钉钉卡片平台模板 ID"
                    style={inputStyle}
                  />
                </Field>
              </>
            )}
            {form.provider === 'wework' && (
              <>
                <Field label="Bot ID"><input value={form.botId} onChange={(event) => set('botId', event.target.value)} style={inputStyle} /></Field>
                <Field label="Secret"><input value={form.secret} onChange={(event) => set('secret', event.target.value)} type="password" placeholder={secretPlaceholder(form.secretConfigured)} style={inputStyle} /></Field>
              </>
            )}
            {welcomeSupported && (
              <div style={advancedPanelStyle}>
                <ToggleRow
                  label="启用欢迎语"
                  checked={form.welcomeEnabled}
                  onChange={(value) => set('welcomeEnabled', value)}
                />
                {form.welcomeEnabled && (
                  <Field label="欢迎语">
                    <textarea
                      value={form.welcomeContent}
                      onChange={(event) => set('welcomeContent', event.target.value)}
                      style={textareaStyle}
                      rows={3}
                    />
                  </Field>
                )}
              </div>
            )}
          </div>
        </div>
        <footer style={modalFooterStyle}>
          <button type="button" onClick={onCancel} style={modalSecondaryButtonStyle}>取消</button>
          <button type="button" onClick={onSave} disabled={saving} style={modalPrimaryButtonStyle(saving)}>
            {saving ? <Loader2 size={14} /> : <Save size={14} />}
            保存
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};

const ChannelCard: React.FC<{
  channel: AgentChannel;
  onEdit: () => void;
  onActiveChange: (active: boolean) => void;
  onDelete: () => void;
  onRegenerateToken: () => void;
}> = ({ channel, onEdit, onActiveChange, onDelete, onRegenerateToken }) => {
  const runtimeStatus = channel.runtime_status;
  const runtimeState = runtimeStatus?.state || (channel.is_active ? 'unknown' : 'inactive');
  const runtimeMode = runtimeStatus?.mode || channel.config.connection_mode;
  const lastError = runtimeStatus?.last_error || runtimeStatus?.reason || channel.config.last_error;
  const isWebhookMode = runtimeMode === 'webhook' || channel.config.connection_mode === 'webhook';
  return (
    <div
      className="open-integration-channel-card"
      data-testid={`open-integration-channel-${channel.id}`}
      style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'var(--bg-secondary)', padding: 12 }}
    >
      <div className="open-integration-channel-card-header" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <StatusIcon active={channel.is_active} hasError={Boolean(lastError)} />
        <div className="open-integration-channel-card-content" style={{ flex: 1, minWidth: 0 }}>
          <div className="open-integration-channel-card-title-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{channel.name}</div>
            <span style={{
              flexShrink: 0,
              fontSize: 12,
              color: channel.is_active ? 'var(--success)' : 'var(--text-muted)',
              background: channel.is_active ? 'var(--success-bg-soft)' : 'var(--bg-tertiary)',
              border: `1px solid ${channel.is_active ? 'var(--success-border-soft)' : 'var(--border-subtle)'}`,
              borderRadius: 999,
              padding: '2px 7px',
            }}>
              {channel.is_active ? '启用' : '停用'}
            </span>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            {formatMode(runtimeMode)} · {formatRuntimeState(runtimeState)}
          </div>
        </div>
        <Toggle checked={channel.is_active} onChange={onActiveChange} testId={`open-integration-channel-toggle-${channel.id}`} />
      </div>
      <div className="open-integration-channel-card-meta" data-testid={`open-integration-channel-meta-${channel.id}`} style={{ marginTop: 10, display: 'grid', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
        <div>运行状态：{formatRuntimeState(runtimeState)}</div>
        <div>接入方式：{formatMode(runtimeMode)}</div>
        {isWebhookMode && <div>回调 Token：{channel.channel_token || '-'}</div>}
        {channel.config.last_connected_at && <div>最近连接：{formatDateTime(channel.config.last_connected_at)}</div>}
        {lastError && <div style={{ color: 'var(--danger)', wordBreak: 'break-word' }}>最近错误：{lastError}</div>}
      </div>
      <div className="open-integration-channel-card-actions" style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" data-testid={`open-integration-channel-edit`} onClick={onEdit} style={secondaryButtonStyle}>编辑</button>
        {isWebhookMode && <button type="button" data-testid={`open-integration-channel-regenerate-token`} onClick={onRegenerateToken} style={secondaryButtonStyle}><RefreshCw size={13} />Token</button>}
        <button type="button" data-testid={`open-integration-channel-delete`} onClick={onDelete} style={{ ...secondaryButtonStyle, color: 'var(--danger)' }}><Trash2 size={13} />删除</button>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
    {label}
    {children}
  </label>
);

const ProviderRadioGroup: React.FC<{ value: AgentChannelProvider; onChange: (provider: AgentChannelProvider) => void }> = ({ value, onChange }) => (
  <div role="radiogroup" aria-label="渠道类型" style={providerRadioGroupStyle}>
    {PROVIDERS.map(item => {
      const checked = value === item.provider;
      return (
        <label key={item.provider} style={providerRadioOptionStyle}>
          <input
            type="radio"
            name="channel-provider"
            value={item.provider}
            checked={checked}
            onChange={() => onChange(item.provider)}
            style={providerRadioInputStyle}
          />
          <span>{item.label}</span>
        </label>
      );
    })}
  </div>
);

const ToggleRow: React.FC<{ label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }> = ({ label, checked, disabled = false, onChange }) => (
  <label
    className="open-integration-toggle-row"
    data-testid={`open-integration-toggle-row-${toTestIdSegment(label)}`}
    style={{ ...toggleRowStyle, ...(disabled ? disabledRowStyle : {}) }}
  >
    <Toggle
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      ariaLabel={label}
      testId={`open-integration-toggle-${toTestIdSegment(label)}`}
    />
    <span>{label}</span>
  </label>
);

const Toggle: React.FC<{
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
  testId?: string;
}> = ({ checked, disabled = false, onChange, ariaLabel, testId }) => (
  <MossSwitch
    checked={checked}
    disabled={disabled}
    ariaLabel={ariaLabel}
    onChange={onChange}
    testId={testId}
  />
);

const StatusIcon: React.FC<{ active: boolean; hasError: boolean }> = ({ active, hasError }) => (
  <div style={{
    width: 28,
    height: 28,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: hasError ? 'var(--danger)' : active ? 'var(--success)' : 'var(--text-muted)',
    background: hasError ? 'var(--danger-bg-soft)' : active ? 'var(--success-bg-soft)' : 'var(--bg-tertiary)',
    flexShrink: 0,
  }}>
    {hasError ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
  </div>
);

const advancedPanelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  paddingTop: 10,
  borderTop: '1px solid var(--border-subtle)',
};

const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1200,
  background: 'var(--modal-backdrop)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const modalShellStyle: React.CSSProperties = {
  width: 640,
  height: 640,
  maxWidth: 'calc(100vw - 32px)',
  maxHeight: 'calc(100vh - 32px)',
  background: 'var(--modal-bg)',
  border: '1px solid var(--modal-border)',
  borderRadius: 12,
  boxShadow: 'var(--modal-shadow)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const modalHeaderStyle: React.CSSProperties = {
  height: 56,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '0 20px',
  borderBottom: '1px solid var(--border-subtle)',
};

const modalBodyStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: 20,
};

const modalFooterStyle: React.CSSProperties = {
  minHeight: 56,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '12px 20px',
  borderTop: '1px solid var(--border-subtle)',
};

const channelFormFieldsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const panelToolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const panelToolbarMetaStyle: React.CSSProperties = {
  marginLeft: 'auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 12,
  minWidth: 0,
  textAlign: 'right',
};

const addChannelButtonStyle: React.CSSProperties = {
  borderRadius: 8,
  border: 'none',
  background: 'var(--text-primary, #0B0B0B)',
  color: 'var(--bg-primary, #fff)',
  cursor: 'pointer',
  height: 36,
  padding: '8px 16px',
  fontSize: 13,
  lineHeight: '18px',
  fontWeight: 500,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
};

const addChannelIconStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  flexShrink: 0,
  display: 'block',
  filter: 'invert(1)',
};

const providerTabsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 20,
  borderBottom: '1px solid var(--border-subtle)',
};

const providerTabStyle: React.CSSProperties = {
  height: 34,
  border: 'none',
  borderBottom: '2px solid transparent',
  background: 'transparent',
  cursor: 'pointer',
  padding: '0 2px',
  fontSize: 13,
};

const providerRadioGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  minHeight: 34,
};

const providerRadioOptionStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 13,
  color: 'var(--text-primary)',
  cursor: 'pointer',
};

const providerRadioInputStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  margin: 0,
  accentColor: 'var(--text-primary, #0B0B0B)',
};

const toggleRowStyle: React.CSSProperties = {
  minHeight: 34,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 12,
  fontSize: 13,
  color: 'var(--text-primary)',
};

const disabledRowStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  cursor: 'not-allowed',
};

const inputStyle: React.CSSProperties = {
  height: 34,
  borderRadius: 8,
  border: '1px solid var(--input-border)',
  background: '#FFFFFF',
  color: 'var(--text-primary)',
  padding: '0 10px',
  outline: 'none',
  fontSize: 13,
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  height: 'auto',
  minHeight: 76,
  padding: 10,
  resize: 'vertical',
  lineHeight: 1.5,
};

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 30,
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  background: '#FFFFFF',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  padding: '0 10px',
  fontSize: 12,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
};

const modalButtonBaseStyle: React.CSSProperties = {
  height: 32,
  borderRadius: 8,
  padding: '0 12px',
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 500,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
};

const modalSecondaryButtonStyle: React.CSSProperties = {
  ...modalButtonBaseStyle,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
};

const modalPrimaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  ...modalButtonBaseStyle,
  border: `1px solid ${disabled ? 'var(--btn-mono-disabled-bg)' : 'var(--btn-mono-bg)'}`,
  background: disabled ? 'var(--btn-mono-disabled-bg)' : 'var(--btn-mono-bg)',
  color: disabled ? 'var(--btn-mono-disabled-text)' : 'var(--btn-mono-text)',
  cursor: disabled ? 'not-allowed' : 'pointer',
});

export default OpenIntegrationPanel;
