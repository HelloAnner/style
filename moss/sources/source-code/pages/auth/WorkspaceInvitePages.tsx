import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  parseTenantInviteErrorCode,
  platformTenantInviteApi,
  type InvitePreview,
} from '../../api/platformTenantInvite';
import { platformAuthApi } from '../../api/platformAuth';
import { useAuthStore } from '../../stores/authStore';
import { TenantErrorCodes } from '../../api/errorCodes';
import { isFeishuUser, useTenantStore } from '../../stores/tenantStore';
import { appendRedirect, useAuthRedirect } from '../../utils/authNavigation';
import { WORKSPACE_HOME_PATH } from '../../utils/routes';
import { requiresOnboardingForTenant } from '../onboarding/onboardingHandoff';

function extractInviteToken(rawValue: string): string | null {
  const normalized = rawValue.trim();
  if (!normalized) {
    return null;
  }
  const pathMatch = normalized.match(/\/join\/([^/?#]+)/);
  if (pathMatch?.[1]) {
    return decodeURIComponent(pathMatch[1]);
  }
  try {
    const url = new URL(normalized, window.location.origin);
    const segments = url.pathname.split('/').filter(Boolean);
    const joinIndex = segments.lastIndexOf('join');
    if (joinIndex >= 0 && segments[joinIndex + 1]) {
      return decodeURIComponent(segments[joinIndex + 1]);
    }
  } catch {
    // ignore and fallback to raw token parsing
  }
  if (!/\s/.test(normalized) && !normalized.endsWith('/')) {
    return normalized;
  }
  return null;
}

function useAuthRehydrated(): boolean {
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

  return rehydrated;
}

/**
 * 邀请页专用的会话就绪判断。
 *
 * `/join/:token` 故意放在 AuthGuard 外（未登录也要能预览邀请），
 * 但 05 号方案后 token 不再落 localStorage，只有 AuthGuard 会调 restoreSession
 * 用 HttpOnly Cookie 换回内存 token。直接跳到邀请页（新标签页、邮件点开等）会让
 * 已登录用户始终被当作未登录——按钮永远显示"通行证登录后加入"、预览永远是 anonymous。
 *
 * 这里补一层：persist 恢复完成后，若有缓存 user 却没 token，主动调一次 restoreSession。
 */
function useInviteSessionReady(): boolean {
  const rehydrated = useAuthRehydrated();
  const isLoading = useAuthStore((s) => s.isLoading);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const triggeredRef = useRef(false);
  const [checking, setChecking] = useState(true);

  // 只在 hydration 完成后触发一次：读取当时的 user/token 快照决定是否需要 restoreSession。
  //
  // 不能通过 useAuthStore selector 订阅 user/token 再放进依赖数组——
  // restoreSession 成功（set user）或失败（logout → user=null）都会更新 user，
  // 触发 effect cleanup 把 stale 置为 true，导致 finally 中 setChecking(false) 被跳过，
  // checking 永远为 true → sessionReady 永远 false → 页面空白（0ea298e 引入的竞态）。
  //
  // 改为 getState() 读快照：只在触发瞬间取一次，不订阅后续变化。
  // triggeredRef 保证只跑一次，无需 cleanup 中的 stale 守卫。
  useEffect(() => {
    if (!rehydrated) return;
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    const { token, user } = useAuthStore.getState();
    // 已有内存 token，或根本没缓存 user → 不需要 cookie refresh
    if (token || !user) {
      setChecking(false);
      return;
    }
    void (async () => {
      try {
        await restoreSession();
      } finally {
        setChecking(false);
      }
    })();
  }, [rehydrated, restoreSession]);

  return rehydrated && !checking && !isLoading;
}

/**
 * 邀请错误码映射（对齐 V1 toInviteErrorText + TenantErrorCodes 精细化）。
 *
 * 错误码来源：
 * - INVITE_ALREADY_ACCEPTED (4007) → 视为"已加入"，调用方可判断进入工作台
 * - INVITE_LINK_EXPIRED (4008)
 * - INVITE_LINK_INVALID (4009)
 * - INVITE_ALREADY_REVOKED (4010)
 * - INVITE_EMAIL_MISMATCH (4011)
 * - 其余兜底：邀请链接无效
 */
function toInviteErrorText(code: string | null): string {
  if (code === TenantErrorCodes.INVITE_ALREADY_ACCEPTED || code === 'INVITE_LINK_ACCEPTED') {
    return '邀请链接已被使用，请向邀请方重新获取';
  }
  if (code === TenantErrorCodes.INVITE_LINK_EXPIRED) {
    return '邀请链接已过期，请向邀请方重新获取';
  }
  if (code === TenantErrorCodes.INVITE_EMAIL_MISMATCH) {
    return '该邀请仅限指定邮箱使用，请换用对应邮箱登录';
  }
  if (code === TenantErrorCodes.INVITE_ALREADY_REVOKED) {
    return '邀请链接已被撤销，请联系邀请方';
  }
  if (code === TenantErrorCodes.INVITE_LINK_INVALID) {
    return '邀请链接无效，请确认链接是否完整';
  }
  if (code === TenantErrorCodes.FEISHU_CHANNEL_OPERATION_DISABLED) {
    return '飞书渠道不支持加入其他企业空间';
  }
  return '邀请链接无效，请确认链接是否完整';
}


/**
 * 邀请链接输入页（原 `/workspace/join`）。
 *
 * 责任范围：
 * - 接收用户输入的邀请链接/邀请 token；
 * - 解析出 token 后跳转到邀请预览页 `/join/:token`；
 * - 仅承接入口，不处理预览和接受逻辑。
 */
export const WorkspaceJoinEntryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rehydrated = useAuthRehydrated();
  const redirectToAuth = useAuthRedirect();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const workspaces = useTenantStore((s) => s.workspaces);
  const initialized = useTenantStore((s) => s.initialized);
  const initializing = useTenantStore((s) => s.initializing);
  const initialize = useTenantStore((s) => s.initialize);
  const [inviteInput, setInviteInput] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && !initialized && !initializing) {
      void initialize();
    }
  }, [initialize, initialized, initializing, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !initialized || initializing || !isFeishuUser(workspaces)) {
      return;
    }
    navigate(appendRedirect('/workspace/select', searchParams.get('redirect')), { replace: true });
  }, [initialized, initializing, isAuthenticated, navigate, searchParams, workspaces]);

  if (!rehydrated) {
    return null;
  }

  if (!isAuthenticated) {
    return redirectToAuth('/login');
  }

  if (!initialized || initializing) {
    return null;
  }

  if (isFeishuUser(workspaces)) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--bg-primary)' }} data-testid="workspace-join-entry-page">
      <div
        data-testid="workspace-join-entry-card"
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'var(--glass-bg)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 16,
          padding: 24,
          boxShadow: 'var(--panel-shadow)',
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
          加入企业空间
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          粘贴邀请链接或输入邀请码，预览后可加入目标空间
        </p>

        <form
          data-testid="workspace-join-entry-form"
          onSubmit={(event) => {
            event.preventDefault();
            const token = extractInviteToken(inviteInput);
            if (!inviteInput.trim()) {
              setErrorText('请输入邀请链接或邀请码');
              return;
            }
            if (!token) {
              setErrorText('无法解析邀请链接，请检查后重试');
              return;
            }
            setErrorText(null);
            navigate(`/join/${encodeURIComponent(token)}`, { replace: true });
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <input
            type="text"
            value={inviteInput}
            onChange={(event) => {
              setInviteInput(event.target.value);
              if (errorText) {
                setErrorText(null);
              }
            }}
            placeholder="例如：https://xxx.com/join/inv_xxxxx"
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

          {errorText && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(239, 68, 68, 0.25)',
                background: 'rgba(239, 68, 68, 0.08)',
                color: '#EF4444',
                fontSize: 13,
              }}
            >
              {errorText}
            </div>
          )}

          <button
            type="submit"
            style={{
              marginTop: 2,
              width: '100%',
              padding: '11px 12px',
              border: 'none',
              borderRadius: 10,
              background: 'var(--send-btn-active-bg)',
              color: 'var(--send-btn-active-icon)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            预览邀请
          </button>

          <button
            type="button"
            onClick={() => {
              navigate(
                appendRedirect('/workspace/select', searchParams.get('redirect')),
                { replace: true },
              );
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--input-border)',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            去选择空间
          </button>
        </form>
      </div>
    </div>
  );
};

/**
 * 邀请预览与确认页（`/join/:token`）。
 *
 * 业务含义：
 * - 承载公开链接与邮件邀请的预览与确认；
 * - 未登录时先引导 CAS 登录，登录后回到当前邀请页继续确认加入；
 * - 已是成员时直接展示「进入工作台」。
 *
 * 状态机（对齐 V1 JoinWorkspaceInvite.tsx）：
 *   loading → 拉预览中
 *   not-logged-in + acceptEnabled → 引导 CAS 登录
 *   can-join → 可确认加入
 *   already-member → 已加入，进入工作台
 *   error → 邀请不可用（expired / invalid / revoked / email-mismatch）
 *
 * 固定亮色主题：用户可能未登录，不使用 CSS 变量主题色，使用固定亮色颜色值。
 *
 * 关键逻辑对齐：
 * - previewInvite：调 platformTenantInviteApi.previewInvite(token)
 * - acceptInvite：调 useTenantStore.getState().acceptInvite(token)（内部已含 refresh）
 * - INVITE_ALREADY_ACCEPTED：视为 already-member，进入工作台而不报错
 * - 未登录：「通行证登录后加入」跳 /login?redirect=/join/<token>，再由 /login 统一中转 CAS
 *
 * @see V1 src/pages/tenant/JoinWorkspaceInvite.tsx — 逻辑来源
 */
export const WorkspaceJoinInvitePage: React.FC = () => {
  const { token: inviteToken } = useParams<{ token: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const sessionReady = useInviteSessionReady();
  const { isAuthenticated, token } = useAuthStore();

  // tenantStore.acceptInvite 完整处理加入 + refreshWorkspaces + refreshCurrentWorkspace
  const acceptInvite = useTenantStore((s) => s.acceptInvite);
  const workspaces = useTenantStore((s) => s.workspaces);
  const initialized = useTenantStore((s) => s.initialized);
  const initializing = useTenantStore((s) => s.initializing);
  const initialize = useTenantStore((s) => s.initialize);

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [previewErrorText, setPreviewErrorText] = useState<string | null>(null);
  const [actionErrorText, setActionErrorText] = useState<string | null>(null);
  const previewAuthModeRef = useRef<'anonymous' | 'authenticated' | null>(null);
  const feishuChannelUser = isAuthenticated && initialized && isFeishuUser(workspaces);

  useEffect(() => {
    if (sessionReady && isAuthenticated && !initialized && !initializing) {
      void initialize();
    }
  }, [initialize, initialized, initializing, isAuthenticated, sessionReady]);

  // redirect 目标：包含当前 pathname + search（含 token），登录后回到邀请页
  const redirectTarget = `${location.pathname}${location.search}`;

  const alreadyMember = Boolean(preview?.alreadyMember);
  const acceptEnabled = preview?.status === 'active' || preview?.status === 'pending';
  // 展示预览详情：有有效邀请（可接受 / 已是成员的 accepted 状态）
  const showPreviewDetails =
    Boolean(preview) && (acceptEnabled || (alreadyMember && preview?.status === 'accepted'));
  // 未登录且邀请可接受时展示引导登录
  const showGuestGuide = sessionReady && !isAuthenticated && acceptEnabled;
  const showJoinAction = Boolean(preview) && acceptEnabled && !alreadyMember;
  const showEnterAction = Boolean(preview) && alreadyMember && isAuthenticated;
  const showPrimaryAction = (showJoinAction && !feishuChannelUser) || showEnterAction;
  const feishuJoinBlocked = feishuChannelUser && showJoinAction;

  // 卡片底部状态提示：loading → 灰色小字；已加入 → 绿色 Banner；错误 → 红色 Banner。
  // 三态互斥，用 hintKind 区分渲染样式。
  const hintKind: 'loading' | 'success' | 'error' | null = loading
    ? 'loading'
    : showPreviewDetails && alreadyMember
      ? 'success'
      : previewErrorText
        ? 'error'
        : null;
  const hintText =
    hintKind === 'loading'
      ? '加载中...'
      : hintKind === 'success'
        ? '你已加入该空间，可直接进入工作台'
        : hintKind === 'error'
          ? previewErrorText
          : null;

  // ── 拉取预览 ──
  // 对齐 V1：未登录和已登录各只拉一次（previewAuthModeRef 防重复）
  const loadPreview = useCallback(async () => {
    if (!inviteToken) {
      setPreviewErrorText('邀请链接无效');
      setPreview(null);
      return;
    }
    setLoading(true);
    setPreviewErrorText(null);
    try {
      const data = await platformTenantInviteApi.previewInvite(inviteToken);
      setPreview(data);
      if (data.status !== 'active' && data.status !== 'pending') {
        // 非 active/pending 状态（revoked/expired/accepted）：转为错误提示
        setPreviewErrorText(toInviteErrorText(`INVITE_LINK_${data.status.toUpperCase()}`));
      }
    } catch (error) {
      setPreview(null);
      setPreviewErrorText(toInviteErrorText(parseTenantInviteErrorCode(error)));
    } finally {
      setLoading(false);
    }
  }, [inviteToken]);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }
    const targetMode = token ? 'authenticated' : 'anonymous';
    if (previewAuthModeRef.current === targetMode) {
      return;
    }
    previewAuthModeRef.current = targetMode;
    void loadPreview();
  }, [sessionReady, token, loadPreview]);

  // ── 接受邀请 / 进入工作台 ──
  const handleAccept = useCallback(async () => {
    if (!inviteToken) {
      setActionErrorText('邀请链接无效');
      return;
    }
    if (!isAuthenticated) {
      navigate(appendRedirect('/login', redirectTarget), { replace: true });
      return;
    }
    if (feishuChannelUser && !alreadyMember) {
      setActionErrorText('飞书渠道不支持加入其他企业空间');
      return;
    }
    setJoining(true);
    setActionErrorText(null);
    try {
      if (alreadyMember) {
        // 已是成员：直接进入工作台（tenantStore 已初始化，不需要重新 accept）
        navigate(WORKSPACE_HOME_PATH, { replace: true });
        return;
      }
      // 接受邀请：tenantStore.acceptInvite 内部含 refreshWorkspaces + refreshCurrentWorkspace
      const accepted = await acceptInvite(inviteToken);
      if (accepted.alreadyMember) {
        // alreadyMember 响应：同样进入工作台
        navigate(WORKSPACE_HOME_PATH, { replace: true });
        return;
      }
      const me = await platformAuthApi.me();
      navigate(requiresOnboardingForTenant(me.onboarding, accepted.tenantId)
        ? '/onboarding'
        : WORKSPACE_HOME_PATH, { replace: true });
    } catch (error: unknown) {
      const inviteCode = parseTenantInviteErrorCode(error);
      if (inviteCode === TenantErrorCodes.INVITE_ALREADY_ACCEPTED) {
        // INVITE_ALREADY_ACCEPTED 视为"已是成员"，直接进入工作台
        navigate(WORKSPACE_HOME_PATH, { replace: true });
        return;
      }
      if (inviteCode) {
        setActionErrorText(toInviteErrorText(inviteCode));
      } else if (error instanceof Error && error.message) {
        setActionErrorText(error.message);
      } else {
        setActionErrorText('加入空间失败，请稍后重试');
      }
    } finally {
      setJoining(false);
    }
  }, [acceptInvite, alreadyMember, feishuChannelUser, inviteToken, isAuthenticated, navigate, redirectTarget]);

  if (!sessionReady) {
    return null;
  }
  if (isAuthenticated && (!initialized || initializing)) {
    return null;
  }

  // ── 固定亮色主题色板（公开页，不用 CSS 变量）──
  const C = {
    bg: '#ffffff',
    pageBg: '#f8f8f8',
    text: '#18181b',
    textMuted: '#71717a',
    border: '#e4e4e7',
    inputBg: '#fafafa',
    btnPrimary: '#18181B',
    btnPrimaryText: '#ffffff',
    btnSecondaryBorder: '#e4e4e7',
    errorBg: 'rgba(239,68,68,0.08)',
    errorBorder: 'rgba(239,68,68,0.25)',
    errorText: '#dc2626',
    successBg: 'rgba(34,197,94,0.08)',
    successBorder: 'rgba(34,197,94,0.25)',
    successText: '#16a34a',
    infoBg: 'rgba(59,130,246,0.08)',
    infoBorder: 'rgba(59,130,246,0.25)',
    infoText: '#2563eb',
  } as const;

  return (
    <div
      data-testid="workspace-join-invite-page"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: C.pageBg,
      }}
    >
      <div
        data-testid="workspace-join-invite-card"
        style={{
          width: '100%',
          maxWidth: 520,
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: '28px 28px 24px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}
      >
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: C.text,
            margin: '0 0 18px',
          }}
        >
          加入企业空间
        </h1>

        {/* 未登录引导 */}
        {showGuestGuide && (
          <div
            data-testid="workspace-join-invite-login-guide"
            style={{
              marginBottom: 14,
              padding: '10px 14px',
              borderRadius: 10,
              border: `1px solid ${C.infoBorder}`,
              background: C.infoBg,
              color: C.infoText,
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            请先通过帆软通行证登录，认证完成后会自动回到当前邀请页。
          </div>
        )}

        {/* 邀请详情卡片 */}
        <div
          data-testid="workspace-join-invite-preview"
          style={{
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.inputBg,
            padding: 16,
            marginBottom: 14,
          }}
        >
          {showPreviewDetails ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <span style={{ width: 80, flexShrink: 0, color: C.textMuted, fontSize: 13 }}>
                  空间名称
                </span>
                <strong style={{ color: C.text, fontSize: 14 }}>{preview?.workspace.name}</strong>
              </div>
              {preview?.workspace.enterpriseName ? (
                <div style={{ display: 'flex', gap: 14 }}>
                  <span style={{ width: 80, flexShrink: 0, color: C.textMuted, fontSize: 13 }}>
                    所属企业
                  </span>
                  <strong style={{ color: C.text, fontSize: 14 }}>
                    {preview.workspace.enterpriseName}
                  </strong>
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: 14 }}>
                <span style={{ width: 80, flexShrink: 0, color: C.textMuted, fontSize: 13 }}>
                  邀请类型
                </span>
                <strong style={{ color: C.text, fontSize: 14 }}>
                  {preview?.inviteType === 'EMAIL' ? '邮件邀请' : '公开链接邀请'}
                </strong>
              </div>
              {preview?.inviteeEmail ? (
                <div style={{ display: 'flex', gap: 14 }}>
                  <span style={{ width: 80, flexShrink: 0, color: C.textMuted, fontSize: 13 }}>
                    受邀邮箱
                  </span>
                  <strong style={{ color: C.text, fontSize: 14 }}>{preview.inviteeEmail}</strong>
                </div>
              ) : null}
              {preview?.expiresAt ? (
                <div style={{ display: 'flex', gap: 14 }}>
                  <span style={{ width: 80, flexShrink: 0, color: C.textMuted, fontSize: 13 }}>
                    过期时间
                  </span>
                  <strong
                    style={{ color: C.text, fontSize: 14, whiteSpace: 'nowrap' }}
                  >
                    {new Date(preview.expiresAt).toLocaleString('zh-CN')}
                  </strong>
                </div>
              ) : null}
            </div>
          ) : loading ? null : (
            <strong style={{ color: C.textMuted, fontSize: 14 }}>当前邀请不可用</strong>
          )}

          {hintKind === 'loading' && hintText ? (
            <div style={{ marginTop: 10, color: C.textMuted, fontSize: 13, lineHeight: 1.5 }}>
              {hintText}
            </div>
          ) : null}
        </div>

        {hintKind === 'success' && hintText ? (
          <div
            style={{
              marginBottom: 14,
              padding: '10px 14px',
              borderRadius: 10,
              border: `1px solid ${C.successBorder}`,
              background: C.successBg,
              color: C.successText,
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{hintText}</span>
          </div>
        ) : null}

        {hintKind === 'error' && hintText ? (
          <div
            style={{
              marginBottom: 14,
              padding: '10px 14px',
              borderRadius: 10,
              border: `1px solid ${C.errorBorder}`,
              background: C.errorBg,
              color: C.errorText,
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>{hintText}</span>
          </div>
        ) : null}

        {/* 操作错误 */}
        {actionErrorText ? (
          <div
            style={{
              marginBottom: 14,
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${C.errorBorder}`,
              background: C.errorBg,
              color: C.errorText,
              fontSize: 13,
            }}
          >
            {actionErrorText}
          </div>
        ) : null}

        {feishuJoinBlocked ? (
          <div
            style={{
              marginBottom: 14,
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${C.errorBorder}`,
              background: C.errorBg,
              color: C.errorText,
              fontSize: 13,
            }}
          >
            飞书渠道不支持加入其他企业空间
          </div>
        ) : null}

        {/* 主操作按钮 */}
        {showPrimaryAction ? (
          <button
            type="button"
            disabled={joining || loading}
            onClick={() => void handleAccept()}
            style={{
              width: '100%',
              padding: '11px 12px',
              border: 'none',
              borderRadius: 10,
              background: C.btnPrimary,
              color: C.btnPrimaryText,
              fontSize: 14,
              fontWeight: 500,
              cursor: joining || loading ? 'not-allowed' : 'pointer',
              opacity: joining || loading ? 0.6 : 1,
            }}
          >
            {joining
              ? '处理中...'
              : showEnterAction
                ? '进入工作台'
                : isAuthenticated
                  ? '加入企业空间'
                  : '通行证登录后加入'}
          </button>
        ) : null}
      </div>
    </div>
  );
};
