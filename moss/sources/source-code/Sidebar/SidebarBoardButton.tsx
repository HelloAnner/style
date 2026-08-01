import React from 'react';
import { track } from '../../utils/track';
import { SidebarIcon } from './icons/SidebarIcon';

interface SidebarBoardButtonProps {
  isActive: boolean;
  onOpenBoard: () => void;
}

export const SidebarBoardButton: React.FC<SidebarBoardButtonProps> = ({
  isActive,
  onOpenBoard,
}) => (
  <button
    data-sidebar-entry="board"
    data-testid="sidebar-entry-board"
    onClick={() => {
      track('board_entry');
      onOpenBoard();
    }}
    style={{
      display: 'flex', alignItems: 'center', gap: 8,
      width: 'calc(100% - 16px)', margin: '0 8px',
      height: 36,
      padding: '7px 12px',
      background: isActive ? 'var(--moss-sidebar-item-active-bg)' : 'transparent',
      border: 'none',
      borderRadius: 8,
      cursor: 'pointer',
      fontSize: 14,
      lineHeight: '22px',
      fontWeight: isActive ? 600 : 400,
      color: 'var(--moss-sidebar-text-primary)',
      textAlign: 'left',
    }}
    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--moss-sidebar-item-hover-bg)'; }}
    onMouseLeave={e => { e.currentTarget.style.background = isActive ? 'var(--moss-sidebar-item-active-bg)' : 'transparent'; }}
  >
    <SidebarIcon name="board" size={16} />
    <span>看板</span>
  </button>
);

export default SidebarBoardButton;
