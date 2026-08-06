/**
 * 个人设置弹窗。
 *
 * 业务含义：
 * - 承载"个人信息"与"切换空间"两个 Tab；
 * - 尺寸 620×520，左侧 130px Tab 导航 + 右侧内容区；
 * - 资产/用量/空间管理等功能已移至 /admin 管理后台；
 * - 不负责 Guard 逻辑，由调用方的 SettingsOverlayRoute 保证认证状态。
 *
 * 关键逻辑来源（V1 搬运）：
 * - 个人信息 Tab：src/pages/me/ProfileSettingsPanel.tsx
 * - 切换空间 Tab：src/components/sidebar/Sidebar.tsx（Popover 工作区列表逻辑）
 * - 头像上传：src/pages/me/avatarUpload.ts
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { platformAuthApi } from '../../api/platformAuth';

import { resolveWorkspacePlanLabelKey, resolveWorkspaceStatusLabelKey } from '../../api/platformTenant';
import { useAuthStore } from '../../stores/authStore';
import { isFeishuUser, useTenantStore } from '../../stores/tenantStore';
import { ChangePasswordModal } from '../../components/modals/ChangePasswordModal';
import { LogoutConfirmDialog } from '../../components/common/LogoutConfirmDialog';
import {
  AVATAR_FILE_ACCEPT,
  AvatarUploadClientError,
  mapAvatarErrorMessageKey,
  prepareAvatarUploadFile,
} from './avatarUpload';

// ── 类型 ──

export type SettingsInitialTab = 'profile' | 'spaces';

interface SettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsInitialTab;
  /** 保留签名兼容旧 App.tsx 调用（废弃字段，值会被忽略）*/
  initialAssetFilterType?: string;
  onOpenAdmin?: () => void;
}

// ── 尺寸常量 ──
const MODAL_WIDTH = 620;
const MODAL_HEIGHT = 530;
const SIDEBAR_WIDTH = 130;

const NICKNAME_MAX_LENGTH = 50;
// CAS 单点登录过渡期：本地邮箱/密码账号能力保留代码与接口，仅在个人设置里临时不展示。
const SHOW_LOCAL_ACCOUNT_PROFILE_FIELDS = false;

// ── 工具函数 ──

function getAvatarFallbackText(nickname?: string | null): string {
  if (!nickname?.trim()) return '?';
  return nickname.trim().slice(0, 2).toUpperCase();
}

// ── 图标 ──

const CloseIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CameraIcon: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted, #7a7a7a)" strokeWidth="2">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

// ── 样式辅助（对齐原型 .pf 类） ──

/** 字段容器：上下留白 + 下边框 */
const pfStyle: React.CSSProperties = {
  padding: '10px 0',
  borderBottom: '1px solid var(--border-subtle, #f0f0f0)',
};

/** 字段标签：在值的上方，小字号浅色 */
const pfLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--text-muted, #7a7a7a)',
  marginBottom: '3px',
};

/** 字段值 */
const pfValueStyle: React.CSSProperties = {
  fontSize: '14px',
  color: 'var(--text-primary, #18181b)',
  fontWeight: 500,
};

/** 操作链接（修改、复制等） */
const formActStyle: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--text-muted, #7a7a7a)',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'color 0.12s',
  background: 'none',
  border: 'none',
  padding: 0,
};

/** formAct 按钮统一 hover：颜色加深 */
const formActHover = {
  onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.color = 'var(--text-primary, #18181b)'; },
  onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.color = 'var(--text-muted, #7a7a7a)'; },
};

const feedbackBaseStyle: React.CSSProperties = {
  fontSize: '12px',
  padding: '4px 0',
};

// ── 个人信息 Tab ──

const ProfileTab: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const logout = useAuthStore((s) => s.logout);

  // 昵称 inline 编辑
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [nicknameSuccess, setNicknameSuccess] = useState<string | null>(null);
  const nicknameInputRef = useRef<HTMLInputElement>(null);

  // 头像
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);

  // 修改密码弹窗
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  // 退出登录确认弹窗
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    setNickname(user?.nickname ?? '');
  }, [user?.nickname]);

  useEffect(() => {
    if (editingNickname) {
      nicknameInputRef.current?.focus();
    }
  }, [editingNickname]);

  const nicknameValidationError =
    nickname.trim().length > NICKNAME_MAX_LENGTH ? `昵称不超过 ${NICKNAME_MAX_LENGTH} 个字符` : null;

  const handleNicknameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextNickname = nickname.trim();
    if (!nextNickname) {
      setNicknameError('昵称不能为空');
      return;
    }
    if (nicknameValidationError) {
      setNicknameError(null);
      return;
    }
    if (nextNickname === user?.nickname) {
      setEditingNickname(false);
      return;
    }
    setNicknameSaving(true);
    setNicknameError(null);
    setNicknameSuccess(null);
    try {
      await platformAuthApi.updateProfile({ nickname: nextNickname });
      updateUser({ nickname: nextNickname });
      setEditingNickname(false);
      setNicknameSuccess('昵称已更新');
    } catch (error: unknown) {
      setNicknameError((error as Error)?.message ?? '保存失败，请重试');
    } finally {
      setNicknameSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    setAvatarSaving(true);
    setAvatarError(null);
    setAvatarSuccess(null);
    try {
      const preparedFile = await prepareAvatarUploadFile(file);
      const response = await platformAuthApi.uploadAvatar(preparedFile);
      updateUser({ avatar_url: response.avatar });
      setAvatarSuccess('头像已更新');
    } catch (error: unknown) {
      if (error instanceof AvatarUploadClientError) {
        setAvatarError(mapAvatarErrorMessageKey(error.messageKey));
      } else if ((error as { status?: number })?.status === 413) {
        setAvatarError('图片过大，最大支持 5MB');
      } else {
        setAvatarError('头像更新失败，请重试');
      }
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleAvatarSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = AVATAR_FILE_ACCEPT;
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void handleAvatarUpload(file);
    };
    input.click();
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = async () => {
    setShowLogoutConfirm(false);
    await logout({ casRedirect: true, redirect: '/' });
  };

  const handleForgotPassword = () => {
    navigate('/forgot-password', { replace: true });
    clearAuth();
  };

  const nicknameBtnDisabled =
    nicknameSaving ||
    !nickname.trim() ||
    nicknameValidationError !== null ||
    nickname.trim() === user?.nickname;

  return (
    <div>
      {/* 头像 + 姓名 + 邮箱 头部卡片 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          paddingBottom: '14px',
          borderBottom: '1px solid var(--border-subtle, #f0f0f0)',
        }}
      >
        <div
          style={{
            position: 'relative',
            cursor: avatarSaving ? 'not-allowed' : 'pointer',
            flexShrink: 0,
          }}
          onClick={!avatarSaving ? handleAvatarSelect : undefined}
          title="修改头像"
        >
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt="头像"
              style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'var(--user-avatar-bg, #E4E4E7)',
                color: 'var(--user-avatar-text, #3F3F46)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 600,
              }}
            >
              {getAvatarFallbackText(user?.nickname || user?.passport_username)}
            </div>
          )}
          {/* 相机角标 */}
          <div
            style={{
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: 'var(--bg-secondary, #fff)',
              border: '1px solid var(--border-subtle, #e4e4e7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CameraIcon />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary, #18181b)' }} data-testid="settings-profile-name">
            {user?.nickname || user?.passport_username || '-'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted, #7a7a7a)', marginTop: '2px' }} data-testid="settings-profile-email">
            {user?.email || ''}
          </div>
        </div>
        {avatarSaving && (
          <span style={{ fontSize: '12px', color: 'var(--text-secondary, #71717a)' }}>上传中...</span>
        )}
      </div>
      {avatarError && <div style={{ ...feedbackBaseStyle, color: 'var(--danger)' }}>{avatarError}</div>}
      {avatarSuccess && <div style={{ ...feedbackBaseStyle, color: 'var(--success)' }}>{avatarSuccess}</div>}

      {/* 昵称 */}
      <div style={pfStyle}>
        {editingNickname ? (
          <>
            <div style={pfLabelStyle}>昵称</div>
            <form
              onSubmit={(e) => void handleNicknameSubmit(e)}
              style={{ display: 'flex', gap: '8px', marginTop: '4px' }}
            >
              <input
                ref={nicknameInputRef}
                type="text"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setNicknameError(null);
                }}
                disabled={nicknameSaving}
                maxLength={NICKNAME_MAX_LENGTH + 5}
                placeholder="请输入昵称"
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  border: '1px solid var(--input-border, #e4e4e7)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: 'var(--text-primary, #18181b)',
                  background: 'var(--input-bg, #fff)',
                  outline: 'none',
                }}
                data-testid="settings-profile-nickname-input"
              />
              <button
                type="submit"
                disabled={nicknameBtnDisabled}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: nicknameBtnDisabled ? 'var(--btn-mono-disabled-bg)' : 'var(--btn-mono-bg)',
                  color: nicknameBtnDisabled ? 'var(--btn-mono-disabled-text)' : 'var(--btn-mono-text)',
                  cursor: nicknameBtnDisabled ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                }}
              >
                {nicknameSaving ? '保存中' : '保存'}
              </button>
              <button
                type="button"
                disabled={nicknameSaving}
                onClick={() => {
                  setEditingNickname(false);
                  setNickname(user?.nickname ?? '');
                  setNicknameError(null);
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  border: '1px solid var(--border-subtle, #e4e4e7)',
                  borderRadius: '8px',
                  background: 'var(--bg-secondary, #fff)',
                  color: 'var(--text-secondary, #71717a)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                取消
              </button>
            </form>
            {(nicknameValidationError ?? nicknameError) && (
              <div style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '4px' }}>
                {nicknameValidationError ?? nicknameError}
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={pfLabelStyle}>昵称</div>
              <div style={pfValueStyle} data-testid="settings-profile-nickname">{user?.nickname ?? '-'}</div>
            </div>
            <button
              type="button"
              style={formActStyle}
              {...formActHover}
              onClick={() => {
                setEditingNickname(true);
                setNicknameError(null);
                setNicknameSuccess(null);
              }}
            >
              修改
            </button>
          </div>
        )}
      </div>
      {nicknameSuccess && <div style={{ ...feedbackBaseStyle, color: 'var(--success)' }}>{nicknameSuccess}</div>}

      {/* 用户 ID */}
      <div style={pfStyle}>
        <div style={pfLabelStyle}>用户 ID</div>
        <div style={{ ...pfValueStyle, fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary, #71717a)' }} data-testid="settings-profile-user-id">
          {user?.id ?? '-'}
        </div>
      </div>

      {/* 帆软通行证用户名 */}
      {user?.passport_username && (
        <div style={pfStyle}>
          <div style={pfLabelStyle}>帆软通行证用户名</div>
          <div style={pfValueStyle} data-testid="settings-profile-passport-username">{user.passport_username}</div>
        </div>
      )}

      {/* 手机号 */}
      <div style={pfStyle}>
        <div style={pfLabelStyle}>手机号</div>
        <div style={pfValueStyle}>{user?.phone || '未绑定'}</div>
      </div>

      {/* 登录密码 */}
      {SHOW_LOCAL_ACCOUNT_PROFILE_FIELDS && (
        <div style={{ ...pfStyle, borderBottom: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={pfLabelStyle}>登录密码</div>
            <div style={{ ...pfValueStyle, fontFamily: 'monospace', letterSpacing: '2px' }}>••••••••</div>
          </div>
          <button type="button" style={formActStyle} {...formActHover} onClick={() => setPasswordModalOpen(true)}>
            修改密码
          </button>
        </div>
      )}

      {/* 退出登录 */}
      <div style={{ paddingTop: '14px', marginTop: '4px' }}>
        <button
          type="button"
          onClick={handleLogout}
          style={{
            padding: '7px 16px',
            borderRadius: '8px',
            border: '1px solid var(--danger-border-soft)',
            background: 'var(--danger-bg-soft)',
            color: 'var(--danger)',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.12s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--danger-bg-soft)'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--danger-bg-soft)'; e.currentTarget.style.borderColor = 'var(--danger-border-soft)'; }}
        >
          退出登录
        </button>
      </div>

      {/* 修改密码弹窗 */}
      {SHOW_LOCAL_ACCOUNT_PROFILE_FIELDS && (
        <ChangePasswordModal isOpen={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />
      )}

      {/* 隐藏"忘记密码"入口（从 ChangePasswordModal 里触发，此处保留供独立访问场景） */}
      {SHOW_LOCAL_ACCOUNT_PROFILE_FIELDS && <div style={{ display: 'none' }}>
        <button type="button" onClick={handleForgotPassword}>忘记密码</button>
      </div>}

      <LogoutConfirmDialog
        open={showLogoutConfirm}
        onConfirm={handleLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
};

// ── 切换空间 Tab ──

const SpacesTab: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const navigate = useNavigate();
  const workspaces = useTenantStore((s) => s.workspaces);
  const currentWorkspace = useTenantStore((s) => s.currentWorkspace);
  const selectWorkspace = useTenantStore((s) => s.selectWorkspace);
  const refreshWorkspaces = useTenantStore((s) => s.refreshWorkspaces);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  // 打开 SpacesTab 时从服务端刷新列表，确保被移除的空间不再展示
  useEffect(() => {
    void refreshWorkspaces().catch(() => {});
  }, [refreshWorkspaces]);

  const ownedSpaces = workspaces.filter((w) => w.role === 'owner');
  const joinedSpaces = workspaces.filter((w) => w.role !== 'owner');
  const feishuChannelUser = isFeishuUser(workspaces);

  const handleSelect = async (tenantId: string) => {
    if (tenantId === currentWorkspace?.tenantId) {
      onClose();
      return;
    }
    setSwitchingId(tenantId);
    try {
      await selectWorkspace(tenantId);
      onClose();
    } finally {
      setSwitchingId(null);
    }
  };

  const renderSpaceCard = (ws: typeof workspaces[0]) => {
    const isActive = ws.tenantId === currentWorkspace?.tenantId;
    const isSwitching = switchingId === ws.tenantId;
    const planLabelKey = resolveWorkspacePlanLabelKey(ws.planType);
    const statusLabelKey = resolveWorkspaceStatusLabelKey(ws.planStatus);
    const planLabel = planLabelKey === 'tenant.planType.official' ? '正式版' : '试用版';
    const statusLabel =
      statusLabelKey === 'tenant.planStatus.expired'
        ? '已过期'
        : statusLabelKey === 'tenant.planStatus.exhausted'
        ? '已耗尽'
        : null;

    return (
      <div
        key={ws.tenantId}
        onClick={() => !isSwitching && void handleSelect(ws.tenantId)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 12px',
          borderRadius: '10px',
          border: isActive ? '1px solid var(--border-subtle)' : '1px solid transparent',
          background: isActive ? 'var(--hover-bg-strong)' : 'transparent',
          cursor: isSwitching ? 'not-allowed' : 'pointer',
          marginBottom: '5px',
          opacity: isSwitching ? 0.6 : 1,
          transition: 'all 0.12s',
        }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--hover-bg, rgba(0,0,0,0.04))'; }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
      >
        {/* 空间图标 */}
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          style={{ color: 'var(--text-muted, #7a7a7a)', flexShrink: 0 }}
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>

        {/* 名称 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-primary, #18181b)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {ws.name}
          </div>
        </div>

        {/* 版本标签 */}
        <span
          style={{
            fontSize: '11px',
            padding: '2px 7px',
            borderRadius: '4px',
            background:
              ws.planType === 'official'
                ? 'var(--accent-bg)'
                : 'var(--warning-bg-soft)',
            color: ws.planType === 'official' ? 'var(--accent)' : 'var(--warning)',
            flexShrink: 0,
          }}
        >
          {planLabel}
        </span>

        {/* 状态标签（仅异常时显示） */}
        {statusLabel && (
          <span
            style={{
              fontSize: '11px',
              padding: '2px 7px',
              borderRadius: '4px',
              background: statusLabelKey === 'tenant.planStatus.expired' ? 'var(--danger-bg-soft)' : 'var(--warning-bg-soft)',
              color: statusLabelKey === 'tenant.planStatus.expired' ? 'var(--danger)' : 'var(--warning)',
              flexShrink: 0,
            }}
          >
            {statusLabel}
          </span>
        )}

        {/* Radio（右侧） */}
        <div
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            border: `2px solid ${isActive ? 'var(--accent, #2563eb)' : 'var(--border-subtle, #e4e4e7)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isActive && (
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: 'var(--accent, #2563eb)',
              }}
            />
          )}
        </div>

        {isSwitching && (
          <span style={{ fontSize: '12px', color: 'var(--text-secondary, #71717a)' }}>切换中...</span>
        )}
      </div>
    );
  };

  return (
    <div>
      {workspaces.length === 0 && (
        <div
          style={{
            padding: '32px 0',
            textAlign: 'center',
            color: 'var(--text-secondary, #71717a)',
            fontSize: '14px',
          }}
        >
          暂无工作空间
        </div>
      )}

      {ownedSpaces.length > 0 && (
        <div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #7a7a7a)', marginBottom: '8px' }}>
            我创建的
          </div>
          {ownedSpaces.map(renderSpaceCard)}
        </div>
      )}

      {joinedSpaces.length > 0 && (
        <div style={{ marginTop: ownedSpaces.length > 0 ? '16px' : 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #7a7a7a)', marginBottom: '8px' }}>
            我加入的
          </div>
          {joinedSpaces.map(renderSpaceCard)}
        </div>
      )}

      {/* 底部：加入/创建企业空间 */}
      {!feishuChannelUser && (
      <div style={{ borderTop: '1px solid var(--border-subtle, #f0f0f0)', paddingTop: '14px', marginTop: '8px' }}>
        <button
          type="button"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent, #2563eb)',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 0',
            transition: 'all 0.12s',
          }}
          onClick={() => { onClose(); navigate('/workspace/join'); }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-hover, #1d4ed8)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--accent, #2563eb)'; }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 2l-4 5-4-5" />
          </svg>
          加入企业空间
        </button>
        {ownedSpaces.length === 0 && (
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent, #2563eb)',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 0',
              marginTop: '8px',
              transition: 'all 0.12s',
            }}
            onClick={() => { onClose(); navigate('/workspace/create'); }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-hover, #1d4ed8)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--accent, #2563eb)'; }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            创建企业空间
          </button>
        )}
      </div>
      )}
    </div>
  );
};

// ── Tab 配置 ──

const TAB_CONFIG: Array<{
  id: SettingsInitialTab;
  label: string;
}> = [
  { id: 'profile', label: '个人信息' },
  { id: 'spaces', label: '切换空间' },
];

// ========== 主组件 ==========

export const SettingsPage: React.FC<SettingsPageProps> = ({
  isOpen,
  onClose,
  initialTab = 'profile',
  // initialAssetFilterType 保留签名但忽略值（已移至管理后台）
}) => {
  // 收窄 initialTab：若传入了旧值（assets/agents/usage 等），回退到 profile
  const resolvedInitialTab: SettingsInitialTab =
    initialTab === 'profile' || initialTab === 'spaces' ? initialTab : 'profile';

  const [activeTab, setActiveTab] = useState<SettingsInitialTab>(resolvedInitialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(resolvedInitialTab);
    }
  }, [isOpen, resolvedInitialTab]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'var(--modal-backdrop, rgba(0,0,0,0.4))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: MODAL_WIDTH,
          height: MODAL_HEIGHT,
          background: 'var(--modal-bg, var(--bg-primary, #fff))',
          borderRadius: '16px',
          border: '1px solid var(--modal-border, #e4e4e7)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="个人设置"
      >
        {/* 顶部标题栏 — 横跨整个弹窗 */}
        <div
          style={{
            padding: '16px 20px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--text-primary, #18181b)',
              margin: 0,
            }}
          >
            个人设置
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted, #7a7a7a)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.12s',
            }}
            aria-label="关闭"
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg, rgba(0,0,0,0.04))'; e.currentTarget.style.color = 'var(--text-primary, #18181b)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted, #7a7a7a)'; }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* 内容区域 */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', marginTop: '14px' }}>
          {/* 侧边导航 */}
          <div
            style={{
              width: SIDEBAR_WIDTH,
              flexShrink: 0,
              borderRight: '1px solid var(--border-subtle, #f4f4f5)',
              padding: '4px 8px',
            }}
          >
            {TAB_CONFIG.map((tab) => (
              <div
                key={tab.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveTab(tab.id);
                  }
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color:
                    activeTab === tab.id
                      ? 'var(--text-primary, #18181b)'
                      : 'var(--text-secondary, #71717a)',
                  cursor: 'pointer',
                  marginBottom: '2px',
                  transition: 'all 0.12s',
                  background:
                    activeTab === tab.id
                      ? 'var(--hover-bg-strong, rgba(0,0,0,0.06))'
                      : 'transparent',
                  fontWeight: activeTab === tab.id ? 500 : 400,
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.background = 'var(--hover-bg, rgba(0,0,0,0.04))';
                    e.currentTarget.style.color = 'var(--text-primary, #18181b)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary, #71717a)';
                  }
                }}
              >
                {tab.label}
              </div>
            ))}
          </div>

          {/* 内容面板 */}
          <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto' }}>
            {activeTab === 'profile' && <ProfileTab />}
            {activeTab === 'spaces' && <SpacesTab onClose={onClose} />}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default SettingsPage;
