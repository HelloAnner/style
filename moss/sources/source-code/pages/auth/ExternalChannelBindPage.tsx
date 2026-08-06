import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, TriangleAlert } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  confirmExternalChannelBinding,
  previewExternalChannelBinding,
  type ExternalChannelBindingPreview,
} from '../../api/externalChannelBinding';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';

type PageState = 'loading' | 'ready' | 'success' | 'error';

function providerName(provider: string | undefined): string {
  switch (provider) {
    case 'feishu':
      return '飞书';
    case 'dingtalk':
      return '钉钉';
    case 'wecom':
    case 'wechat_work':
      return '企业微信';
    default:
      return '外部机器人';
  }
}

function statusText(preview: ExternalChannelBindingPreview | null, fallback: string | null): string {
  if (fallback) {
    return fallback;
  }
  if (!preview) {
    return '绑定链接无效，请回到机器人重新获取。';
  }
  if (preview.status === 'used') {
    return '该绑定链接已使用，请回到机器人继续提问。';
  }
  if (preview.status === 'expired') {
    return '该绑定链接已过期，请回到机器人重新获取。';
  }
  return '确认后，此账号将用于当前机器人对话身份识别。';
}

const ExternalChannelBindPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const user = useAuthStore((state) => state.user);
  const workspaces = useTenantStore((state) => state.workspaces);
  const currentWorkspace = useTenantStore((state) => state.currentWorkspace);
  const tenantInitialized = useTenantStore((state) => state.initialized);
  const tenantInitializing = useTenantStore((state) => state.initializing);
  const initializeTenants = useTenantStore((state) => state.initialize);
  const refreshWorkspaces = useTenantStore((state) => state.refreshWorkspaces);
  const selectWorkspace = useTenantStore((state) => state.selectWorkspace);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [preview, setPreview] = useState<ExternalChannelBindingPreview | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tenantInitialized && !tenantInitializing) {
      void initializeTenants();
    }
  }, [initializeTenants, tenantInitialized, tenantInitializing]);

  useEffect(() => {
    let stale = false;
    if (!token) {
      setPageState('error');
      setErrorText('绑定链接缺少 token，请回到机器人重新获取。');
      return;
    }
    setPageState('loading');
    setErrorText(null);
    void previewExternalChannelBinding(token)
      .then((data) => {
        if (stale) return;
        setPreview(data);
        setPageState(data.bindable ? 'ready' : 'error');
      })
      .catch((error: unknown) => {
        if (stale) return;
        const message = error instanceof Error ? error.message : '绑定链接无效，请回到机器人重新获取。';
        setErrorText(message);
        setPageState('error');
      });
    return () => {
      stale = true;
    };
  }, [token]);

  const displayName = useMemo(() => {
    return user?.nickname || user?.email || user?.phone || user?.id || '当前 Moss 账号';
  }, [user]);

  const targetWorkspace = useMemo(() => {
    if (!preview?.tenant_id) return null;
    return workspaces.find((workspace) => workspace.tenantId === preview.tenant_id) ?? null;
  }, [preview?.tenant_id, workspaces]);

  const targetTenantName = useMemo(() => {
    return preview?.tenant_name || targetWorkspace?.name || preview?.tenant_id || '目标工作区';
  }, [preview?.tenant_id, preview?.tenant_name, targetWorkspace?.name]);

  const bindingEffectText = useMemo(() => {
    if (!preview?.tenant_id || pageState !== 'ready') {
      return '';
    }
    if (currentWorkspace?.tenantId === preview.tenant_id) {
      return `确认后，将在当前工作区「${targetTenantName}」完成绑定。`;
    }
    if (targetWorkspace) {
      return `确认后，将自动切换到工作区「${targetTenantName}」并完成绑定。`;
    }
    return `确认后，将自动加入工作区「${targetTenantName}」并切换到该工作区。`;
  }, [currentWorkspace?.tenantId, pageState, preview?.tenant_id, targetTenantName, targetWorkspace]);

  const handleConfirm = useCallback(() => {
    if (!token || submitting) {
      return;
    }
    setSubmitting(true);
    setErrorText(null);
    setSuccessNote(null);
    void (async () => {
      const result = await confirmExternalChannelBinding(token);
      const tenantName = result.tenant_name || targetTenantName;
      let switchFailed = false;
      try {
        await refreshWorkspaces();
        await selectWorkspace(result.tenant_id);
      } catch {
        switchFailed = true;
      }
      if (switchFailed) {
        setSuccessNote(`已完成绑定，但自动切换工作区失败，请手动切换到「${tenantName}」。`);
      } else if (result.joined_tenant) {
        setSuccessNote(`已加入并切换到工作区「${tenantName}」。`);
      } else {
        setSuccessNote(`已切换到工作区「${tenantName}」。`);
      }
      return result;
    })()
      .then((result) => {
        setPageState('success');
        setPreview((current) => current ? {
          ...current,
          tenant_name: result.tenant_name ?? current.tenant_name,
          status: 'used',
          bindable: false,
        } : current);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : '绑定失败，请回到机器人重新获取链接。';
        setErrorText(message);
        setPageState('error');
      })
      .finally(() => setSubmitting(false));
  }, [refreshWorkspaces, selectWorkspace, submitting, targetTenantName, token]);

  const title = pageState === 'success' ? '绑定成功' : '绑定 Moss 账号';
  const description = pageState === 'success'
    ? (successNote || '已完成绑定，请回到机器人继续提问。')
    : statusText(preview, errorText);
  const provider = providerName(preview?.provider);

  return (
    <main
      data-testid="external-channel-bind-page"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
    >
      <section
        data-testid="external-channel-bind-card"
        style={{
          width: '100%',
          maxWidth: 480,
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          background: 'var(--bg-secondary)',
          boxShadow: 'var(--panel-shadow)',
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          {pageState === 'loading' ? (
            <Loader2 size={24} style={{ color: 'var(--text-muted)' }} className="external-bind-spin" />
          ) : pageState === 'success' ? (
            <CheckCircle2 size={24} style={{ color: 'var(--color-success)' }} />
          ) : (
            <TriangleAlert size={24} style={{ color: pageState === 'ready' ? 'var(--text-muted)' : 'var(--color-warning)' }} />
          )}
          <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.3, fontWeight: 600 }}>{title}</h1>
        </div>

        <p style={{ margin: '0 0 18px', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7 }}>
          {description}
        </p>

        {preview && (
          <dl
            data-testid="external-channel-bind-details"
            style={{
              display: 'grid',
              gridTemplateColumns: '96px 1fr',
              gap: '10px 12px',
              margin: '0 0 20px',
              fontSize: 13,
            }}
          >
            <dt style={{ color: 'var(--text-muted)' }}>平台</dt>
            <dd style={{ margin: 0 }}>{provider}</dd>
            <dt style={{ color: 'var(--text-muted)' }}>目标工作区</dt>
            <dd style={{ margin: 0, wordBreak: 'break-all' }}>{targetTenantName}</dd>
            <dt style={{ color: 'var(--text-muted)' }}>Moss 账号</dt>
            <dd style={{ margin: 0, wordBreak: 'break-all' }}>{displayName}</dd>
            <dt style={{ color: 'var(--text-muted)' }}>外部账号</dt>
            <dd style={{ margin: 0, wordBreak: 'break-all' }}>{preview.external_user_id}</dd>
          </dl>
        )}

        {bindingEffectText && (
          <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>
            {bindingEffectText}
          </p>
        )}

        {pageState === 'ready' && (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            style={{
              width: '100%',
              height: 40,
              border: '1px solid var(--accent-color)',
              borderRadius: 8,
              background: 'var(--accent-color)',
              color: 'var(--accent-v11)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: submitting ? 'default' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? <Loader2 size={16} className="external-bind-spin" /> : <CheckCircle2 size={16} />}
            确认绑定
          </button>
        )}
      </section>
      <style>{`
        .external-bind-spin {
          animation: external-bind-spin 1s linear infinite;
        }
        @keyframes external-bind-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
};

export default ExternalChannelBindPage;
