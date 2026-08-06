/**
 * 工作空间入口页面集合：选择 / 创建。
 *
 * 逻辑层完整对齐 V1 fineinsight `pages/tenant/WorkspaceSelect.tsx` 和
 * `pages/tenant/CreateWorkspace.tsx`，仅 UI 按 V2 prototype 重写（亮色主题）。
 *
 * 关键决策：
 * - selectWorkspace 为纯本地操作（写 localStorage + refreshCurrentWorkspace），不换 token
 * - createWorkspace 不涉及 token 切换（V1 设计，平台通过 X-Tenant-Id header 识别租户）
 * - hasSelfBuiltWorkspace() 判断是否隐藏"创建新空间"入口
 * - 企业搜索使用内联实现（带 300ms 防抖，最少 2 个字符触发）
 */

import React, { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { TenantErrorCodes, getErrorCode } from '../../api/errorCodes';
import { type CompanySearchItem, platformTenantApi } from '../../api/platformTenant';
import { useAuthStore } from '../../stores/authStore';
import {
  hasSelfBuiltWorkspace,
  isFeishuUser,
  needsEnterpriseBinding,
  useTenantStore,
} from '../../stores/tenantStore';
import {
  AlertIcon,
  AuthCardLayout,
  C,
  CorevoLogo,
  ErrorBanner,
  PrimarySubmitButton,
} from './_shared';
import {
  appendRedirect,
  resolveContinueTarget,
  useAuthRedirect,
  useContinueNavigation,
} from '../../utils/authNavigation';
import { WORKSPACE_HOME_PATH } from '../../utils/routes';
import {
  readOnboardingDraft,
  saveOnboardingDraft,
} from '../onboarding/onboardingHandoff';

// ── 工具函数 ──

function resolveRedirect(value: string | null): string {
  return resolveContinueTarget(value, WORKSPACE_HOME_PATH);
}

function defaultWorkspaceName(companyName: string): string {
  const shortName = companyName.replace(/(集团)?(股份)?有限公司$/, '').trim();
  return `${shortName || companyName}空间`;
}

function resolveWorkspaceRoleLabel(role?: string | null): string {
  if (role === 'owner') return '所有者';
  if (role === 'admin') return '管理员';
  return '成员';
}

function resolveWorkspacePlanLabel(planType?: string | null): string {
  return planType === 'official' ? '正式版' : '试用版';
}

function resolveWorkspaceStatusLabel(planStatus?: string | null): string | null {
  if (planStatus === 'expired') return '已过期';
  if (planStatus === 'exhausted') return '已用尽';
  return null;
}

function mapTenantErrorToMessage(error: unknown, fallback: string): string {
  const code = getErrorCode(error);
  if (code === TenantErrorCodes.WORKSPACE_CREATE_LIMIT_REACHED) return '已创建过工作空间，无法重复创建';
  if (code === TenantErrorCodes.FEISHU_CHANNEL_OPERATION_DISABLED) return '飞书渠道不支持通过 MOSS 后台创建企业空间';
  if (code === TenantErrorCodes.CREDIT_CODE_DUPLICATED) return '该企业统一社会信用代码已被注册';
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

// ── WorkspaceSelectPage ──

/**
 * 工作空间选择页面。
 *
 * 展示用户可访问的所有工作空间，提供切换入口。
 * 当工作空间列表为空时自动跳转到创建页。
 * 已有 owner 角色的工作空间时隐藏"创建新空间"入口。
 */
export const WorkspaceSelectPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectToAuth = useAuthRedirect();
  const continueNav = useContinueNavigation();

  const workspaces = useTenantStore((s) => s.workspaces);
  const currentWorkspace = useTenantStore((s) => s.currentWorkspace);
  const initialized = useTenantStore((s) => s.initialized);
  const initializing = useTenantStore((s) => s.initializing);
  const initialize = useTenantStore((s) => s.initialize);
  const selectWorkspace = useTenantStore((s) => s.selectWorkspace);
  const refreshWorkspaces = useTenantStore((s) => s.refreshWorkspaces);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [submittingTenantId, setSubmittingTenantId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const feishuChannelUser = isFeishuUser(workspaces);
  const createBlocked = feishuChannelUser || hasSelfBuiltWorkspace(workspaces, currentWorkspace);

  // 触发初始化
  useEffect(() => {
    if (!initialized && !initializing) {
      void initialize();
    }
  }, [initialize, initialized, initializing]);

  // 进入选择页时重新拉取最新工作区列表：
  // 兜底被移除等场景下列表与服务端不一致的问题（多 tab / store 漏清理）。
  useEffect(() => {
    if (!initialized || initializing) return;
    void refreshWorkspaces().catch(() => {
      // 拉取失败不阻塞页面渲染，保持当前列表
    });
  }, [initialized, initializing, refreshWorkspaces]);

  // 空列表自动跳转创建页（对齐 V1 WorkspaceSelect 逻辑）
  useEffect(() => {
    if (initialized && !initializing && workspaces.length === 0) {
      navigate(
        appendRedirect('/workspace/create', searchParams.get('redirect')),
        { replace: true },
      );
    }
  }, [initialized, initializing, navigate, searchParams, workspaces.length]);

  if (!isAuthenticated) {
    return redirectToAuth('/login');
  }

  if (!initialized || initializing) {
    return (
      <AuthCardLayout testId="workspace-select-page" cardTestId="workspace-select-card">
        <CorevoLogo />
        <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 13, padding: '20px 0' }} data-testid="workspace-select-loading">
          正在加载工作空间...
        </div>
      </AuthCardLayout>
    );
  }

  const handleSelect = async (tenantId: string) => {
    setSubmittingTenantId(tenantId);
    setErrorText(null);
    try {
      await selectWorkspace(tenantId);
      continueNav({ defaultPath: WORKSPACE_HOME_PATH });
    } catch {
      setErrorText('切换工作空间失败，请重试');
    } finally {
      setSubmittingTenantId(null);
    }
  };

  const handleCreate = () => {
    navigate(
      appendRedirect('/workspace/create', searchParams.get('redirect')),
      { replace: true },
    );
  };

  const handleJoin = () => {
    navigate(
      appendRedirect('/workspace/join', searchParams.get('redirect')),
      { replace: true },
    );
  };

  return (
    <AuthCardLayout testId="workspace-select-page" cardTestId="workspace-select-card">
      <CorevoLogo />

      <div style={{ marginBottom: 24 }} data-testid="workspace-select-header">
        <h2 style={{ fontSize: 22, fontWeight: 600, color: C.textPrimary, marginBottom: 6 }}>
          选择工作空间
        </h2>
        <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>
          请选择一个工作空间继续
        </p>
      </div>

      {errorText && <ErrorBanner message={errorText} />}

      {/* 工作空间列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }} data-testid="workspace-select-list">
        {workspaces.map((workspace) => {
          const isCurrent = currentWorkspace?.tenantId === workspace.tenantId;
          const isSelecting = submittingTenantId === workspace.tenantId;
          const planLabel = resolveWorkspacePlanLabel(workspace.planType);
          const statusLabel = resolveWorkspaceStatusLabel(workspace.planStatus);
          const roleLabel = resolveWorkspaceRoleLabel(workspace.role);

          return (
            <div
              key={workspace.tenantId}
              data-testid={`workspace-select-item-${workspace.tenantId}`}
              style={{
                padding: '14px 16px',
                borderRadius: 10,
                border: `1px solid ${isCurrent ? C.btnBg : C.inputBorder}`,
                background: isCurrent ? C.bgTertiary : C.inputBg,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* 空间信息行 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: C.textPrimary }}>
                    {workspace.name}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                    {roleLabel}
                  </div>
                </div>
                {/* 标签区 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 7px',
                      borderRadius: 4,
                      background: workspace.planType === 'official' ? '#f0fdf4' : '#fefce8',
                      color: workspace.planType === 'official' ? '#15803d' : '#a16207',
                      border: `1px solid ${workspace.planType === 'official' ? '#bbf7d0' : '#fde68a'}`,
                      fontWeight: 500,
                    }}
                  >
                    {planLabel}
                  </span>
                  {statusLabel && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: '#fef2f2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        fontWeight: 500,
                      }}
                    >
                      {statusLabel}
                    </span>
                  )}
                  {isCurrent && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: C.bgTertiary,
                        color: C.textMuted,
                        border: `1px solid ${C.borderSubtle}`,
                      }}
                    >
                      当前
                    </span>
                  )}
                </div>
              </div>

              {/* 进入按钮 */}
              <button
                type="button"
                disabled={submittingTenantId !== null}
                onClick={() => void handleSelect(workspace.tenantId)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: 'none',
                  borderRadius: 7,
                  background: C.btnBg,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: submittingTenantId !== null ? 'not-allowed' : 'pointer',
                  opacity: submittingTenantId !== null ? 0.6 : 1,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => {
                  if (submittingTenantId === null) e.currentTarget.style.background = C.btnHover;
                }}
                onMouseLeave={(e) => {
                  if (submittingTenantId === null) e.currentTarget.style.background = C.btnBg;
                }}
              >
                {isSelecting ? '进入中...' : '进入空间'}
              </button>
            </div>
          );
        })}
      </div>

      {/* 底部操作区 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="workspace-select-actions">
        {!createBlocked && (
          <button
            type="button"
            disabled={submittingTenantId !== null}
            onClick={handleCreate}
            style={{
              width: '100%',
              padding: '9px 12px',
              border: `1px solid ${C.inputBorder}`,
              borderRadius: 7,
              background: 'transparent',
              color: C.textSecondary,
              fontSize: 13,
              cursor: submittingTenantId !== null ? 'not-allowed' : 'pointer',
              opacity: submittingTenantId !== null ? 0.5 : 1,
            }}
          >
            创建企业空间
          </button>
        )}
        {!feishuChannelUser && (
          <button
            type="button"
            disabled={submittingTenantId !== null}
            onClick={handleJoin}
            style={{
              width: '100%',
              padding: '9px 12px',
              border: `1px solid ${C.inputBorder}`,
              borderRadius: 7,
              background: 'transparent',
              color: C.textSecondary,
              fontSize: 13,
              cursor: submittingTenantId !== null ? 'not-allowed' : 'pointer',
              opacity: submittingTenantId !== null ? 0.5 : 1,
            }}
          >
            加入其他空间
          </button>
        )}
      </div>
    </AuthCardLayout>
  );
};

// ── WorkspaceCreatePage ──

/**
 * 工作空间创建页面。
 *
 * 已有自建工作区（owner 角色）的用户不允许再次创建，会立即跳回。
 * 创建成功后不换 token，直接通过 tenantStore.createWorkspace() 切换到新空间。
 * 企业搜索内联实现：300ms 防抖 + 2 字符触发 + 点外部关闭下拉。
 */
export const WorkspaceCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectToAuth = useAuthRedirect();

  const createWorkspaceFn = useTenantStore((s) => s.createWorkspace);
  const bindCurrentEnterprise = useTenantStore((s) => s.bindCurrentEnterprise);
  const workspaces = useTenantStore((s) => s.workspaces);
  const currentWorkspace = useTenantStore((s) => s.currentWorkspace);
  const initialized = useTenantStore((s) => s.initialized);
  const initializing = useTenantStore((s) => s.initializing);
  const initialize = useTenantStore((s) => s.initialize);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentUserId = useAuthStore((s) => s.user?.id ?? '');
  const initialDraft = useMemo(
    () => readOnboardingDraft(currentUserId),
    [currentUserId],
  );

  const [name, setName] = useState(initialDraft?.spaceName ?? '');
  const [nameTouched, setNameTouched] = useState(initialDraft?.spaceTouched ?? false);
  const [company, setCompany] = useState<CompanySearchItem | null>(
    initialDraft?.selectedCompany ?? null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [skipBlockedGuard, setSkipBlockedGuard] = useState(false);

  // 企业搜索状态
  const [companyKeyword, setCompanyKeyword] = useState(initialDraft?.companyQuery ?? '');
  const [companyResults, setCompanyResults] = useState<CompanySearchItem[]>([]);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [searchingCompany, setSearchingCompany] = useState(false);
  const companySearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const companyContainerRef = useRef<HTMLDivElement>(null);

  const redirectTarget = useMemo(
    () => resolveRedirect(searchParams.get('redirect')),
    [searchParams]
  );
  const joinTarget = useMemo(
    () => appendRedirect('/workspace/join', searchParams.get('redirect')),
    [searchParams]
  );
  const hasWorkspaceOptions = workspaces.length > 0;
  const feishuChannelUser = isFeishuUser(workspaces);
  const enterpriseBindingMode = needsEnterpriseBinding(currentWorkspace);
  // 返回按钮：有 currentWorkspace 时回到 redirect 目标，否则跳选择页并透传 redirect
  const goBackTarget = currentWorkspace
    ? redirectTarget
    : appendRedirect('/workspace/select', searchParams.get('redirect'));

  const createBlocked = hasSelfBuiltWorkspace(workspaces, currentWorkspace);
  const workspaceCreateBlocked = !enterpriseBindingMode && (feishuChannelUser || createBlocked);
  const workspaceNameError =
    !enterpriseBindingMode && name.trim().length > 50 ? '空间名称不能超过 50 个字符' : null;
  const displayErrorText = workspaceNameError ?? errorText;

  // 触发初始化
  useEffect(() => {
    if (!initialized && !initializing) {
      void initialize();
    }
  }, [initialize, initialized, initializing]);

  useEffect(() => {
    if (!currentUserId) return;
    saveOnboardingDraft(currentUserId, {
      flowPath: 'admin',
      step: 'company',
      companyQuery: companyKeyword,
      selectedCompany: company ? {
        companyName: company.companyName,
        creditCode: company.creditCode,
      } : null,
      spaceName: name,
      spaceTouched: nameTouched,
      intent: initialDraft?.intent ?? '',
      department: initialDraft?.department ?? '',
      scenario: initialDraft?.scenario ?? '',
    });
  }, [company, companyKeyword, currentUserId, initialDraft, name, nameTouched]);

  // 已有自建工作区或飞书渠道用户 → 跳回（对齐后端渠道策略）
  useEffect(() => {
    if (!initialized || initializing || !workspaceCreateBlocked || skipBlockedGuard) return;
    console.error('[WorkspaceCreate] 当前账号不允许创建工作空间');
    navigate(goBackTarget, { replace: true });
  }, [goBackTarget, initialized, initializing, navigate, skipBlockedGuard, workspaceCreateBlocked]);

  // 企业搜索防抖处理（300ms，2 字符触发）
  const handleCompanySearch = useCallback(
    (keyword: string) => {
      setCompanyKeyword(keyword);
      if (company && keyword !== company.companyName) {
        setCompany(null);
      }
      if (companySearchTimer.current) clearTimeout(companySearchTimer.current);
      const trimmed = keyword.trim();
      if (trimmed.length < 2) {
        setCompanyResults([]);
        setShowCompanyDropdown(false);
        return;
      }
      companySearchTimer.current = setTimeout(async () => {
        setSearchingCompany(true);
        try {
          const res = await platformTenantApi.searchCompany(trimmed);
          const items = (res as { items?: CompanySearchItem[] }).items ?? [];
          setCompanyResults(items);
          setShowCompanyDropdown(true);
        } catch {
          setCompanyResults([]);
        } finally {
          setSearchingCompany(false);
        }
      }, 300);
    },
    [company]
  );

  const handleSelectCompany = useCallback((item: CompanySearchItem) => {
    setCompany(item);
    setCompanyKeyword(item.companyName);
    if (!nameTouched || !name.trim()) {
      setName(defaultWorkspaceName(item.companyName));
      setNameTouched(false);
    }
    setShowCompanyDropdown(false);
  }, [name, nameTouched]);

  // 点击外部关闭企业搜索下拉
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (
        companyContainerRef.current &&
        !companyContainerRef.current.contains(e.target as Node)
      ) {
        setShowCompanyDropdown(false);
      }
    };
    if (showCompanyDropdown) {
      document.addEventListener('mousedown', handle);
    }
    return () => document.removeEventListener('mousedown', handle);
  }, [showCompanyDropdown]);

  if (!isAuthenticated) {
    return redirectToAuth('/login');
  }

  if (!initialized || initializing || workspaceCreateBlocked) {
    return (
      <AuthCardLayout testId="workspace-create-page" cardTestId="workspace-create-card">
        <CorevoLogo />
        <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 13, padding: '20px 0' }} data-testid="workspace-create-loading">
          正在加载...
        </div>
      </AuthCardLayout>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!company) {
      setErrorText('请选择企业');
      return;
    }

    if (enterpriseBindingMode) {
      setSubmitting(true);
      setErrorText(null);
      try {
        await bindCurrentEnterprise({
          companyName: company.companyName,
          creditCode: company.creditCode,
        });
        navigate(redirectTarget, { replace: true });
      } catch (error: unknown) {
        setErrorText(mapTenantErrorToMessage(error, '绑定企业失败，请重试'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (feishuChannelUser) {
      setErrorText('飞书渠道不支持通过 MOSS 后台创建企业空间');
      return;
    }
    if (createBlocked) {
      setErrorText('已创建过工作空间，无法重复创建');
      return;
    }
    const nextName = name.trim();
    if (!nextName) {
      setErrorText('请输入空间名称');
      return;
    }
    if (nextName.length > 50) {
      return; // workspaceNameError 已展示
    }
    setSubmitting(true);
    setErrorText(null);
    setSkipBlockedGuard(true);
    try {
      await createWorkspaceFn({
        name: nextName,
        companyName: company.companyName,
        creditCode: company.creditCode,
      });
      navigate(appendRedirect('/onboarding', searchParams.get('redirect')), { replace: true });
    } catch (error: unknown) {
      setSkipBlockedGuard(false);
      setErrorText(mapTenantErrorToMessage(error, '创建工作空间失败，请重试'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCardLayout testId="workspace-create-page" cardTestId="workspace-create-card">
      <CorevoLogo />

      <div style={{ marginBottom: 6 }} data-testid="workspace-create-header">
        <h2 style={{ fontSize: 22, fontWeight: 600, color: C.textPrimary, marginBottom: 6 }}>
          {enterpriseBindingMode ? '选择企业' : '创建企业空间'}
        </h2>
        {/* 顶部加入入口（对齐 V1 CreateWorkspace 布局） */}
        {!enterpriseBindingMode && !feishuChannelUser && (
          <div style={{ fontSize: 13, color: C.textMuted }}>
            已有空间？
            <button
              type="button"
              onClick={() => navigate(joinTarget, { replace: true })}
              style={{
                marginLeft: 4,
                color: C.textSecondary,
                fontWeight: 500,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: 13,
              }}
            >
              加入空间
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: 20 }} data-testid="workspace-create-form">
        {/* 企业名称 */}
        <div style={{ marginBottom: 16 }} data-testid="workspace-create-company-field">
          <label
            htmlFor="create-company"
            style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.textSecondary, marginBottom: 6 }}
          >
            企业名称
          </label>
          <div id="create-company" ref={companyContainerRef} style={{ position: 'relative' }} data-testid="workspace-create-company-search">
            <input
              type="text"
              value={companyKeyword}
              onChange={(e) => handleCompanySearch(e.target.value)}
              onFocus={() => {
                if (companyResults.length > 0 && !company) setShowCompanyDropdown(true);
              }}
              placeholder="输入企业名称搜索（至少 2 个字符）"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${company ? C.btnBg : C.inputBorder}`,
                borderRadius: 8,
                fontSize: 13,
                color: C.textPrimary,
                background: C.inputBg,
                outline: 'none',
              }}
            />
            {searchingCompany && (
              <div
                data-testid="workspace-create-company-results"
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 12,
                  color: C.textMuted,
                }}
              >
                搜索中...
              </div>
            )}
            {showCompanyDropdown && companyResults.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 4,
                  background: C.bgCard,
                  border: `1px solid ${C.inputBorder}`,
                  borderRadius: 8,
                  boxShadow: C.shadowCard,
                  maxHeight: 240,
                  overflowY: 'auto',
                  zIndex: 50,
                }}
              >
                {companyResults.map((item) => (
                  <button
                    key={item.creditCode}
                    type="button"
                    data-testid={`workspace-create-company-option-${item.creditCode}`}
                    onClick={() => handleSelectCompany(item)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 14px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      borderBottom: `1px solid ${C.borderSubtle}`,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary }}>
                      {item.companyName}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                      {item.creditCode}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {company && (
            <div style={{ marginTop: 5, fontSize: 11, color: C.textMuted }}>
              统一社会信用代码：{company.creditCode}
            </div>
          )}
        </div>

        {/* 空间名称 */}
        {!enterpriseBindingMode && (
          <div style={{ marginBottom: 20 }} data-testid="workspace-create-name-field">
            <label
              htmlFor="create-workspace-name"
              style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.textSecondary, marginBottom: 6 }}
            >
              空间名称
            </label>
            <input
              id="create-workspace-name"
              type="text"
              value={name}
              onChange={(e) => {
                setNameTouched(true);
                setName(e.target.value);
              }}
              placeholder="请输入空间名称（50 字以内）"
              maxLength={50}
              disabled={submitting}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${workspaceNameError ? C.inputErrorBorder : C.inputBorder}`,
                borderRadius: 8,
                fontSize: 13,
                color: C.textPrimary,
                background: workspaceNameError ? C.inputErrorBg : C.inputBg,
                outline: 'none',
              }}
            />
          </div>
        )}

        {/* 错误提示 */}
        {displayErrorText && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: C.errorBg,
              border: `1px solid ${C.errorBorder}`,
              color: C.error,
              fontSize: 12,
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertIcon />
            <span>{displayErrorText}</span>
          </div>
        )}

        <PrimarySubmitButton
          loading={submitting}
          loadingText={enterpriseBindingMode ? '绑定中...' : '创建中...'}
        >
          {enterpriseBindingMode ? '确认企业' : '创建企业空间'}
        </PrimarySubmitButton>

        {!enterpriseBindingMode && (currentWorkspace || hasWorkspaceOptions) && (
          <button
            type="button"
            onClick={() => navigate(goBackTarget, { replace: true })}
            style={{
              width: '100%',
              padding: '10px 12px',
              marginTop: 8,
              border: `1px solid ${C.inputBorder}`,
              borderRadius: 8,
              background: 'transparent',
              color: C.textMuted,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {currentWorkspace ? '返回工作台' : '返回空间选择'}
          </button>
        )}
      </form>
    </AuthCardLayout>
  );
};

// ── WorkspacePathRedirect ──

/**
 * /workspace 根路径重定向：已登录跳工作台入口，未登录跳登录页。
 */
export const WorkspacePathRedirect: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const redirectToAuth = useAuthRedirect();

  if (!isAuthenticated) {
    return redirectToAuth('/login');
  }
  return <Navigate to={WORKSPACE_HOME_PATH} replace />;
};
