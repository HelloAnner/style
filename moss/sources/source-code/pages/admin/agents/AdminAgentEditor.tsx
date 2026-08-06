import React, { useEffect, useMemo, useState } from 'react';
import { kernelApiFetch } from '../../../api/gateway';
import { agentApi } from '../../../api/platform';
import { putAgentSkillBindings, putAgentToolBindings } from '../../../api/platformAgent';
import type { Agent } from '../../../types/platform';
import { getAgentDisplayName } from '../../../types/platform';
import { SidebarAgentIcon } from '../../../components/Sidebar/SidebarAgentIcon';
import { track } from '../../../utils/track';
import { toast } from '../../../utils/toast';
import { isDefaultAgentsMdTemplate } from '../../../utils/agentsMd';
import { AdminCapabilityPanel, type AdminCapabilityPayload } from './AdminCapabilityPanel';
import OpenIntegrationPanel from './OpenIntegrationPanel';
import closeIcon from '../../../assets/icons/file-panel/close.svg';
import drawerStyles from '../../../components/Workspace/WorkspaceDrawer.module.css';

interface AdminAgentEditorProps {
  agent: Agent;
  onBack: () => void;
  onSaved: (agent: Agent) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const ArrowLeftIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

export const AdminAgentEditor: React.FC<AdminAgentEditorProps> = ({ agent, onBack, onSaved, onDirtyChange }) => {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [initialSystemPromptValue, setInitialSystemPromptValue] = useState('');
  const [kernelPrompt, setKernelPrompt] = useState('');
  const [defaultPromptTemplate, setDefaultPromptTemplate] = useState('');
  const [pendingBindings, setPendingBindings] = useState<AdminCapabilityPayload | null>(null);
  const [integrationOpen, setIntegrationOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const promptEditable = agent.editable !== false;
  const capabilityEditable = agent.capabilityEditable !== false;

  useEffect(() => {
    track('agent_edit', { agent_id: agent.id });
    const content = agent.agents_md || '';
    setSystemPrompt(content);
    setInitialSystemPromptValue(content);
    setPendingBindings(null);
    setError(null);
  }, [agent.id]);

  useEffect(() => {
    (async () => {
      try {
        const templateResponse = await kernelApiFetch(`/api/v1/agents/${agent.id}/agents-md`);
        if (templateResponse.ok) {
          const data = await templateResponse.json();
          const template = data.default_agents_md_template || '';
          const content = typeof data.content === 'string' ? data.content : template;
          setKernelPrompt(data.kernel_prompt_preview || '');
          setDefaultPromptTemplate(template);
          setSystemPrompt(content);
          setInitialSystemPromptValue(content);
        }
      } catch {
        setKernelPrompt('');
        setDefaultPromptTemplate('');
      }
    })();
  }, [agent.id]);

  const promptDirty = useMemo(() => {
    const currentRaw = systemPrompt.trim();
    const initialRaw = initialSystemPromptValue.trim();

    if (!currentRaw && isDefaultAgentsMdTemplate(initialSystemPromptValue, defaultPromptTemplate)) {
      return true;
    }

    return currentRaw !== initialRaw;
  }, [defaultPromptTemplate, initialSystemPromptValue, systemPrompt]);

  const dirty = (promptEditable && promptDirty) || (capabilityEditable && Boolean(pendingBindings?.hasChanges));

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => () => {
    onDirtyChange?.(false);
  }, [onDirtyChange]);

  const handlePromptChange = (value: string) => {
    if (!promptEditable) return;
    setSystemPrompt(value);
  };

  const handleBindingChange = (payload: AdminCapabilityPayload) => {
    if (!capabilityEditable) return;
    setPendingBindings(payload.hasChanges ? payload : null);
  };

  const handlePublish = async () => {
    if (!dirty) return;
    track('publish_update');
    setSaving(true);
    setError(null);
    try {
      let saved = agent;
      if (promptEditable && promptDirty) {
        saved = await agentApi.update(agent.id, {
          agents_md: systemPrompt,
        });
      }
      if (capabilityEditable && pendingBindings?.hasChanges) {
        await Promise.all([
          putAgentSkillBindings(agent.id, pendingBindings.skillItems),
          putAgentToolBindings(agent.id, pendingBindings.toolItems),
        ]);
      }
      setInitialSystemPromptValue(systemPrompt);
      setPendingBindings(null);
      onSaved(saved);
      toast.success('智能体配置已发布');
    } catch (err) {
      const message = err instanceof Error ? err.message : '发布失败';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      data-testid="admin-agent-editor"
      style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}
    >
      <header
        data-testid="admin-agent-editor-header"
        style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 24px',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        <button type="button" onClick={onBack} data-testid="admin-agent-editor-back" style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: 6 }}>
          <ArrowLeftIcon />
        </button>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 0 1px rgba(9,30,64,0.02), 0 4px 4px rgba(9,30,64,0.06), 0 4px 12px rgba(9,30,64,0.04)',
        }}>
          <SidebarAgentIcon agent={agent} size={24} testId="admin-agent-editor-agent-icon" />
        </div>
        <div data-testid="admin-agent-editor-agent-name" style={{ fontSize: 15, fontWeight: 600 }}>{getAgentDisplayName(agent)}</div>
        <span data-testid="admin-agent-editor-publish-status" style={{
          fontSize: 12,
          lineHeight: '20px',
          color: dirty ? 'var(--text-tertiary)' : 'var(--success)',
          background: dirty ? 'var(--bg-tertiary)' : 'var(--success-bg-soft)',
          border: `1px solid ${dirty ? 'var(--border-subtle)' : 'var(--success-border-soft)'}`,
          borderRadius: 4,
          padding: '0 6px',
        }}>
          {dirty ? '未发布' : '已发布'}
        </span>
        {agent.lockedReason && (
          <span data-testid="admin-agent-editor-locked-reason" style={{ fontSize: 12, color: 'var(--warning)', background: 'var(--warning-bg-soft)', borderRadius: 999, padding: '3px 9px' }}>
            {agent.lockedReason}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {error && <span data-testid="admin-agent-editor-error" style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</span>}
        <button type="button" data-testid="admin-agent-editor-open-integration" onClick={() => {
          track('open_integration');
          setIntegrationOpen(true);
        }} style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          padding: '8px 14px',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
        }}>
          开放集成
        </button>
        <button type="button" data-testid="admin-agent-editor-publish" onClick={handlePublish} disabled={saving || !dirty} style={{
          border: 'none',
          borderRadius: 8,
          background: 'var(--btn-primary-bg)',
          color: 'var(--btn-primary-text)',
          padding: '8px 16px',
          cursor: saving || !dirty ? 'not-allowed' : 'pointer',
          opacity: saving || !dirty ? 0.55 : 1,
          fontSize: 13,
          fontWeight: 500,
        }}>
          {saving ? '发布中...' : '发布更新'}
        </button>
      </header>
      <div data-testid="admin-agent-editor-body" style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        <main
          data-testid="admin-agent-editor-main"
          style={{ flex: 1, minWidth: 0, minHeight: 0, padding: 24, overflow: 'hidden', display: 'flex' }}
        >
          <section
            data-testid="admin-agent-editor-prompt-panel"
            style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 12,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            padding: 16,
          }}>
            <div data-testid="admin-agent-editor-prompt-panel-header" style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>系统提示词</div>
            <div
              data-testid="admin-agent-editor-prompt-editor"
              style={{
                flex: 1,
                minHeight: 0,
                border: '1px solid var(--studio-editor-border)',
                borderRadius: 10,
                background: 'var(--studio-editor-bg)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <div
                data-testid="admin-agent-editor-prompt-editor-content"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <div
                  data-testid="admin-agent-editor-prompt-kernel-block"
                  style={{
                    flexGrow: 2,
                    flexShrink: 1,
                    flexBasis: 0,
                    minHeight: 140,
                    border: '1px solid var(--studio-prompt-block-border)',
                    borderRadius: 14,
                    background: 'var(--studio-prompt-block-bg)',
                    color: 'var(--studio-prompt-block-text)',
                    padding: '18px 20px',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    fontSize: 13,
                    lineHeight: 1.8,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    marginBottom: 18,
                  }}
                >
                  <div data-testid="admin-agent-editor-prompt-kernel-block-title" style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--studio-prompt-block-title)' }}>
                    内置提示词
                  </div>
                  <div data-testid="admin-agent-editor-prompt-kernel-block-content">
                    {kernelPrompt || '加载中...'}
                  </div>
                </div>
                <textarea
                  data-testid="admin-agent-editor-prompt-textarea"
                  value={systemPrompt}
                  onChange={(event) => handlePromptChange(event.target.value)}
                  disabled={!promptEditable}
                  placeholder={defaultPromptTemplate || '请输入企业个性化配置'}
                  style={{
                    flexGrow: 3,
                    flexShrink: 1,
                    flexBasis: 0,
                    minHeight: 0,
                    overflowY: 'auto',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--studio-editor-text)',
                    padding: '4px 8px 8px',
                    resize: 'none',
                    outline: 'none',
                    cursor: promptEditable ? 'text' : 'not-allowed',
                    opacity: promptEditable ? 1 : 0.65,
                    fontSize: 13,
                    lineHeight: 1.8,
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>
          </section>
        </main>
        <AdminCapabilityPanel agentId={agent.id} disabled={!capabilityEditable} onChange={handleBindingChange} />
      </div>
      {integrationOpen && (
        <div
          data-testid="admin-agent-editor-integration-dialog"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--modal-backdrop)',
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'flex-end',
            zIndex: 1000,
          }}
        >
          <div
            data-testid="admin-agent-editor-integration-dialog-panel"
            style={{
            width: 'min(760px, 100%)',
            height: '100%',
            background: 'var(--bg-primary)',
            borderLeft: '1px solid var(--border-subtle)',
            boxShadow: 'var(--modal-shadow)',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              height: 56,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '0 20px',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div data-testid="admin-agent-editor-integration-dialog-header" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>开放集成配置</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    配置应用凭证后，系统自动使用长连接接收消息。
                  </span>
                  <button
                    type="button"
                    className="integration-config-help"
                    aria-label="如何配置？"
                    onClick={() => window.open('https://docs.mossdo.com/docs/function/bot-integration', '_blank', 'noopener,noreferrer')}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      color: 'var(--moss-home-title-accent, #D95E3A)',
                      fontSize: 12,
                      lineHeight: '18px',
                      cursor: 'pointer',
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      textDecoration: 'none',
                    }}
                  >
                    <span data-config-help-label>如何配置</span>
                    <span>？</span>
                  </button>
                  <style>
                    {'.integration-config-help:hover [data-config-help-label] { text-decoration: underline; }'}
                  </style>
                </div>
              </div>
              <button
                type="button"
                data-testid="admin-agent-editor-integration-dialog-close"
                onClick={() => setIntegrationOpen(false)}
                className={drawerStyles.iconBtn}
                title="关闭"
                aria-label="关闭"
              >
                <img src={closeIcon} alt="" aria-hidden="true" className={drawerStyles.headerActionIcon} />
              </button>
            </div>
            <div data-testid="admin-agent-editor-integration-dialog-content" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <OpenIntegrationPanel agentId={agent.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAgentEditor;
