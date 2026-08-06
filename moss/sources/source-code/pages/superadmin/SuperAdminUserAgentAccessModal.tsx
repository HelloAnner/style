import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  superAdminApi,
  type SaAccountAgentAccessResponse,
  type SaAccountAgentQuestionMode,
  type SaAccountAgentQuestionSource,
  type SaUserItem,
} from '../../api/superadmin';

interface SuperAdminUserAgentAccessModalProps {
  user: SaUserItem;
  onClose: () => void;
}

const SOURCE_LABELS: Record<SaAccountAgentQuestionSource, string> = {
  default: '默认推荐问',
  generated: '生成推荐问',
  empty: '无推荐问',
  missing: '未开通',
  mixed: '多工作区不一致',
};

const MODE_OPTIONS: Array<{ value: SaAccountAgentQuestionMode; label: string; desc: string }> = [
  { value: 'default', label: '默认推荐问', desc: '仅给未配置推荐问的智能体写入内置固定问题。' },
  { value: 'generated', label: '生成推荐问', desc: '仅给未配置推荐问的智能体按企业资料生成问题。' },
];

export const SuperAdminUserAgentAccessModal: React.FC<SuperAdminUserAgentAccessModalProps> = ({
  user,
  onClose,
}) => {
  const [access, setAccess] = useState<SaAccountAgentAccessResponse | null>(null);
  const [enabledBusinessIds, setEnabledBusinessIds] = useState<Set<string>>(() => new Set());
  const [questionMode, setQuestionMode] = useState<SaAccountAgentQuestionMode>('default');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabledCount = enabledBusinessIds.size;
  const agentCount = access?.agents.length ?? 0;

  const title = useMemo(() => {
    const name = user.nickname || user.phone || user.id;
    return `${name} · 智能体开通`;
  }, [user]);

  const loadAccess = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await superAdminApi.userAgentAccess(user.id);
      setAccess(response);
      setEnabledBusinessIds(new Set(response.agents.filter((item) => item.enabled).map((item) => item.businessId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取智能体状态失败');
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    void loadAccess();
  }, [loadAccess]);

  const toggleAgent = useCallback((businessId: string) => {
    setEnabledBusinessIds((current) => {
      const next = new Set(current);
      if (next.has(businessId)) {
        next.delete(businessId);
      } else {
        next.add(businessId);
      }
      return next;
    });
  }, []);

  const saveAccess = useCallback(async () => {
    if (enabledBusinessIds.size === 0) {
      toast.error('至少保留一个智能体');
      return;
    }
    setSaving(true);
    try {
      const response = await superAdminApi.updateUserAgentAccess(user.id, {
        enabledBusinessIds: Array.from(enabledBusinessIds),
        questionMode,
      });
      setAccess(response);
      setEnabledBusinessIds(new Set(response.agents.filter((item) => item.enabled).map((item) => item.businessId)));
      toast.success('已保存智能体开通状态');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存智能体状态失败');
    } finally {
      setSaving(false);
    }
  }, [enabledBusinessIds, questionMode, user.id]);

  return (
    <div
      data-testid="superadmin-user-agent-access-modal"
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'var(--modal-backdrop)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <section
        data-testid="superadmin-user-agent-access-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(760px, 100%)',
          maxHeight: 'min(720px, calc(100vh - 48px))',
          overflow: 'auto',
          border: '1px solid var(--modal-border)',
          borderRadius: 8,
          background: 'var(--modal-bg)',
          boxShadow: 'var(--modal-shadow)',
          color: 'var(--text-primary)',
        }}
      >
        <header
          data-testid="superadmin-user-agent-access-modal-header"
          style={{
            padding: 18,
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              {user.phone || '-'} · 工作区 {access?.tenantIds.length ?? user.workspaceCount} 个
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
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
            关闭
          </button>
        </header>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div data-testid="superadmin-user-agent-access-mode-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {MODE_OPTIONS.map((option) => {
              const selected = questionMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setQuestionMode(option.value)}
                  style={{
                    textAlign: 'left',
                    minHeight: 72,
                    borderRadius: 8,
                    border: `1px solid ${selected ? 'var(--btn-primary-bg)' : 'var(--border-subtle)'}`,
                    background: selected ? 'var(--info-bg-soft)' : 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    padding: 12,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{option.label}</div>
                  <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)' }}>
                    {option.desc}
                  </div>
                </button>
              );
            })}
          </div>

          <div
            data-testid="superadmin-user-agent-access-agent-list"
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              overflow: 'hidden',
              background: 'var(--bg-secondary)',
            }}
          >
            <div
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                fontSize: 12,
                color: 'var(--text-muted)',
              }}
            >
              <span>开通 {enabledCount} / {agentCount}</span>
              <button
                type="button"
                onClick={() => void loadAccess()}
                disabled={loading || saving}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  cursor: loading || saving ? 'not-allowed' : 'pointer',
                  padding: 0,
                }}
              >
                刷新
              </button>
            </div>

            {loading && <div style={{ padding: 14, fontSize: 13, color: 'var(--text-muted)' }}>加载中...</div>}

            {!loading && access?.agents.map((agent) => {
              const enabled = enabledBusinessIds.has(agent.businessId);
              return (
                <div
                  key={agent.businessId}
                  className="superadmin-user-agent-access-agent-row"
                  data-testid={`superadmin-user-agent-access-agent-${agent.businessId}`}
                  style={{
                    padding: 12,
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 12,
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{agent.displayName}</span>
                      <span
                        style={{
                          fontSize: 12,
                          color: enabled ? 'var(--success)' : 'var(--text-muted)',
                          background: enabled ? 'var(--success-bg-soft)' : 'var(--bg-tertiary)',
                          border: `1px solid ${enabled ? 'var(--success-border-soft)' : 'var(--border-subtle)'}`,
                          borderRadius: 8,
                          padding: '2px 7px',
                        }}
                      >
                        {enabled ? '已开通' : '已屏蔽'}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          color: 'var(--info)',
                          background: 'var(--info-bg-soft)',
                          border: '1px solid var(--info-border-soft)',
                          borderRadius: 8,
                          padding: '2px 7px',
                        }}
                      >
                        {SOURCE_LABELS[agent.recommendedQuestionSource] || agent.recommendedQuestionSource}
                      </span>
                    </div>
                    <div style={{ marginTop: 5, fontSize: 12, color: 'var(--text-muted)' }}>
                      {agent.businessId} · 已开通工作区 {agent.enabledTenantCount} / {agent.tenantCount}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => toggleAgent(agent.businessId)}
                    style={{
                      width: 46,
                      height: 26,
                      borderRadius: 13,
                      border: `1px solid ${enabled ? 'var(--btn-primary-bg)' : 'var(--border-subtle)'}`,
                      background: enabled ? 'var(--btn-primary-bg)' : 'var(--bg-primary)',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                      justifyContent: enabled ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        background: enabled ? 'var(--btn-primary-text)' : 'var(--text-muted)',
                        display: 'block',
                      }}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 13, background: 'var(--danger-bg-soft)', border: '1px solid var(--danger-border-soft)', borderRadius: 8, padding: 10 }}>
              {error}
            </div>
          )}

        </div>

        <footer
          data-testid="superadmin-user-agent-access-modal-footer"
          style={{
            padding: 18,
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 34,
              padding: '0 14px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void saveAccess()}
            style={{
              height: 34,
              padding: '0 14px',
              borderRadius: 8,
              border: '1px solid var(--btn-primary-bg)',
              background: saving || loading ? 'var(--bg-tertiary)' : 'var(--btn-primary-bg)',
              color: saving || loading ? 'var(--text-muted)' : 'var(--btn-primary-text)',
              cursor: saving || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </footer>
      </section>
    </div>
  );
};

export default SuperAdminUserAgentAccessModal;
