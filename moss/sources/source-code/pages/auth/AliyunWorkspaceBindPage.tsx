import React, { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { platformAuthApi } from '../../api/platformAuth';
import { type CompanySearchItem, platformTenantApi } from '../../api/platformTenant';
import { hasSelfBuiltWorkspace, useTenantStore } from '../../stores/tenantStore';
import { appendRedirect, resolveContinueTarget } from '../../utils/authNavigation';
import { WORKSPACE_HOME_PATH } from '../../utils/routes';
import { AuthCardLayout, C, CorevoLogo, ErrorBanner, PrimarySubmitButton } from './_shared';

const CREATE_TARGET = '__create__';

/**
 * 阿里云订单绑定目标选择页。选择卡片只更新本地状态，提交后才执行绑定与履约。
 */
export const AliyunWorkspaceBindPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const state = searchParams.get('state')?.trim() ?? '';
  const redirectTarget = resolveContinueTarget(searchParams.get('redirect'), WORKSPACE_HOME_PATH);
  const workspaces = useTenantStore((item) => item.workspaces);
  const currentWorkspace = useTenantStore((item) => item.currentWorkspace);
  const initialized = useTenantStore((item) => item.initialized);
  const initializing = useTenantStore((item) => item.initializing);
  const initialize = useTenantStore((item) => item.initialize);
  const refreshWorkspaces = useTenantStore((item) => item.refreshWorkspaces);
  const selectWorkspace = useTenantStore((item) => item.selectWorkspace);

  const manageableWorkspaces = useMemo(
    () => workspaces.filter((workspace) => (
      workspace.role === 'owner' || workspace.role === 'admin'
    )),
    [workspaces],
  );
  const bindableWorkspaces = useMemo(
    () => manageableWorkspaces.filter((workspace) => workspace.channel !== 'aliyun'),
    [manageableWorkspaces],
  );
  const canCreateWorkspace = !hasSelfBuiltWorkspace(workspaces, currentWorkspace);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [companyKeyword, setCompanyKeyword] = useState('');
  const [company, setCompany] = useState<CompanySearchItem | null>(null);
  const [companyResults, setCompanyResults] = useState<CompanySearchItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!initialized && !initializing) {
      void initialize();
    }
  }, [initialize, initialized, initializing]);

  useEffect(() => {
    if (!initialized || selectedTarget !== null) return;
    const currentCandidate = bindableWorkspaces.find(
      (workspace) => workspace.tenantId === currentWorkspace?.tenantId,
    );
    setSelectedTarget(
      currentCandidate?.tenantId
        ?? bindableWorkspaces[0]?.tenantId
        ?? (canCreateWorkspace ? CREATE_TARGET : null),
    );
  }, [bindableWorkspaces, canCreateWorkspace, currentWorkspace?.tenantId, initialized, selectedTarget]);

  useEffect(() => {
    const keyword = companyKeyword.trim();
    if (selectedTarget !== CREATE_TARGET || company || keyword.length < 2) {
      setCompanyResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void platformTenantApi.searchCompany(keyword)
        .then((response) => setCompanyResults(response.items ?? []))
        .catch(() => setCompanyResults([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [company, companyKeyword, selectedTarget]);

  if (!state) {
    return (
      <AuthCardLayout testId="aliyun-workspace-bind-page" cardTestId="aliyun-workspace-bind-card">
        <CorevoLogo />
        <ErrorBanner message="阿里云订单绑定信息已失效，请重新从阿里云市场进入" />
      </AuthCardLayout>
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTarget) return;
    if (selectedTarget === CREATE_TARGET && (!workspaceName.trim() || !company)) {
      setErrorText('请填写空间名称并选择企业');
      return;
    }
    setSubmitting(true);
    setErrorText(null);
    try {
      const result = selectedTarget === CREATE_TARGET
        ? await platformAuthApi.bindAliyunMarketplace(state, undefined, {
            targetType: 'CREATE',
            workspaceName: workspaceName.trim(),
            companyName: company!.companyName,
            creditCode: company!.creditCode,
          })
        : await platformAuthApi.bindAliyunMarketplace(state, undefined, {
            targetType: 'EXISTING',
            tenantId: selectedTarget,
          });
      if (!result.tenantId || result.selectionRequired) {
        throw new Error('阿里云订单尚未完成绑定');
      }
      await refreshWorkspaces();
      await selectWorkspace(result.tenantId);
      navigate(selectedTarget === CREATE_TARGET
        ? appendRedirect('/onboarding', redirectTarget)
        : redirectTarget, { replace: true });
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : '绑定失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCardLayout testId="aliyun-workspace-bind-page" cardTestId="aliyun-workspace-bind-card">
      <CorevoLogo />
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: C.textPrimary }}>绑定阿里云订单</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.5, color: C.textMuted }}>
          {canCreateWorkspace ? '选择已有空间，或创建新空间。' : '选择已有空间。'}
          确认后订单权益将发放到该空间。
        </p>
      </div>

      {(!initialized || initializing) ? (
        <div style={{ padding: '20px 0', textAlign: 'center', color: C.textMuted }}>正在加载工作空间...</div>
      ) : (
        <form onSubmit={(event) => void handleSubmit(event)}>
          {errorText && <ErrorBanner message={errorText} />}
          <div role="radiogroup" aria-label="阿里云订单绑定目标" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {manageableWorkspaces.map((workspace) => {
              const selected = selectedTarget === workspace.tenantId;
              const aliyunBound = workspace.channel === 'aliyun';
              return (
                <button
                  key={workspace.tenantId}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-disabled={aliyunBound}
                  disabled={aliyunBound}
                  data-testid={`aliyun-bind-workspace-${workspace.tenantId}`}
                  onClick={() => setSelectedTarget(workspace.tenantId)}
                  style={{
                    padding: '13px 14px',
                    borderRadius: 9,
                    border: `1px solid ${selected ? C.btnBg : C.inputBorder}`,
                    background: selected ? C.bgTertiary : C.inputBg,
                    color: C.textPrimary,
                    textAlign: 'left',
                    cursor: aliyunBound ? 'not-allowed' : 'pointer',
                    opacity: aliyunBound ? 0.55 : 1,
                  }}
                >
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>{workspace.name}</span>
                  <span style={{ display: 'block', marginTop: 3, fontSize: 12, color: C.textMuted }}>
                    {workspace.role === 'owner' ? '所有者' : '管理员'} · {aliyunBound
                      ? '已绑定其他阿里云账号'
                      : workspace.planType === 'official' ? '正式版' : '试用版'}
                  </span>
                </button>
              );
            })}
            {canCreateWorkspace && (
              <button
                type="button"
                role="radio"
                aria-checked={selectedTarget === CREATE_TARGET}
                data-testid="aliyun-bind-create-target"
                onClick={() => setSelectedTarget(CREATE_TARGET)}
                style={{
                  padding: '13px 14px',
                  borderRadius: 9,
                  border: `1px solid ${selectedTarget === CREATE_TARGET ? C.btnBg : C.inputBorder}`,
                  background: selectedTarget === CREATE_TARGET ? C.bgTertiary : C.inputBg,
                  color: C.textPrimary,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>创建新空间</span>
                <span style={{ display: 'block', marginTop: 3, fontSize: 12, color: C.textMuted }}>创建后直接绑定本次订单</span>
              </button>
            )}
          </div>

          {selectedTarget === CREATE_TARGET && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              <label style={{ fontSize: 13, color: C.textSecondary }}>
                空间名称
                <input
                  value={workspaceName}
                  maxLength={50}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', marginTop: 5, padding: '10px 12px', border: `1px solid ${C.inputBorder}`, borderRadius: 8, background: C.inputBg, color: C.textPrimary }}
                />
              </label>
              <label style={{ position: 'relative', fontSize: 13, color: C.textSecondary }}>
                企业名称
                <input
                  value={companyKeyword}
                  onChange={(event) => {
                    setCompanyKeyword(event.target.value);
                    setCompany(null);
                  }}
                  placeholder="输入至少 2 个字搜索企业"
                  style={{ width: '100%', boxSizing: 'border-box', marginTop: 5, padding: '10px 12px', border: `1px solid ${C.inputBorder}`, borderRadius: 8, background: C.inputBg, color: C.textPrimary }}
                />
                {companyResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 2, marginTop: 4, border: `1px solid ${C.inputBorder}`, borderRadius: 8, background: C.inputBg, boxShadow: C.shadowCard, overflow: 'hidden' }}>
                    {companyResults.map((item) => (
                      <button
                        key={item.creditCode}
                        type="button"
                        onClick={() => {
                          setCompany(item);
                          setCompanyKeyword(item.companyName);
                          setCompanyResults([]);
                        }}
                        style={{ display: 'block', width: '100%', padding: '9px 12px', border: 0, background: C.inputBg, color: C.textPrimary, textAlign: 'left', cursor: 'pointer' }}
                      >
                        {item.companyName}
                      </button>
                    ))}
                  </div>
                )}
              </label>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <PrimarySubmitButton loading={submitting} disabled={!selectedTarget} loadingText="绑定中...">
              确认绑定
            </PrimarySubmitButton>
          </div>
        </form>
      )}
    </AuthCardLayout>
  );
};
