import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getPlatformApiErrorCode, platformAuthApi } from '../../api/platformAuth';
import { useAuthStore } from '../../stores/authStore';

const SUPER_ADMIN_CONTACT_REQUIRED = '1021';

function resolveSuperAdminRedirect(search: string): string {
  const redirect = new URLSearchParams(search).get('redirect');
  if (redirect && redirect.startsWith('/superadmin/')) {
    return redirect;
  }
  return '/superadmin/dashboard';
}

/**
 * 超管二次认证页面。
 *
 * 业务职责：
 * - 为超管账户提供验证码二次校验入口；
 * - 提权成功后更新主前端会话 token，并进入超管后台目标路由。
 */
export const SuperAdminVerifyPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);

  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSendCode = async () => {
    if (sending || submitting) {
      return;
    }
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      await platformAuthApi.sendSuperAdminCode();
      setNotice('验证码已发送，请联系平台管理员渠道获取。');
    } catch (err) {
      const errorCode = getPlatformApiErrorCode(err);
      if (errorCode === SUPER_ADMIN_CONTACT_REQUIRED) {
        setError('当前账号未配置超管联系渠道，请联系平台管理员。');
      } else {
        setError(err instanceof Error ? err.message : '验证码发送失败，请稍后重试。');
      }
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) {
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setError('请输入 6 位数字验证码');
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await platformAuthApi.verifySuperAdmin(code.trim());
      const currentState = useAuthStore.getState();
      login(response.token, {
        ...(currentState.user ?? { id: '', email: '', created_at: new Date().toISOString() }),
        email: response.user.email || currentState.user?.email || '',
        nickname: response.user.nickname || undefined,
        passport_username: currentState.user?.passport_username,
        isSuperAdmin: response.user.isSuperAdmin ?? true,
        saVerified: response.user.saVerified ?? true,
      }, currentState.tenant ?? { id: '', name: '', plan: 'free', max_agents: 0, monthly_token_quota: 0, created_at: new Date().toISOString() });
      navigate(resolveSuperAdminRedirect(location.search), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码校验失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-testid="superadmin-verify-page"
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div
        data-testid="superadmin-verify-card"
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--glass-bg)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 16,
          padding: 24,
          boxShadow: 'var(--panel-shadow)',
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
          超管二次校验
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          请输入 6 位验证码，完成超级管理员权限确认
        </p>

        {notice && (
          <div
            style={{
              marginBottom: 14,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(34, 197, 94, 0.25)',
              background: 'rgba(34, 197, 94, 0.08)',
              color: '#22c55e',
              fontSize: 13,
            }}
          >
            {notice}
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: 14,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(239, 68, 68, 0.25)',
              background: 'rgba(239, 68, 68, 0.08)',
              color: '#EF4444',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-testid="superadmin-verify-form">
          <input
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="输入 6 位验证码"
            maxLength={6}
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--input-border)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />

          <button
            type="button"
            onClick={handleSendCode}
            disabled={sending || submitting}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--input-border)',
              background: 'var(--hover-bg)',
              color: 'var(--text-primary)',
              fontSize: 13,
              cursor: sending || submitting ? 'not-allowed' : 'pointer',
              opacity: sending || submitting ? 0.6 : 1,
            }}
          >
            {sending ? '发送中...' : '发送验证码'}
          </button>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '11px 12px',
              border: 'none',
              borderRadius: 10,
              background: 'var(--send-btn-active-bg)',
              color: 'var(--send-btn-active-icon)',
              fontSize: 14,
              fontWeight: 500,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? '校验中...' : '确认校验'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SuperAdminVerifyPage;
