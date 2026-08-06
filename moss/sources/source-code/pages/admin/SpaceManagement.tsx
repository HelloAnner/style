/**
 * 空间管理页面（AdminDashboard 的主要内容区）。
 *
 * 业务含义：
 * - 承载工作区级别的信息维护与成员管理；
 * - 顶部 Tab 切换：「空间信息」/ 「成员管理」；
 * - 使用 ?subTab=xxx 查询参数同步激活 Tab，与 AdminDashboard 的 searchParams 模式对齐。
 *
 * 关键逻辑来源（V1 搬运）：
 * - 空间信息 Tab：src/pages/settings/tabs/WorkspaceBasicInfo.tsx（约 240 行）
 * - 成员管理 Tab：src/pages/settings/tabs/TeamMembers.tsx（约 400 行）
 * - 邀请弹窗：InviteMemberModal（本批次新建）
 */

import React, {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { TenantErrorCodes, getErrorCode } from '../../api/errorCodes';
import {
  type MemberInfo,
  type MemberPageResponse,
  platformTenantInviteApi,
} from '../../api/platformTenantInvite';
import { platformTenantApi } from '../../api/platformTenant';
import { usePermission } from '../../hooks/usePermission';
import { isFeishuWorkspace, useTenantStore } from '../../stores/tenantStore';
import { InviteMemberModal } from '../../components/modals/InviteMemberModal';
import { useAuthStore } from '../../stores/authStore';
import { track } from '../../utils/track';
import { toast } from '../../utils/toast';
import { COMPANY_BG_MAX_LENGTH } from './constants';

// ── 角色下拉组件 ──

const ROLE_OPTIONS: Array<{ value: 'admin' | 'member'; label: string }> = [
  { value: 'admin', label: '管理员' },
  { value: 'member', label: '成员' },
];

function memberGridColumns(canManage: boolean): string {
  return canManage ? '1.5fr 1.5fr 1.5fr 1.2fr 1fr' : '1.5fr 1.5fr 1.5fr 1.2fr';
}

function RoleDropdown({
  currentRole,
  disabled,
  onChange,
}: {
  currentRole: 'admin' | 'member';
  disabled: boolean;
  onChange: (role: 'admin' | 'member') => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleToggle = () => {
    if (disabled) return;
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((v) => !v);
  };

  const currentLabel = currentRole === 'admin' ? '管理员' : '成员';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 6px 2px 8px',
          borderRadius: '4px',
          border: '1px solid var(--border-subtle, #e4e4e7)',
          background: 'var(--bg-primary, #fff)',
          color: 'var(--text-secondary, #71717a)',
          fontSize: '12px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'border-color 0.12s',
        }}
      >
        {disabled ? '修改中...' : currentLabel}
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuPos.top,
            left: menuPos.left,
            minWidth: '100px',
            background: 'var(--dropdown-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          {ROLE_OPTIONS.map((opt) => {
            const isActive = opt.value === currentRole;
            return (
              <div
                key={opt.value}
                role="button"
                onClick={() => {
                  if (!isActive) onChange(opt.value);
                  setOpen(false);
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--hover-bg, rgba(0,0,0,0.04))'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: isActive ? 'var(--text-primary, #18181b)' : 'var(--text-secondary, #71717a)',
                  fontWeight: isActive ? 500 : 400,
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
              >
                {opt.label}
                {isActive && (
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

// ── 常量 ──

const PAGE_SIZE = 20;
const WORKSPACE_NAME_MAX_LENGTH = 50;

// ── 工具函数 ──

async function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // fallback
    }
  }
  if (typeof document === 'undefined') throw new Error('clipboard unavailable');
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.appendChild(textarea);
  textarea.select();
  const copied =
    typeof document.execCommand === 'function' && document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) throw new Error('copy failed');
}

// ── 样式常量 ──

const tabBtnStyle = (active: boolean, hovered = false): React.CSSProperties => ({
  padding: '10px 8px',
  marginRight: '8px',
  border: 'none',
  borderBottom: `2px solid ${active ? 'var(--text-primary)' : 'transparent'}`,
  background: (!active && hovered) ? 'var(--bg-hover, #f4f4f5)' : 'none',
  borderRadius: '4px 4px 0 0',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: active ? 600 : 400,
  color: active ? 'var(--text-primary, #18181b)' : 'var(--text-secondary, #71717a)',
  transition: 'background 0.15s',
});

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  padding: '12px 0',
  borderBottom: '1px solid var(--border-subtle, #f0f0f0)',
};

const labelStyle: React.CSSProperties = {
  width: '100px',
  flexShrink: 0,
  fontSize: '13px',
  color: 'var(--text-secondary, #71717a)',
  lineHeight: '24px',
};

const valueStyle: React.CSSProperties = {
  flex: 1,
  fontSize: '14px',
  color: 'var(--text-primary, #18181b)',
  lineHeight: '24px',
  wordBreak: 'break-all',
};

const linkBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '13px',
  color: 'var(--text-secondary, #71717a)',
  padding: '0 4px',
  lineHeight: '24px',
  flexShrink: 0,
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
};

// ── 空间信息 Tab ──

const WorkspaceInfoTab: React.FC = () => {
  const { isAdmin } = usePermission();
  const currentWorkspace = useTenantStore((s) => s.currentWorkspace);
  const refreshCurrentWorkspace = useTenantStore((s) => s.refreshCurrentWorkspace);
  const renameCurrentWorkspace = useTenantStore((s) => s.renameCurrentWorkspace);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workspaceName, setWorkspaceName] = useState(currentWorkspace?.name ?? '');
  const [editingName, setEditingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [idCopied, setIdCopied] = useState(false);
  const [editBtnHovered, setEditBtnHovered] = useState(false);
  const [copyBtnHovered, setCopyBtnHovered] = useState(false);
  const [businessProfile, setBusinessProfile] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveProfileBtnHovered, setSaveProfileBtnHovered] = useState(false);

  const nameValidationError =
    workspaceName.trim().length > WORKSPACE_NAME_MAX_LENGTH
      ? `名称不超过 ${WORKSPACE_NAME_MAX_LENGTH} 个字符`
      : null;

  useEffect(() => {
    setWorkspaceName(currentWorkspace?.name ?? '');
  }, [currentWorkspace?.name]);

  // 从 API 加载企业业务概况
  useEffect(() => {
    if (!currentWorkspace) return;
    let cancelled = false;
    platformTenantApi.getEnterpriseProfile()
      .then((res) => { if (!cancelled) setBusinessProfile(res.companyBackground ?? ''); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentWorkspace?.tenantId]);

  useEffect(() => {
    if (currentWorkspace) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        await refreshCurrentWorkspace();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentWorkspace, refreshCurrentWorkspace]);

  const handleNameSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextName = workspaceName.trim();
    if (!isAdmin) return;
    if (!nextName) {
      setNameError('名称不能为空');
      return;
    }
    if (nameValidationError) {
      setNameError(null);
      return;
    }
    if (nextName === currentWorkspace?.name) {
      setEditingName(false);
      return;
    }
    setSaving(true);
    setNameError(null);
    try {
      await renameCurrentWorkspace(nextName);
      setEditingName(false);
    } catch (error: unknown) {
      setNameError((error as Error)?.message ?? '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyId = async () => {
    if (!currentWorkspace?.tenantId) return;
    try {
      await copyText(currentWorkspace.tenantId);
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 1500);
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  if (loading && !currentWorkspace) {
    return (
      <div style={{ padding: '32px', color: 'var(--text-secondary, #71717a)', fontSize: '14px' }} data-testid="space-management-workspace-loading">
        加载中...
      </div>
    );
  }

  const handleSaveBusinessProfile = async () => {
    track('space_overview_save');
    setSavingProfile(true);
    try {
      await platformTenantApi.updateEnterpriseProfile(businessProfile);
      toast.success('保存成功');
    } catch (error: unknown) {
      toast.error((error as Error)?.message ?? '保存失败，请重试');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div style={{ width: '100%' }} data-testid="space-management-panel-workspace">
      {/* 基本信息卡片 */}
      <div
        style={{
          padding: '20px 24px',
          border: '1px solid var(--border-default, #e4e4e7)',
          borderRadius: '10px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-secondary, #71717a)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '12px',
          }}
        >
          基本信息
        </div>

        {/* 名称行 */}
        <div style={rowStyle}>
          <span style={labelStyle}>空间名称</span>
          <div style={valueStyle}>
            {editingName ? (
              <form
                onSubmit={(e) => void handleNameSubmit(e)}
                style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
              >
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => {
                      setWorkspaceName(e.target.value);
                      setNameError(null);
                    }}
                    disabled={saving}
                    placeholder="请输入空间名称"
                    style={{
                      flex: 1,
                      padding: '5px 10px',
                      border: '1px solid var(--border-default, #e4e4e7)',
                      borderRadius: '6px',
                      fontSize: '14px',
                      background: 'var(--bg-primary, #fff)',
                      color: 'var(--text-primary, #18181b)',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={
                      saving ||
                      !workspaceName.trim() ||
                      nameValidationError !== null ||
                      workspaceName.trim() === currentWorkspace?.name
                    }
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background:
                        saving ||
                        !workspaceName.trim() ||
                        nameValidationError !== null ||
                        workspaceName.trim() === currentWorkspace?.name
                          ? 'var(--btn-mono-disabled-bg)'
                          : 'var(--btn-mono-bg)',
                      color:
                        saving ||
                        !workspaceName.trim() ||
                        nameValidationError !== null ||
                        workspaceName.trim() === currentWorkspace?.name
                          ? 'var(--btn-mono-disabled-text)'
                          : 'var(--btn-mono-text)',
                      fontSize: '13px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {saving ? '保存中' : '保存'}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setEditingName(false);
                      setWorkspaceName(currentWorkspace?.name ?? '');
                      setNameError(null);
                    }}
                    style={{ ...linkBtnStyle, textDecoration: 'none' }}
                  >
                    取消
                  </button>
                </div>
                {(nameValidationError ?? nameError) && (
                  <div style={{ fontSize: '12px', color: 'var(--danger)' }}>
                    {nameValidationError ?? nameError}
                  </div>
                )}
              </form>
            ) : (
              <span>{currentWorkspace?.name ?? '-'}</span>
            )}
          </div>
          {isAdmin && !editingName && (
            <button
              type="button"
              style={{
                ...linkBtnStyle,
                color: editBtnHovered ? 'var(--text-primary, #18181b)' : 'var(--text-secondary, #71717a)',
                transition: 'color 0.15s',
              }}
              onMouseEnter={() => setEditBtnHovered(true)}
              onMouseLeave={() => setEditBtnHovered(false)}
              onClick={() => {
                setEditingName(true);
                setNameError(null);
              }}
            >
              编辑
            </button>
          )}
        </div>

        {/* 空间 ID 行 */}
        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <span style={labelStyle}>空间 ID</span>
          <span style={valueStyle}>{currentWorkspace?.tenantId ?? '-'}</span>
          {currentWorkspace?.tenantId && (
            <button
              type="button"
              style={{
                ...linkBtnStyle,
                color: copyBtnHovered ? 'var(--text-primary, #18181b)' : 'var(--text-secondary, #71717a)',
                transition: 'color 0.15s',
              }}
              onMouseEnter={() => setCopyBtnHovered(true)}
              onMouseLeave={() => setCopyBtnHovered(false)}
              onClick={() => void handleCopyId()}
            >
              {idCopied ? '已复制' : '复制'}
            </button>
          )}
        </div>
      </div>

      {/* 企业信息卡片 */}
      <div
        style={{
          padding: '20px 24px',
          border: '1px solid var(--border-default, #e4e4e7)',
          borderRadius: '10px',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-secondary, #71717a)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '12px',
          }}
        >
          企业信息
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>关联企业</span>
          <span style={valueStyle}>
            {currentWorkspace?.enterpriseName?.trim() || '-'}
          </span>
        </div>

        {/* 业务概况 */}
        <div style={{ padding: '12px 0' }}>
          <div
            style={{
              fontSize: '13px',
              color: 'var(--text-secondary, #71717a)',
              marginBottom: '8px',
            }}
          >
            业务概况
          </div>
          <textarea
            value={businessProfile}
            onChange={(e) => setBusinessProfile(e.target.value)}
            placeholder="概括当前企业自身、产品业务特性、市场位置与典型竞争格局..."
            maxLength={COMPANY_BG_MAX_LENGTH}
            style={{
              width: '100%',
              minHeight: '96px',
              padding: '10px 12px',
              border: '1px solid var(--input-border, #e4e4e7)',
              borderRadius: '8px',
              fontSize: '13px',
              color: 'var(--text-primary, #18181b)',
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.6,
              background: 'var(--input-bg, #fff)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '8px',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary, #71717a)',
              }}
            >
              将自动为各智能体补充本公司业务背景
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #a1a1aa)' }}>
                {businessProfile.length}/{COMPANY_BG_MAX_LENGTH}
              </span>
              <button
              type="button"
              disabled={savingProfile}
              onClick={() => void handleSaveBusinessProfile()}
              onMouseEnter={() => setSaveProfileBtnHovered(true)}
              onMouseLeave={() => setSaveProfileBtnHovered(false)}
              style={{
                background: savingProfile
                  ? 'var(--btn-mono-disabled-bg)'
                  : (saveProfileBtnHovered ? 'var(--btn-mono-hover-bg)' : 'var(--btn-mono-bg)'),
                color: savingProfile ? 'var(--btn-mono-disabled-text)' : 'var(--btn-mono-text)',
                padding: '6px 16px',
                fontSize: '12px',
                borderRadius: '8px',
                border: 'none',
                cursor: savingProfile ? 'not-allowed' : 'pointer',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              {savingProfile ? '保存中' : '保存'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── 成员管理 Tab ──

const TeamMembersTab: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const currentWorkspace = useTenantStore((s) => s.currentWorkspace);
  const { isAdmin, isOwner } = usePermission();

  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');

  // 搜索防抖 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword.trim()), 300);
    return () => clearTimeout(timer);
  }, [keyword]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actioningKey, setActioningKey] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteBtnHovered, setInviteBtnHovered] = useState(false);
  const [hoveredRemoveKey, setHoveredRemoveKey] = useState<string | null>(null);
  const [prevPageHovered, setPrevPageHovered] = useState(false);
  const [nextPageHovered, setNextPageHovered] = useState(false);

  const tenantId = currentWorkspace?.tenantId ?? null;
  const canManage = isAdmin;
  const canInvite = canManage && !isFeishuWorkspace(currentWorkspace);

  const loadMembers = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setErrorText(null);
    try {
      const result: MemberPageResponse = await platformTenantInviteApi.getMembers(tenantId, {
        page,
        size: PAGE_SIZE,
        ...(debouncedKeyword ? { keyword: debouncedKeyword } : {}),
      });
      setMembers(result.content ?? []);
      setTotalCount(result.total >= 0 ? result.total : result.totalPages * PAGE_SIZE);
      setTotalPages(result.totalPages > 0 ? result.totalPages : 1);
      const backendPage = result.page > 0 ? result.page : 1;
      const nextPage = Math.min(backendPage, result.totalPages);
      if (nextPage !== page) setPage(nextPage);
    } catch (error: unknown) {
      const code = getErrorCode(error);
      if (code === TenantErrorCodes.TENANT_FORBIDDEN) {
        setErrorText('无权限访问此工作区');
      } else if (code === TenantErrorCodes.PERMISSION_DENIED) {
        setErrorText('权限不足，无法执行此操作');
      } else {
        setErrorText('加载成员列表失败，请重试');
      }
      setMembers([]);
      setTotalCount(0);
      if (page !== 1) setPage(1);
    } finally {
      setLoading(false);
    }
  }, [debouncedKeyword, page, tenantId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const handleRemoveMember = useCallback(
    async (member: MemberInfo) => {
      if (!tenantId) return;
      const ok = window.confirm(`确认移除成员「${member.nickname}」？`);
      if (!ok) return;
      setActioningKey(`remove:${member.userId}`);
      setErrorText(null);
      try {
        await platformTenantInviteApi.removeMember(tenantId, member.userId);
        await loadMembers();
      } catch (error: unknown) {
        const code = getErrorCode(error);
        if (code === TenantErrorCodes.TENANT_FORBIDDEN) {
          setErrorText('无权限访问此工作区');
        } else if (code === TenantErrorCodes.PERMISSION_DENIED) {
          setErrorText('权限不足，无法移除此成员');
        } else {
          setErrorText('移除失败，请重试');
        }
      } finally {
        setActioningKey(null);
      }
    },
    [loadMembers, tenantId]
  );

  /**
   * 判断当前用户能否移除目标成员。
   *
   * 规则：
   * - 没有管理权限（member）→ 不可移除
   * - 目标是 owner → 不可移除
   * - 目标是自己 → 不可移除
   * - 当前用户是 owner → 可移除任何人
   * - 当前用户是 admin → 只能移除 member，不能移除其他 admin
   */
  function canRemoveMember(member: MemberInfo): boolean {
    // member 无管理权限，直接拒绝
    if (!canManage) return false;
    // 不能移除自己
    if (member.userId === user?.id) return false;
    // owner 不可被移除
    if (member.role === 'owner') return false;
    // owner 可以移除任何人（上面已排除自己和 owner）
    if (isOwner) return true;
    // admin 只能移除 member，不能移除其他 admin
    return member.role === 'member';
  }

  /**
   * 判断当前用户能否修改目标成员的角色。
   *
   * 规则：
   * - 没有管理权限（member）→ 不可改
   * - 目标是 owner → 不可改（owner 不可被降级）
   * - 目标是自己 → 不可改（不能改自己的角色）
   * - 当前用户是 owner → 可改任何人
   * - 当前用户是 admin → 只能改 member，不能改其他 admin
   */
  function canChangeRole(member: MemberInfo): boolean {
    // member 无管理权限，直接拒绝
    if (!canManage) return false;
    // owner 角色不可被变更
    if (member.role === 'owner') return false;
    // 不能修改自己的角色
    if (member.userId === user?.id) return false;
    // owner 可以修改任何人（上面已排除 owner 和自己）
    if (isOwner) return true;
    // admin 只能修改 member，不能修改其他 admin
    return member.role === 'member';
  }

  const handleChangeRole = useCallback(
    async (member: MemberInfo, newRole: 'admin' | 'member') => {
      if (!tenantId || newRole === member.role) return;
      setActioningKey(`role:${member.userId}`);
      setErrorText(null);
      try {
        await platformTenantInviteApi.updateMemberRole(tenantId, member.userId, newRole);
        await loadMembers();
      } catch (error: unknown) {
        const code = getErrorCode(error);
        if (code === TenantErrorCodes.PERMISSION_DENIED) {
          setErrorText('权限不足，无法修改角色');
        } else {
          setErrorText('修改角色失败，请重试');
        }
      } finally {
        setActioningKey(null);
      }
    },
    [loadMembers, tenantId]
  );

  function resolveRoleLabel(role: string): string {
    if (role === 'owner') return '创建者';
    if (role === 'admin') return '管理员';
    return '成员';
  }

  const showPagination = totalCount > PAGE_SIZE;

  return (
    <div data-testid="space-management-panel-members">
      {/* 工具栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}
      >
        {canInvite && (
          <button
            type="button"
            onClick={() => {
              track('space_invite_member');
              setInviteOpen(true);
            }}
            onMouseEnter={() => setInviteBtnHovered(true)}
            onMouseLeave={() => setInviteBtnHovered(false)}
            style={{
              padding: '7px 16px',
              borderRadius: '6px',
              border: 'none',
              background: inviteBtnHovered ? 'var(--btn-mono-hover-bg)' : 'var(--btn-mono-bg)',
              color: 'var(--btn-mono-text)',
              fontSize: '13px',
              cursor: 'pointer',
              fontWeight: 500,
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
          >
            + 邀请成员
          </button>
        )}
        <input
          type="text"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            if (page !== 1) setPage(1);
          }}
          placeholder="搜索成员（姓名/手机号）"
            style={{
              width: '240px',
              padding: '7px 12px',
              border: '1px solid var(--border-default, #e4e4e7)',
              borderRadius: '6px',
              fontSize: '13px',
              background: 'var(--bg-primary, #fff)',
              color: 'var(--text-primary, #18181b)',
              outline: 'none',
            }}
          />
      </div>

      {/* 错误提示 */}
      {errorText && (
        <div
          style={{
            marginBottom: '12px',
            padding: '8px 12px',
            background: 'var(--danger-bg-soft)',
            border: '1px solid var(--danger-border-soft)',
            borderRadius: '6px',
            fontSize: '13px',
            color: 'var(--danger)',
          }}
        >
          {errorText}
        </div>
      )}

      {/* 表格 */}
      {loading ? (
        <div
          style={{
            padding: '32px',
            textAlign: 'center',
            color: 'var(--text-secondary, #71717a)',
            fontSize: '14px',
          }}
        >
          加载中...
        </div>
      ) : (
        <>
          <div
            style={{
              border: '1px solid var(--border-default, #e4e4e7)',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            {/* 表头 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: memberGridColumns(canManage),
                padding: '10px 16px',
                background: 'var(--bg-secondary, #fafafa)',
                borderBottom: '1px solid var(--border-default, #e4e4e7)',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary, #71717a)',
                letterSpacing: '0.03em',
              }}
            >
              <span>成员</span>
              <span>手机号</span>
              <span>角色</span>
              <span>加入时间</span>
              {canManage && <span>操作</span>}
            </div>

            {/* 数据行 */}
            {members.length === 0 ? (
              <div
                style={{
                  padding: '32px',
                  textAlign: 'center',
                  color: 'var(--text-secondary, #71717a)',
                  fontSize: '13px',
                }}
              >
                暂无成员
              </div>
            ) : (
              members.map((member) => (
                <div
                  key={member.userId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: memberGridColumns(canManage),
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-subtle, #f4f4f5)',
                    alignItems: 'center',
                    fontSize: '13px',
                    color: 'var(--text-primary, #18181b)',
                  }}
                >
                  {/* 成员列 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'var(--user-avatar-bg)',
                        color: 'var(--user-avatar-text)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 600,
                        flexShrink: 0,
                        overflow: 'hidden',
                      }}
                    >
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.nickname}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        member.nickname.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {member.nickname}
                    </span>
                  </div>

                  {/* 手机号 */}
                  <span
                    style={{
                      color: 'var(--text-secondary, #71717a)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {member.phone ?? '-'}
                  </span>

                  {/* 角色 */}
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {canChangeRole(member) ? (
                      <RoleDropdown
                        currentRole={member.role as 'admin' | 'member'}
                        disabled={actioningKey === `role:${member.userId}`}
                        onChange={(newRole) => void handleChangeRole(member, newRole)}
                      />
                    ) : (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          background: member.role === 'owner' ? 'var(--warning-bg-soft)' : member.role === 'admin' ? 'var(--accent-bg)' : 'var(--bg-tertiary)',
                          color: member.role === 'owner' ? 'var(--warning)' : member.role === 'admin' ? 'var(--accent)' : 'var(--text-secondary)',
                        }}
                      >
                        {resolveRoleLabel(member.role)}
                      </span>
                    )}
                  </span>

                  {/* 加入时间 */}
                  <span style={{ color: 'var(--text-secondary, #71717a)' }}>
                    {member.joinedAt
                      ? new Date(member.joinedAt).toLocaleDateString('zh-CN')
                      : '-'}
                  </span>

                  {/* 操作 */}
                  {canManage && (
                    <span>
                      {canRemoveMember(member) ? (
                        <button
                          type="button"
                          disabled={actioningKey === `remove:${member.userId}`}
                          onClick={() => void handleRemoveMember(member)}
                          onMouseEnter={() => setHoveredRemoveKey(member.userId)}
                          onMouseLeave={() => setHoveredRemoveKey(null)}
                          style={{
                            background: hoveredRemoveKey === member.userId ? 'var(--danger-bg-soft)' : 'none',
                            border: `1px solid ${hoveredRemoveKey === member.userId ? 'var(--danger)' : 'var(--danger-border-soft)'}`,
                            borderRadius: '5px',
                            color: hoveredRemoveKey === member.userId ? 'var(--danger-hover)' : 'var(--danger)',
                            fontSize: '12px',
                            cursor: actioningKey === `remove:${member.userId}` ? 'not-allowed' : 'pointer',
                            padding: '3px 10px',
                            opacity: actioningKey === `remove:${member.userId}` ? 0.5 : 1,
                            transition: 'color 0.15s, border-color 0.15s, background 0.15s',
                          }}
                        >
                          {actioningKey === `remove:${member.userId}` ? '移除中' : '移除'}
                        </button>
                      ) : (
                        <span>-</span>
                      )}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* 分页 */}
          {showPagination && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '8px',
                marginTop: '12px',
                fontSize: '13px',
                color: 'var(--text-secondary, #71717a)',
              }}
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                onMouseEnter={() => { if (page > 1) setPrevPageHovered(true); }}
                onMouseLeave={() => setPrevPageHovered(false)}
                style={{
                  padding: '5px 10px',
                  border: '1px solid var(--border-default, #e4e4e7)',
                  borderRadius: '5px',
                  background: (prevPageHovered && page > 1) ? 'var(--bg-hover, #f4f4f5)' : 'transparent',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  color: page <= 1 ? 'var(--text-disabled)' : 'var(--text-primary)',
                  fontSize: '13px',
                  transition: 'background 0.15s',
                }}
              >
                上一页
              </button>
              <span>
                第 {page} / {totalPages} 页 · 共 {totalCount} 人
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                onMouseEnter={() => { if (page < totalPages) setNextPageHovered(true); }}
                onMouseLeave={() => setNextPageHovered(false)}
                style={{
                  padding: '5px 10px',
                  border: '1px solid var(--border-default, #e4e4e7)',
                  borderRadius: '5px',
                  background: (nextPageHovered && page < totalPages) ? 'var(--bg-hover, #f4f4f5)' : 'transparent',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  color: page >= totalPages ? 'var(--text-disabled)' : 'var(--text-primary)',
                  fontSize: '13px',
                  transition: 'background 0.15s',
                }}
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}

      {/* 邀请弹窗 */}
      {canInvite && tenantId && (
        <InviteMemberModal
          isOpen={inviteOpen}
          tenantId={tenantId}
          onClose={() => {
            setInviteOpen(false);
            void loadMembers();
          }}
        />
      )}
    </div>
  );
};

// ── 子 Tab 类型 ──

type SpaceSubTab = 'workspace' | 'members';

function resolveSubTab(subTab: string | null): SpaceSubTab {
  return subTab === 'members' ? 'members' : 'workspace';
}

// ── 主组件 ──

const SpaceManagement: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSubTab = resolveSubTab(searchParams.get('subTab'));
  const [hoveredTab, setHoveredTab] = useState<SpaceSubTab | null>(null);

  const handleSubTabChange = (subTab: SpaceSubTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('subTab', subTab);
    setSearchParams(next, { replace: true });
  };

  return (
    <div style={{ padding: '28px 32px 24px' }} data-testid="space-management-page">
      {/* 页面标题 */}
      <h2
        data-testid="space-management-header"
        style={{
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--text-primary, #18181b)',
          margin: '0 0 20px',
        }}
      >
        空间管理
      </h2>

      {/* Sub Tab 导航 */}
      <div
        data-testid="space-management-tabs"
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-subtle, #f0f0f0)',
          marginBottom: '24px',
        }}
      >
        <button
          type="button"
          style={tabBtnStyle(activeSubTab === 'workspace', hoveredTab === 'workspace')}
          onMouseEnter={() => setHoveredTab('workspace')}
          onMouseLeave={() => setHoveredTab(null)}
          onClick={() => handleSubTabChange('workspace')}
        >
          空间信息
        </button>
        <button
          type="button"
          style={tabBtnStyle(activeSubTab === 'members', hoveredTab === 'members')}
          onMouseEnter={() => setHoveredTab('members')}
          onMouseLeave={() => setHoveredTab(null)}
          onClick={() => handleSubTabChange('members')}
        >
          成员管理
        </button>
      </div>

      {/* 内容区 */}
      {activeSubTab === 'workspace' && <WorkspaceInfoTab />}
      {activeSubTab === 'members' && <TeamMembersTab />}
    </div>
  );
};

export default SpaceManagement;
