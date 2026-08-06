/**
 * 工作区守卫组件
 *
 * 确保用户已登录且已选择有效的工作区（tenant），否则引导到工作区选择/创建流程。
 * 必须嵌套在 AuthGuard 内部使用（AuthGuard 已处理未登录跳转）。
 * 支持双模式：
 *   - children 模式：<WorkspaceGuard>{children}</WorkspaceGuard>
 *   - Outlet 模式：<Route element={<WorkspaceGuard />}>（layout route）
 *
 * 逻辑对应 V1 WorkspaceGuard，适配 corevo tenantStore 接口：
 * - 调用 tenantStore.initialize() 替代直接 platformTenantApi.listWorkspaces()
 * - workspaces.length === 0 → 跳 /workspace/create
 * - 有 workspaces 但 currentWorkspace == null → 跳 /workspace/select
 * - 未登录时优先跳 /login（不卡在 Loading）
 *
 * 注意：selectWorkspace 是纯本地切换，不换 token，X-Tenant-Id 注入在 client.ts，
 * 切换后注入的 tenantId 值来自 authStorage，已有 known issue 记录。
 */

import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { platformAuthApi } from '../../api/platformAuth';
import { useAuthStore } from '../../stores/authStore';
import { needsEnterpriseBinding, useTenantStore } from '../../stores/tenantStore';
import { useUserFileStore } from '../../stores/userFileStore';
import { useAuthRedirect } from '../../utils/authNavigation';
import {
  clearPendingOnboardingHandoff,
  clearOnboardingDraft,
  ONBOARDING_HANDOFF_COMPLETED_EVENT,
  readPendingOnboardingHandoff,
  requiresOnboardingForTenant,
  type OnboardingHandoffCompletedDetail,
} from '../../pages/onboarding/onboardingHandoff';

interface WorkspaceGuardProps {
  children?: React.ReactNode;
}

/**
 * 工作区守卫：未登录跳登录页，已登录但未进入工作区时跳转创建/选择页。
 * 支持 children 模式和 Outlet 模式。
 */
export const WorkspaceGuard: React.FC<WorkspaceGuardProps> = ({ children }) => {
  const location = useLocation();
  const token = useAuthStore((s) => s.token);
  const isLoading = useAuthStore((s) => s.isLoading);
  const currentUserId = useAuthStore((s) => s.user?.id ?? '');
  const workspaces = useTenantStore((s) => s.workspaces);
  const currentWorkspace = useTenantStore((s) => s.currentWorkspace);
  const tenantInitialized = useTenantStore((s) => s.initialized);
  const tenantInitializing = useTenantStore((s) => s.initializing);
  const initializeTenant = useTenantStore((s) => s.initialize);
  const redirectToAuth = useAuthRedirect();
  const [onboardingGate, setOnboardingGate] = useState<{
    tenantId: string;
    required: boolean;
    onboardingTenantId: string | null;
    phase: 'PROFILE_REQUIRED' | 'DEFAULT_JOB_PENDING' | 'COMPLETE' | null;
  } | null>(null);

  useEffect(() => {
    const handler = () => {
      const tenantId = useTenantStore.getState().currentWorkspace?.tenantId;
      if (tenantId) {
        void useUserFileStore.getState().fetchFiles(tenantId);
      }
    };

    window.addEventListener('session-file-added', handler);
    return () => window.removeEventListener('session-file-added', handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<OnboardingHandoffCompletedDetail>).detail;
      const tenantId = currentWorkspace?.tenantId;
      if (detail?.userId !== currentUserId || detail.tenantId !== tenantId) return;
      setOnboardingGate({
        tenantId,
        required: false,
        onboardingTenantId: null,
        phase: 'COMPLETE',
      });
    };

    window.addEventListener(ONBOARDING_HANDOFF_COMPLETED_EVENT, handler);
    return () => window.removeEventListener(ONBOARDING_HANDOFF_COMPLETED_EVENT, handler);
  }, [currentUserId, currentWorkspace?.tenantId]);

  useEffect(() => {
    console.log('[FE-DEBUG][WorkspaceGuard]', 'initialize 条件检查', {
      token: !!token,
      isLoading,
      tenantInitialized,
      tenantInitializing,
    });
    if (token && !isLoading && !tenantInitialized && !tenantInitializing) {
      console.log('[FE-DEBUG][WorkspaceGuard]', 'initialize 触发');
      void initializeTenant();
    }
  }, [initializeTenant, isLoading, tenantInitialized, tenantInitializing, token]);

  useEffect(() => {
    const tenantId = currentWorkspace?.tenantId;
    if (!token || isLoading || !tenantInitialized || tenantInitializing || !tenantId) return;
    let active = true;
    void platformAuthApi.me()
      .then((me) => {
        if (active) {
          const phase = me.onboarding?.phase ?? null;
          if (phase === 'COMPLETE') {
            clearPendingOnboardingHandoff(currentUserId, tenantId);
            clearOnboardingDraft(currentUserId, tenantId);
          }
          setOnboardingGate({
            tenantId,
            required: me.onboarding?.required === true,
            onboardingTenantId: me.onboarding?.tenantId ?? null,
            phase,
          });
        }
      })
      .catch(() => {
        if (active) {
          setOnboardingGate({
            tenantId,
            required: false,
            onboardingTenantId: null,
            phase: null,
          });
        }
      });
    return () => {
      active = false;
    };
  }, [
    currentUserId,
    currentWorkspace?.tenantId,
    isLoading,
    tenantInitialized,
    tenantInitializing,
    token,
  ]);

  // 注意：未登录时，tenant store 可能处于未初始化状态（reset 后 initialized=false）。
  // 这种情况下仍应优先跳转登录页，而不是卡在 Loading。
  if (isLoading) {
    console.log('[FE-DEBUG][WorkspaceGuard]', '最终判断：isLoading=true → loading');
    return null;
  }
  if (!token) {
    console.log('[FE-DEBUG][WorkspaceGuard]', '最终判断：无 token → 跳登录', { pathname: location.pathname });
    return redirectToAuth('/login');
  }
  if (!tenantInitialized || tenantInitializing) {
    console.log('[FE-DEBUG][WorkspaceGuard]', '最终判断：tenant 未初始化 → loading', { tenantInitialized, tenantInitializing });
    return null; // loading
  }
  if (workspaces.length === 0) {
    console.log('[FE-DEBUG][WorkspaceGuard]', '最终判断：无工作区 → 跳 /workspace/create');
    return redirectToAuth('/workspace/create');
  }
  if (!currentWorkspace) {
    console.log('[FE-DEBUG][WorkspaceGuard]', '最终判断：未选工作区 → 跳 /workspace/select', { workspacesCount: workspaces.length });
    return redirectToAuth('/workspace/select');
  }
  if (needsEnterpriseBinding(currentWorkspace)) {
    console.log('[FE-DEBUG][WorkspaceGuard]', '最终判断：企业未绑定 → 跳 /workspace/create');
    return redirectToAuth('/workspace/create');
  }
  const currentOnboardingGate = onboardingGate?.tenantId === currentWorkspace.tenantId
    ? onboardingGate
    : null;
  const onboardingRequired = currentOnboardingGate
    ? requiresOnboardingForTenant({
      required: currentOnboardingGate.required,
      tenantId: currentOnboardingGate.onboardingTenantId,
    }, currentWorkspace.tenantId)
    : null;
  if (onboardingRequired === null) {
    return null;
  }
  if (onboardingRequired) {
    if (
      currentOnboardingGate?.phase === 'DEFAULT_JOB_PENDING'
      && currentUserId
      && readPendingOnboardingHandoff(currentUserId, currentWorkspace.tenantId)
    ) {
      return <>{children ?? <Outlet />}</>;
    }
    return redirectToAuth('/onboarding');
  }
  console.log('[FE-DEBUG][WorkspaceGuard]', '最终判断：放行', { tenantId: currentWorkspace.tenantId });
  return <>{children ?? <Outlet />}</>;
};

export default WorkspaceGuard;
