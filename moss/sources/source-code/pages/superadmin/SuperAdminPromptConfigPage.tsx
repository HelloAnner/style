import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RotateCcw, Save, Trash2, UploadCloud } from 'lucide-react';
import {
  superAdminApi,
  type SaAnswerScopeConfig,
  type SaPromptConfigAgentOption,
  type SaPromptConfigDetailResponse,
  type SaPromptConfigRuntimeConfig,
} from '../../api/superadmin';
import { SuperAdminConfigShell } from './SuperAdminConfigShell';

function formatTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function baseEditorContent(detail: SaPromptConfigDetailResponse | null): string {
  if (!detail) return '';
  return detail.draftContent || detail.appliedContent || detail.defaultContent || '';
}

const IconButton: React.FC<{
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'warning';
}> = ({ icon, children, onClick, disabled, variant = 'default' }) => (
  <button
    type="button"
    className={`fi-config-button${variant === 'primary' ? ' primary' : ''}${variant === 'warning' ? ' warning' : ''}`}
    onClick={onClick}
    disabled={disabled}
    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
  >
    {icon}
    {children}
  </button>
);

const SuperAdminPromptConfigPage: React.FC = () => {
  const [runtime, setRuntime] = useState<SaPromptConfigRuntimeConfig | null>(null);
  const [agents, setAgents] = useState<SaPromptConfigAgentOption[]>([]);
  const [selectedSlotKey, setSelectedSlotKey] = useState('');
  const [detail, setDetail] = useState<SaPromptConfigDetailResponse | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [answerScopeConfig, setAnswerScopeConfig] = useState<SaAnswerScopeConfig | null>(null);
  const [answerScopePrompt, setAnswerScopePrompt] = useState('');
  const [answerScopeEnabled, setAnswerScopeEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [scopeWorking, setScopeWorking] = useState(false);

  const hasUnsavedLocalEdit = Boolean(detail)
    && editorContent !== baseEditorContent(detail);
  const hasUnsavedScopeEdit = Boolean(answerScopeConfig)
    && (
      answerScopeEnabled !== answerScopeConfig?.enabled
      || answerScopePrompt !== answerScopeConfig?.prompt
    );

  useEffect(() => {
    if (!hasUnsavedLocalEdit && !hasUnsavedScopeEdit) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedLocalEdit, hasUnsavedScopeEdit]);

  const loadAll = useCallback(async (slotKey?: string) => {
    setLoading(true);
    try {
      const [agentOptions, runtimeConfig] = await Promise.all([
        superAdminApi.promptConfigAgents(),
        superAdminApi.promptConfigRuntime(),
      ]);
      const nextSlotKey = slotKey || agentOptions[0]?.slotKey || '';
      if (!nextSlotKey) {
        throw new Error('没有可配置的 Agent');
      }
      const nextDetail = await superAdminApi.promptConfig(nextSlotKey);
      setAgents(agentOptions);
      setSelectedSlotKey(nextSlotKey);
      setDetail(nextDetail);
      setEditorContent(baseEditorContent(nextDetail));
      setRuntime(runtimeConfig);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载 Prompt 配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnswerScope = useCallback(async () => {
    try {
      const scopeConfig = await superAdminApi.answerScopeConfig();
      setAnswerScopeConfig(scopeConfig);
      setAnswerScopeEnabled(scopeConfig.enabled);
      setAnswerScopePrompt(scopeConfig.prompt);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载职责范围配置失败');
    }
  }, []);

  useEffect(() => {
    void loadAll();
    void loadAnswerScope();
  }, [loadAll, loadAnswerScope]);

  const runAction = useCallback(async (action: () => Promise<SaPromptConfigDetailResponse>, success: string) => {
    setWorking(true);
    try {
      const updated = await action();
      const next = detail && !updated.defaultContent
        ? { ...updated, defaultContent: detail.defaultContent }
        : updated;
      setDetail(next);
      setEditorContent(baseEditorContent(next));
      toast.success(success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setWorking(false);
    }
  }, [detail]);

  const saveDraft = useCallback(() => {
    if (!detail) return;
    void runAction(
      () => superAdminApi.savePromptConfigDraft(detail.slotKey, { content: editorContent }),
      '草稿已保存',
    );
  }, [detail, editorContent, runAction]);

  const applyDraft = useCallback(() => {
    if (!detail) return;
    if (hasUnsavedLocalEdit) {
      toast.error('当前编辑内容尚未保存，请先保存草稿再应用');
      return;
    }
    const expectedDraftHash = detail.draftContentHash;
    if (!expectedDraftHash) {
      toast.error('草稿缺少应用校验信息，请刷新后重试');
      return;
    }
    void runAction(
      () => superAdminApi.applyPromptConfigDraft(detail.slotKey, { expectedDraftHash }),
      '已应用到调试；开启调试开关后，新会话将在最多 15 秒内生效',
    );
  }, [detail, hasUnsavedLocalEdit, runAction]);

  const discardDraft = useCallback(() => {
    if (!detail) return;
    if (!window.confirm('确认放弃当前草稿？')) return;
    void runAction(() => superAdminApi.discardPromptConfigDraft(detail.slotKey), '草稿已放弃');
  }, [detail, runAction]);

  const updateRuntime = useCallback((enabled: boolean) => {
    if (enabled && !runtime?.enabled) {
      const confirmed = window.confirm(
        '确认开启 Prompt 调试开关？\n\n开启后，新会话会使用已应用的调试 Prompt。生产环境误开可能影响线上回答效果，请确认当前操作符合预期。',
      );
      if (!confirmed) return;
    }
    setWorking(true);
    void superAdminApi.updatePromptConfigRuntime({ enabled })
      .then((updated) => {
        setRuntime(updated);
        toast.success(enabled ? '调试开关已开启' : '调试开关已关闭，新请求将回退内置 Prompt');
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : '更新运行时开关失败');
      })
      .finally(() => setWorking(false));
  }, [runtime?.enabled]);

  const restoreDefault = useCallback(() => {
    if (!detail) return;
    if (!window.confirm('确认恢复内置 Prompt？当前调试内容会停止生效。')) return;
    void runAction(
      () => superAdminApi.restorePromptConfigDefault(detail.slotKey),
      '已恢复内置 Prompt',
    );
  }, [detail, runAction]);

  const saveAnswerScope = useCallback(() => {
    setScopeWorking(true);
    void superAdminApi.updateAnswerScopeConfig({
      enabled: answerScopeEnabled,
      prompt: answerScopePrompt,
    })
      .then((updated) => {
        setAnswerScopeConfig(updated);
        setAnswerScopeEnabled(updated.enabled);
        setAnswerScopePrompt(updated.prompt);
        toast.success('职责范围配置已保存，新请求将在最多 15 秒内生效');
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : '保存职责范围配置失败');
      })
      .finally(() => setScopeWorking(false));
  }, [answerScopeEnabled, answerScopePrompt]);

  const changeAgent = useCallback((slotKey: string) => {
    if (!slotKey || slotKey === selectedSlotKey) return;
    if (hasUnsavedLocalEdit && !window.confirm('当前编辑内容尚未保存，切换 Agent 会丢失本地修改。确认切换？')) return;
    setSelectedSlotKey(slotKey);
    void loadAll(slotKey);
  }, [hasUnsavedLocalEdit, loadAll, selectedSlotKey]);

  return (
    <SuperAdminConfigShell
      activeKey="prompt-config"
      testId="superadmin-prompt-config-page"
      title="Prompt 调试"
      subtitle="按 Agent 调试最终 System Prompt；开启后，新会话使用当前应用内容"
    >
      <div className="fi-prompt-page-body">
        <div className="fi-prompt-config-layout">
          <section className="fi-config-card fi-prompt-config-card">
            <div className="fi-config-section-header">
              <div>
                <div className="fi-config-section-title">System Prompt</div>
                <div className="fi-config-section-desc">
                  默认内容来自 Kernel 完整拼接并包含内置职责范围；占位符会在真实请求中替换
                </div>
              </div>
              <div className="fi-config-inline-row">
                <span className="fi-config-label">调试开关</span>
                <button
                  type="button"
                  className={`fi-config-toggle${runtime?.enabled ? ' is-on' : ''}`}
                  onClick={() => updateRuntime(!runtime?.enabled)}
                  disabled={loading || working}
                  aria-label={runtime?.enabled ? '关闭调试开关' : '开启调试开关'}
                >
                  <span />
                </button>
              </div>
            </div>

            <div className="fi-prompt-agent-tabs-row">
              <span className="fi-config-label">Agent</span>
              <div className="fi-prompt-agent-tabs" role="tablist" aria-label="Agent">
                {agents.map((agent) => {
                  const active = agent.slotKey === selectedSlotKey;
                  return (
                    <button
                      key={agent.slotKey}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`fi-prompt-agent-tab${active ? ' is-active' : ''}`}
                      onClick={() => changeAgent(agent.slotKey)}
                      disabled={loading || working}
                    >
                      {agent.displayName}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="fi-config-field fi-prompt-editor-field">
              <span className="fi-config-label">Prompt 内容</span>
              <span className="fi-config-section-desc">
                可直接修改文本；删除形如 {'{{enterprise_context}}'} 的占位符后，对应动态内容不会注入最终 Prompt。
              </span>
              <textarea
                className="fi-config-textarea fi-prompt-textarea"
                value={editorContent}
                onChange={(event) => setEditorContent(event.target.value)}
                disabled={!detail || working}
                spellCheck={false}
                style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', lineHeight: 1.55 }}
              />
            </label>

            <div className="fi-config-footer fi-prompt-config-footer">
              <div className="fi-config-updated-at">
                {detail?.draftUpdatedAt
                  ? `草稿更新：${formatTime(detail.draftUpdatedAt)}`
                  : hasUnsavedLocalEdit
                    ? '本地有未保存修改'
                    : '无草稿'}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <IconButton icon={<Save size={14} />} onClick={saveDraft} disabled={!detail || working || !editorContent.trim()} variant="primary">
                  保存草稿
                </IconButton>
                <IconButton
                  icon={<UploadCloud size={14} />}
                  onClick={applyDraft}
                  disabled={!detail?.draftContent || hasUnsavedLocalEdit || !detail.draftContentHash || working}
                  variant="primary"
                >
                  应用到调试
                </IconButton>
                <IconButton
                  icon={<RotateCcw size={14} />}
                  onClick={restoreDefault}
                  disabled={!detail || working || !detail.enabled}
                  variant="warning"
                >
                  恢复内置
                </IconButton>
                <IconButton icon={<Trash2 size={14} />} onClick={discardDraft} disabled={!detail?.draftContent || working} variant="warning">
                  放弃草稿
                </IconButton>
              </div>
            </div>

            <section className="fi-config-section fi-prompt-scope-section">
              <div className="fi-config-section-header">
                <div>
                  <div className="fi-config-section-title">职责范围 Prompt</div>
                  <div className="fi-config-section-desc">
                    仅在主 Prompt 调试未命中时参与正常 Prompt 拼接；关闭后完全不注入回答范围
                  </div>
                </div>
                <div className="fi-config-inline-row">
                  <span className="fi-config-label">启用职责范围</span>
                  <button
                    type="button"
                    className={`fi-config-toggle${answerScopeEnabled ? ' is-on' : ''}`}
                    onClick={() => setAnswerScopeEnabled((enabled) => !enabled)}
                    disabled={!answerScopeConfig || scopeWorking}
                    aria-label={answerScopeEnabled ? '关闭职责范围' : '开启职责范围'}
                  >
                    <span />
                  </button>
                </div>
              </div>
              <label className="fi-config-field">
                <span className="fi-config-label">职责范围内容</span>
                {runtime?.enabled && detail?.enabled && (
                  <span className="fi-config-section-desc">
                    当前 Agent 已命中主 Prompt 调试模板，本配置暂不参与运行。
                  </span>
                )}
                <textarea
                  className="fi-config-textarea fi-prompt-scope-textarea"
                  value={answerScopePrompt}
                  onChange={(event) => setAnswerScopePrompt(event.target.value)}
                  disabled={!answerScopeConfig || scopeWorking}
                  spellCheck={false}
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', lineHeight: 1.55 }}
                />
              </label>
              <div className="fi-config-footer">
                <div className="fi-config-updated-at">
                  {hasUnsavedScopeEdit
                    ? '职责范围有未保存修改'
                    : `最近更新：${formatTime(answerScopeConfig?.updatedAt)}`}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <IconButton
                    icon={<RotateCcw size={14} />}
                    onClick={() => setAnswerScopePrompt(answerScopeConfig?.defaultPrompt || '')}
                    disabled={!answerScopeConfig || scopeWorking || answerScopePrompt === answerScopeConfig.defaultPrompt}
                  >
                    恢复默认内容
                  </IconButton>
                  <IconButton
                    icon={<Save size={14} />}
                    onClick={saveAnswerScope}
                    disabled={
                      !answerScopeConfig
                      || scopeWorking
                      || !hasUnsavedScopeEdit
                      || (answerScopeEnabled && !answerScopePrompt.trim())
                    }
                    variant="primary"
                  >
                    保存职责范围
                  </IconButton>
                </div>
              </div>
            </section>
          </section>
        </div>
      </div>
    </SuperAdminConfigShell>
  );
};

export default SuperAdminPromptConfigPage;
