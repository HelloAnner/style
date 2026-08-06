/**
 * 访客守卫组件
 *
 * 已登录用户访问登录/注册等公开页时，自动跳回工作台入口。
 * 支持双模式：
 *   - children 模式：<GuestGuard>{children}</GuestGuard>
 *   - Outlet 模式：<Route element={<GuestGuard />}>（layout route）
 *
 * 等待 persist hydration 完成后才判断 token，避免 hydration 前误跳。
 * token 不持久化，直开 guest 页时需要通过 HttpOnly Cookie 恢复一次会话。
 * 对应 V1 GuestGuard，适配 corevo authStore 接口（persist hydration 模式）。
 */

import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useConsumeRedirect } from '../../utils/authNavigation';
import { WORKSPACE_HOME_PATH } from '../../utils/routes';

interface GuestGuardProps {
  children?: React.ReactNode;
}

/**
 * 访客守卫：已登录用户访问登录页时跳回工作台入口。
 * 支持 children 模式和 Outlet 模式。
 */
export const GuestGuard: React.FC<GuestGuardProps> = ({ children }) => {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  // Hook 必须无条件调用，结果仅在已登录分支使用。
  // 已登录访问 guest 页时，按 URL 的 ?redirect= 回跳原目标，默认跳工作台入口。
  const consumeRedirectElement = useConsumeRedirect(WORKSPACE_HOME_PATH);

  const [checkingSession, setCheckingSession] = useState(false);
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
    if (!rehydrated || token || !user) {
      return;
    }

    let stale = false;
    setCheckingSession(true);
    void restoreSession().finally(() => {
      if (!stale) {
        setCheckingSession(false);
      }
    });

    return () => {
      stale = true;
    };
  }, [rehydrated, restoreSession, token, user]);

  const shouldRestoreSession = rehydrated && !token && !!user;

  if (!rehydrated || isLoading || (!token && (checkingSession || shouldRestoreSession))) {
    return null;
  }

  if (token) {
    console.log('[FE-DEBUG][GuestGuard]', '已登录 → 按 redirect 回跳（无 redirect 则跳工作台入口）');
    return consumeRedirectElement;
  }

  console.log('[FE-DEBUG][GuestGuard]', '未登录 → 放行访客页');
  return <>{children ?? <Outlet />}</>;
};

export default GuestGuard;
