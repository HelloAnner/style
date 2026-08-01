/**
 * 用户 Popover 菜单组件
 *
 * 聚合个人信息、当前工作区（点击打开 spaces 设置）、设置入口、管理后台入口、退出登录。
 * 从 V1 fineinsight Sidebar.tsx 的 profilePopoverContent 逻辑移植，UI 按 V2 原型重写。
 *
 * 包含：
 * - 用户头像 + 昵称（fallback email）
 * - 当前工作区入口（版本标签 + 点击打开 spaces 设置）
 * - 个人设置菜单项
 * - 管理后台菜单项
 * - 帮助文档入口（仅展示，暂不绑定交互）
 * - 退出登录
 *
 * 标签颜色用内联 style const 集合管理（无需引入新 CSS 文件）。
 */

import React, { KeyboardEvent, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { usePermission } from '../../hooks/usePermission';
import { track } from '../../utils/track';
import { resolveWorkspacePlanLabelKey } from '../../api/platformTenant';
import { getAvatarFallbackText, AVATAR_FALLBACK_BG, AVATAR_FALLBACK_COLOR } from '../../utils/avatarUtils';
import { LogoutConfirmDialog } from '../common/LogoutConfirmDialog';
import spaceIcon from '../../assets/icons/user-popover/space.svg';
import chevronRightIcon from '../../assets/icons/user-popover/chevron-right.svg';
import profileIcon from '../../assets/icons/user-popover/profile.svg';
import adminIcon from '../../assets/icons/user-popover/admin.svg';
import helpIcon from '../../assets/icons/user-popover/help.svg';
import logoutIcon from '../../assets/icons/user-popover/logout.svg';

// ── 工作区标签 CSS class 映射（内联 styles 集合） ──

const TAG_STYLES = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 4px',
    borderRadius: 2,
    fontSize: 12,
    fontWeight: 400,
    lineHeight: '20px',
    flexShrink: 0 as const,
  },
  official: {
    background: 'var(--info-bg-soft, #f5faff)',
    color: 'var(--info, #2c60db)',
  },
  trial: {
    background: 'var(--info-bg-soft, #f5faff)',
    color: 'var(--info, #2c60db)',
  },
} as const;

function getPlanTagStyle(planType?: string | null): React.CSSProperties {
  const variant = planType === 'official' ? TAG_STYLES.official : TAG_STYLES.trial;
  return { ...TAG_STYLES.base, ...variant };
}

function maskEmail(email: string): string {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0) return trimmed;
  return `${trimmed.slice(0, 1)}***${trimmed.slice(atIndex)}`;
}

const panelStyle: React.CSSProperties = {
  width: 260,
  borderRadius: 8,
  background: 'var(--dropdown-bg, var(--fd-color-bg-elevated, #fff))',
  boxShadow: '0 0 4px rgba(9,30,64,0.05), 0 6px 16px -1px rgba(9,30,64,0.06), 0 6px 32px 8px rgba(9,30,64,0.04)',
  overflow: 'hidden',
};

const itemStyle: React.CSSProperties = {
  minHeight: 38,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  margin: '6px 6px',
  padding: '8px 12px',
  borderRadius: 8,
  cursor: 'pointer',
  transition: 'background 0.1s',
  color: 'var(--text-primary)',
};

const groupedFirstItemStyle: React.CSSProperties = {
  ...itemStyle,
  marginBottom: 0,
};

const groupedNextItemStyle: React.CSSProperties = {
  ...itemStyle,
  marginTop: 0,
};

const itemTextStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: 14,
  lineHeight: '22px',
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const dividerStyle: React.CSSProperties = {
  height: 0.5,
  background: 'var(--border-subtle, var(--fd-color-border-secondary, #e6e9ef))',
  width: '100%',
};

const popoverIconStyle: React.CSSProperties = {
  display: 'block',
  width: 16,
  height: 16,
  flexShrink: 0,
};

const HELP_DOC_URL = 'https://docs.mossdo.com/';

export interface UserPopoverProps {
  /** 点击打开设置弹窗，传入初始 Tab */
  onOpenSettings?: (tab: 'profile' | 'spaces') => void;
  /** 关闭 Popover 回调 */
  onClose: () => void;
}

// ── 主组件 ──

/**
 * 用户 Popover：展开态侧边栏底部的个人菜单。
 * 包含工作区入口（点击打开 spaces 设置）、个人设置、管理后台（管理员）、退出登录。
 */
export const UserPopover: React.FC<UserPopoverProps> = ({ onOpenSettings, onClose }) => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const currentWorkspace = useTenantStore((s) => s.currentWorkspace);
  const { isAdmin } = usePermission();

  const userDisplayName = user?.nickname?.trim() || user?.passport_username || user?.email?.split('@')[0] || '用户';
  const userEmail = user?.email ?? '';
  const maskedEmail = userEmail ? maskEmail(userEmail) : '';
  const avatarText = useMemo(() => getAvatarFallbackText(user?.nickname || user?.passport_username), [user?.nickname, user?.passport_username]);

  // 当前工作区计划标签文字
  const currentPlanLabel = currentWorkspace
    ? resolveWorkspacePlanLabelKey(currentWorkspace.planType)
    : null;
  // 键盘辅助：Enter / Space 触发操作
  const handleKeyAction = useCallback(
    (event: KeyboardEvent<HTMLElement>, onAction: () => void) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onAction();
    },
    []
  );

  const handleOpenSettings = useCallback(
    (tab: 'profile' | 'spaces') => {
      track('user_menu', { sub_event: tab === 'spaces' ? 'tenant_name' : 'personal_settings' });
      onClose();
      onOpenSettings?.(tab);
    },
    [onClose, onOpenSettings]
  );

  const handleOpenAdmin = useCallback(() => {
    track('user_menu', { sub_event: 'admin' });
    onClose();
    navigate('/admin');
  }, [navigate, onClose]);

  const handleOpenHelpDoc = useCallback(() => {
    track('user_menu', { sub_event: 'help_doc' });
    onClose();
    window.open(HELP_DOC_URL, '_blank', 'noopener,noreferrer');
  }, [onClose]);

  const handleLogout = useCallback(() => {
    track('user_menu', { sub_event: 'logout' });
    setShowLogoutConfirm(true);
  }, []);

  const handleLogoutConfirm = useCallback(async () => {
    setShowLogoutConfirm(false);
    onClose();
    await logout({ casRedirect: true, redirect: '/' });
  }, [logout, onClose]);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // ── 渲染 ──

  return (
    <div
      style={panelStyle}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── 用户头像 + 昵称 + 邮箱 ── */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 32, height: 32, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            background: AVATAR_FALLBACK_BG,
            color: AVATAR_FALLBACK_COLOR,
            fontSize: 13, fontWeight: 500,
          }}
        >
          {avatarText}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14, lineHeight: '22px', fontWeight: 400, color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
            title={userDisplayName}
            data-testid="user-popover-name"
          >
            {userDisplayName}
          </div>
          {maskedEmail && (
            <div
              style={{
                fontSize: 12, lineHeight: '20px', color: 'var(--text-quaternary, var(--text-muted))',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
              title={userEmail}
              data-testid="user-popover-email"
            >
              {maskedEmail}
            </div>
          )}
        </div>
      </div>

      {/* 分隔线 */}
      <div style={dividerStyle} />

      {/* ── 当前工作区入口（点击打开 spaces 设置） ── */}
      {currentWorkspace && (
        <div
          role="button"
          tabIndex={0}
          aria-label="管理工作区"
          style={itemStyle}
          onClick={() => handleOpenSettings('spaces')}
          onKeyDown={(e) => handleKeyAction(e, () => handleOpenSettings('spaces'))}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <img src={spaceIcon} alt="" aria-hidden="true" style={popoverIconStyle} />
          <span style={itemTextStyle}>
            {currentWorkspace.name}
          </span>
          {currentPlanLabel && (
            <span style={getPlanTagStyle(currentWorkspace.planType)}>
              {currentPlanLabel === 'tenant.planType.official' ? '正式版' : '试用版'}
            </span>
          )}
          <img src={chevronRightIcon} alt="" aria-hidden="true" style={popoverIconStyle} />
        </div>
      )}

      {/* 分隔线 */}
      <div style={dividerStyle} />

      {/* ── 菜单项 ── */}
      <div
        role="button"
        tabIndex={0}
        aria-label="个人设置"
        style={isAdmin ? groupedFirstItemStyle : itemStyle}
        onClick={() => handleOpenSettings('profile')}
        onKeyDown={(e) => handleKeyAction(e, () => handleOpenSettings('profile'))}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <img src={profileIcon} alt="" aria-hidden="true" style={popoverIconStyle} />
        <span style={itemTextStyle}>个人设置</span>
      </div>

      {/* 管理后台（仅 admin） */}
      {isAdmin && (
        <div
          role="button"
          tabIndex={0}
          aria-label="管理后台"
          style={groupedNextItemStyle}
          onClick={handleOpenAdmin}
          onKeyDown={(e) => handleKeyAction(e, handleOpenAdmin)}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <img src={adminIcon} alt="" aria-hidden="true" style={popoverIconStyle} />
          <span style={itemTextStyle}>管理后台</span>
        </div>
      )}

      <div style={dividerStyle} />

      {/* 帮助文档 */}
      <div
        role="button"
        tabIndex={0}
        aria-label="帮助文档"
        style={itemStyle}
        onClick={handleOpenHelpDoc}
        onKeyDown={(e) => handleKeyAction(e, handleOpenHelpDoc)}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        data-testid="user-popover-help"
      >
        <img src={helpIcon} alt="" aria-hidden="true" style={popoverIconStyle} />
        <span style={itemTextStyle}>帮助文档</span>
      </div>

      <div style={dividerStyle} />

      {/* 退出登录 */}
      <div
        role="button"
        tabIndex={0}
        aria-label="退出登录"
        style={itemStyle}
        onClick={handleLogout}
        onKeyDown={(e) => handleKeyAction(e, handleLogout)}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <img src={logoutIcon} alt="" aria-hidden="true" style={popoverIconStyle} />
        <span style={itemTextStyle}>退出登录</span>
      </div>
      <LogoutConfirmDialog
        open={showLogoutConfirm}
        onConfirm={handleLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
};

export default UserPopover;
