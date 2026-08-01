/**
 * Agent Core Web 主应用 - Corevo Design System
 *
 * 布局结构：
 * - 对话模式：Sidebar + Chat Area
 * - 工作区模式：Sidebar + Chat Area + Workspace(可切换)
 *
 * ┌─────────┬────────────────────┬─────────────┐
 * │         │                    │             │
 * │ Sidebar │    Chat Area       │  Workspace  │
 * │         │                    │             │
 * │  240px  │      flex-1        │   flex-1    │
 * │         │                    │             │
 * └─────────┴────────────────────┴─────────────┘
 */

import React, { useState, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet, useNavigate, useMatch, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { setNotifyHandler } from './api/notify';
import { motion } from 'framer-motion';
import { Sidebar } from './components/Sidebar/Sidebar';
import { CollapsedSidebar } from './components/Sidebar/CollapsedSidebar';
import { ChatContainer } from './components/Chat/ChatContainer';
import { useAgentStore } from './stores/agentStore';
import { useAutoOpenSessionFiles } from './hooks/useAutoOpenSessionFiles';
import { useSessionRuntimeStore } from './stores/sessionRuntimeStore';
import { hasActiveAssistantMessage } from './lib/conversationActivity';
import { getSendTaskSession } from './lib/sendTaskGuard';
import { useAgentContextStore } from './stores/agentContextStore';
import { type RightPanelType, useUiStore } from './stores/uiStore';
import { useBoardDraftStore } from './stores/boardDraftStore';
import { usePreviewStore } from './stores/previewStore';
import { useAgent } from './hooks/useAgent';
import { ThemeProvider } from './components/common/ThemeProvider';
import { PageErrorBoundary, ComponentErrorBoundary } from './components/common/ErrorBoundary';
import { WorkspaceSkeleton, AutomationPanelSkeleton } from './components/common/PanelSkeletons';
import { AuthGuard } from './components/common/AuthGuard';
import { WorkspaceGuard } from './components/common/WorkspaceGuard';
import { AdminGuard } from './components/common/AdminGuard';
import { GuestGuard } from './components/common/GuestGuard';
import { useAuthStore } from './stores/authStore';
import SuperAdminVerifyPage from './pages/auth/SuperAdminVerifyPage';
import { WorkspaceCreatePage, WorkspacePathRedirect, WorkspaceSelectPage } from './pages/auth/WorkspaceEntryPages';
import { WorkspaceJoinEntryPage, WorkspaceJoinInvitePage } from './pages/auth/WorkspaceInvitePages';
import CallbackPage from './pages/auth/CallbackPage';
import { AliyunWorkspaceBindPage } from './pages/auth/AliyunWorkspaceBindPage';
import { installFetchInterceptor } from './api/client';
import { MobileUnsupportedGuard, isMobileDevice } from './components/common/MobileUnsupportedGuard';
import { LegacyStarMigrationRedirect } from './components/common/LegacyStarMigrationRedirect';
import { useBillingStore } from './stores/billingStore';
import { useFrontendConfigStore } from './stores/frontendConfigStore';
import { isFeishuWorkspace, useTenantStore } from './stores/tenantStore';
import { useResizablePanelWidth } from './hooks/useResizablePanelWidth';
import { resolveWorkspaceBillingUiState } from './utils/billingUiState';
import { WorkspaceBillingBanner } from './components/Billing/WorkspaceBillingBanner';
import { WorkspaceSalesConsultModal } from './components/Billing/WorkspaceSalesConsultModal';
import { platformAuthApi } from './api/platformAuth';
import { platformApiPath } from './api/gateway';
import { isFeishuEnv } from './utils/feishu';
import { BOARD_HOME_PATH, WEBSITE_HOME_PATH, WEBSITE_STATIC_PATH, WORKSPACE_HOME_PATH, sessionPath } from './utils/routes';
import { MainWebSocketProvider } from './contexts/MainWebSocketContext';
import { BOARD_ENTRY_ENABLED, supportsBoard } from './pages/boards/boardAvailability';
import { renderSuperAdminRoute } from './pages/superadmin/superAdminRoutes';

installFetchInterceptor();
console.log('[FE-DEBUG][App]', 'installFetchInterceptor 调用完成');
setNotifyHandler((level, message, options) => {
  if (level === 'info') {
    toast.info(message, options);
  } else {
    toast.error(message, options);
  }
});

const SharePage = lazy(() => import('./pages/share/SharePage'));
const FileSharePage = lazy(() => import('./pages/share/FileSharePage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const ShowcasePage = lazy(() => import('./pages/showcase/ShowcasePage'));
const OnboardingPage = lazy(() => import('./pages/onboarding/OnboardingPage'));
const WorkspaceDrawer = lazy(() => import('./components/Workspace/WorkspaceDrawer').then(m => ({ default: m.WorkspaceDrawer })));
const AutomationPanel = lazy(() => import('./components/Automation/AutomationPanel'));
const BoardPanelDrawer = lazy(() => import('./pages/boards/BoardPanelDrawer').then(m => ({ default: m.BoardPanelDrawer })));

const AutomationToast = lazy(() => import('./components/Automation/AutomationToast'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const FeishuUsageDetailPage = lazy(() => import('./pages/feishu/FeishuUsageDetailPage'));
const LegacyStarMigrationPage = lazy(() => import('./pages/legacy/LegacyStarMigrationPage'));
const BoardHomePage = lazy(() => import('./pages/boards/BoardHomePage'));
const ExternalChannelBindPage = lazy(() => import('./pages/auth/ExternalChannelBindPage'));
const SessionFilePreviewPage = lazy(() => import('./pages/SessionFilePreviewPage'));

const RIGHT_PANEL_MIN_WIDTH = 480;
const RIGHT_PANEL_FIXED_RATIO = 0.5;

// SaaS 模式始终为 true（VITE_SAAS_MODE 已废弃，统一使用嵌套 Guard 路由结构）

type SettingsInitialTab = 'profile' | 'spaces';

const WebsiteHomeRedirect: React.FC = () => {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const [rehydrated, setRehydrated] = useState(
    () => useAuthStore.persist.hasHydrated?.() ?? false
  );
  const handledRef = React.useRef(false);

  React.useEffect(() => {
    const finish = useAuthStore.persist.onFinishHydration?.(() => {
      setRehydrated(true);
    });
    if (useAuthStore.persist.hasHydrated?.()) {
      setRehydrated(true);
    }
    return () => finish?.();
  }, []);

  React.useEffect(() => {
    if (!rehydrated || handledRef.current) {
      return;
    }

    if (token) {
      handledRef.current = true;
      window.location.replace(WORKSPACE_HOME_PATH);
      return;
    }

    if (!user) {
      handledRef.current = true;
      window.location.replace(WEBSITE_STATIC_PATH);
      return;
    }

    handledRef.current = true;
    void restoreSession()
      .then((ok) => {
        window.location.replace(ok ? WORKSPACE_HOME_PATH : WEBSITE_STATIC_PATH);
      })
      .catch(() => {
        window.location.replace(WEBSITE_STATIC_PATH);
      });
  }, [rehydrated, restoreSession, token, user]);

  return null;
};

function resolveSuperAdminRedirect(search: string): string {
  const redirect = new URLSearchParams(search).get('redirect');
  if (redirect && redirect.startsWith('/superadmin/')) {
    return redirect;
  }
  return '/superadmin/dashboard';
}

function parseTokenClaims(token: string | null): Record<string, unknown> | null {
  if (!token) {
    return null;
  }
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readBooleanClaim(payload: Record<string, unknown> | null, keys: string[]): boolean | undefined {
  if (!payload) {
    return undefined;
  }
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      if (value === 'true') {
        return true;
      }
      if (value === 'false') {
        return false;
      }
    }
  }
  return undefined;
}

function resolveSuperAdminFlags(user: { isSuperAdmin?: boolean; saVerified?: boolean } | null, token: string | null) {
  const claims = parseTokenClaims(token);
  const isSuperAdmin = typeof user?.isSuperAdmin === 'boolean'
    ? user.isSuperAdmin
    : (readBooleanClaim(claims, ['isSuperAdmin', 'is_super_admin', 'superAdmin', 'super_admin']) ?? false);
  const saVerified = typeof user?.saVerified === 'boolean'
    ? user.saVerified
    : (readBooleanClaim(claims, ['saVerified', 'sa_verified']) ?? false);
  return { isSuperAdmin, saVerified };
}

const SuperAdminRouteGate: React.FC = () => {
  const location = useLocation();
  const { '*': splat } = useParams<{ '*': string }>();
  const { isAuthenticated, user, token } = useAuthStore();
  const [rehydrated, setRehydrated] = useState(
    () => useAuthStore.persist.hasHydrated?.() ?? false
  );

  React.useEffect(() => {
    const finish = useAuthStore.persist.onFinishHydration?.(() => {
      setRehydrated(true);
    });
    if (useAuthStore.persist.hasHydrated?.()) {
      setRehydrated(true);
    }
    return () => finish?.();
  }, []);

  const suffix = splat ? `/${splat}` : '';
  const redirectTarget = `/superadmin${suffix}${location.search}`;
  const { isSuperAdmin, saVerified } = resolveSuperAdminFlags(user, token);

  console.log('[FE-DEBUG][App:SuperAdminRouteGate]', '判断', { rehydrated, isAuthenticated, isSuperAdmin, saVerified, splat });

  if (!rehydrated) {
    return null;
  }
  if (!isAuthenticated) {
    console.log('[FE-DEBUG][App:SuperAdminRouteGate]', '未登录 → 跳登录页');
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectTarget)}`} replace />;
  }
  if (!isSuperAdmin) {
    console.log('[FE-DEBUG][App:SuperAdminRouteGate]', '非超管 → 跳工作台入口');
    return <Navigate to={WORKSPACE_HOME_PATH} replace />;
  }
  if (!saVerified) {
    console.log('[FE-DEBUG][App:SuperAdminRouteGate]', '超管未验证 → 跳验证页');
    return <Navigate to={`/superadmin/verify?redirect=${encodeURIComponent(redirectTarget)}`} replace />;
  }
  return renderSuperAdminRoute(splat);
};

const CasRedirectRoute: React.FC = () => {
  const [searchParams] = useSearchParams();

  React.useEffect(() => {
    const redirect = searchParams.get('redirect');
    const safeRedirect = redirect && redirect.startsWith('/') && !redirect.startsWith('//')
      ? redirect
      : '/';
    const params = new URLSearchParams();
    if (safeRedirect !== '/') {
      params.set('redirect', safeRedirect);
    }
    const query = params.toString();
    window.location.replace(platformApiPath(`/auth/cas/login${query ? `?${query}` : ''}`));
  }, [searchParams]);

  return null;
};

const FeishuOAuthRedirectRoute: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    setError(null);
    const redirect = searchParams.get('redirect');
    const safeRedirect = redirect && redirect.startsWith('/') && !redirect.startsWith('//')
      ? redirect
      : WORKSPACE_HOME_PATH;
    platformAuthApi.feishuAuthorizeUrl(safeRedirect)
      .then((res) => {
        const authorizeUrl = res.authorizeUrl?.trim();
        if (!authorizeUrl) {
          throw new Error('飞书授权地址为空');
        }
        window.location.replace(authorizeUrl);
      })
      .catch((err) => {
        console.error('[FE-DEBUG][LoginPageRoute]', '飞书 OAuth 跳转失败', err);
        setError(err instanceof Error ? err.message : '飞书登录暂不可用');
      });
  }, [searchParams]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: 24 }}>
      <div role={error ? 'alert' : 'status'} style={{ color: error ? 'var(--color-error)' : 'var(--text-secondary)', textAlign: 'center' }}>
        {error ? `飞书登录失败：${error}` : '正在跳转到飞书登录…'}
      </div>
    </div>
  );
};

const LoginPageRoute: React.FC = () => (
  isFeishuEnv() ? <FeishuOAuthRedirectRoute /> : <CasRedirectRoute />
);
const CasLoginPageRoute: React.FC = () => <CasRedirectRoute />;
const RegisterPageRoute: React.FC = () => <CasRedirectRoute />;
const SuperAdminVerifyRoute: React.FC = () => {
  const location = useLocation();
  const { isAuthenticated, user, token } = useAuthStore();
  const [rehydrated, setRehydrated] = useState(
    () => useAuthStore.persist.hasHydrated?.() ?? false
  );

  React.useEffect(() => {
    const finish = useAuthStore.persist.onFinishHydration?.(() => {
      setRehydrated(true);
    });
    if (useAuthStore.persist.hasHydrated?.()) {
      setRehydrated(true);
    }
    return () => finish?.();
  }, []);
  const { isSuperAdmin, saVerified } = resolveSuperAdminFlags(user, token);

  if (!rehydrated) {
    return null;
  }
  if (!isAuthenticated) {
    const redirectTarget = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectTarget)}`} replace />;
  }
  if (!isSuperAdmin) {
    return <Navigate to={WORKSPACE_HOME_PATH} replace />;
  }
  if (saVerified) {
    return <Navigate to={resolveSuperAdminRedirect(location.search)} replace />;
  }
  return <SuperAdminVerifyPage />;
};

const SettingsOverlayRoute: React.FC<{
  initialTab: SettingsInitialTab;
}> = ({ initialTab }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const [rehydrated, setRehydrated] = useState(
    () => useAuthStore.persist.hasHydrated?.() ?? false
  );

  React.useEffect(() => {
    const finish = useAuthStore.persist.onFinishHydration?.(() => {
      setRehydrated(true);
    });
    if (useAuthStore.persist.hasHydrated?.()) {
      setRehydrated(true);
    }
    return () => finish?.();
  }, []);

  if (!rehydrated) {
    return null;
  }

  if (!isAuthenticated) {
    const redirectTarget = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectTarget)}`} replace />;
  }

  return (
    <Suspense fallback={null}>
      <SettingsPage
        isOpen
        onClose={() => navigate(WORKSPACE_HOME_PATH, { replace: true })}
        initialTab={initialTab}
        onOpenAdmin={() => navigate('/admin')}
      />
    </Suspense>
  );
};

/** 管理后台路由组件，透传 queryString 给 AdminDashboard，由 AdminGuard 保护。 */
const AdminDashboardRoute: React.FC = () => (
  <Suspense fallback={null}>
    <AdminDashboard />
  </Suspense>
);

const FeishuUsageDetailRoute: React.FC = () => {
  const location = useLocation();
  const currentWorkspace = useTenantStore((s) => s.currentWorkspace);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  React.useEffect(() => {
    if (!currentWorkspace || isFeishuWorkspace(currentWorkspace)) {
      return;
    }
    const redirectTarget = `${location.pathname}${location.search}`;
    clearAuth();
    window.location.replace(`/login/feishu?redirect=${encodeURIComponent(redirectTarget)}`);
  }, [clearAuth, currentWorkspace, location.pathname, location.search]);

  if (!currentWorkspace || !isFeishuWorkspace(currentWorkspace)) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <FeishuUsageDetailPage />
    </Suspense>
  );
};

const AdminEntryRoute: React.FC = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const tab = searchParams.get('tab');

  // profile 重定向到个人设置弹窗
  if (tab === 'profile') {
    console.log('[FE-DEBUG][App:AdminEntryRoute]', 'tab=profile → 跳 /me');
    return <Navigate to="/me" replace />;
  }

  console.log('[FE-DEBUG][App:AdminEntryRoute]', '渲染 AdminDashboard', { tab });
  // 权限检查已由父级 AdminGuard（usePermission）完成，此处无需二次校验
  return <AdminDashboardRoute />;
};

function fileNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).pop() || normalized || '文件';
}

function useExternalSessionFilePreviewRequest() {
  const match = useMatch('/s/:sessionId');
  const [searchParams, setSearchParams] = useSearchParams();
  const currentAgentId = useAgentContextStore((s) => s.currentAgentId);
  const currentSessionId = useAgentStore((s) => s.currentSessionId);
  const agents = useAgentContextStore((s) => s.agents);
  const setCurrentAgent = useAgentContextStore((s) => s.setCurrentAgent);
  const openFile = usePreviewStore((s) => s.openFile);
  const lastHandledRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (searchParams.get('preview') !== 'session-file') return;
    const sessionId = match?.params?.sessionId ?? null;
    const agentId = searchParams.get('agentId')?.trim() || null;
    const path = searchParams.get('path')?.trim() || '';
    if (!sessionId || !path) return;

    const requestKey = `${sessionId}\n${agentId ?? ''}\n${path}`;
    if (lastHandledRef.current === requestKey) return;
    if (currentSessionId !== sessionId) return;

    if (agentId && currentAgentId !== agentId) {
      if (agents.length === 0 || agents.some((agent) => agent.id === agentId)) {
        setCurrentAgent(agentId);
        useAgentStore.getState().setCurrentSessionId(sessionId);
      }
      return;
    }

    (window as typeof window & { __mossAutoOpenSession?: boolean }).__mossAutoOpenSession = true;
    openFile({
      name: fileNameFromPath(path),
      path,
      level: 'session',
    });
    window.dispatchEvent(new Event('moss:switch-to-session-tab'));
    lastHandledRef.current = requestKey;

    const next = new URLSearchParams(searchParams);
    next.delete('preview');
    next.delete('agentId');
    next.delete('path');
    setSearchParams(next, { replace: true });
  }, [agents, currentAgentId, currentSessionId, match?.params?.sessionId, openFile, searchParams, setCurrentAgent, setSearchParams]);
}

const AppContent: React.FC<{ onOpenAdmin?: () => void }> = ({ onOpenAdmin }) => {
  // selector 订阅，避免无关字段（如 messages append）触发整页重渲染
  const location = useLocation();
  const navigate = useNavigate();
  const openRequest = usePreviewStore((s) => s.openRequest);
  const fetchAgents = useAgentContextStore((s) => s.fetchAgents);
  const fetchLLMConfigs = useAgentContextStore((s) => s.fetchLLMConfigs);
  const currentAgent = useAgentContextStore((s) => s.getCurrentAgent());
  const currentAgentId = useAgentContextStore((s) => s.currentAgentId);
  const agentsLoading = useAgentContextStore((s) => s.agentsLoading);
  const agentsCount = useAgentContextStore((s) => s.agents.length);
  const isSidebarOpen = useAgentStore((s) => s.isSidebarOpen);
  const rightPanelGroupRef = React.useRef<HTMLDivElement>(null);
  const previousAgentIdRef = React.useRef<string | null>(currentAgentId);
  const lastPreviewOpenRequestRef = React.useRef(openRequest);

  const { rightPanelType, ensureWorkspaceOpen, closeRightPanel, workspaceMaximized } = useUiStore(s => ({
    rightPanelType: s.rightPanelType,
    ensureWorkspaceOpen: s.ensureWorkspaceOpen,
    closeRightPanel: s.closeRightPanel,
    workspaceMaximized: s.workspaceMaximized,
  }));

  // 自动打开工作区面板（当会话中有新文件时）
  useAutoOpenSessionFiles();
  useExternalSessionFilePreviewRequest();

  // 初始化数据加载 + 切换空间后重新拉取
  const { loadSession: agentLoadSession } = useAgent();
  const tenantId = useTenantStore((s) => s.currentWorkspace?.tenantId);
  React.useEffect(() => {
    fetchAgents();
    fetchLLMConfigs();
  }, [fetchAgents, fetchLLMConfigs, tenantId]);

  // 监听文件打开请求，自动切换到预览区
  React.useEffect(() => {
    // 当用户点击文件时（openRequest 递增），自动打开预览区
    if (openRequest > lastPreviewOpenRequestRef.current) {
      ensureWorkspaceOpen();
    }
    lastPreviewOpenRequestRef.current = openRequest;
  }, [ensureWorkspaceOpen, openRequest]);

  const isBoardPage = location.pathname === BOARD_HOME_PATH;
  const frontendConfigLoaded = useFrontendConfigStore((state) => state.loaded);
  const dashboardEnabled = useFrontendConfigStore((state) => state.dashboardEnabled);
  const dashboardAvailable = frontendConfigLoaded && dashboardEnabled;
  const canOpenBoard = dashboardAvailable && supportsBoard(currentAgent);
  const boardPanelStateByAgentRef = React.useRef<Record<string, { workspaceMaximized: boolean }>>({});
  const previousPanelAgentIdRef = React.useRef<string | null>(currentAgentId);
  const previousPanelCanOpenBoardRef = React.useRef(canOpenBoard);

  React.useEffect(() => {
    if (frontendConfigLoaded && isBoardPage && currentAgentId && agentsCount > 0 && !agentsLoading && !canOpenBoard) {
      navigate(WORKSPACE_HOME_PATH, { replace: true });
    }
  }, [agentsCount, agentsLoading, canOpenBoard, currentAgentId, frontendConfigLoaded, isBoardPage, navigate]);

  React.useEffect(() => {
    if (frontendConfigLoaded && rightPanelType === 'board' && !canOpenBoard) {
      closeRightPanel();
    }
  }, [canOpenBoard, closeRightPanel, frontendConfigLoaded, rightPanelType]);

  React.useEffect(() => {
    const previousAgentId = previousPanelAgentIdRef.current;
    const didSwitchAgent = previousAgentId !== currentAgentId;
    if (!didSwitchAgent) {
      previousPanelCanOpenBoardRef.current = canOpenBoard;
      return;
    }

    const panelState = useUiStore.getState();
    if (previousAgentId && previousPanelCanOpenBoardRef.current) {
      if (panelState.rightPanelType === 'board') {
        boardPanelStateByAgentRef.current[previousAgentId] = {
          workspaceMaximized: panelState.workspaceMaximized,
        };
      } else {
        delete boardPanelStateByAgentRef.current[previousAgentId];
      }
    }

    if (currentAgentId && !canOpenBoard && panelState.rightPanelType === 'board') {
      closeRightPanel();
      if (location.pathname !== WORKSPACE_HOME_PATH) {
        navigate(WORKSPACE_HOME_PATH, { replace: true });
      }
    }

    if (currentAgentId && canOpenBoard) {
      const rememberedBoardState = boardPanelStateByAgentRef.current[currentAgentId];
      if (rememberedBoardState) {
        useUiStore.setState({
          rightPanelType: 'board',
          workspaceMaximized: rememberedBoardState.workspaceMaximized,
          automationFocusPipelineId: null,
        });
      }
    }

    previousPanelAgentIdRef.current = currentAgentId;
    previousPanelCanOpenBoardRef.current = canOpenBoard;
  }, [canOpenBoard, closeRightPanel, currentAgentId, location.pathname, navigate]);

  React.useEffect(() => {
    const previousAgentId = previousAgentIdRef.current;
    if (previousAgentId && previousAgentId !== currentAgentId) {
      useBoardDraftStore.getState().clearAgentDrafts(previousAgentId, { deleteFiles: true });
    }
    previousAgentIdRef.current = currentAgentId;
  }, [currentAgentId]);

  React.useEffect(() => {
    const cleanupBoardDrafts = () => {
      useBoardDraftStore.getState().clearAllDrafts({ deleteFiles: true, keepalive: true });
    };
    window.addEventListener('beforeunload', cleanupBoardDrafts);
    return () => window.removeEventListener('beforeunload', cleanupBoardDrafts);
  }, []);

  const isRightPanelOpen = rightPanelType !== 'none';
  const [renderedRightPanelType, setRenderedRightPanelType] = React.useState<RightPanelType>(
    rightPanelType !== 'none' ? rightPanelType : 'none'
  );
  const effectiveRightPanelType = rightPanelType !== 'none' ? rightPanelType : renderedRightPanelType;

  // 是否显示右侧面板。关闭时会保留上一块面板 0.3s，等宽度收起后再卸载。
  const showRightPanel = !isBoardPage && effectiveRightPanelType !== 'none';
  const isMaximizableRightPanel = effectiveRightPanelType === 'workspace' || effectiveRightPanelType === 'board';
  const usesInsetDrawerChrome =
    effectiveRightPanelType === 'workspace' ||
    effectiveRightPanelType === 'board' ||
    effectiveRightPanelType === 'automation';
  const isRightPanelMaximized = isRightPanelOpen && isMaximizableRightPanel && workspaceMaximized;
  const [isRightPanelWidthAnimating, setIsRightPanelWidthAnimating] = React.useState(false);
  const [rightPanelAnimatedWidth, setRightPanelAnimatedWidth] = React.useState<number | null>(null);

  // 是否显示聊天区域。右侧面板最大化时仍保留在布局流里，让宽度动画自然把它挤到 0。
  const showChatArea = !isBoardPage;

  // 右侧面板固定宽度 — 工作区 / 智能看板 / 自动化共用同一份比例，避免三类容器宽度不一致。
  const workspaceResize = useResizablePanelWidth({
    storageKey: 'corevo.workspace-panel-width',
    defaultRatio: RIGHT_PANEL_FIXED_RATIO,
    minRatio: RIGHT_PANEL_FIXED_RATIO,
    maxRatio: RIGHT_PANEL_FIXED_RATIO,
    getContainerWidth: () => rightPanelGroupRef.current?.clientWidth ?? 1120,
  });
  const activeResize = workspaceResize;
  const usesFixedRightPanelWidth =
    (effectiveRightPanelType === 'workspace' && !isRightPanelMaximized) ||
    effectiveRightPanelType === 'automation' ||
    (effectiveRightPanelType === 'board' && !isRightPanelMaximized);
  const rightPanelTargetWidth = showRightPanel
    ? (!isRightPanelOpen
        ? 0
        : isMaximizableRightPanel
          ? (isRightPanelMaximized
              ? (rightPanelGroupRef.current?.clientWidth ?? activeResize.width)
              : activeResize.width)
          : (usesFixedRightPanelWidth ? activeResize.width : undefined))
    : undefined;
  const previousRightPanelTargetWidthRef = React.useRef(rightPanelTargetWidth);
  const rightPanelAnimationFrameRef = React.useRef<number | null>(null);
  const hasRightPanelWidthTargetChanged =
    showRightPanel &&
    !activeResize.isResizing &&
    typeof rightPanelTargetWidth === 'number' &&
    previousRightPanelTargetWidthRef.current !== rightPanelTargetWidth;
  const rightPanelDisplayWidth =
    rightPanelAnimatedWidth ??
    (hasRightPanelWidthTargetChanged
      ? (typeof previousRightPanelTargetWidthRef.current === 'number' ? previousRightPanelTargetWidthRef.current : 0)
      : rightPanelTargetWidth);
  const rightPanelOverlayAnchorWidth = isMaximizableRightPanel ? activeResize.width : 0;
  const isRightPanelOverlayActive = showRightPanel
    && isMaximizableRightPanel
    && typeof rightPanelDisplayWidth === 'number'
    && rightPanelDisplayWidth > rightPanelOverlayAnchorWidth + 1;
  const isChatAreaCompressed = !isRightPanelOverlayActive
    && (isRightPanelMaximized || isRightPanelWidthAnimating || hasRightPanelWidthTargetChanged);
  const isRightPanelWidthTransitioning = isRightPanelWidthAnimating || hasRightPanelWidthTargetChanged;
  const isRightPanelClosing = showRightPanel && !isRightPanelOpen && isRightPanelWidthTransitioning;
  // The inset drawer chrome needs symmetric horizontal breathing room beside chat.
  // Keeping this fixed avoids the right panel visually sticking to the chat divider.
  const rightPanelHorizontalInset = usesInsetDrawerChrome
    ? 16
    : 0;
  const shouldFreezeAutomationContentWidth =
    effectiveRightPanelType === 'automation' &&
    isRightPanelClosing &&
    typeof activeResize.width === 'number';
  const frozenAutomationContentWidth = shouldFreezeAutomationContentWidth
    ? Math.max(0, activeResize.width - rightPanelHorizontalInset)
    : undefined;
  const rightPanelContentFrameStyle: React.CSSProperties = frozenAutomationContentWidth === undefined
    ? { height: '100%' }
    : {
        height: '100%',
        width: frozenAutomationContentWidth,
        minWidth: frozenAutomationContentWidth,
        flex: '0 0 auto',
      };
  React.useEffect(() => {
    if (rightPanelType !== 'none') {
      setRenderedRightPanelType(rightPanelType);
    }
  }, [rightPanelType]);

  React.useLayoutEffect(() => {
    if (rightPanelAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(rightPanelAnimationFrameRef.current);
      rightPanelAnimationFrameRef.current = null;
    }

    if (!showRightPanel || activeResize.isResizing) {
      setIsRightPanelWidthAnimating(false);
      setRightPanelAnimatedWidth(null);
      previousRightPanelTargetWidthRef.current = rightPanelTargetWidth;
      if (!showRightPanel) {
        setRenderedRightPanelType('none');
      }
      return;
    }

    if (typeof rightPanelTargetWidth !== 'number') {
      previousRightPanelTargetWidthRef.current = rightPanelTargetWidth;
      return;
    }

    if (previousRightPanelTargetWidthRef.current === rightPanelTargetWidth) {
      return;
    }

    const startWidth =
      typeof previousRightPanelTargetWidthRef.current === 'number'
        ? previousRightPanelTargetWidthRef.current
        : 0;
    const endWidth = rightPanelTargetWidth;
    const duration = 300;

    setIsRightPanelWidthAnimating(true);
    setRightPanelAnimatedWidth(startWidth);

    const startedAt = window.performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      setRightPanelAnimatedWidth(startWidth + (endWidth - startWidth) * eased);

      if (progress < 1) {
        rightPanelAnimationFrameRef.current = window.requestAnimationFrame(step);
        return;
      }

      rightPanelAnimationFrameRef.current = null;
      previousRightPanelTargetWidthRef.current = endWidth;
      setRightPanelAnimatedWidth(null);
      setIsRightPanelWidthAnimating(false);
      if (!isRightPanelOpen) {
        setRenderedRightPanelType('none');
      }
    };

    rightPanelAnimationFrameRef.current = window.requestAnimationFrame(step);

    return () => {
      if (rightPanelAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(rightPanelAnimationFrameRef.current);
        rightPanelAnimationFrameRef.current = null;
      }
    };
  }, [
    activeResize.isResizing,
    isRightPanelMaximized,
    isRightPanelOpen,
    rightPanelTargetWidth,
    showRightPanel,
  ]);
  
  // Billing Banner 状态（页面级，横跨整个工作台）
  const billingStatus = useBillingStore((s) => s.billingStatus);
  const currentWorkspace = useTenantStore((s) => s.currentWorkspace);
  const billingUiState = resolveWorkspaceBillingUiState({
    billingStatus,
    role: currentWorkspace?.role ?? 'member',
  });
  const [showSalesModal, setShowSalesModal] = useState(false);

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}
      data-testid="app-shell"
    >
      {/* Billing Banner — 页面最顶部，横跨全宽（对标 V1: Home.tsx 顶部） */}
      <WorkspaceBillingBanner
        billingUiState={billingUiState}
        onOpenSalesConsult={() => setShowSalesModal(true)}
      />
      <WorkspaceSalesConsultModal open={showSalesModal} onClose={() => setShowSalesModal(false)} />

      {/* 背景装饰 */}
      <BackgroundDecoration />

      {/* 自动化任务完成 Toast 通知 */}
      <Suspense fallback={null}><AutomationToast /></Suspense>

      {/* 主内容区域 */}
      <div
        className="relative flex w-full h-full"
        style={{ padding: 0, gap: 0, flex: 1, minHeight: 0 }}
        data-testid="app-main-layout"
      >
        {/* 侧边栏 */}
        <motion.div
          initial={false}
          animate={{ width: isSidebarOpen ? 260 : 48, opacity: 1 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className={`sidebar-region ${isSidebarOpen ? 'sidebar-region-expanded' : 'sidebar-region-collapsed'} flex-shrink-0 relative z-10`}
          data-testid={isSidebarOpen ? 'sidebar-region-expanded' : 'sidebar-region-collapsed'}
        >
          {isSidebarOpen ? (
            <Sidebar onOpenAdmin={onOpenAdmin} />
          ) : (
            <CollapsedSidebar />
          )}
        </motion.div>

        {/* chat + 右侧面板组：独立子容器，gap:0 以便嵌入可拖拽分隔条 */}
        <div
          ref={rightPanelGroupRef}
          className="relative flex"
          style={{ flex: 1, minWidth: 0, height: '100%', gap: 0 }}
          data-testid="workspace-layout"
        >
          {isBoardPage && BOARD_ENTRY_ENABLED && dashboardAvailable ? (
            <div className="relative z-10" style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
              <Suspense fallback={null}>
                <BoardHomePage />
              </Suspense>
            </div>
          ) : (
            <>
          {/* 主聊天区域 - 全屏预览时通过 CSS 隐藏（保持挂载状态，避免重新渲染） */}
          <div
            className="relative z-10"
            style={{
              flex: 1,
              minWidth: isChatAreaCompressed ? 0 : 400,
              overflow: 'hidden',
              visibility: 'visible',
              position: 'relative',
              opacity: isRightPanelMaximized ? 0.35 : 1,
              transition: 'opacity 0.3s ease',
              pointerEvents: isRightPanelOverlayActive ? 'none' : 'auto',
            }}
            data-testid="chat-region"
          >
            <ChatContainer
              onOpenRoundtable={() => {}}
            />
          </div>

          {showRightPanel && isRightPanelOverlayActive && (
            <div
              aria-hidden="true"
              style={{
                width: rightPanelOverlayAnchorWidth,
                flex: '0 0 auto',
                height: '100%',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* 右侧面板 - 工作区或自动化（互斥） */}
          {showRightPanel && (
            <div
              className="relative z-10"
              style={{
                // 固定比例宽度：使用统一 50% 宽度 + flex:none；最大化右侧面板：铺满剩余空间
                position: isRightPanelOverlayActive ? 'absolute' : 'relative',
                top: isRightPanelOverlayActive ? 0 : undefined,
                right: isRightPanelOverlayActive ? 0 : undefined,
                zIndex: isRightPanelOverlayActive ? 30 : undefined,
                flex: isRightPanelOverlayActive
                  ? 'none'
                  : rightPanelDisplayWidth === undefined ? 1 : '0 0 auto',
                flexBasis: rightPanelDisplayWidth,
                width: rightPanelDisplayWidth,
                minWidth: isRightPanelMaximized || isRightPanelWidthTransitioning || !isRightPanelOpen
                  ? 0
                  : usesFixedRightPanelWidth
                  // Keep workspace, smart board, and automation visually consistent when not maximized.
                  ? RIGHT_PANEL_MIN_WIDTH
                  : 0,
                flexShrink: rightPanelDisplayWidth === undefined ? undefined : 0,
                // 固定宽度右侧面板与 chat 直接相邻；其他非固定面板保留 12px 间隙。
                marginLeft: isRightPanelOverlayActive || usesFixedRightPanelWidth || isRightPanelMaximized ? 0 : (showChatArea ? 12 : 0),
                height: '100%',
                boxSizing: 'border-box',
                overflow: shouldFreezeAutomationContentWidth ? 'hidden' : undefined,
                // Keep left/right chrome padding symmetrical; do not collapse the left inset in normal mode.
                padding: usesInsetDrawerChrome
                  ? '8px'
                  : 0,
                transition: activeResize.isResizing
                  ? 'none'
                  : 'padding 0.3s ease, margin-left 0.3s ease',
                willChange: activeResize.isResizing ? undefined : 'width, padding, margin-left',
              }}
              data-testid="right-panel-region"
            >
              <ComponentErrorBoundary name={
                effectiveRightPanelType === 'workspace'
                  ? '工作区'
                  : effectiveRightPanelType === 'board'
                    ? '智能看板'
                    : '自动化'
              }>
                <Suspense fallback={
                  effectiveRightPanelType === 'automation' ? <AutomationPanelSkeleton /> : <WorkspaceSkeleton />
                }>
                  {effectiveRightPanelType === 'workspace' ? (
                    <div data-testid="right-panel-workspace" style={{ height: '100%' }}>
                      <WorkspaceDrawer />
                    </div>
                  ) : effectiveRightPanelType === 'board' ? (
                    <div data-testid="right-panel-board" style={{ height: '100%' }}>
                      <BoardPanelDrawer />
                    </div>
                  ) : (
                    <div style={rightPanelContentFrameStyle} data-testid="right-panel-automation">
                      <AutomationPanel
                        onClose={closeRightPanel}
                        onLoadSession={(sid) => {
                          useAgentStore.getState().setCurrentSessionId(sid);
                          agentLoadSession(sid);
                        }}
                      />
                    </div>
                  )}
                </Suspense>
              </ComponentErrorBoundary>
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// 背景装饰组件 - Corevo Design System
const BackgroundDecoration: React.FC = React.memo(() => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ display: 'none', willChange: 'auto', contain: 'strict' }}>
      {/* 紫色光晕 */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--glow-purple) 0%, transparent 70%)',
          top: -150,
          left: -100,
          transform: 'translateZ(0)',
        }}
      />
      
      {/* 蓝色光晕 */}
      <div
        className="absolute w-[700px] h-[700px] rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--glow-blue) 0%, transparent 70%)',
          bottom: -200,
          right: -100,
          transform: 'translateZ(0)',
        }}
      />
      
      {/* 紫罗兰光晕 */}
      <div
        className="absolute w-[500px] h-[400px] rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--glow-violet) 0%, transparent 70%)',
          top: -200,
          right: 200,
          transform: 'translateZ(0)',
        }}
      />
    </div>
  );
});

/**
 * URL ↔ agentStore 单向同步（单一 effect，通过变更追踪避免乒乓）
 *
 * 核心原则：
 *   - 初次挂载 / URL 变化 → URL 是真相源（URL→Store）
 *   - 仅 store 变化（WebSocket 生成 sessionId）→ Store→URL
 *   - 两者同时变化时 URL 优先
 *
 * 双 effect 方案的致命缺陷：React 在同一次渲染中用闭包快照值
 * 同时运行两个 effect，导致 URL→Store(reset) 和 Store→URL(navigate)
 * 互相矛盾 → 乒乓无限循环。
 */
function UrlSessionSync() {
  const navigate = useNavigate();
  const location = useLocation();
  const match = useMatch('/s/:sessionId');
  const urlSessionId = match?.params?.sessionId ?? null;
  const isWorkspaceEntry = location.pathname === WORKSPACE_HOME_PATH;
  const currentSessionId = useAgentStore((s) => s.currentSessionId);

  const prevUrlRef = React.useRef<string | null | undefined>(undefined);
  const prevStoreRef = React.useRef<string | null | undefined>(undefined);
  // Tracks whether the initial URL→Store sync has completed.
  // Zustand persist hydration is async (microtask): on first render both values
  // are null, then hydration restores a stale sessionId which looks like a
  // "store-initiated change".  Without this guard the storeChanged branch would
  // navigate to the stale session even though the user is at /.
  const didInitialSync = React.useRef(false);

  React.useEffect(() => {
    const isFirstRun = prevUrlRef.current === undefined;
    const urlChanged = urlSessionId !== prevUrlRef.current;
    const storeChanged = currentSessionId !== prevStoreRef.current;

    prevUrlRef.current = urlSessionId;
    prevStoreRef.current = currentSessionId;

    if (!urlSessionId && !isWorkspaceEntry) {
      didInitialSync.current = true;
      return;
    }

    if (urlSessionId === currentSessionId) {
      didInitialSync.current = true;
      return;
    }

    if (isFirstRun || urlChanged) {
      if (urlSessionId) {
        useAgentStore.getState().setCurrentSessionId(urlSessionId);
      } else if (currentSessionId) {
        const runtime = useSessionRuntimeStore.getState();
        // 新会话的 ID 会在 /jobs 落库前预先生成。路由外壳如果恰好在这个
        // 窗口重新挂载，不能因为消息还没渲染就把 session 清空。
        const isCreatingSession = getSendTaskSession() === currentSessionId;
        const hasLiveSession = isCreatingSession
          || runtime.messages.length > 0
          || hasActiveAssistantMessage(runtime.messages);
        if (hasLiveSession) {
          navigate(sessionPath(currentSessionId), { replace: true });
        } else {
          // /app 是明确的新会话入口。没有可展示的内存会话时清空旧 currentSessionId，
          // 避免持久化状态把用户从新会话入口拽回历史会话。
          useAgentStore.getState().startNewSession();
        }
      }
      didInitialSync.current = true;
      return;
    }

    if (storeChanged) {
      if (!didInitialSync.current && !urlSessionId && currentSessionId) {
        useAgentStore.getState().startNewSession();
        didInitialSync.current = true;
        return;
      }

      if (currentSessionId) {
        navigate(sessionPath(currentSessionId), { replace: true });
      } else if (urlSessionId) {
        navigate(WORKSPACE_HOME_PATH, { replace: true });
      }
    }
  }, [urlSessionId, currentSessionId, isWorkspaceEntry, navigate]);

  return null;
}

/** Layout route: AppContent 始终挂载，不会因 / ↔ /s/:id 切换而卸载 */
function AppLayout() {
  const navigate = useNavigate();
  const sessionMatch = useMatch('/s/:sessionId');
  const [searchParams] = useSearchParams();
  const handleOpenAdmin = useCallback(() => navigate('/admin'), [navigate]);
  const showStandaloneSessionFilePreview = Boolean(
    sessionMatch
    && isMobileDevice()
    && searchParams.get('preview') === 'session-file',
  );

  if (showStandaloneSessionFilePreview) {
    return (
      <Suspense fallback={null}>
        <SessionFilePreviewPage />
      </Suspense>
    );
  }

  return (
    <>
      <UrlSessionSync />
      <AppContent onOpenAdmin={handleOpenAdmin} />
      <Outlet />
    </>
  );
}

function WorkspaceRealtimeLayout() {
  return (
    <MainWebSocketProvider>
      <Outlet />
    </MainWebSocketProvider>
  );
}

const App: React.FC = () => {
  const loadRuntimeConfig = useFrontendConfigStore((state) => state.loadRuntimeConfig);

  React.useEffect(() => {
    void loadRuntimeConfig();
  }, [loadRuntimeConfig]);

  React.useEffect(() => {
    const refreshRuntimeConfig = () => {
      if (document.visibilityState === 'visible') {
        void loadRuntimeConfig({ force: true });
      }
    };
    window.addEventListener('focus', refreshRuntimeConfig);
    document.addEventListener('visibilitychange', refreshRuntimeConfig);
    return () => {
      window.removeEventListener('focus', refreshRuntimeConfig);
      document.removeEventListener('visibilitychange', refreshRuntimeConfig);
    };
  }, [loadRuntimeConfig]);

  return (
    <PageErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <Toaster
          position="top-right"
          richColors
          toastOptions={{
            style: {
              fontFamily: 'inherit',
              fontSize: '14px',
            },
          }}
        />
        <MobileUnsupportedGuard>
        <LegacyStarMigrationRedirect />
        <Routes>
          <Route path={WEBSITE_HOME_PATH} element={<WebsiteHomeRedirect />} />

          {/* 强制飞书登录入口：已登录用户也需要重新走飞书 OAuth。 */}
          <Route path="/login/feishu" element={<FeishuOAuthRedirectRoute />} />

          {/* ── 公开路由：无需登录 ── */}
          {/* 访客守卫：已登录用户访问登录页跳回工作台入口 */}
          <Route element={<GuestGuard />}>
            <Route path="/login" element={<LoginPageRoute />} />
            <Route path="/login/cas" element={<CasLoginPageRoute />} />
            <Route path="/register" element={<RegisterPageRoute />} />
            <Route path="/forgot-password" element={<CasRedirectRoute />} />
          </Route>

          {/* 邀请链接：不套 GuestGuard，已登录也要能预览邀请 */}
          <Route path="/join/:token" element={<WorkspaceJoinInvitePage />} />

          {/* Public share page — outside AuthGuard */}
          <Route path="/share/:token" element={
            <Suspense fallback={null}>
              <SharePage />
            </Suspense>
          } />
          <Route path="/file/:token" element={
            <Suspense fallback={null}>
              <FileSharePage />
            </Suspense>
          } />
          {/* Public showcase page — outside AuthGuard */}
          <Route path="/showcase" element={
            <Suspense fallback={null}>
              <ShowcasePage />
            </Suspense>
          } />
          {/* Platform auth callback — outside AuthGuard */}
          <Route path="/auth/callback" element={
            <Suspense fallback={null}>
              <CallbackPage />
            </Suspense>
          } />
          <Route path="/legacy-star-migrate" element={
            <Suspense fallback={null}>
              <LegacyStarMigrationPage />
            </Suspense>
          } />

          {/* ── 需登录路由 ── */}
          <Route element={<AuthGuard />}>
            {/* 超管验证页（PendingSuperAdmin：未提权超管） */}
            <Route path="/superadmin/verify" element={<SuperAdminVerifyRoute />} />
            {/* 超管后台 */}
            <Route path="/superadmin/*" element={<SuperAdminRouteGate />} />

            {/* 工作区选择/创建（登录后但未选择空间） */}
            <Route path="/onboarding" element={
              <Suspense fallback={null}>
                <OnboardingPage />
              </Suspense>
            } />
            <Route path="/workspace/select" element={<WorkspaceSelectPage />} />
            <Route path="/workspace/join" element={<WorkspaceJoinEntryPage />} />
            <Route path="/workspace/create" element={<WorkspaceCreatePage />} />
            <Route path="/workspace/aliyun-bind" element={<AliyunWorkspaceBindPage />} />
            <Route path="/workspace" element={<WorkspacePathRedirect />} />
            <Route path="/external-channel/bind" element={
              <Suspense fallback={null}>
                <ExternalChannelBindPage />
              </Suspense>
            } />

            {/* ── 需登录 + 需工作区路由 ── */}
            <Route element={<WorkspaceGuard />}>
              <Route element={<WorkspaceRealtimeLayout />}>
                <Route path="/feishu/usage" element={<FeishuUsageDetailRoute />} />
                <Route path="/feishu/usage/:usageId" element={<FeishuUsageDetailRoute />} />
                {/* 管理后台（仅 admin/owner） */}
                <Route element={<AdminGuard />}>
                  <Route path="/admin" element={<AdminEntryRoute />} />
                </Route>

                {/* 工作台兼容入口（共享 AppLayout，避免切换兼容路径时卸载工作台壳） */}
                <Route element={<AppLayout />}>
                  <Route path={WORKSPACE_HOME_PATH} element={null} />
                  <Route path="/s/:sessionId" element={null} />
                  <Route
                    path={BOARD_HOME_PATH}
                    element={BOARD_ENTRY_ENABLED ? null : <Navigate to={WORKSPACE_HOME_PATH} replace />}
                  />
                  <Route path="/me" element={<SettingsOverlayRoute initialTab="profile" />} />
                  <Route path="/settings/workspace" element={<Navigate to="/admin?tab=general&subTab=workspace" replace />} />
                  <Route path="/settings/workspace/members" element={<Navigate to="/admin?tab=general&subTab=members" replace />} />
                  <Route path="/agents" element={<Navigate to="/admin?tab=agents" replace />} />
                  <Route path="/agents/:agentId" element={<Navigate to="/admin?tab=agents" replace />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to={WORKSPACE_HOME_PATH} replace />} />
            </Route>
          </Route>
        </Routes>
        </MobileUnsupportedGuard>
      </ThemeProvider>
    </PageErrorBoundary>
  );
};

export default App;
