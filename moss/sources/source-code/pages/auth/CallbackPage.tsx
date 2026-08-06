import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore, type User, type Tenant } from '../../stores/authStore';
import { platformTenantApi } from '../../api/platformTenant';
import { platformAuthApi } from '../../api/platformAuth';
import { AccountErrorCodes, getErrorCode } from '../../api/errorCodes';
import { appendRedirect, resolveContinueTarget } from '../../utils/authNavigation';
import { WORKSPACE_HOME_PATH } from '../../utils/routes';
import { requiresOnboardingForTenant } from '../onboarding/onboardingHandoff';

const CALLBACK_CODE_SINGLE_FLIGHT_TTL_MS = 30_000;

const callbackCodeExchanges = new Map<string, {
  promise: Promise<string>;
  expiresAt: number;
  timeoutId: ReturnType<typeof setTimeout>;
}>();

function isInviteContinueTarget(target: string): boolean {
  return target.startsWith('/join/');
}

function isOnboardingTarget(target: string): boolean {
  try {
    const url = new URL(target, 'http://localhost');
    return url.pathname === '/onboarding';
  } catch {
    return false;
  }
}

function callbackUrlWithoutSensitiveParams(searchParams: URLSearchParams): string {
  const next = new URLSearchParams(searchParams);
  next.delete('token');
  next.delete('code');
  const query = next.toString();
  return query ? `/auth/callback?${query}` : '/auth/callback';
}

function completeCallbackOnce(code: string): Promise<string> {
  const now = Date.now();
  const existing = callbackCodeExchanges.get(code);
  if (existing && existing.expiresAt > now) {
    return existing.promise;
  }
  if (existing) {
    clearTimeout(existing.timeoutId);
    callbackCodeExchanges.delete(code);
  }

  const promise = platformAuthApi.completeCallback(code)
    .then((response) => response.token)
    .catch((error) => {
      const current = callbackCodeExchanges.get(code);
      if (current?.promise === promise) {
        clearTimeout(current.timeoutId);
        callbackCodeExchanges.delete(code);
      }
      throw error;
    });

  const timeoutId = setTimeout(() => {
    const current = callbackCodeExchanges.get(code);
    if (current?.promise === promise) {
      callbackCodeExchanges.delete(code);
    }
  }, CALLBACK_CODE_SINGLE_FLIGHT_TTL_MS);

  callbackCodeExchanges.set(code, {
    promise,
    expiresAt: now + CALLBACK_CODE_SINGLE_FLIGHT_TTL_MS,
    timeoutId,
  });
  return promise;
}

type LoginFailureStage = 'callback' | 'refresh' | 'initialize';

function resolveCallbackErrorMessage(error: unknown, stage: LoginFailureStage): string {
  const code = getErrorCode(error);
  const status = error && typeof error === 'object'
    ? (error as { status?: unknown }).status
    : undefined;
  if (stage === 'callback' && code === AccountErrorCodes.AUTH_TOKEN_INVALID) {
    return '登录回调已失效，请重新登录';
  }
  if (stage === 'refresh' && (
    code === AccountErrorCodes.AUTH_TOKEN_INVALID ||
    code === AccountErrorCodes.REFRESH_TOKEN_EXPIRED ||
    status === 401
  )) {
    return '登录状态已过期，请重新登录';
  }
  return '登录已完成，但初始化工作区失败，请刷新后重试';
}

export function __clearCallbackExchangeCacheForTest(): void {
  callbackCodeExchanges.forEach((entry) => clearTimeout(entry.timeoutId));
  callbackCodeExchanges.clear();
}

/**
 * OAuth/CAS 回调页面。
 *
 * 后端回调只携带短期一次性 code，本页用同源接口换取本地会话，
 * 然后完成完整登录流程（包括 switch-tenant 获取正确 token）。
 */
export default function CallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const login = useAuthStore((s) => s.login);
  const clearCallbackStaleWorkspaceState = useAuthStore((s) => s.clearCallbackStaleWorkspaceState);
  const redirectTarget = resolveContinueTarget(searchParams.get('redirect'), WORKSPACE_HOME_PATH);
  const aliyunState = searchParams.get('aliyunState')?.trim() || null;
  const retryLoginRedirect = aliyunState
    ? callbackUrlWithoutSensitiveParams(searchParams)
    : redirectTarget;

  useEffect(() => {
    setErrorMessage(null);
    const hasUrlToken = searchParams.has('token');
    const callbackCode = searchParams.get('code')?.trim() || null;
    if (hasUrlToken || callbackCode) {
      window.history.replaceState(null, '', callbackUrlWithoutSensitiveParams(searchParams));
    }
    console.log('[FE-DEBUG][CallbackPage]', '回调开始', { hasUrlToken, hasCode: !!callbackCode, redirectTarget, hasAliyunState: !!aliyunState });

    let cancelled = false;

    const completeLogin = async () => {
      let failureStage: LoginFailureStage = callbackCode ? 'callback' : 'refresh';
      try {
        // callback 代表一次新的登录完成回调。先清掉旧账号的租户选择和工作台运行态，
        // 避免新 token 携带旧 X-Tenant-Id 请求平台接口。
        clearCallbackStaleWorkspaceState();

        const token = callbackCode
          ? await completeCallbackOnce(callbackCode)
          : (await platformAuthApi.refreshToken()).token;
        if (!token) {
          throw new Error('获取登录令牌失败');
        }
        if (cancelled) return;
        failureStage = 'initialize';

        // 再用 access token 临时存入 store，以便后续 API 请求能带上 Authorization。
        useAuthStore.setState({ token, isLoading: true });

        const aliyunBinding = aliyunState
          ? await platformAuthApi.bindAliyunMarketplace(aliyunState, token)
          : null;
        if (aliyunBinding) {
          if (cancelled) return;
        }

        // 获取用户信息（统一走平台 API，避免响应结构漂移）
        const me = await platformAuthApi.me();
        const currentUser = me.user;
        if (!currentUser?.id) {
          throw new Error('获取用户信息失败');
        }
        console.log('[FE-DEBUG][CallbackPage]', 'me() 结果', { userId: currentUser.id, lastTenantId: me.lastTenantId });

        const user: User = {
          id: currentUser.id ?? '',
          phone: currentUser.phone ?? undefined,
          email: currentUser.email ?? '',
          nickname: currentUser.nickname ?? undefined,
          passport_username: currentUser.passport_username ?? undefined,
          avatar_url: currentUser.avatar ?? undefined,
          isSuperAdmin: currentUser.isSuperAdmin ?? false,
          saVerified: currentUser.saVerified ?? false,
          created_at: new Date().toISOString(),
        };

        if (aliyunState && aliyunBinding?.selectionRequired) {
          login(token, user, null);
          const bindParams = new URLSearchParams({ state: aliyunState, redirect: redirectTarget });
          navigate(`/workspace/aliyun-bind?${bindParams.toString()}`, { replace: true });
          return;
        }

        // 获取工作区列表
        const workspaces = await platformTenantApi.listWorkspaces();

        if (cancelled) return;

        if (workspaces.length === 0) {
          login(token, user, null);
          if (isInviteContinueTarget(redirectTarget)) {
            console.log('[FE-DEBUG][CallbackPage]', '无工作区但来自邀请 → 回邀请页继续加入');
            navigate(redirectTarget, { replace: true });
            return;
          }
          navigate(appendRedirect('/workspace/create', redirectTarget), { replace: true });
          return;
        }

        // 选择目标工作区
        const targetWs = workspaces.find((w) => w.tenantId === me.lastTenantId)
          || workspaces[0];

        console.log('[FE-DEBUG][CallbackPage]', '工作区选择', { workspacesCount: workspaces.length, selectedTenantId: targetWs.tenantId });

        // switch-tenant 获取正确 token
        const switched = await platformAuthApi.switchTenant(targetWs.tenantId, token);
        console.log('[FE-DEBUG][CallbackPage]', 'switch-tenant 结果', { newTokenPrefix: switched.token?.slice(0, 8) });

        if (cancelled) return;

        const tenant: Tenant = {
          id: targetWs.tenantId,
          name: targetWs.workspaceName ?? '',
          plan: (targetWs.planType as Tenant['plan']) ?? 'free',
          max_agents: 0,
          monthly_token_quota: 0,
          created_at: new Date().toISOString(),
        };

        login(switched.token, user, tenant);
        if (requiresOnboardingForTenant(me.onboarding, targetWs.tenantId)) {
          navigate(appendRedirect('/onboarding', redirectTarget), { replace: true });
          return;
        }
        navigate(isOnboardingTarget(redirectTarget) ? WORKSPACE_HOME_PATH : redirectTarget, { replace: true });
      } catch (e) {
        console.error('[FE-DEBUG][CallbackPage]', '回调流程失败', e);
        if (!cancelled) {
          setErrorMessage(resolveCallbackErrorMessage(e, failureStage));
        }
      }
    };

    completeLogin();
    return () => { cancelled = true; };
  }, [searchParams, login, clearCallbackStaleWorkspaceState, navigate, redirectTarget, aliyunState]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }} data-testid="auth-callback-page">
      {errorMessage ? (
        <div style={{ textAlign: 'center' }}>
          <p data-testid="auth-callback-error">{errorMessage}</p>
          <button
            type="button"
            onClick={() => {
              window.location.href = `/login?redirect=${encodeURIComponent(retryLoginRedirect)}`;
            }}
          >
            重新登录
          </button>
        </div>
      ) : (
        <p data-testid="auth-callback-status">正在验证身份...</p>
      )}
    </div>
  );
}
