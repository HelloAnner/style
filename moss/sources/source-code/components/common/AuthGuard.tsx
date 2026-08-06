/**
 * 认证守卫组件
 *
 * 检查用户认证状态，未认证时重定向到登录页。
 * 支持双模式：
 *   - children 模式：<AuthGuard>{children}</AuthGuard>
 *   - Outlet 模式：<Route element={<AuthGuard />}>（layout route）
 *
 * 逻辑：等待 persist hydration + restoreSession 完成后才判断 token，
 * 避免 hydration 前误跳。包含 Token 自动续期（生命周期剩余 1/3 时静默刷新）。
 *
 * 对应 V1 AuthGuard，适配 corevo authStore 接口（isLoading / restoreSession / persist hydration）。
 */

import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useAuthRedirect } from '../../utils/authNavigation';

// 全局骨架屏 — 模拟侧边栏 + 对话区的完整布局
const LoadingScreen: React.FC = () => (
  <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)' }}>
    {/* 侧边栏骨架 */}
    <div style={{
      width: 180, flexShrink: 0, padding: '20px 16px',
      display: 'flex', flexDirection: 'column', gap: 12,
      borderRight: '1px solid var(--border-subtle)',
    }}>
      <div className="auth-sk" style={{ width: 100, height: 28, borderRadius: 8, background: 'var(--bg-tertiary)' }} />
      <div style={{ height: 8 }} />
      {[0.9, 0.65, 0.8, 0.55, 0.7].map((w, i) => (
        <div key={i} className="auth-sk" style={{
          width: `${w * 100}%`, height: 14, borderRadius: 6,
          background: 'var(--bg-tertiary)', animationDelay: `${i * 0.1}s`,
        }} />
      ))}
    </div>
    {/* 对话区骨架 */}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 24px', maxWidth: 880, margin: '0 auto', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 12 }}>
        <div className="auth-sk" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--bg-tertiary)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, maxWidth: '85%' }}>
          <div className="auth-sk" style={{ width: 60, height: 10, borderRadius: 5, background: 'var(--bg-tertiary)', animationDelay: '0.05s' }} />
          <div className="auth-sk" style={{ borderRadius: 16, padding: 14, background: 'var(--bg-tertiary)', animationDelay: '0.1s' }}>
            <div style={{ width: 180, height: 13, borderRadius: 6, background: 'var(--border-subtle)' }} />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <div className="auth-sk" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--bg-tertiary)', animationDelay: '0.15s' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, maxWidth: '85%' }}>
          <div className="auth-sk" style={{ width: 80, height: 10, borderRadius: 5, background: 'var(--bg-tertiary)', animationDelay: '0.2s' }} />
          <div className="auth-sk" style={{ borderRadius: 16, padding: 14, background: 'var(--bg-tertiary)', animationDelay: '0.25s', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ width: 360, height: 13, borderRadius: 6, background: 'var(--border-subtle)' }} />
            <div style={{ width: 280, height: 13, borderRadius: 6, background: 'var(--border-subtle)' }} />
            <div style={{ width: 220, height: 13, borderRadius: 6, background: 'var(--border-subtle)' }} />
          </div>
        </div>
      </div>
    </div>
    <style>{`
      .auth-sk { animation: auth-sk-pulse 1.5s ease-in-out infinite; }
      @keyframes auth-sk-pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.6; } }
    `}</style>
  </div>
);

interface AuthGuardProps {
  children?: React.ReactNode;
}

function isFeishuUsagePath(pathname: string): boolean {
  return pathname.startsWith('/feishu/usage/');
}

function sessionFilePreviewLoginPath(pathname: string, search: string): string | null {
  if (!/^\/s\/[^/]+\/?$/.test(pathname)) {
    return null;
  }
  const searchParams = new URLSearchParams(search);
  if (searchParams.get('preview') !== 'session-file') {
    return null;
  }
  const loginProvider = searchParams.get('loginProvider')?.trim().toLowerCase();
  if (loginProvider === 'feishu') {
    return '/login/feishu';
  }
  if (loginProvider === 'cas') {
    return '/login/cas';
  }
  return null;
}

function resolveLoginPath(pathname: string, search: string): string {
  const previewLoginPath = sessionFilePreviewLoginPath(pathname, search);
  if (previewLoginPath) {
    return previewLoginPath;
  }
  if (isFeishuUsagePath(pathname)) {
    return '/login/feishu';
  }
  return '/login';
}

/**
 * 登录态守卫：未登录跳转到登录页，并保留回跳地址。
 * 支持 children 模式和 Outlet 模式。
 */
export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const location = useLocation();
  const token = useAuthStore((s) => s.token);
  const isLoading = useAuthStore((s) => s.isLoading);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const logout = useAuthStore((s) => s.logout);
  const redirectToAuth = useAuthRedirect();

  const [checking, setChecking] = useState(true);
  const [rehydrated, setRehydrated] = useState(
    () => useAuthStore.persist.hasHydrated?.() ?? false
  );

  useEffect(() => {
    const finish = useAuthStore.persist.onFinishHydration?.(() => {
      setRehydrated(true);
    });
    if (useAuthStore.persist.hasHydrated?.()) {
      setRehydrated(true);
    }
    return () => finish?.();
  }, []);

  useEffect(() => {
    if (!rehydrated) return;
    let stale = false;

    const checkAuth = async () => {
      console.log('[FE-DEBUG][AuthGuard]', 'restoreSession 开始', { rehydrated });
      const ok = await restoreSession();
      if (!stale) {
        console.log('[FE-DEBUG][AuthGuard]', 'restoreSession 完成', { result: ok });
        setChecking(false);
      }
    };

    void checkAuth();
    return () => { stale = true; };
  }, [rehydrated, restoreSession]);

  // Token 自动续期：在 token 生命周期剩余 1/3 时静默刷新
  useEffect(() => {
    if (!token || checking) return;

    const scheduleRefresh = () => {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiresAt = payload.exp * 1000;
        const issuedAt = (payload.iat ?? 0) * 1000;
        const now = Date.now();
        const remaining = expiresAt - now;

        if (remaining <= 0) {
          logout();
          return undefined;
        }

        const lifetime = expiresAt - issuedAt;
        const threshold = Math.max(lifetime / 3, 60_000);
        const delay = remaining > threshold ? remaining - threshold : 0;

        const MIN_DELAY = 30_000;
        const safeDelay = Math.max(delay, MIN_DELAY);

        console.log('[FE-DEBUG][AuthGuard]', 'token 续期定时触发已排期', { remainingMs: remaining, delayMs: safeDelay });
        const timer = window.setTimeout(async () => {
          console.log('[FE-DEBUG][AuthGuard]', 'token 续期触发');
          try {
            const refreshed = await refreshToken();
            if (refreshed) {
              console.log('[FE-DEBUG][AuthGuard]', 'token 续期成功');
            } else {
              console.warn('[FE-DEBUG][AuthGuard]', 'token 续期失败：接口返回 false');
            }
          } catch (e) {
            console.warn('[FE-DEBUG][AuthGuard]', 'token 续期异常', e);
          }
        }, safeDelay);

        return timer;
      } catch {
        return undefined;
      }
    };

    const timer = scheduleRefresh();
    return () => { if (timer) window.clearTimeout(timer); };
  }, [token, checking, logout, refreshToken]);

  if (!rehydrated || checking || isLoading) {
    return <LoadingScreen />;
  }

  if (!token) {
    console.log('[FE-DEBUG][AuthGuard]', '最终判断：无 token → 跳登录', { pathname: location.pathname });
    return redirectToAuth(resolveLoginPath(location.pathname, location.search));
  }

  console.log('[FE-DEBUG][AuthGuard]', '最终判断：token 有效 → 放行');
  return <>{children ?? <Outlet />}</>;
};

export default AuthGuard;
