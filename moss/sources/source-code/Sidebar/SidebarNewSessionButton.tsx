import React from 'react';
import { SidebarIcon } from './icons/SidebarIcon';

interface SidebarNewSessionButtonProps {
  disabled: boolean;
  isActive: boolean;
  onNewSession: () => void;
}

export const SidebarNewSessionButton: React.FC<SidebarNewSessionButtonProps> = ({
  disabled,
  isActive,
  onNewSession,
}) => (
  <button
    data-sidebar-entry="new-session"
    data-testid="sidebar-entry-new-session"
    onClick={onNewSession}
    disabled={disabled}
    style={{
      display: 'flex', alignItems: 'center', gap: 8,
      width: 'calc(100% - 24px)', margin: '0 12px',
      height: 36,
      padding: '7px 12px',
      background: isActive ? 'var(--moss-sidebar-new-session-bg)' : 'transparent',
      border: 'none',
      borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: 14,
      lineHeight: '22px',
      fontWeight: isActive ? 600 : 400,
      color: disabled
        ? 'var(--moss-sidebar-item-disabled-fg)'
        : 'var(--moss-sidebar-new-session-fg)',
      textAlign: 'left',
      opacity: disabled ? 0.6 : 1,
    }}
    title={disabled ? '额度不足，无法新建会话' : undefined}
    onMouseEnter={e => { if (!disabled && !isActive) e.currentTarget.style.background = 'var(--moss-sidebar-new-session-hover-bg)'; }}
    onMouseLeave={e => { e.currentTarget.style.background = isActive ? 'var(--moss-sidebar-new-session-bg)' : 'transparent'; }}
  >
    <SidebarIcon name="new-session" size={16} />
    <span>新会话</span>
  </button>
);

export default SidebarNewSessionButton;
